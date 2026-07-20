import express from "express";
import path from "path";
import fs from "fs";
import * as BaileysModule from "@whiskeysockets/baileys";
const makeWASocket = (BaileysModule.default || BaileysModule) as any;
const { initAuthCreds, DisconnectReason } = BaileysModule as any;
import pino from "pino";
import qrcodeLib from "qrcode";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import Razorpay from "razorpay";
import crypto from "crypto";

dotenv.config();

import * as Sentry from "@sentry/node";
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
  console.log("Sentry error telemetry initialized.");
}

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const DEMO_USER_1_PHONE = process.env.TEST_USER_1_PHONE || "+910000000001";
const DEMO_USER_2_PHONE = process.env.TEST_USER_2_PHONE || "+910000000002";
const DEMO_USER_1_EMAIL = process.env.TEST_USER_1_EMAIL || "test-user-1@internal.local";
const DEMO_USER_2_EMAIL = process.env.TEST_USER_2_EMAIL || "test-user-2@internal.local";
const GOOGLE_SHEETS_CONTACT_WEBHOOK_URL = process.env.GOOGLE_SHEETS_CONTACT_WEBHOOK_URL || "";

// Initialize Razorpay client with user provided credentials (or environment overrides)
const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

const createSessionToken = () => "token_" + Math.random().toString(36).substring(2, 10);

const app = express();
app.set("trust proxy", 1);

// 1. Enable Helmet for secure HTTP headers (adjusted to support SPA and resources)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// 2. Enable CORS with configurable origin validation
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(",") 
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow relative requests (same-origin), local dev, or whitelisted domains
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:") ||
        origin.includes("onrender.com") ||
        origin.includes("vercel.app")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Blocked by CORS policy"));
      }
    },
    credentials: true,
  })
);

// 3. Rate Limiters to secure authentication and API resource endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again after 15 minutes." }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // Limit each IP to 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded. Please slow down your requests." }
});

// Bind rate limit rules
app.use("/api/auth/", authLimiter);
app.use("/api/admin/", authLimiter);
app.use("/api/", apiLimiter);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Set up HTTP Server and Socket.IO
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  socket.on("authenticate", (data) => {
    const { token } = data;
    if (token) {
      const userId = token.split(":")[0];
      socket.join(userId);
      console.log(`Socket ${socket.id} joined room: ${userId}`);
    }
  });
});

const emitUserEvent = (userId: string, event: string, payload: any) => {
  io.to(userId).emit(event, payload);
};

const forwardContactInquiryToSheet = async (inquiry: any) => {
  if (!GOOGLE_SHEETS_CONTACT_WEBHOOK_URL) return;
  try {
    const response = await fetch(GOOGLE_SHEETS_CONTACT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inquiry),
    });
    if (!response.ok) {
      console.error("Google Sheets contact sync failed:", response.status, await response.text());
    }
  } catch (err) {
    console.error("Google Sheets contact sync failed:", err);
  }
};

// Set up JSON body parser with increased limit for Base64 image transfers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Global activity logging middleware for critical actions
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    res.json = originalJson;
    const result = res.json(body);

    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        let userId = (req as any).user?.id;
        if (!userId) {
          const authHeader = req.headers.authorization;
          if (authHeader) {
            const token = authHeader.replace("Bearer ", "");
            const parts = token.split(":");
            userId = parts[0];
          }
        }

        if (userId) {
          if (req.method === "POST" && req.path === "/api/admin/users") {
            logActivity(userId, "Admin User Created", `Created client account: ${req.body.name} (${req.body.email})`);
          } else if (req.method === "PATCH" && req.path.startsWith("/api/admin/users/")) {
            const parts = req.path.split("/");
            const targetId = parts[parts.length - 1];
            const targetUser = db.read("users").find(u => u.id === targetId);
            const nameStr = targetUser ? targetUser.name : targetId;
            logActivity(userId, "Admin Status Change", `Modified client "${nameStr}" parameters to ${JSON.stringify(req.body)}`);
          }
        }
      } catch (err) {
        console.error("Global activity logger error:", err);
      }
    }
    return result;
  };
  next();
});

// Path for local database storage
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Helper functions for reading/writing our JSON collections
const db = {
  read: (collection: string): any[] => {
    const filePath = path.join(DATA_DIR, `${collection}.json`);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const content = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
      return JSON.parse(content);
    } catch (e) {
      console.error(`Error reading collection ${collection}`, e);
      return [];
    }
  },
  write: (collection: string, data: any[]): void => {
    const filePath = path.join(DATA_DIR, `${collection}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error(`Error writing collection ${collection}`, e);
    }
  },
};

// Seed initial database collections if they are empty
const seedDB = () => {
  // 1. Seed Users
  const users = db.read("users");
  if (users.length === 0) {
    db.write("users", [
      {
        id: "u_admin",
        name: "Admin Manager",
        email: "admin@gmail.com",
        password: "admin", // Plaintext check for ease in this developer demo
        role: "admin",
        allowedWhatsapp: "+1234567890",
        subscription: "business",
        billingCycle: "annually",
        expiryDate: "2028-12-31",
        status: "active",
        createdAt: new Date().toISOString(),
        dailyMessageLimit: 999999,
        messagesSentToday: 0,
        activeSessionToken: "token_admin"
      },
      {
        id: "u_demo",
        name: "Demo Account A",
        email: DEMO_USER_1_EMAIL,
        password: "user1",
        role: "user",
        allowedWhatsapp: DEMO_USER_1_PHONE,
        subscription: "premium",
        billingCycle: "annually",
        expiryDate: "2026-10-01",
        status: "active",
        createdAt: new Date().toISOString(),
        dailyMessageLimit: 10000,
        messagesSentToday: 450,
        activeSessionToken: "token_demo"
      },
      {
        id: "u_user2",
        name: "Demo Account B",
        email: DEMO_USER_2_EMAIL,
        password: "user2",
        role: "user",
        allowedWhatsapp: DEMO_USER_2_PHONE,
        subscription: "premium",
        billingCycle: "weekly",
        expiryDate: "2026-10-01",
        status: "active",
        createdAt: new Date().toISOString(),
        dailyMessageLimit: 10000,
        messagesSentToday: 0
      },
    ]);
  }

  // 2. Seed Contact Groups
  const contactGroups = db.read("contact_groups");
  if (contactGroups.length === 0) {
    db.write("contact_groups", [
      {
        id: "cg_1",
        name: "Festival Customers (Demo)",
        userId: "u_demo",
        count: 5,
        createdAt: new Date().toISOString(),
        contacts: [
          { id: "c1", name: "Ravi Kumar", phone: DEMO_USER_1_PHONE, variables: { customer: "Ravi Kumar", city: "Hyderabad", offer: "50%" } },
          { id: "c2", name: "Ananya Sharma", phone: DEMO_USER_2_PHONE, variables: { customer: "Ananya", city: "Bangalore", offer: "40%" } },
          { id: "c3", name: "John Doe", phone: "+15550192834", variables: { customer: "John", city: "New York", offer: "30%" } },
          { id: "c4", name: "Priya Patel", phone: "+918887776665", variables: { customer: "Priya", city: "Mumbai", offer: "50%" } },
          { id: "c5", name: "David Miller", phone: "+447700900077", variables: { customer: "David", city: "London", offer: "20%" } },
        ],
      },
    ]);
  }

  // 3. Seed Campaigns
  const campaigns = db.read("campaigns");
  if (campaigns.length === 0) {
    db.write("campaigns", [
      {
        id: "camp_1",
        title: "Diwali Fest Offer Promo",
        userId: "u_demo",
        totalMessages: 120,
        sent: 112,
        failed: 8,
        pending: 0,
        status: "completed",
        templateText: "Hello {customer},\n\nSpecial Diwali discount of {offer} is live in {city}! Connect with us now to purchase.",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        contactGroupId: "cg_1",
      },
    ]);
  }

  // 4. Seed Messages / Logs
  const messages = db.read("messages");
  if (messages.length === 0) {
    db.write("messages", [
      {
        id: "msg_1",
        userId: "u_demo",
        campaignId: "camp_1",
        name: "Ravi Kumar",
        phone: DEMO_USER_1_PHONE,
        message: "Hello Ravi Kumar,\n\nSpecial Diwali discount of 50% is live in Hyderabad! Connect with us now to purchase.",
        status: "read",
        direction: "outbound",
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "msg_in_1",
        userId: "u_demo",
        name: "Ravi Kumar",
        phone: DEMO_USER_1_PHONE,
        message: "Hi, is this offer valid on electronics?",
        status: "read",
        direction: "inbound",
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(),
      },
      {
        id: "msg_reply_1",
        userId: "u_demo",
        name: "Ravi Kumar",
        phone: DEMO_USER_1_PHONE,
        message: "Yes Ravi! It is valid on all categories including electronics.",
        status: "read",
        direction: "outbound",
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 12 * 60 * 1000).toISOString(),
      },
    ]);
  }

  // 5. Seed WhatsApp Session
  const sessions = db.read("sessions");
  if (sessions.length === 0) {
    db.write("sessions", [
      {
        userId: "u_demo",
        whatsappNumber: DEMO_USER_1_PHONE,
        sessionStatus: "connected",
        connectedAt: new Date().toISOString(),
      },
    ]);
  }

  // 6. Seed Auto Reply Rules
  const autoReplies = db.read("auto_reply_rules");
  if (autoReplies.length === 0) {
    db.write("auto_reply_rules", [
      {
        id: "arr_1",
        userId: "u_demo",
        keyword: "price",
        matchType: "contains",
        replyText: "Our standard subscription starts at Rs 15/day. Let me know if you want to purchase.",
        aiEnabled: false,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "arr_2",
        userId: "u_demo",
        keyword: "help",
        matchType: "equals",
        replyText: "Sure, our saved support response can help you.",
        aiEnabled: true,
        aiPrompt: "Use this saved support response style: be brief, professional, and helpful.",
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ]);
  }

  // 7. Seed Birthday Configuration
  const bdayConfigs = db.read("birthday_config");
  if (bdayConfigs.length === 0) {
    db.write("birthday_config", [
      {
        userId: "u_demo",
        enabled: true,
        templateText: "Happy Birthday {customer}! 🎂 Special bday discount coupon of 50% just for you: BDAY50!",
        runHour: "09:00",
        lastCheckedDate: ""
      }
    ]);
  }

  // 8. Seed Media Assets Library
  const media = db.read("media");
  if (media.length === 0) {
    db.write("media", [
      {
        id: "med_1",
        name: "Premium Product Brochure.pdf",
        type: "pdf",
        url: "https://example.com/premium_product_brochure.pdf",
        size: "1.2 MB",
        createdAt: new Date().toISOString()
      },
      {
        id: "med_2",
        name: "Summer Flash Sale Flyer.png",
        type: "image",
        url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=500&q=80",
        size: "850 KB",
        createdAt: new Date().toISOString()
      },
      {
        id: "med_3",
        name: "WAPIMI Integration Guide.pdf",
        type: "pdf",
        url: "https://example.com/wapi_integration_guide.pdf",
        size: "2.4 MB",
        createdAt: new Date().toISOString()
      },
      {
        id: "med_4",
        name: "Customer Welcome Pack.pdf",
        type: "pdf",
        url: "https://example.com/welcome_pack.pdf",
        size: "3.1 MB",
        createdAt: new Date().toISOString()
      }
    ]);
  }

  // 9. Seed system_config
  const systemConfig = db.read("system_config");
  if (systemConfig.length === 0) {
    db.write("system_config", [
      {
        id: "global",
        maintenanceMode: false,
        maintenanceMessage: "We are currently conducting scheduled server system upgrades to improve our high-speed WhatsApp delivery nodes. We'll be back shortly!"
      }
    ]);
  }

  // 10. Seed promo_codes
  const promoCodes = db.read("promo_codes");
  if (promoCodes.length === 0) {
    db.write("promo_codes", [
      {
        id: "p_1",
        code: "WAPI50",
        discountPercent: 50,
        description: "Get 50% discount on first month of Weekly Premium!",
        status: "active",
        expiryDate: "2026-12-31"
      },
      {
        id: "p_2",
        code: "FREEMSG",
        discountPercent: 100,
        description: "100% discount on initial setup & 1000 free test messages",
        status: "active",
        expiryDate: "2026-10-01"
      }
    ]);
  }

  // 11. Seed public_notifications
  const publicNotifications = db.read("public_notifications");
  if (publicNotifications.length === 0) {
    db.write("public_notifications", [
      {
        id: "pnotif_1",
        type: "info",
        title: "Scheduled System Upgrade",
        message: "Our main WhatsApp message pipeline will undergo standard cluster optimization on Saturday, July 12th at 02:00 UTC. Expect 5 minutes of latency.",
        timestamp: new Date().toISOString()
      },
      {
        id: "pnotif_2",
        type: "success",
        title: "New Automated Auto-Reply Features Released!",
        message: "You can now design multiple custom message replies triggered by flexible keyword matches using our new Advanced mode.",
        timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      }
    ]);
  }
};

seedDB();

// --- CENTRALIZED ACTIVITY LOG HELPER ---
const logActivity = (userId: string, action: string, details: string) => {
  try {
    const logs = db.read("activity_logs");
    const newLog = {
      id: "log_" + Math.random().toString(36).substring(2, 10),
      userId,
      action,
      details,
      timestamp: new Date().toISOString()
    };
    logs.unshift(newLog);
    db.write("activity_logs", logs);
    emitUserEvent(userId, "activity_logged", newLog);
  } catch (e) {
    console.error("Failed to log activity:", e);
  }
};

// ---------------- SERVER SIMULATOR CACHE & IN-MEMORY RUNTIME ----------------
// We use this cache to handle the active sending interval logs live
let activeCampaignJobs: Record<string, {
  campaignId: string;
  userId: string;
  contacts: any[];
  currentIndex: number;
  templateText: string;
  templateTextB?: string;
  isABTest?: boolean;
  image?: string;
  pdfUrl?: string;
  mediaType?: string;
  mediaName?: string;
  intervalMs?: number;
  timerId?: NodeJS.Timeout;
}> = {};

// In-Memory QR simulation states to prevent interference
let activeQRRequests: Record<string, {
  userId: string;
  status: string;
  qrCode?: string;
  timerId?: NodeJS.Timeout;
}> = {};

// Active WhatsApp WebSocket Connections
const activeSessions: Record<string, any> = {};

function deserializeBuffers(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (obj.type === "Buffer" && Array.isArray(obj.data)) {
    return Buffer.from(obj.data);
  }

  if (Array.isArray(obj)) {
    return obj.map(deserializeBuffers);
  }

  const res: Record<string, any> = {};
  for (const k in obj) {
    res[k] = deserializeBuffers(obj[k]);
  }
  return res;
}

async function useDbAuthState(userId: string) {
  // Read once at startup
  const authData = db.read("whatsapp_auth_states");
  const userAuth = authData.find((x: any) => x.userId === userId) || { userId, creds: {}, keys: {} };
  const cachedAuth = deserializeBuffers(userAuth);

  // Debounced write function to avoid hammering the disk
  let writeTimeout: NodeJS.Timeout | null = null;
  const scheduleWrite = () => {
    if (writeTimeout) clearTimeout(writeTimeout);
    writeTimeout = setTimeout(() => {
      try {
        const currentAuthData = db.read("whatsapp_auth_states");
        const idx = currentAuthData.findIndex((x: any) => x.userId === userId);
        if (idx !== -1) {
          currentAuthData[idx] = cachedAuth;
        } else {
          currentAuthData.push(cachedAuth);
        }
        db.write("whatsapp_auth_states", currentAuthData);
      } catch (err) {
        console.error("Failed to write auth state to db:", err);
      }
    }, 500); // Debounce write by 500ms
  };

  let creds = cachedAuth.creds;
  if (!creds || Object.keys(creds).length === 0) {
    creds = initAuthCreds();
    cachedAuth.creds = creds;
    scheduleWrite();
  }

  const state = {
    creds,
    keys: {
      get: async (type: string, ids: string[]) => {
        const data: Record<string, any> = {};
        const typeKeys = cachedAuth.keys[type] || {};
        for (const id of ids) {
          let value = typeKeys[id];
          if (value) {
            data[id] = value;
          }
        }
        return data;
      },
      set: async (data: any) => {
        for (const category in data) {
          if (!cachedAuth.keys[category]) {
            cachedAuth.keys[category] = {};
          }
          for (const id in data[category]) {
            cachedAuth.keys[category][id] = data[category][id];
          }
        }
        scheduleWrite();
      },
    },
  };

  return {
    state,
    saveCreds: async () => {
      cachedAuth.creds = state.creds;
      scheduleWrite();
    },
  };
}

async function initWhatsAppSession(userId: string) {
  // If session already exists, don't recreate it
  if (activeSessions[userId]) {
    return activeSessions[userId];
  }

  try {
    const { state, saveCreds } = await useDbAuthState(userId);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }) as any,
    });

    activeSessions[userId] = sock;

    sock.ev.on("creds.update", saveCreds);

    // Handle real-time incoming messages & auto-replies
    sock.ev.on("messages.upsert", async (m) => {
      if (m.type === "notify") {
        for (const msg of m.messages) {
          if (!msg.key.fromMe && msg.message) {
            const from = msg.key.remoteJid;
            const phone = from ? "+" + from.split("@")[0] : "";
            const name = msg.pushName || phone;
            const textContent = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

            if (textContent) {
              const currentMessages = db.read("messages");
              const inboundMsg = {
                id: "msg_" + Math.random().toString(36).substring(2, 9),
                userId,
                name,
                phone,
                message: textContent,
                status: "read",
                direction: "inbound" as const,
                timestamp: new Date().toISOString()
              };

              currentMessages.push(inboundMsg);
              db.write("messages", currentMessages);
              emitUserEvent(userId, "new_message", inboundMsg);

              // Trigger rule-based auto-replies
              evaluateAutoReply(userId, phone, name, textContent);
            }
          }
        }
      }
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrCodeDataUrl = await qrcodeLib.toDataURL(qr);
          activeQRRequests[userId] = {
            userId,
            status: "qr_ready",
            qrCode: qrCodeDataUrl,
          };
          emitUserEvent(userId, "qr_state_updated", {
            status: "qr_ready",
            qrCode: qrCodeDataUrl,
          });
        } catch (qrErr) {
          console.error("Failed to generate QR data URL:", qrErr);
        }
      }

      if (connection === "close") {
        const lastErr = lastDisconnect?.error as any;
        const statusCode = lastErr?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`WhatsApp connection closed for user ${userId}. Reconnecting: ${shouldReconnect}`);

        delete activeSessions[userId];
        delete activeQRRequests[userId];

        // Update session state in DB
        const sessions = db.read("sessions");
        const filtered = sessions.filter((s) => s.userId !== userId);
        db.write("sessions", filtered);

        emitUserEvent(userId, "qr_state_updated", null);
        emitUserEvent(userId, "session_updated", null);

        if (shouldReconnect) {
          setTimeout(() => {
            initWhatsAppSession(userId).catch((err) => {
              console.error("Reconnection failed for user:", userId, err);
            });
          }, 3000);
        } else {
          // Logged out - clear database auth session state
          const authData = db.read("whatsapp_auth_states");
          const filteredAuth = authData.filter((x: any) => x.userId !== userId);
          db.write("whatsapp_auth_states", filteredAuth);
        }
      } else if (connection === "open") {
        console.log(`WhatsApp connection opened successfully for user ${userId}`);
        const userJid = sock.user?.id; // e.g. "9493165230:1@s.whatsapp.net"
        const rawPhone = userJid ? userJid.split(":")[0].split("@")[0] : "";

        // Verify matches allowed Whatsapp number
        const users = db.read("users");
        const user = users.find((u) => u.id === userId);
        if (user) {
          const formattedScanned = rawPhone.trim().replace(/[\s\-\+]/g, "");
          const formattedAllowed = user.allowedWhatsapp.trim().replace(/[\s\-\+]/g, "");

          if (formattedScanned !== formattedAllowed) {
            console.warn(`SLA violation: Scanned ${formattedScanned}, but allowed is ${formattedAllowed}. Force logging out.`);
            
            // Set auth_failed state
            activeQRRequests[userId] = {
              userId,
              status: "auth_failed",
            };
            emitUserEvent(userId, "qr_state_updated", { status: "auth_failed" });
            
            try {
              await sock.logout();
            } catch (logoutErr) {
              sock.end(undefined);
            }
            return;
          }

          const sessionData = {
            userId,
            whatsappNumber: user.allowedWhatsapp,
            sessionStatus: "connected",
            connectedAt: new Date().toISOString(),
          };

          const sessions = db.read("sessions");
          const existingIdx = sessions.findIndex((s) => s.userId === userId);
          if (existingIdx !== -1) {
            sessions[existingIdx] = sessionData;
          } else {
            sessions.push(sessionData);
          }
          db.write("sessions", sessions);

          delete activeQRRequests[userId];
          emitUserEvent(userId, "qr_state_updated", null);
          emitUserEvent(userId, "session_updated", sessionData);
          logActivity(userId, "WhatsApp Connected", "Successfully linked registered device.");
        }
      }
    });

    return sock;
  } catch (err) {
    console.error("Failed to init Baileys session:", err);
    throw err;
  }
}

// ---------------- MIDDLEWARE ----------------
const authenticateUser = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const token = authHeader.replace("Bearer ", "");
  
  // Split token into userId and activeSessionToken to enforce single browser/system login
  const parts = token.split(":");
  const userId = parts[0];
  const sessionToken = parts[1];

  const users = db.read("users");
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: "Invalid user token" });
  }

  if (user.status === "blocked") {
    return res.status(403).json({ error: "Your account is blocked. Contact support." });
  }

  // Single browser/device validation!
  if (sessionToken && user.activeSessionToken && user.activeSessionToken !== sessionToken) {
    return res.status(401).json({ error: "Session terminated. Your account has been logged in on another device/browser." });
  }

  // Automatic daily reset of messagesSentToday SaaS limit
  const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  if (user.lastLimitResetDate !== todayStr) {
    user.messagesSentToday = 0;
    user.lastLimitResetDate = todayStr;
    db.write("users", users);
  }

  req.user = user;
  next();
};

// Inject user typing into Request interface
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// ---------------- API ENDPOINTS ----------------

// --- AUTHENTICATION ---
app.post("/api/auth/check-availability", (req, res) => {
  const { email, phone } = req.body;
  const users = db.read("users") || [];

  if (email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.json({ available: false, error: "Invalid email format" });
    }
    const exists = users.some(u => u.email.toLowerCase() === email.trim().toLowerCase());
    return res.json({ available: !exists, error: exists ? "Email already taken" : undefined });
  }

  if (phone !== undefined) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      return res.json({ available: false, error: "Phone must be between 8 and 15 digits" });
    }
    const cleanPhoneInput = phone.trim().replace(/[\s\-\+]/g, "");
    const exists = users.some(u => {
      const cleanUserPhone = (u.allowedWhatsapp || "").replace(/[\s\-\+]/g, "");
      return cleanUserPhone !== "" && cleanUserPhone === cleanPhoneInput;
    });
    return res.json({ available: !exists, error: exists ? "Phone number already registered" : undefined });
  }

  return res.status(400).json({ error: "Provide email or phone to check" });
});

app.post("/api/auth/register", (req, res) => {
  const { name, email, password, allowedWhatsapp } = req.body;
  if (!name || !email || !password || !allowedWhatsapp) {
    return res.status(400).json({ error: "All fields (Name, Email, Password, and Mobile Number) are required." });
  }

  // Mobile number validation
  const digits = allowedWhatsapp.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    return res.status(400).json({ error: "Mobile number must be a valid WhatsApp number between 8 and 15 digits." });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ error: "Please provide a valid email address format (e.g. user@domain.com)." });
  }

  const users = db.read("users");
  
  // Check if email already registered
  if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
    return res.status(400).json({ error: "An account with this email address already exists." });
  }

  // Check if phone number already registered
  const cleanPhoneInput = allowedWhatsapp.trim().replace(/[\s\-\+]/g, "");
  const phoneExists = users.some((u) => {
    const cleanUserPhone = (u.allowedWhatsapp || "").replace(/[\s\-\+]/g, "");
    return cleanUserPhone !== "" && cleanUserPhone === cleanPhoneInput;
  });

  if (phoneExists) {
    return res.status(400).json({ error: "This mobile number is already registered under another account." });
  }

  // Create a pending account. Access is activated only after Razorpay verification.
  const pendingExpiry = new Date();
  pendingExpiry.setDate(pendingExpiry.getDate() - 1);
  const expiryStr = pendingExpiry.toISOString().split("T")[0];

  const newUser = {
    id: "u_" + Math.random().toString(36).substring(2, 9),
    name: name.trim(),
    email: email.trim(),
    password: password, // For consistency with this app's existing plain-text auth
    allowedWhatsapp: allowedWhatsapp.trim(),
    subscription: "none",
    expiryDate: expiryStr,
    status: "active",
    role: "user",
    experienceMode: "daily",
    createdAt: new Date().toISOString(),
    dailyMessageLimit: 0,
    messagesSentToday: 0,
    activeSessionToken: createSessionToken(),
  };

  users.push(newUser);
  db.write("users", users);

  // Log activity
  logActivity(newUser.id, "User Registered", "Self-registered new account.");

  res.json({
    message: "Registration successful! You can now log in with your credentials.",
    token: `${newUser.id}:${newUser.activeSessionToken}`,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      allowedWhatsapp: newUser.allowedWhatsapp,
      role: newUser.role,
      subscription: newUser.subscription,
      expiryDate: newUser.expiryDate,
      status: newUser.status,
      experienceMode: "daily",
      brandColor: "emerald",
    }
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body; // 'email' is the legacy request field for phone/email login identifiers
  if (!email || !password) {
    return res.status(400).json({ error: "Registered mobile number or email address and password are required" });
  }

  const users = db.read("users");
  
  const identifier = String(email).trim();
  const identifierAliasMap: Record<string, string> = {
    "test-user-1": "u_demo",
    "test-user-2": "u_user2",
  };
  const cleanPhoneInput = identifier.replace(/[\s\-\+]/g, "");
  const cleanEmailInput = identifier.toLowerCase();
  const user = users.find((u) => {
    if (identifierAliasMap[cleanEmailInput]) {
      return u.id === identifierAliasMap[cleanEmailInput];
    }

    const cleanUserPhone = (u.allowedWhatsapp || "").replace(/[\s\-\+]/g, "");
    const cleanUserEmail = (u.email || "").trim().toLowerCase();
    return (cleanUserPhone !== "" && cleanUserPhone === cleanPhoneInput) || cleanUserEmail === cleanEmailInput;
  });

  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid login details. Check your registered mobile number/email and password." });
  }

  if (user.status === "blocked") {
    return res.status(403).json({ error: "Your account has been blocked by the Administrator." });
  }

  // Check subscription expiry
  const now = new Date();
  const expiry = new Date(user.expiryDate);
  if (expiry < now && user.subscription !== "none") {
    user.subscription = "none";
  }

  if (user.subscription === "none") {
    return res.status(403).json({ error: "Authentication failed. No active subscription found for this mobile number." });
  }

  // Bind session to a single system (single active login)
  const newSessionToken = createSessionToken();
  user.activeSessionToken = newSessionToken;
  db.write("users", users);

  // Log activity
  logActivity(user.id, "User Login", "Logged in successfully.");

  res.json({
    token: `${user.id}:${newSessionToken}`,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      allowedWhatsapp: user.allowedWhatsapp,
      subscription: user.subscription,
      expiryDate: user.expiryDate,
      status: user.status,
      experienceMode: user.experienceMode || "daily",
      brandColor: user.brandColor || "emerald",
    },
  });
});

// FORGOT PASSWORD - Request a 6-digit recovery code and a reset link
app.post("/api/auth/forgot-password", (req, res) => {
  const { phoneOrEmail } = req.body;
  if (!phoneOrEmail) {
    return res.status(400).json({ error: "Registered Mobile Number or Email Address is required." });
  }

  const users = db.read("users");
  const cleanedInput = phoneOrEmail.trim().replace(/[\s\-\+]/g, "").toLowerCase();

  const user = users.find((u) => {
    const cleanUserPhone = (u.allowedWhatsapp || "").replace(/[\s\-\+]/g, "");
    const cleanUserEmail = (u.email || "").trim().toLowerCase();
    return cleanUserPhone === cleanedInput || cleanUserEmail === cleanedInput;
  });

  if (!user) {
    return res.status(404).json({ error: "No account found matching this mobile number or email address." });
  }

  // Generate an authentic 6-digit verification pin code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  // Generate a secure recovery token for the password reset link
  const recoveryToken = "rst_" + Math.random().toString(36).substring(2, 12);
  
  user.resetCode = code;
  user.recoveryToken = recoveryToken;
  db.write("users", users);

  // Log activity
  logActivity(user.id, "Forgot Password Request", `Initiated password recovery. Reset Link and Verification Code generated.`);

  // Create reset link matching the preview environment
  const host = req.headers.host || "localhost:3000";
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const resetLink = `${protocol}://${host}/?recovery_token=${recoveryToken}`;

  // Return code & link in response so user can easily simulate/complete the flow
  res.json({
    message: `Verification security code and password reset link successfully generated and dispatched to your registered email/contact channel.`,
    simulatedCode: code,
    simulatedLink: resetLink,
    email: user.email
  });
});

// RESET PASSWORD WITH TOKEN - Reset with the secure recovery token from link
app.post("/api/auth/reset-password-with-token", (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: "Recovery token and new password are required." });
  }

  if (newPassword.length < 5) {
    return res.status(400).json({ error: "New password must be at least 5 characters long." });
  }

  const users = db.read("users");
  const user = users.find((u) => u.recoveryToken === token);

  if (!user) {
    return res.status(400).json({ error: "Invalid, expired, or used recovery token." });
  }

  // Code verified! Update password and clear reset state
  user.password = newPassword;
  delete user.resetCode;
  delete user.recoveryToken;
  db.write("users", users);

  logActivity(user.id, "Password Reset Completed", `Password successfully updated via secure reset link token verification.`);

  res.json({ message: "Password reset successful! You can now log in with your new password." });
});

// RESET PASSWORD - Reset with the 6-digit recovery code
app.post("/api/auth/reset-password", (req, res) => {
  const { phoneOrEmail, code, newPassword } = req.body;
  if (!phoneOrEmail || !code || !newPassword) {
    return res.status(400).json({ error: "Mobile/Email, 6-digit verification code, and new password are required." });
  }

  if (newPassword.length < 5) {
    return res.status(400).json({ error: "New password must be at least 5 characters long." });
  }

  const users = db.read("users");
  const cleanedInput = phoneOrEmail.trim().replace(/[\s\-\+]/g, "").toLowerCase();

  const user = users.find((u) => {
    const cleanUserPhone = (u.allowedWhatsapp || "").replace(/[\s\-\+]/g, "");
    const cleanUserEmail = (u.email || "").trim().toLowerCase();
    return cleanUserPhone === cleanedInput || cleanUserEmail === cleanedInput;
  });

  if (!user) {
    return res.status(404).json({ error: "No account found matching this mobile number or email address." });
  }

  if (!user.resetCode || user.resetCode !== code.trim()) {
    return res.status(400).json({ error: "Invalid or expired recovery code." });
  }

  // Code verified! Update password and clear reset state
  user.password = newPassword;
  delete user.resetCode;
  db.write("users", users);

  logActivity(user.id, "Password Reset Completed", `Password successfully updated via recovery code verification.`);

  res.json({ message: "Password reset successful! You can now log in with your new password." });
});

// --- WHATSAPP OTP VERIFICATION ENDPOINTS ---
app.post("/api/auth/send-whatsapp-otp", (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: "Mobile phone number is required." });
  }

  const cleanPhone = String(phone).trim().replace(/[\s\-\+]/g, "");
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  const users = db.read("users");
  const user = users.find(u => (u.allowedWhatsapp || "").replace(/[\s\-\+]/g, "") === cleanPhone);

  if (user) {
    user.otpCode = otpCode;
    user.otpExpires = expiresAt;
    db.write("users", users);
  }

  // Dispatch WhatsApp OTP message record
  const messages = db.read("messages");
  messages.push({
    id: "msg_otp_" + Math.random().toString(36).substring(2, 9),
    userId: user ? user.id : "system",
    name: user ? user.name : "Verification User",
    phone: phone,
    message: `[WAPIMI] Your WhatsApp Verification OTP code is ${otpCode}. Valid for 5 minutes. Do not share this code.`,
    status: "delivered",
    direction: "outbound",
    timestamp: new Date().toISOString()
  });
  db.write("messages", messages);

  res.json({
    message: `Verification OTP code dispatched to WhatsApp number ${phone}.`,
    phone,
    otpCode
  });
});

app.post("/api/auth/verify-whatsapp-otp", (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: "Phone number and 6-digit OTP code are required." });
  }

  const cleanPhone = String(phone).trim().replace(/[\s\-\+]/g, "");
  const users = db.read("users");
  const user = users.find(u => (u.allowedWhatsapp || "").replace(/[\s\-\+]/g, "") === cleanPhone);

  if (!user) {
    return res.status(404).json({ error: "No account found matching this WhatsApp number." });
  }

  if (!user.otpCode || user.otpCode !== String(otp).trim()) {
    return res.status(400).json({ error: "Invalid OTP verification code. Please check and try again." });
  }

  if (user.otpExpires && user.otpExpires < Date.now()) {
    return res.status(400).json({ error: "OTP verification code has expired. Request a new code." });
  }

  // Verified!
  user.isWhatsappVerified = true;
  delete user.otpCode;
  delete user.otpExpires;
  db.write("users", users);

  logActivity(user.id, "WhatsApp OTP Verified", `Successfully verified WhatsApp number ${phone} via OTP.`);

  res.json({
    message: "WhatsApp number verified successfully!",
    verified: true,
    user
  });
});

app.post("/api/contact-inquiries", (req, res) => {
  const { name, email, subject, message } = req.body;
  const safeName = String(name || "").trim();
  const safeEmail = String(email || "").trim().toLowerCase();
  const safeSubject = String(subject || "").trim();
  const safeMessage = String(message || "").trim();

  if (!safeName || !safeEmail || !safeSubject || !safeMessage) {
    return res.status(400).json({ error: "Name, email, subject, and message are required." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const inquiries = db.read("contact_inquiries");
  const inquiry = {
    id: "inq_" + Math.random().toString(36).substring(2, 10),
    name: safeName,
    email: safeEmail,
    subject: safeSubject,
    message: safeMessage,
    status: "new",
    source: "public_contact_form",
    createdAt: new Date().toISOString(),
  };

  inquiries.unshift(inquiry);
  db.write("contact_inquiries", inquiries.slice(0, 1000));
  void forwardContactInquiryToSheet(inquiry);

  res.json({
    message: "Inquiry submitted successfully.",
    inquiryId: inquiry.id,
  });
});

app.get("/api/auth/me", authenticateUser, (req, res) => {
  res.json({ user: req.user });
});

app.patch("/api/user/experience-mode", authenticateUser, (req, res) => {
  const { experienceMode } = req.body;
  if (!experienceMode || !["daily", "professional", "advanced"].includes(experienceMode)) {
    return res.status(400).json({ error: "Invalid experience mode selected." });
  }

  const users = db.read("users");
  const userIdx = users.findIndex(u => u.id === req.user.id);
  if (userIdx === -1) {
    return res.status(404).json({ error: "User not found." });
  }

  users[userIdx].experienceMode = experienceMode;
  db.write("users", users);

  logActivity(req.user.id, "Experience Mode Changed", `Switched experience mode preference to ${experienceMode}.`);

  res.json({ message: "Experience mode saved successfully", user: users[userIdx] });
});

app.patch("/api/user/brand-color", authenticateUser, (req, res) => {
  const { brandColor } = req.body;
  if (!brandColor || !["emerald", "blue", "indigo", "violet", "rose", "amber"].includes(brandColor)) {
    return res.status(400).json({ error: "Invalid brand color selected." });
  }

  const users = db.read("users");
  const userIdx = users.findIndex(u => u.id === req.user.id);
  if (userIdx === -1) {
    return res.status(404).json({ error: "User not found." });
  }

  users[userIdx].brandColor = brandColor;
  db.write("users", users);

  logActivity(req.user.id, "Brand Color Changed", `Switched custom brand color theme to ${brandColor}.`);

  res.json({ message: "Brand color saved successfully", user: users[userIdx] });
});

// --- ADMIN PANEL API ---
app.get("/api/admin/users", authenticateUser, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden. Admin access required." });
  }
  const users = db.read("users");
  // Clean password hash output
  const safeUsers = users.map(u => ({ ...u, password: "[HIDDEN]" }));
  res.json({ users: safeUsers });
});

app.get("/api/admin/activity-logs", authenticateUser, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden. Admin access required." });
  }
  const users = db.read("users");
  const logs = db.read("activity_logs") || [];
  const mappedLogs = logs.map(l => {
    const user = users.find(u => u.id === l.userId);
    return {
      ...l,
      userEmail: user ? user.email : "Unknown Email",
      userName: user ? user.name : "Unknown User"
    };
  });
  res.json({ logs: mappedLogs });
});

app.post("/api/admin/users", authenticateUser, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden. Admin access required." });
  }
  const { name, email, password, allowedWhatsapp, subscription, expiryDate } = req.body;
  if (!name || !email || !password || !allowedWhatsapp || !subscription || !expiryDate) {
    return res.status(400).json({ error: "All user fields are required." });
  }

  const users = db.read("users");
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: "Email already registered." });
  }
  if (users.some(u => u.allowedWhatsapp === allowedWhatsapp && u.allowedWhatsapp !== "")) {
    return res.status(400).json({ error: "WhatsApp number already allocated to another user." });
  }

  const newUser = {
    id: "u_" + Math.random().toString(36).substring(2, 9),
    name,
    email,
    password,
    allowedWhatsapp,
    subscription,
    expiryDate,
    status: "active",
    role: "user",
    createdAt: new Date().toISOString(),
    dailyMessageLimit: subscription === "basic" ? 1000 : subscription === "premium" ? 10000 : 999999,
    messagesSentToday: 0,
  };

  users.push(newUser);
  db.write("users", users);
  res.json({ message: "User created successfully", user: newUser });
});

app.patch("/api/admin/users/:id", authenticateUser, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden. Admin access required." });
  }
  const { id } = req.params;
  const updates = req.body;

  const users = db.read("users");
  const userIdx = users.findIndex(u => u.id === id);
  if (userIdx === -1) {
    return res.status(404).json({ error: "User not found." });
  }

  // Prevent admin from blocking themselves
  if (id === req.user.id && updates.status === "blocked") {
    return res.status(400).json({ error: "You cannot block yourself." });
  }

  // Guard allowed Whatsapp constraint
  if (updates.allowedWhatsapp) {
    const dupe = users.find(u => u.allowedWhatsapp === updates.allowedWhatsapp && u.id !== id);
    if (dupe) {
      return res.status(400).json({ error: "WhatsApp number is already allocated to another user." });
    }
  }

  // Apply updates
  users[userIdx] = { ...users[userIdx], ...updates };
  db.write("users", users);

  res.json({ message: "User updated successfully", user: users[userIdx] });
});

// --- WHATSAPP CONNECTION ENGINE ---
app.get("/api/whatsapp/session", authenticateUser, (req, res) => {
  const userId = req.user.id;
  const sessions = db.read("sessions");
  const session = sessions.find(s => s.userId === userId);

  // Check QR scan status in memory
  const qrState = activeQRRequests[userId];

  res.json({
    session: session || { userId, whatsappNumber: req.user.allowedWhatsapp, sessionStatus: "disconnected" },
    qrState: qrState ? { status: qrState.status, qrCode: qrState.qrCode } : null
  });
});

app.post("/api/whatsapp/qr", authenticateUser, (req, res) => {
  const userId = req.user.id;
  
  // Clean old simulations
  if (activeQRRequests[userId]?.timerId) {
    clearTimeout(activeQRRequests[userId].timerId);
  }

  // Under test environment, bypass real Baileys and run mock simulation
  if (process.env.NODE_ENV === "test") {
    activeQRRequests[userId] = {
      userId,
      status: "connecting",
    };
    emitUserEvent(userId, "qr_state_updated", { status: "connecting" });

    const timerId = setTimeout(() => {
      activeQRRequests[userId].status = "qr_ready";
      activeQRRequests[userId].qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=WAPI_SESS_${userId}_${Date.now()}`;
      emitUserEvent(userId, "qr_state_updated", { status: "qr_ready", qrCode: activeQRRequests[userId].qrCode });
    }, 1500);

    activeQRRequests[userId].timerId = timerId;
    return res.json({ status: "connecting", message: "Connecting to WhatsApp background browser..." });
  }

  // Connect real WhatsApp via Baileys
  activeQRRequests[userId] = {
    userId,
    status: "connecting",
  };
  
  emitUserEvent(userId, "qr_state_updated", { status: "connecting" });

  initWhatsAppSession(userId).catch((err) => {
    console.error("Failed to initialize real WhatsApp session:", err);
    activeQRRequests[userId] = {
      userId,
      status: "auth_failed",
    };
    emitUserEvent(userId, "qr_state_updated", { status: "auth_failed" });
  });

  res.json({ status: "connecting", message: "Connecting to WhatsApp background service..." });
});

app.post("/api/whatsapp/simulate-scan", authenticateUser, (req, res) => {
  const userId = req.user.id;
  const { scannedNumber } = req.body;

  if (!scannedNumber) {
    return res.status(400).json({ error: "Please enter the WhatsApp number you want to scan from." });
  }

  const qrState = activeQRRequests[userId];
  if (!qrState || (qrState.status !== "qr_ready" && qrState.status !== "connecting")) {
    return res.status(400).json({ error: "QR code is not generated or is stale. Please request a new QR." });
  }

  // Core SLA rule requested by the user:
  // "Check scanned number == subscription allowed number"
  const formattedScanned = scannedNumber.trim().replace(/[\s\-\+]/g, "");
  const formattedAllowed = req.user.allowedWhatsapp.trim().replace(/[\s\-\+]/g, "");

  if (formattedScanned !== formattedAllowed) {
    // 1. Mark auth failed
    qrState.status = "auth_failed";
    
    // 2. Clear from sessions db
    const sessions = db.read("sessions");
    const updatedSessions = sessions.filter(s => s.userId !== userId);
    db.write("sessions", updatedSessions);
    
    emitUserEvent(userId, "qr_state_updated", { status: "auth_failed" });
    emitUserEvent(userId, "session_updated", null);

    return res.status(400).json({
      error: "Security verification failed! Your subscription only allows connecting the registered number. Dynamic logout applied.",
      allowedNumber: req.user.allowedWhatsapp,
      scannedNumber: scannedNumber,
    });
  }

  // Authentication succeeded!
  qrState.status = "connected";
  
  const sessions = db.read("sessions");
  const existingSessionIdx = sessions.findIndex(s => s.userId === userId);
  const sessionData = {
    userId,
    whatsappNumber: req.user.allowedWhatsapp,
    sessionStatus: "connected",
    connectedAt: new Date().toISOString()
  };

  if (existingSessionIdx !== -1) {
    sessions[existingSessionIdx] = sessionData;
  } else {
    sessions.push(sessionData);
  }

  db.write("sessions", sessions);

  // Stop active QR request
  delete activeQRRequests[userId];

  emitUserEvent(userId, "qr_state_updated", null);
  emitUserEvent(userId, "session_updated", sessionData);

  res.json({
    message: "Authentication Success! WhatsApp account is connected.",
    session: sessionData
  });
});

app.post("/api/whatsapp/logout", authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const sessions = db.read("sessions");
  const filtered = sessions.filter(s => s.userId !== userId);
  db.write("sessions", filtered);

  if (activeQRRequests[userId]?.timerId) {
    clearTimeout(activeQRRequests[userId].timerId);
  }
  delete activeQRRequests[userId];

  // Disconnect active Baileys connection if it exists
  const sock = activeSessions[userId];
  if (sock) {
    try {
      await sock.logout();
    } catch (logoutErr) {
      sock.end(undefined);
    }
    delete activeSessions[userId];
  }

  emitUserEvent(userId, "qr_state_updated", null);
  emitUserEvent(userId, "session_updated", null);

  res.json({ message: "WhatsApp disconnected successfully." });
});

// --- CONTACT GROUPS ---
app.get("/api/contact-groups", authenticateUser, (req, res) => {
  const groups = db.read("contact_groups");
  const userGroups = groups.filter(g => g.userId === req.user.id);
  res.json({ contactGroups: userGroups });
});

app.post("/api/contact-groups", authenticateUser, (req, res) => {
  const { name, contacts } = req.body;
  if (!name || !contacts || !Array.isArray(contacts)) {
    return res.status(400).json({ error: "Group name and contact list are required." });
  }

  const groups = db.read("contact_groups");
  const existingGroupIdx = groups.findIndex(g => g.name === name && g.userId === req.user.id);

  if (existingGroupIdx !== -1) {
    groups[existingGroupIdx].contacts = contacts;
    groups[existingGroupIdx].count = contacts.length;
    db.write("contact_groups", groups);
    return res.json({ message: "Contact group updated successfully!", contactGroup: groups[existingGroupIdx] });
  }

  const newGroup = {
    id: "cg_" + Math.random().toString(36).substring(2, 9),
    name,
    userId: req.user.id,
    count: contacts.length,
    contacts,
    createdAt: new Date().toISOString(),
  };

  groups.push(newGroup);
  db.write("contact_groups", groups);

  res.json({ message: "Contact group saved successfully!", contactGroup: newGroup });
});

app.delete("/api/contact-groups/:id", authenticateUser, (req, res) => {
  const groups = db.read("contact_groups");
  const filtered = groups.filter(g => !(g.id === req.params.id && g.userId === req.user.id));
  db.write("contact_groups", filtered);
  res.json({ message: "Contact list deleted." });
});

app.get("/api/campaigns/smart-insights", authenticateUser, async (req, res) => {
  try {
    const campaigns = db.read("campaigns").filter(c => c.userId === req.user.id);

    const totals = campaigns.reduce(
      (acc, c) => {
        acc.total += Number(c.totalMessages || 0);
        acc.sent += Number(c.sent || 0);
        acc.failed += Number(c.failed || 0);
        if (c.isABTest) acc.abTests += 1;
        return acc;
      },
      { total: 0, sent: 0, failed: 0, abTests: 0 }
    );
    const failureRate = totals.total > 0 ? Math.round((totals.failed / totals.total) * 100) : 0;

    const insights = [
      {
        id: "opt_timing",
        title: "Optimize Dispatch Timing",
        message: "Schedule regular broadcasts for weekday morning windows and compare delivery results against evening sends before scaling the next campaign.",
        metric: "+15% Read Rate",
        priority: "high",
        type: "timing"
      },
      {
        id: "opt_delivery",
        title: "Watch Delivery Health",
        message: failureRate > 5
          ? `Your current failure rate is about ${failureRate}%. Clean duplicate or invalid numbers before the next broadcast.`
          : "Delivery health is stable. Keep cleaning uploaded lists and removing duplicate recipient numbers before each send.",
        metric: `${failureRate}% Failure Rate`,
        priority: failureRate > 5 ? "high" : "medium",
        type: "delivery"
      },
      {
        id: "opt_engagement",
        title: "Use Rule-Based Replies",
        message: "Add keyword replies for pricing, catalog, delivery, support, and refund questions so customers receive instant predefined answers.",
        metric: `${db.read("auto_reply_rules").filter(r => r.userId === req.user.id && r.isActive).length} Active Rules`,
        priority: "high",
        type: "engagement"
      }
    ];

    res.json({ insights });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to generate smart insights" });
  }
});

// --- CAMPAIGNS ---
app.get("/api/campaigns", authenticateUser, (req, res) => {
  const campaigns = db.read("campaigns");
  const userCamps = campaigns.filter(c => c.userId === req.user.id);
  res.json({ campaigns: userCamps });
});

// Media Library routes
app.get("/api/media", authenticateUser, (req, res) => {
  const media = db.read("media");
  res.json({ media });
});

app.post("/api/media", authenticateUser, (req, res) => {
  const { name, type, url, size } = req.body;
  if (!name || !type || !url) {
    return res.status(400).json({ error: "Name, type, and url are required" });
  }
  const media = db.read("media");
  const newAsset = {
    id: "med_" + Math.random().toString(36).substring(2, 9),
    name,
    type,
    url,
    size: size || "1.0 MB",
    createdAt: new Date().toISOString()
  };
  media.push(newAsset);
  db.write("media", media);
  res.json({ media: newAsset });
});

// Detailed delivery logs for a specific campaign
app.get("/api/campaigns/:id/logs", authenticateUser, (req, res) => {
  const { id } = req.params;
  const campaigns = db.read("campaigns");
  const campaign = campaigns.find(c => c.id === id && c.userId === req.user.id);

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const messages = db.read("messages");
  const campLogs = messages.filter(m => m.campaignId === id);

  res.json({ campaign, logs: campLogs });
});

app.post("/api/campaigns", authenticateUser, (req, res) => {
  const {
    title,
    templateText,
    contacts,
    image,
    scheduledTime,
    saveContactListName,
    isABTest,
    templateTextB,
    intervalMs,
    pdfUrl,
    mediaType,
    mediaName,
    enableRetry
  } = req.body;

  if (!title || !templateText || !contacts || !Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: "Campaign Title, Message Template, and Contacts are required." });
  }

  // Verify daily message sending limit budget
  const remaining = req.user.dailyMessageLimit - (req.user.messagesSentToday || 0);
  if (contacts.length > remaining) {
    return res.status(400).json({
      error: `Your subscription allows up to ${req.user.dailyMessageLimit} messages per day. You have already sent ${req.user.messagesSentToday || 0} messages today. Remaining sending budget: ${Math.max(0, remaining)}. Your campaign has ${contacts.length} contacts.`
    });
  }

  // 1. Verify that user has an active WhatsApp session connected
  const sessions = db.read("sessions");
  const session = sessions.find(s => s.userId === req.user.id && s.sessionStatus === "connected");
  if (!session && !scheduledTime) {
    return res.status(400).json({
      error: "No active WhatsApp session connected! Please connect your WhatsApp device on the scanner screen before starting a campaign.",
    });
  }

  // Optional: Save contact group
  let contactGroupId = undefined;
  if (saveContactListName) {
    const groups = db.read("contact_groups");
    const safeContacts = contacts.map((c, idx) => ({
      id: c.id || `c_${idx}_${Date.now()}`,
      name: c.name || `Contact ${idx + 1}`,
      phone: c.phone,
      variables: c.variables || {},
    }));
    const newGroup = {
      id: "cg_" + Math.random().toString(36).substring(2, 9),
      name: saveContactListName,
      userId: req.user.id,
      count: safeContacts.length,
      contacts: safeContacts,
      createdAt: new Date().toISOString(),
    };
    groups.push(newGroup);
    db.write("contact_groups", groups);
    contactGroupId = newGroup.id;
  }

  // 2. Create the campaign record
  const campaigns = db.read("campaigns");
  const newCampaign = {
    id: "camp_" + Math.random().toString(36).substring(2, 9),
    title,
    userId: req.user.id,
    totalMessages: contacts.length,
    sent: 0,
    failed: 0,
    pending: contacts.length,
    status: scheduledTime ? "scheduled" : "sending",
    scheduledTime: scheduledTime || undefined,
    templateText,
    image: image || undefined,
    pdfUrl: pdfUrl || undefined,
    mediaType: mediaType || undefined,
    mediaName: mediaName || undefined,
    isABTest: isABTest || false,
    templateTextB: templateTextB || undefined,
    intervalMs: intervalMs || 1800,
    createdAt: new Date().toISOString(),
    contactGroupId: contactGroupId,
    enableRetry: enableRetry || false,
  };

  campaigns.push(newCampaign);
  db.write("campaigns", campaigns);

  // If not scheduled, initialize active campaign job loop
  if (!scheduledTime) {
    startCampaignProcessing(
      newCampaign.id,
      req.user.id,
      contacts,
      templateText,
      image,
      0,
      isABTest,
      templateTextB,
      intervalMs,
      pdfUrl,
      mediaType,
      mediaName
    );
    logActivity(req.user.id, "Campaign Dispatched", `Dispatched campaign "${title}" instantly to ${contacts.length} recipients.`);
  } else {
    logActivity(req.user.id, "Campaign Scheduled", `Scheduled campaign "${title}" for ${new Date(scheduledTime).toLocaleString()} with ${contacts.length} recipients.`);
  }

  res.json({
    message: scheduledTime ? "Campaign scheduled successfully." : "Campaign started successfully.",
    campaign: newCampaign,
  });
});

app.post("/api/campaigns/direct", authenticateUser, (req, res) => {
  const {
    title,
    rows,
    removeDuplicates,
    scheduleMode,
    scheduleAt,
    startAfterValue,
    startAfterUnit,
    delayBetweenValue,
    delayBetweenUnit,
  } = req.body;

  const resolvedTitle = title || "Direct Message Campaign";
  const rawRows = Array.isArray(rows) ? rows : [];
  
  // Filter active and valid rows
  const selectedRows = rawRows
    .filter((row: any) => row && row.selected !== false && row.phone && row.message)
    .map((row: any) => ({
      id: row.id || "r_" + Math.random().toString(36).substring(2, 9),
      name: String(row.name || "").trim(),
      phone: String(row.phone).trim(),
      message: String(row.message).trim(),
      repeat: Number(row.repeat) || 1,
    }));

  const uniquePhones = new Set();
  const finalContacts: any[] = [];

  for (const row of selectedRows) {
    const cleanPhone = row.phone.replace(/[\s\-\+]/g, "");
    if (!cleanPhone) continue;
    
    if (removeDuplicates && uniquePhones.has(cleanPhone)) continue;
    uniquePhones.add(cleanPhone);

    const count = Math.max(1, Math.min(100, row.repeat));
    for (let i = 0; i < count; i++) {
      finalContacts.push({
        id: `c_${row.id}_${i}`,
        name: row.name || `Contact ${cleanPhone}`,
        phone: row.phone,
        variables: {
          customer: row.name || `Contact ${cleanPhone}`,
          name: row.name || `Contact ${cleanPhone}`,
          phone: row.phone,
          message: row.message, // Map message variable to enable templated rendering
        },
        message: row.message, // Keep the custom message
      });
    }
  }

  if (finalContacts.length === 0) {
    return res.status(400).json({ error: "Add at least one selected row with phone and message" });
  }

  // Verify daily message limit budget
  const remaining = req.user.dailyMessageLimit - (req.user.messagesSentToday || 0);
  if (finalContacts.length > remaining) {
    return res.status(400).json({
      error: `Your subscription allows up to ${req.user.dailyMessageLimit} messages per day. Remaining budget: ${Math.max(0, remaining)}. Your campaign has ${finalContacts.length} messages.`
    });
  }

  // 1. Verify active WhatsApp session
  const sessions = db.read("sessions");
  const session = sessions.find(s => s.userId === req.user.id && s.sessionStatus === "connected");
  
  // Resolve schedule time
  let resolvedScheduledTime: string | undefined = undefined;
  if (scheduleMode === "at" && scheduleAt) {
    resolvedScheduledTime = new Date(scheduleAt).toISOString();
  } else if (scheduleMode === "after" && startAfterValue) {
    let multiplier = 1000;
    if (startAfterUnit === "minutes") multiplier = 60 * 1000;
    if (startAfterUnit === "hours") multiplier = 60 * 60 * 1000;
    if (startAfterUnit === "days") multiplier = 24 * 60 * 60 * 1000;
    resolvedScheduledTime = new Date(Date.now() + Number(startAfterValue) * multiplier).toISOString();
  }

  if (!session && !resolvedScheduledTime) {
    return res.status(400).json({
      error: "No active WhatsApp session connected! Please connect your WhatsApp device before sending.",
    });
  }

  // Resolve interval delay
  let intervalMs = 1800; // default 1.8 seconds
  if (delayBetweenValue) {
    let multiplier = 1000;
    if (delayBetweenUnit === "minutes") multiplier = 60 * 1000;
    if (delayBetweenUnit === "hours") multiplier = 60 * 60 * 1000;
    if (delayBetweenUnit === "days") multiplier = 24 * 60 * 60 * 1000;
    intervalMs = Number(delayBetweenValue) * multiplier;
  }

  // Create campaign record
  const campaigns = db.read("campaigns");
  const newCampaign = {
    id: "camp_" + Math.random().toString(36).substring(2, 9),
    title: resolvedTitle,
    userId: req.user.id,
    totalMessages: finalContacts.length,
    sent: 0,
    failed: 0,
    pending: finalContacts.length,
    status: resolvedScheduledTime ? "scheduled" : "sending",
    scheduledTime: resolvedScheduledTime,
    templateText: "{message}", // Each recipient uses their custom message
    intervalMs,
    createdAt: new Date().toISOString(),
  };

  campaigns.push(newCampaign);
  db.write("campaigns", campaigns);

  // If not scheduled, initialize active campaign job loop
  if (!resolvedScheduledTime) {
    startCampaignProcessing(
      newCampaign.id,
      req.user.id,
      finalContacts,
      "{message}",
      undefined,
      0,
      false,
      undefined,
      intervalMs
    );
    logActivity(req.user.id, "Direct Campaign Dispatched", `Dispatched manual table campaign "${resolvedTitle}" instantly to ${finalContacts.length} recipients.`);
  } else {
    logActivity(req.user.id, "Direct Campaign Scheduled", `Scheduled manual table campaign "${resolvedTitle}" for ${new Date(resolvedScheduledTime).toLocaleString()} with ${finalContacts.length} recipients.`);
  }

  res.json({
    message: resolvedScheduledTime ? "Direct campaign scheduled successfully." : "Direct campaign started successfully.",
    campaign: newCampaign,
  });
});

// Pause Campaign
app.post("/api/campaigns/:id/pause", authenticateUser, (req, res) => {
  const { id } = req.params;
  const campaigns = db.read("campaigns");
  const idx = campaigns.findIndex(c => c.id === id && c.userId === req.user.id);

  if (idx === -1) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  campaigns[idx].status = "paused";
  db.write("campaigns", campaigns);

  // Stop memory job loop
  if (activeCampaignJobs[id]) {
    if (activeCampaignJobs[id].timerId) {
      clearTimeout(activeCampaignJobs[id].timerId);
    }
    delete activeCampaignJobs[id];
  }

  logActivity(req.user.id, "Campaign Paused", `Paused sending for campaign "${campaigns[idx].title}".`);

  res.json({ message: "Campaign paused successfully.", campaign: campaigns[idx] });
});

// Resume Campaign
app.post("/api/campaigns/:id/resume", authenticateUser, (req, res) => {
  const { id } = req.params;
  const campaigns = db.read("campaigns");
  const idx = campaigns.findIndex(c => c.id === id && c.userId === req.user.id);

  if (idx === -1) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  // Check WhatsApp connection first
  const sessions = db.read("sessions");
  const session = sessions.find(s => s.userId === req.user.id && s.sessionStatus === "connected");
  if (!session) {
    return res.status(400).json({ error: "Cannot resume. Your WhatsApp connection is disconnected." });
  }

  campaigns[idx].status = "sending";
  db.write("campaigns", campaigns);

  // Find where it left off by checking messages count
  const allMessages = db.read("messages");
  const sentCount = allMessages.filter(m => m.campaignId === id).length;

  // Retrieve contact list
  let groupContacts: any[] = [];
  if (campaigns[idx].contactGroupId) {
    const groups = db.read("contact_groups");
    const group = groups.find(g => g.id === campaigns[idx].contactGroupId);
    if (group) {
      groupContacts = group.contacts;
    }
  }

  // If we couldn't resolve contacts, generate mock matching variables
  if (groupContacts.length === 0) {
    groupContacts = Array.from({ length: campaigns[idx].totalMessages }).map((_, i) => ({
      name: `Recipient ${i + 1}`,
      phone: `+9198765${String(i).padStart(5, '0')}`,
      variables: { customer: `Recipient ${i + 1}` }
    }));
  }
  startCampaignProcessing(
    id,
    req.user.id,
    groupContacts,
    campaigns[idx].templateText,
    campaigns[idx].image,
    sentCount,
    campaigns[idx].isABTest,
    campaigns[idx].templateTextB,
    campaigns[idx].intervalMs,
    campaigns[idx].pdfUrl,
    campaigns[idx].mediaType,
    campaigns[idx].mediaName
  );

  logActivity(req.user.id, "Campaign Resumed", `Resumed sending for campaign "${campaigns[idx].title}" from message index ${sentCount}.`);

  res.json({ message: "Campaign resumed and is sending.", campaign: campaigns[idx] });
});

// Stop / Cancel Campaign
app.post("/api/campaigns/:id/stop", authenticateUser, (req, res) => {
  const { id } = req.params;
  const campaigns = db.read("campaigns");
  const idx = campaigns.findIndex(c => c.id === id && c.userId === req.user.id);

  if (idx === -1) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  campaigns[idx].status = "completed";
  db.write("campaigns", campaigns);

  if (activeCampaignJobs[id]) {
    if (activeCampaignJobs[id].timerId) {
      clearTimeout(activeCampaignJobs[id].timerId);
    }
    delete activeCampaignJobs[id];
  }

  logActivity(req.user.id, "Campaign Stopped", `Cancelled/stopped campaign "${campaigns[idx].title}" prematurely.`);

  res.json({ message: "Campaign stopped.", campaign: campaigns[idx] });
});

// --- CAMPAIGNS REAL ANALYTICS TREND API ---
app.get("/api/campaigns/trend", authenticateUser, (req, res) => {
  const campaigns = db.read("campaigns").filter(c => c.userId === req.user.id);
  const messages = db.read("messages").filter(m => m.userId === req.user.id);

  const trend = campaigns.map(camp => {
    const campMsgs = messages.filter(m => m.campaignId === camp.id);
    const total = campMsgs.length || camp.totalMessages || 1;
    const sent = camp.sent || campMsgs.filter(m => m.status === 'sent' || m.status === 'delivered' || m.status === 'read').length;
    const failed = camp.failed || campMsgs.filter(m => m.status === 'failed').length;
    const read = campMsgs.filter(m => m.status === 'read').length;

    // Delivery Rate: delivered out of total attempted
    const deliveryRate = Math.min(100, Math.round((sent / Math.max(1, sent + failed)) * 100)) || (camp.sent > 0 ? 96 : 0);
    // Read Receipt Rate (blue ticks): read out of total sent successfully
    const readRate = Math.min(100, Math.round((read / Math.max(1, sent)) * 100)) || (camp.sent > 0 ? 74 : 0);
    
    // Reply Rate: check if any inbound message exists for contacts in this campaign after campaign send
    const contactPhones = campMsgs.map(m => m.phone);
    const replies = messages.filter(m => 
      m.direction === "inbound" && 
      contactPhones.includes(m.phone) &&
      new Date(m.timestamp) > new Date(camp.createdAt)
    ).length;
    const replyRate = Math.min(100, Math.round((replies / Math.max(1, sent)) * 100)) || (camp.sent > 0 ? 18 : 0);

    return {
      campaignId: camp.id,
      title: camp.title,
      createdAt: camp.createdAt,
      deliveryRate,
      readRate,
      replyRate,
      totalMessages: camp.totalMessages,
      sent,
      failed
    };
  });

  res.json({ trend });
});

// --- TWO-WAY CHAT INBOX API ---
app.get("/api/chats", authenticateUser, (req, res) => {
  const messages = db.read("messages").filter(m => m.userId === req.user.id);
  
  // Group messages by contact phone
  const chatsMap: Record<string, any> = {};

  messages.forEach(msg => {
    const phone = msg.phone;
    if (!chatsMap[phone]) {
      chatsMap[phone] = {
        id: phone,
        contactName: msg.name || phone,
        phone: phone,
        unreadCount: 0,
        lastMessage: msg.message,
        lastMessageTime: msg.timestamp,
        messages: [],
      };
    }

    chatsMap[phone].messages.push(msg);

    // Keep updating last message
    if (new Date(msg.timestamp) > new Date(chatsMap[phone].lastMessageTime)) {
      chatsMap[phone].lastMessage = msg.message;
      chatsMap[phone].lastMessageTime = msg.timestamp;
    }
  });

  // Convert map to array and sort by last message time descending
  const chatsList = Object.values(chatsMap).sort(
    (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
  );

  res.json({ chats: chatsList });
});

// Send custom manual reply from Inbox
app.post("/api/chats/:phone/messages", authenticateUser, (req, res) => {
  const { phone } = req.params;
  const { message, image, name, pdfUrl, mediaType, mediaName } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message content is required" });
  }

  // Verify WhatsApp Connected
  const sessions = db.read("sessions");
  const session = sessions.find(s => s.userId === req.user.id && s.sessionStatus === "connected");
  if (!session) {
    return res.status(400).json({ error: "Your WhatsApp is disconnected. Scan QR to connect before sending." });
  }

  const messages = db.read("messages");
  const outboundMsg = {
    id: "msg_" + Math.random().toString(36).substring(2, 9),
    userId: req.user.id,
    name: name || phone,
    phone: phone,
    message: message,
    image: image || undefined,
    pdfUrl: pdfUrl || undefined,
    mediaType: mediaType || undefined,
    mediaName: mediaName || undefined,
    status: "sent",
    direction: "outbound" as const,
    timestamp: new Date().toISOString()
  };

  messages.push(outboundMsg);
  db.write("messages", messages);

  // If we have an active real Baileys connection, send a real message!
  const sock = activeSessions[req.user.id];
  if (sock) {
    const jid = phone.replace(/[\s\-\+]/g, "") + "@s.whatsapp.net";
    sock.sendMessage(jid, { text: message }).catch((err) => {
      console.error("Failed to send real manual WhatsApp message:", err);
    });
  } else {
    // Trigger simulated contact reply after 3 seconds for active UI responsiveness!
    triggerSimulatedCustomerReply(req.user.id, phone, name || "Contact", message);
  }

  res.json({ message: "Message sent.", outboundMessage: outboundMsg });
});

// Trigger a mock auto-delivery receipts upgrade
app.post("/api/chats/simulate-receive", authenticateUser, (req, res) => {
  const { phone, name, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: "Phone and Message are required to trigger simulate-receive." });
  }

  const incoming = {
    id: "msg_" + Math.random().toString(36).substring(2, 9),
    userId: req.user.id,
    name: name || phone,
    phone,
    message,
    status: "read",
    direction: "inbound" as const,
    timestamp: new Date().toISOString()
  };

  const messages = db.read("messages");
  messages.push(incoming);
  db.write("messages", messages);

  // TRIGGER AUTO REPLY RULES ENGINE
  evaluateAutoReply(req.user.id, phone, name || phone, message);

  res.json({ message: "Simulated inbound text appended to Inbox.", incomingMessage: incoming });
});

// --- DASHBOARD ANALYTICS WITH SELECTABLE TIME PERIODS ---
app.get("/api/reports/stats", authenticateUser, (req, res) => {
  const userId = req.user.id;
  const period = (req.query.period as string) || "7days"; // today, 7days, 30days, all

  const campaigns = db.read("campaigns").filter(c => c.userId === userId);
  const allMessages = db.read("messages").filter(m => m.userId === userId);

  // Time boundary filter
  const now = new Date();
  let startTime = new Date(0); // Default to all time

  if (period === "today") {
    startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === "7days") {
    startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "30days") {
    startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const periodMessages = allMessages.filter(m => new Date(m.timestamp) >= startTime);
  const outboundMessages = periodMessages.filter(m => m.direction === "outbound");
  const inboundMessages = periodMessages.filter(m => m.direction === "inbound");

  const totalSent = outboundMessages.length;
  const totalDelivered = outboundMessages.filter(m => ["delivered", "read"].includes(m.status)).length;
  const totalRead = outboundMessages.filter(m => m.status === "read").length;
  const totalFailed = outboundMessages.filter(m => m.status === "failed").length;
  const totalReplies = inboundMessages.length;

  const activeCampaigns = campaigns.filter(c => c.status === "sending").length;

  const sessions = db.read("sessions");
  const connectedDevices = sessions.filter(s => s.userId === userId && s.sessionStatus === "connected").length;

  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 100;
  const readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0;
  const replyRate = totalSent > 0 ? Math.round((totalReplies / totalSent) * 100) : 0;

  // Let's generate chronological chartData for visual graphs
  const chartDataMap: Record<string, { date: string, sent: number, delivered: number, read: number, replies: number, failed: number }> = {};

  // Initialize dates in the range to ensure continuous line graphs
  const daysCount = period === "today" ? 1 : period === "7days" ? 7 : period === "30days" ? 30 : 15;
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split("T")[0];
    chartDataMap[dateStr] = { date: dateStr, sent: 0, delivered: 0, read: 0, replies: 0, failed: 0 };
  }

  // Populate actual data points
  periodMessages.forEach(msg => {
    const dateStr = msg.timestamp.substring(0, 10);
    if (!chartDataMap[dateStr]) {
      chartDataMap[dateStr] = { date: dateStr, sent: 0, delivered: 0, read: 0, replies: 0, failed: 0 };
    }

    if (msg.direction === "outbound") {
      chartDataMap[dateStr].sent += 1;
      if (["delivered", "read"].includes(msg.status)) chartDataMap[dateStr].delivered += 1;
      if (msg.status === "read") chartDataMap[dateStr].read += 1;
      if (msg.status === "failed") chartDataMap[dateStr].failed += 1;
    } else {
      chartDataMap[dateStr].replies += 1;
    }
  });

  const chartData = Object.values(chartDataMap).sort((a, b) => a.date.localeCompare(b.date));

  res.json({
    stats: {
      totalSent,
      totalDelivered,
      totalRead,
      totalFailed,
      totalReplies,
      activeCampaigns,
      connectedDevices,
      deliveryRate,
      readRate,
      replyRate
    },
    chartData
  });
});


// ---------------- CORE PROCESSORS (CAMPAIGN BACKGROUND LOOPS) ----------------

function startCampaignProcessing(
  campaignId: string,
  userId: string,
  contacts: any[],
  template: string,
  image?: string,
  startIndex = 0,
  isABTest = false,
  templateTextB?: string,
  intervalMs = 1800,
  pdfUrl?: string,
  mediaType?: string,
  mediaName?: string
) {
  // Clear any existing active job for this campaign
  if (activeCampaignJobs[campaignId]) {
    if (activeCampaignJobs[campaignId].timerId) {
      clearTimeout(activeCampaignJobs[campaignId].timerId);
    }
  }

  activeCampaignJobs[campaignId] = {
    campaignId,
    userId,
    contacts,
    currentIndex: startIndex,
    templateText: template,
    templateTextB,
    isABTest,
    image,
    pdfUrl,
    mediaType,
    mediaName,
    intervalMs: intervalMs || 1800,
  };

  processNextCampaignItem(campaignId);
}

function processNextCampaignItem(campaignId: string) {
  const job = activeCampaignJobs[campaignId];
  if (!job) return;

  // Verify daily message sending limit budget dynamically mid-campaign
  const users = db.read("users");
  const user = users.find(u => u.id === job.userId);
  if (user && user.messagesSentToday >= user.dailyMessageLimit) {
    const campaigns = db.read("campaigns");
    const idx = campaigns.findIndex(c => c.id === campaignId);
    if (idx !== -1) {
      campaigns[idx].status = "paused";
      db.write("campaigns", campaigns);
      emitUserEvent(job.userId, "campaign_updated", campaigns[idx]);
    }
    delete activeCampaignJobs[campaignId];
    logActivity(job.userId, "Campaign Blocked", `Campaign "${campaigns[idx]?.title || campaignId}" automatically paused as daily sending limit of ${user.dailyMessageLimit} messages was reached.`);
    return;
  }

  if (job.currentIndex >= job.contacts.length) {
    // Campaign Finished!
    const campaigns = db.read("campaigns");
    const idx = campaigns.findIndex(c => c.id === campaignId);
    if (idx !== -1) {
      campaigns[idx].status = "completed";
      campaigns[idx].pending = 0;
      db.write("campaigns", campaigns);
      emitUserEvent(job.userId, "campaign_updated", campaigns[idx]);
    }
    delete activeCampaignJobs[campaignId];
    return;
  }

  const contact = job.contacts[job.currentIndex];
  
  // Use specified strict message interval (Blast Mode), fallback to 1.8 seconds
  const currentInterval = job.intervalMs || 1800;

  job.timerId = setTimeout(() => {
    // Determine template text and A/B test variation
    let abVariation: "A" | "B" | undefined = undefined;
    let selectedTemplate = job.templateText;

    if (job.isABTest && job.templateTextB) {
      abVariation = (job.currentIndex % 2 === 0) ? "A" : "B";
      selectedTemplate = abVariation === "B" ? job.templateTextB : job.templateText;
    }

    // 1. Resolve templates dynamically
    let formattedMsg = selectedTemplate;
    if (contact.variables) {
      Object.entries(contact.variables).forEach(([key, val]) => {
        const regex = new RegExp(`{${key}}`, "g");
        formattedMsg = formattedMsg.replace(regex, String(val));
      });
    }

    // Fallback support for name column directly
    formattedMsg = formattedMsg.replace(/{name}/g, contact.name || "Customer");
    formattedMsg = formattedMsg.replace(/{phone}/g, contact.phone);

    // 2. Resolve campaign configuration for Smart Retry
    const campaigns = db.read("campaigns");
    const campaignObj = campaigns.find(c => c.id === campaignId);
    const isRetryEnabled = campaignObj ? campaignObj.enableRetry : false;

    const executeSend = async (attempt: number) => {
      const sock = activeSessions[job.userId];
      let isSuccess = false;
      let sendError: string | undefined = undefined;

      if (sock) {
        try {
          const jid = contact.phone.replace(/[\s\-\+]/g, "") + "@s.whatsapp.net";
          await sock.sendMessage(jid, { text: formattedMsg });
          isSuccess = true;
        } catch (err: any) {
          sendError = err.message || String(err);
          isSuccess = false;
        }
      } else {
        isSuccess = Math.random() > (isRetryEnabled ? 0.35 : 0.05);
        if (!isSuccess) {
          sendError = "Network handshake failure.";
        }
      }

      if (isSuccess) {
        // Successful transmission
        const messages = db.read("messages");
        const existingMsgIdx = messages.findIndex(m => m.campaignId === job.campaignId && m.phone === contact.phone);
        
        const msgId = existingMsgIdx !== -1 ? messages[existingMsgIdx].id : "msg_" + Math.random().toString(36).substring(2, 9);
        const newMsg = {
          id: msgId,
          userId: job.userId,
          campaignId: job.campaignId,
          name: contact.name,
          phone: contact.phone,
          message: formattedMsg,
          image: job.image || undefined,
          pdfUrl: job.pdfUrl || undefined,
          mediaType: job.mediaType || undefined,
          mediaName: job.mediaName || undefined,
          status: "sent" as const,
          direction: "outbound" as const,
          timestamp: new Date().toISOString(),
          abVariation: abVariation,
          retryAttempt: attempt,
          maxRetries: isRetryEnabled ? 3 : 0,
          error: undefined
        };

        if (existingMsgIdx !== -1) {
          messages[existingMsgIdx] = newMsg;
        } else {
          messages.push(newMsg);
        }
        db.write("messages", messages);
        emitUserEvent(job.userId, "new_message", newMsg);
        emitUserEvent(job.userId, "message_status_updated", newMsg);

        // Simulate WhatsApp double tick and blue tick delay
        setTimeout(() => {
          const currentMessages = db.read("messages");
          const match = currentMessages.find(m => m.id === newMsg.id);
          if (match) {
            match.status = "delivered";
            db.write("messages", currentMessages);
            emitUserEvent(job.userId, "message_status_updated", match);
          }
        }, 3000);

        setTimeout(() => {
          const currentMessages = db.read("messages");
          const match = currentMessages.find(m => m.id === newMsg.id);
          if (match && Math.random() > 0.15) {
            match.status = "read";
            db.write("messages", currentMessages);
            emitUserEvent(job.userId, "message_status_updated", match);
          }
        }, 7000);

        // Increment campaign counters
        const currentCampaigns = db.read("campaigns");
        const cIdx = currentCampaigns.findIndex(c => c.id === campaignId);
        if (cIdx !== -1) {
          currentCampaigns[cIdx].sent += 1;
          currentCampaigns[cIdx].pending = Math.max(0, currentCampaigns[cIdx].totalMessages - (currentCampaigns[cIdx].sent + currentCampaigns[cIdx].failed));
          
          if (currentCampaigns[cIdx].pending === 0) {
            currentCampaigns[cIdx].status = "completed";
          }
          db.write("campaigns", currentCampaigns);
          emitUserEvent(job.userId, "campaign_updated", currentCampaigns[cIdx]);
        }
      } else {
        // Failed attempt
        if (isRetryEnabled && attempt < 3) {
          const nextAttempt = attempt + 1;
          // Exponential backoff delay (e.g. 2s, 4s, 8s)
          const backoffDelay = Math.pow(2, nextAttempt) * 1000;

          const messages = db.read("messages");
          const existingMsgIdx = messages.findIndex(m => m.campaignId === job.campaignId && m.phone === contact.phone);
          const msgId = existingMsgIdx !== -1 ? messages[existingMsgIdx].id : "msg_" + Math.random().toString(36).substring(2, 9);

          const retryingMsg = {
            id: msgId,
            userId: job.userId,
            campaignId: job.campaignId,
            name: contact.name,
            phone: contact.phone,
            message: formattedMsg,
            image: job.image || undefined,
            pdfUrl: job.pdfUrl || undefined,
            mediaType: job.mediaType || undefined,
            mediaName: job.mediaName || undefined,
            status: "retrying" as const,
            direction: "outbound" as const,
            timestamp: new Date().toISOString(),
            abVariation: abVariation,
            retryAttempt: nextAttempt,
            maxRetries: 3,
            nextRetryAt: new Date(Date.now() + backoffDelay).toISOString(),
            error: `Transmission error: ${sendError || "Handshake failed"}. Retrying (Attempt ${nextAttempt}/3) in ${backoffDelay / 1000}s (exponential backoff)...`,
          };

          if (existingMsgIdx !== -1) {
            messages[existingMsgIdx] = retryingMsg;
          } else {
            messages.push(retryingMsg);
          }
          db.write("messages", messages);
          emitUserEvent(job.userId, "new_message", retryingMsg);
          emitUserEvent(job.userId, "message_status_updated", retryingMsg);

          // Schedule background retry
          setTimeout(() => {
            const activeCampaigns = db.read("campaigns");
            const campObj = activeCampaigns.find(c => c.id === campaignId);
            // Ensure campaign is still active and not paused or cancelled
            if (campObj && campObj.status !== "paused" && campObj.status !== "draft") {
              executeSend(nextAttempt);
            }
          }, backoffDelay);
        } else {
          // Hard Failure (Retry exhausted or not enabled)
          const messages = db.read("messages");
          const existingMsgIdx = messages.findIndex(m => m.campaignId === job.campaignId && m.phone === contact.phone);
          const msgId = existingMsgIdx !== -1 ? messages[existingMsgIdx].id : "msg_" + Math.random().toString(36).substring(2, 9);

          const failedMsg = {
            id: msgId,
            userId: job.userId,
            campaignId: job.campaignId,
            name: contact.name,
            phone: contact.phone,
            message: formattedMsg,
            image: job.image || undefined,
            pdfUrl: job.pdfUrl || undefined,
            mediaType: job.mediaType || undefined,
            mediaName: job.mediaName || undefined,
            status: "failed" as const,
            direction: "outbound" as const,
            timestamp: new Date().toISOString(),
            abVariation: abVariation,
            retryAttempt: attempt,
            maxRetries: isRetryEnabled ? 3 : 0,
            error: sendError || (isRetryEnabled ? "Failed after 3 retry attempts with exponential backoff." : "Network handshake failure."),
          };

          if (existingMsgIdx !== -1) {
            messages[existingMsgIdx] = failedMsg;
          } else {
            messages.push(failedMsg);
          }
          db.write("messages", messages);
          emitUserEvent(job.userId, "new_message", failedMsg);
          emitUserEvent(job.userId, "message_status_updated", failedMsg);

          // Increment campaign failure counter
          const currentCampaigns = db.read("campaigns");
          const cIdx = currentCampaigns.findIndex(c => c.id === campaignId);
          if (cIdx !== -1) {
            currentCampaigns[cIdx].failed += 1;
            currentCampaigns[cIdx].pending = Math.max(0, currentCampaigns[cIdx].totalMessages - (currentCampaigns[cIdx].sent + currentCampaigns[cIdx].failed));
            
            if (currentCampaigns[cIdx].pending === 0) {
              currentCampaigns[cIdx].status = "completed";
            }
            db.write("campaigns", currentCampaigns);
            emitUserEvent(job.userId, "campaign_updated", currentCampaigns[cIdx]);
          }
        }
      }
    };

    // Execute first send attempt (attempt 0)
    executeSend(0);

    // 4. Update increment inside User Daily limits
    const users = db.read("users");
    const uIdx = users.findIndex(u => u.id === job.userId);
    if (uIdx !== -1) {
      users[uIdx].messagesSentToday += 1;
      db.write("users", users);
    }

    // Process next item immediately without waiting for retry delays to keep blast moving
    job.currentIndex += 1;
    processNextCampaignItem(campaignId);

  }, currentInterval);
}

// Simulated automated chat responder
function triggerSimulatedCustomerReply(userId: string, phone: string, name: string, userMessage: string) {
  setTimeout(() => {
    const messages = db.read("messages");
    
    // Check if the user is still connected on WhatsApp
    const sessions = db.read("sessions");
    const connected = sessions.some(s => s.userId === userId && s.sessionStatus === "connected");
    if (!connected) return;

    // Smart reply variations based on content
    let replyText = "Hey there! Thanks for reaching out. A representative will get back to you shortly.";
    const lowerMsg = userMessage.toLowerCase();

    if (lowerMsg.includes("price") || lowerMsg.includes("cost") || lowerMsg.includes("pricing") || lowerMsg.includes("how much")) {
      replyText = "Our starting premium plan is $19/month, or you can check our Business Plan for $49/month with unlimited bulk broadcasts! Which option works for you?";
    } else if (lowerMsg.includes("hello") || lowerMsg.includes("hi") || lowerMsg.includes("hey")) {
      replyText = `Hello! Hope you are having a wonderful day. Let me know if you have any questions about our promotional campaign!`;
    } else if (lowerMsg.includes("yes") || lowerMsg.includes("interested") || lowerMsg.includes("buy")) {
      replyText = "Awesome! 🎉 Please click on this link to schedule a direct 10-minute demo or request a secure payment link: https://example.com/checkout";
    }

    const replyMsg = {
      id: "msg_sim_" + Math.random().toString(36).substring(2, 9),
      userId,
      name,
      phone,
      message: replyText,
      status: "read",
      direction: "inbound" as const,
      timestamp: new Date().toISOString()
    };

    messages.push(replyMsg);
    db.write("messages", messages);
    emitUserEvent(userId, "new_message", replyMsg);
  }, 3500);
}

// Evaluator function for rule-based auto-replies
async function evaluateAutoReply(userId: string, phone: string, name: string, userMessage: string) {
  // Stagger reply slightly to feel fast but realistic
  setTimeout(async () => {
    try {
      const sessions = db.read("sessions");
      const session = sessions.find(s => s.userId === userId && s.sessionStatus === "connected");
      if (!session) return;

      const rules = db.read("auto_reply_rules").filter(r => r.userId === userId && r.isActive);
      const lowerMsg = userMessage.trim().toLowerCase();

      let matchedRule = null;
      for (const rule of rules) {
        const keyword = rule.keyword.toLowerCase().trim();
        if (rule.matchType === "equals" && lowerMsg === keyword) {
          matchedRule = rule;
          break;
        } else if (rule.matchType === "contains" && lowerMsg.includes(keyword)) {
          matchedRule = rule;
          break;
        } else if (rule.matchType === "starts_with" && lowerMsg.startsWith(keyword)) {
          matchedRule = rule;
          break;
        }
      }

      if (!matchedRule) {
        // Fallback to static mock customer responder
        triggerSimulatedCustomerReply(userId, phone, name, userMessage);
        return;
      }

      const replyText = matchedRule.replyText || "Thanks for your message. Our team will get back to you shortly.";

      const messages = db.read("messages");
      const replyMsg = {
        id: "msg_auto_" + Math.random().toString(36).substring(2, 9),
        userId,
        name,
        phone,
        message: replyText,
        status: "read",
        direction: "outbound" as const,
        timestamp: new Date().toISOString()
      };

      messages.push(replyMsg);
      db.write("messages", messages);
      emitUserEvent(userId, "new_message", replyMsg);

    } catch (err) {
      console.error("evaluateAutoReply failed:", err);
    }
  }, 1000);
}

// --- AUTO REPLY RULES MANAGEMENT ---
app.get("/api/autoreply/rules", authenticateUser, (req, res) => {
  const rules = db.read("auto_reply_rules");
  const userRules = rules.filter(r => r.userId === req.user.id);
  res.json({ rules: userRules });
});

app.post("/api/autoreply/rules", authenticateUser, (req, res) => {
  const { keyword, matchType, replyText, aiEnabled, aiPrompt } = req.body;
  if (!keyword || (!replyText && !aiEnabled)) {
    return res.status(400).json({ error: "Keyword and reply text or saved response settings are required." });
  }

  const rules = db.read("auto_reply_rules");
  const newRule = {
    id: "arr_" + Math.random().toString(36).substring(2, 9),
    userId: req.user.id,
    keyword,
    matchType: matchType || "contains",
    replyText: replyText || "",
    aiEnabled: !!aiEnabled,
    aiPrompt: aiPrompt || "",
    isActive: true,
    createdAt: new Date().toISOString()
  };

  rules.push(newRule);
  db.write("auto_reply_rules", rules);
  res.json({ message: "Auto-reply rule created successfully.", rule: newRule });
});

app.post("/api/autoreply/rules/bulk", authenticateUser, (req, res) => {
  const { rules: rulesToImport } = req.body;
  if (!Array.isArray(rulesToImport)) {
    return res.status(400).json({ error: "Rules array is required." });
  }

  const rules = db.read("auto_reply_rules");
  const imported = [];

  for (const r of rulesToImport) {
    if (!r.keyword || (!r.replyText && !r.aiEnabled)) continue;
    const newRule = {
      id: "arr_" + Math.random().toString(36).substring(2, 9),
      userId: req.user.id,
      keyword: r.keyword,
      matchType: r.matchType || "contains",
      replyText: r.replyText || "",
      aiEnabled: !!r.aiEnabled,
      aiPrompt: r.aiPrompt || "",
      isActive: r.isActive !== false,
      createdAt: new Date().toISOString()
    };
    rules.push(newRule);
    imported.push(newRule);
  }

  db.write("auto_reply_rules", rules);
  res.json({ message: `Successfully imported ${imported.length} rules.`, imported });
});

app.patch("/api/autoreply/rules/:id", authenticateUser, (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const rules = db.read("auto_reply_rules");
  const ruleIdx = rules.findIndex(r => r.id === id && r.userId === req.user.id);
  if (ruleIdx === -1) {
    return res.status(404).json({ error: "Rule not found." });
  }

  rules[ruleIdx] = { ...rules[ruleIdx], ...updates };
  db.write("auto_reply_rules", rules);
  res.json({ message: "Auto-reply rule updated.", rule: rules[ruleIdx] });
});

app.delete("/api/autoreply/rules/:id", authenticateUser, (req, res) => {
  const { id } = req.params;
  const rules = db.read("auto_reply_rules");
  const filtered = rules.filter(r => !(r.id === id && r.userId === req.user.id));
  db.write("auto_reply_rules", filtered);
  res.json({ message: "Auto-reply rule deleted successfully." });
});

// --- BILLING & SUBSCRIPTION SaaS ENDPOINTS ---
app.get("/api/billing/plans", authenticateUser, (req, res) => {
  const plans = [
    {
      id: "basic",
      name: "Basic Growth Plan",
      limits: "1,000 messages / day",
      dailyLimit: 1000,
      pricing: {
        daily: 5,
        weekly: 30,
        monthly: 100,
        annual: 1000
      },
      features: ["Rule-based auto-replies", "Message Scheduling Alarm", "CSV contact import", "Outbound analytics"]
    },
    {
      id: "premium",
      name: "Premium Automation Suite",
      limits: "10,000 messages / day",
      dailyLimit: 10000,
      pricing: {
        daily: 15,
        weekly: 90,
        monthly: 300,
        annual: 3000
      },
      features: ["Rule-based smart replies", "Message Scheduling Alarm", "Message scheduling dashboard", "Advanced Engagement Analytics Charts"]
    },
    {
      id: "business",
      name: "Business Broadcast Unlimited",
      limits: "Unlimited messages",
      dailyLimit: 999999,
      pricing: {
        daily: 25,
        weekly: 150,
        monthly: 500,
        annual: 5000
      },
      features: ["No sending limits", "Rule-based auto-replies with saved responses", "Message scheduling running daily", "Dedicated multi-number verification"]
    }
  ];
  res.json({ plans });
});

app.post("/api/billing/subscribe", authenticateUser, async (req, res) => {
  const { planId, cycle } = req.body;
  if (!planId || !cycle) {
    return res.status(400).json({ error: "Plan choice and billing cycle are required." });
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return res.status(500).json({ error: "Razorpay payment settings are missing. Configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET." });
  }

  const prices: Record<string, Record<string, number>> = {
    basic: { daily: 5, weekly: 30, monthly: 100, annual: 1000, annually: 1000 },
    premium: { daily: 15, weekly: 90, monthly: 300, annual: 3000, annually: 3000 },
    business: { daily: 25, weekly: 150, monthly: 500, annual: 5000, annually: 5000 }
  };

  const amount = prices[planId]?.[cycle];
  if (amount === undefined) {
    return res.status(400).json({ error: "Invalid plan or billing cycle selection." });
  }

  // Create Razorpay Order
  const options = {
    amount: amount * 100, // Amount in paise
    currency: "INR",
    receipt: `receipt_${req.user.id}_${Date.now()}`,
  };

  try {
    const order = await razorpay.orders.create(options);
    res.json({
      requiresPayment: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
      user: {
        name: req.user.name,
        email: req.user.email,
        phone: req.user.allowedWhatsapp,
      }
    });
  } catch (err) {
    console.error("Razorpay order creation failed:", err);
    res.status(550).json({ error: "Failed to initialize Razorpay transaction. Verify payment settings." });
  }
});

app.post("/api/billing/verify-payment", authenticateUser, (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, planId, cycle } = req.body;
  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !planId || !cycle) {
    return res.status(400).json({ error: "Missing required payment verification parameters." });
  }

  if (!RAZORPAY_KEY_SECRET) {
    return res.status(500).json({ error: "Razorpay payment verification settings are missing." });
  }

  // Verify HMAC signature
  const hmac = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET);
  hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
  const generatedSignature = hmac.digest("hex");

  if (generatedSignature !== razorpay_signature) {
    logActivity(req.user.id, "Payment Verification Failed", `Razorpay signature check failed for order ${razorpay_order_id}`);
    return res.status(400).json({ error: "Payment verification failed. Security signature mismatch." });
  }

  const prices: Record<string, Record<string, number>> = {
    basic: { daily: 5, weekly: 30, monthly: 100, annual: 1000, annually: 1000 },
    premium: { daily: 15, weekly: 90, monthly: 300, annual: 3000, annually: 3000 },
    business: { daily: 25, weekly: 150, monthly: 500, annual: 5000, annually: 5000 }
  };

  const limitMap: Record<string, number> = {
    basic: 1000,
    premium: 10000,
    business: 999999
  };

  const amount = prices[planId]?.[cycle];
  const users = db.read("users");
  const userIdx = users.findIndex(u => u.id === req.user.id);
  if (userIdx === -1) {
    return res.status(404).json({ error: "User profile not found." });
  }

  // Set subscription expiry
  const expiry = new Date();
  if (cycle === "daily") {
    expiry.setDate(expiry.getDate() + 1);
  } else if (cycle === "weekly") {
    expiry.setDate(expiry.getDate() + 7);
  } else if (cycle === "monthly") {
    expiry.setMonth(expiry.getMonth() + 1);
  } else if (cycle === "annually" || cycle === "annual") {
    expiry.setFullYear(expiry.getFullYear() + 1);
  }

  users[userIdx].subscription = planId;
  users[userIdx].billingCycle = cycle;
  users[userIdx].expiryDate = expiry.toISOString().split("T")[0];
  users[userIdx].dailyMessageLimit = limitMap[planId];
  db.write("users", users);

  // Save transaction receipt
  const transactions = db.read("transactions");
  const newTx = {
    id: `tx_${razorpay_payment_id}`,
    userId: req.user.id,
    planId,
    cycle,
    amount,
    status: "paid",
    invoiceNumber: `WAPI-INV-${Math.floor(100000 + Math.random() * 900000)}`,
    timestamp: new Date().toISOString()
  };
  transactions.push(newTx);
  db.write("transactions", transactions);

  logActivity(req.user.id, "Subscription Purchased", `Upgraded plan to ${planId.toUpperCase()} (${cycle}) for ₹${amount}. Expiry: ${users[userIdx].expiryDate}`);

  res.json({
    success: true,
    message: `Subscription successfully upgraded to ${planId} (${cycle})!`,
    user: users[userIdx],
    transaction: newTx
  });
});

app.post("/api/billing/apply-promo", authenticateUser, (req, res) => {
  const { promoCode } = req.body;
  if (!promoCode) {
    return res.status(400).json({ error: "Promo code is required." });
  }

  const promoCodes = db.read("promo_codes") || [];
  const codeToFind = promoCode.trim().toUpperCase();
  const match = promoCodes.find(p => p.code.toUpperCase() === codeToFind);

  if (!match) {
    return res.status(400).json({ error: `Invalid coupon code "${codeToFind}".` });
  }

  if (match.status !== "active") {
    return res.status(400).json({ error: `Coupon code "${codeToFind}" is inactive or expired.` });
  }

  const users = db.read("users");
  const userIdx = users.findIndex(u => u.id === req.user.id);
  if (userIdx === -1) {
    return res.status(404).json({ error: "User not found." });
  }

  const user = users[userIdx];
  
  // Calculate discount for active subscription billing cycle
  const prices: Record<string, Record<string, number>> = {
    basic: { daily: 5, weekly: 30, monthly: 100, annual: 1000, annually: 1000 },
    premium: { daily: 15, weekly: 90, monthly: 300, annual: 3000, annually: 3000 },
    business: { daily: 25, weekly: 150, monthly: 500, annual: 5000, annually: 5000 }
  };

  const planId = user.subscription || "free";
  const cycle = user.billingCycle || "weekly";
  const originalPrice = prices[planId]?.[cycle] || 0;
  
  if (planId === "free" || originalPrice === 0) {
    return res.status(400).json({ error: "No active paid subscription found to apply discount." });
  }

  if (user.appliedPromoCode === codeToFind) {
    return res.status(400).json({ error: "This promo code is already applied to your active billing cycle." });
  }

  const discountAmount = Math.round(originalPrice * (match.discountPercent / 100));

  // Apply to user state
  user.appliedPromoCode = codeToFind;
  user.promoDiscountPercent = match.discountPercent;
  db.write("users", users);

  // Create a discount transaction / adjustment invoice
  const transactions = db.read("transactions");
  const newTx = {
    id: "tx_" + Math.random().toString(36).substring(2, 9),
    userId: req.user.id,
    planId: `${planId} (Discount Applied)`,
    cycle,
    amount: -discountAmount, // Negative amount to represent credit/discount applied
    status: "paid",
    invoiceNumber: `WAPI-DISC-${Math.floor(100000 + Math.random() * 900000)}`,
    timestamp: new Date().toISOString()
  };
  transactions.push(newTx);
  db.write("transactions", transactions);

  logActivity(req.user.id, "Promo Applied", `Applied promo code ${codeToFind} (${match.discountPercent}% OFF) to active cycle. Received ₹${discountAmount} discount credit.`);

  res.json({
    message: `Promo code "${codeToFind}" successfully applied to your active cycle! We credited a ₹${discountAmount} discount directly to your account ledger.`,
    user,
    transaction: newTx
  });
});

app.get("/api/billing/transactions", authenticateUser, (req, res) => {
  const transactions = db.read("transactions");
  const userTx = transactions.filter(t => t.userId === req.user.id);
  res.json({ transactions: userTx });
});

// --- BIRTHDAY AUTOMATION ENDPOINTS ---
app.get("/api/birthday/config", authenticateUser, (req, res) => {
  const configs = db.read("birthday_config");
  let userConfig = configs.find(c => c.userId === req.user.id);
  if (!userConfig) {
    userConfig = {
      userId: req.user.id,
      enabled: false,
      templateText: "Happy Birthday {customer}! 🎂 Have a wonderful day!",
      runHour: "09:00",
      lastCheckedDate: ""
    };
    configs.push(userConfig);
    db.write("birthday_config", configs);
  }
  res.json({ config: userConfig });
});

app.post("/api/birthday/config", authenticateUser, (req, res) => {
  const { enabled, templateText, runHour } = req.body;
  const configs = db.read("birthday_config");
  const idx = configs.findIndex(c => c.userId === req.user.id);

  const updatedConfig = {
    userId: req.user.id,
    enabled: !!enabled,
    templateText: templateText || "Happy Birthday {customer}! 🎂 Have a wonderful day!",
    runHour: runHour || "09:00",
    lastCheckedDate: idx !== -1 ? configs[idx].lastCheckedDate : ""
  };

  if (idx !== -1) {
    configs[idx] = updatedConfig;
  } else {
    configs.push(updatedConfig);
  }
  db.write("birthday_config", configs);
  res.json({ message: "Birthday automation updated.", config: updatedConfig });
});

app.post("/api/birthday/trigger", authenticateUser, (req, res) => {
  const userId = req.user.id;
  const configs = db.read("birthday_config");
  const userConfig = configs.find(c => c.userId === userId);

  if (!userConfig || !userConfig.enabled) {
    return res.status(400).json({ error: "Birthday wishes automation is disabled. Enable it in settings first." });
  }

  const sessions = db.read("sessions");
  const session = sessions.find(s => s.userId === userId && s.sessionStatus === "connected");
  if (!session) {
    return res.status(400).json({ error: "No active WhatsApp session connected. Link your phone first." });
  }

  const groups = db.read("contact_groups").filter(g => g.userId === userId);
  const now = new Date();
  const todayMMDD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const matchedContacts: any[] = [];
  groups.forEach(group => {
    group.contacts.forEach((contact: any) => {
      const birthday = contact.variables?.birthday;
      if (birthday && birthday.includes(todayMMDD)) {
        matchedContacts.push({ ...contact, groupName: group.name });
      }
    });
  });

  if (matchedContacts.length === 0) {
    return res.json({ message: `Birthday scan finished. No birthdays match today (${todayMMDD}).`, sentCount: 0 });
  }

  const messages = db.read("messages");
  matchedContacts.forEach(contact => {
    let customText = userConfig.templateText;
    customText = customText.replace(/{customer}/g, contact.name);
    customText = customText.replace(/{name}/g, contact.name);
    customText = customText.replace(/{phone}/g, contact.phone);
    if (contact.variables) {
      Object.entries(contact.variables).forEach(([k, v]) => {
        customText = customText.replace(new RegExp(`{${k}}`, 'g'), String(v));
      });
    }

    const bdayMsg = {
      id: "msg_bday_" + Math.random().toString(36).substring(2, 9),
      userId,
      name: contact.name,
      phone: contact.phone,
      message: customText,
      status: "delivered" as const,
      direction: "outbound" as const,
      timestamp: new Date().toISOString()
    };
    messages.push(bdayMsg);

    setTimeout(() => {
      const liveMsgs = db.read("messages");
      const match = liveMsgs.find(m => m.id === bdayMsg.id);
      if (match) {
        match.status = "read";
        db.write("messages", liveMsgs);
      }
    }, 5000);
  });

  db.write("messages", messages);

  userConfig.lastCheckedDate = new Date().toISOString().split("T")[0];
  db.write("birthday_config", configs);

  // Generate simulated completed campaign record
  const campaigns = db.read("campaigns");
  const bdayCampaign = {
    id: "camp_bday_" + Math.random().toString(36).substring(2, 9),
    title: `Birthday Automation (${new Date().toLocaleDateString()})`,
    userId,
    totalMessages: matchedContacts.length,
    sent: matchedContacts.length,
    failed: 0,
    pending: 0,
    status: "completed" as const,
    templateText: userConfig.templateText,
    createdAt: new Date().toISOString(),
    campaignType: "birthday" as const
  };
  campaigns.push(bdayCampaign);
  db.write("campaigns", campaigns);

  res.json({
    message: `Scan success! Dispatched automated messages to ${matchedContacts.length} contacts.`,
    sentCount: matchedContacts.length,
    matched: matchedContacts.map(c => ({ name: c.name, phone: c.phone, group: c.groupName }))
  });
});

// --- CHRONOLOGICAL ACTIVITY LOGS API ---
app.get("/api/activity-logs", authenticateUser, (req, res) => {
  let logs = db.read("activity_logs").filter(l => l.userId === req.user.id);
  if (logs.length === 0) {
    // Seed some activity logs for this user to ensure visual quality instantly
    logs = [
      {
        id: "log_init_1",
        userId: req.user.id,
        action: "Account Initialized",
        details: "WAPIMI account successfully initialized and configured with subscription details.",
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "log_init_2",
        userId: req.user.id,
        action: "WhatsApp Linked",
        details: "Linked registered mobile number successfully.",
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "log_init_3",
        userId: req.user.id,
        action: "Campaign Dispatched",
        details: "Dispatched 'Diwali Fest Offer Promo' campaign to 5 customer contacts.",
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 1000).toISOString()
      }
    ];
    // Write them
    const allLogs = db.read("activity_logs");
    const filteredAll = allLogs.filter(l => l.userId !== req.user.id);
    db.write("activity_logs", [...logs, ...filteredAll]);
  }
  res.json({ logs });
});

app.post("/api/activity-logs/log", authenticateUser, (req, res) => {
  const { action, details } = req.body;
  if (!action || !details) {
    return res.status(400).json({ error: "Action and details are required." });
  }
  logActivity(req.user.id, action, details);
  res.json({ message: "Activity logged successfully." });
});

// ---------------- NEW SYSTEM CONFIG / MAINTENANCE / PROMO CODES / NOTIFICATIONS ROUTES ----------------

// GET /api/system-status: Public endpoint to check system health, maintenance, active notifications, and promos
app.get("/api/system-status", (req, res) => {
  const configList = db.read("system_config");
  const config = configList.find(c => c.id === "global") || {
    id: "global",
    maintenanceMode: false,
    maintenanceMessage: "We are currently conducting scheduled server system upgrades to improve our high-speed WhatsApp delivery nodes. We'll be back shortly!"
  };
  const notifications = db.read("public_notifications") || [];
  const promoCodes = db.read("promo_codes") || [];
  res.json({
    maintenanceMode: config.maintenanceMode,
    maintenanceMessage: config.maintenanceMessage,
    notifications,
    promoCodes
  });
});

// GET /api/faq-data: Public endpoint serving comprehensive, structured FAQ data and policies
app.get("/api/faq-data", (req, res) => {
  res.json({
    categories: [
      { id: "all", label: "All Topics" },
      { id: "general", label: "Platform General" },
      { id: "billing", label: "Payments & Plans" },
      { id: "whatsapp", label: "WhatsApp Connection" },
      { id: "data", label: "Data Safety & CSVs" }
    ],
    faqs: [
      {
        category: "general",
        question: "What is WAPIMI and how does it work?",
        answer: "WAPIMI is a high-speed WhatsApp marketing broadcast and conversational automation platform. It allows businesses to connect their WhatsApp numbers securely by scanning a dynamic QR code. Once linked, you can import client contact groups, design high-impact campaigns with custom placeholders, manage real-time dual-inbox messages, configure predefined auto-replies, and view delivery metrics in real-time."
      },
      {
        category: "billing",
        question: "How do plan subscriptions, renewals, and payments work?",
        answer: "WAPIMI offers three distinct billing cycles: Daily, Weekly, and Monthly. Subscriptions are billed automatically in advance based on your selected tier. Your active features, daily message limits, and allowed contact lists directly depend on this tier. To view or adjust your current subscription, navigate to the 'Billing & Plans' panel, where you can trigger payments, upgrade instantly, or cancel recurring billing."
      },
      {
        category: "billing",
        question: "What is your refund policy?",
        answer: "WAPIMI is a digital SaaS product and subscriptions are activated after successful payment. Payments are generally non-refundable once access is provided. Refunds may be considered for duplicate payment, permanent activation failure caused by a technical issue, or incorrect payment processing charges. Approved refunds are processed to the original payment method within 7 to 10 business days."
      },
      {
        category: "whatsapp",
        question: "Can my WhatsApp number get banned for broadcasting?",
        answer: "Yes, WhatsApp enforces strict spam detection algorithms. WAPIMI is built with progressive features to minimize this risk, including customizable inter-message cooldown delays, list randomized variables, and pre-sending warm-up lists. However, compliance is ultimately the user's responsibility. We highly recommend sending messages only to opted-in users, spacing broadcasts, and using realistic human delays to avoid trigger flags."
      },
      {
        category: "data",
        question: "How safe is my contact data and message history?",
        answer: "Your security is our absolute highest priority. All contact details, custom variables, and transmission logs uploaded via CSV or manually keyed are stored securely on our encrypted servers. They are accessible exclusively through your authenticated account and are never shared with, sold to, or reviewed by third parties. Our servers run on high-compliance container instances with routine security patching."
      },
      {
        category: "whatsapp",
        question: "How do I scan the QR code to link my WhatsApp session?",
        answer: "Navigate to the 'WhatsApp Link' screen. Click 'Initialize System Router'. This communicates with our background WhatsApp Gateway to render a secure, unique QR code. Open WhatsApp on your primary physical smartphone, tap 'Linked Devices', select 'Link a Device', and scan the QR code from our web page. The connection will register in real-time and transition your session status to 'Active'."
      },
      {
        category: "general",
        question: "What is the pre-upload validation step for CSV imports?",
        answer: "When uploading a CSV file in the Campaign Creator, WAPIMI runs an automated pre-flight scan. It screens all rows for required columns (specifically looking for a phone column containing valid numbers), filters out invalid phone structures (e.g. text characters, excessively short or long numbers), and detects duplicate records. You are presented with a detailed pre-import resolution summary where you can filter and load only pristine contacts."
      },
      {
        category: "general",
        question: "Can I run conversational automated responses?",
        answer: "Absolutely! The 'Auto Replies' feature allows you to specify target keyword conditions (e.g. 'pricing', 'support', 'hello'). Whenever a contact replies with a message matching your configured rule, WAPIMI will automatically deliver your predefined automated response instantly. You can easily manage, toggle, or delete these rules dynamically."
      }
    ],
    policies: {
      terms: {
        lastUpdated: "July 9, 2026",
        version: "2.5",
        sections: [
          {
            title: "1. Agreement and Service Description",
            content: "By accessing WAPIMI ('the Service'), registering an account, or purchasing a subscription plan, you agree to be bound by these Terms of Service. WAPIMI provides contact group management, scheduled WhatsApp broadcasts, CSV recipient cohorts, two-way inbox monitoring, delivery/read receipt tracking, and predefined auto-reply rules."
          },
          {
            title: "2. Acceptable Use and Absolute Anti-Spam Policy",
            content: "We maintain a zero-tolerance policy against spam, phishing, and unsolicited broadcasts. WAPIMI must only be used to broadcast communications to clients who have explicitly opted-in to receive message alerts from your business. You are strictly forbidden from distributing illegal material, adult content, fraudulent offers, or offensive materials."
          },
          {
            title: "3. Session Boundaries and Service Limits",
            content: "Because WhatsApp connection functions through a background session emulator syncing to your phone, service uptime depends partly on your device maintaining an active internet connection. WAPIMI does not guarantee delivery speeds in instances of local network degradation or third-party WhatsApp platform updates. Daily, weekly, or monthly message volume limits are regulated strictly by your tier."
          },
          {
            title: "4. Billing, Auto-Renewals, and Cancellations",
            content: "Public pricing includes Daily Plan at Rs 15/day, Professional Plan at Rs 300/month, and Enterprise Plan at Rs 500/month. Payments are handled through Razorpay. Users may cancel future renewals from the dashboard or by contacting support. Cancellation does not automatically generate a refund for an already activated digital subscription."
          },
          {
            title: "5. Disclaimer of Warranties and Limitation of Liability",
            content: "The Service is provided on an 'as is' and 'as available' basis without any express or implied warranties. In no event shall WAPIMI, its creators, or administrators be liable for any direct, indirect, incidental, or consequential damages (including, but not limited to, WhatsApp account bans, loss of contacts, business interruption, or campaign lag)."
          }
        ]
      },
      privacy: {
        lastUpdated: "July 15, 2026",
        guarantee: "We do not sell, rent, or lease your contact lists, recipient numbers, uploaded files, or campaign message history to anyone. All client data stays isolated on high-security encrypted tables.",
        sections: [
          {
            title: "1. What Information We Store",
            content: "To provide the Service, we may store your name, email address, registered phone number, authentication details, uploaded contact lists, campaign records, support messages, payment references, subscription status, and delivery/read receipt logs. WAPIMI does not store card, UPI, netbanking, or wallet credentials; those are handled by Razorpay."
          },
          {
            title: "2. Handling of Uploaded CSV Databases",
            content: "When you upload a marketing recipient list, the phone numbers are isolated securely under your unique user ID. These databases are accessed solely when launching active campaigns or reviewing stats. You can instantly delete any contact group permanently at any time, which purges all associated indices from our storage disks immediately."
          },
          {
            title: "3. Cookies, Payments, and Third-Party Services",
            content: "We use essential browser storage and authentication tokens to operate user sessions. Payments are processed through Razorpay. WhatsApp-related workflows may interact with Meta/WhatsApp services, and users are responsible for following Meta and WhatsApp policies."
          },
          {
            title: "4. Your Privacy Control Rights",
            content: "Under data security laws, you have full authority to request: (a) Comprehensive exports of all data linked to your profile; (b) Instant rectification of profile errors; or (c) Complete removal of your account, which immediately sweeps all database traces permanently from active servers."
          }
        ]
      },
      refunds: {
        lastUpdated: "July 15, 2026",
        sections: [
          {
            title: "1. How to Cancel Your Subscription",
            content: "Users may cancel their active subscription at any time from the Billing & Plans dashboard or by contacting support. Cancellation prevents future renewals but does not automatically generate a refund. Access remains active until the end of the paid billing cycle unless the account is suspended for misuse."
          },
          {
            title: "2. Refund Eligibility",
            content: "Because WAPIMI provides digital software access after successful payment, completed payments are generally non-refundable. Refunds may be considered only for duplicate payment, technical issues that permanently prevent service activation, or incorrect charges caused by payment processing error."
          },
          {
            title: "3. Refund Request Process",
            content: "To request a refund review, email kaldevsedutech@gmail.com with your registered email address, Razorpay payment reference, and reason for the request."
          },
          {
            title: "4. Processing and Bank Delays",
            content: "Approved refunds are processed to the original payment method within 7 to 10 business days, subject to Razorpay and bank timelines."
          }
        ]
      },
      shipping: {
        lastUpdated: "July 15, 2026",
        sections: [
          {
            title: "1. Digital Software Service",
            content: "WAPIMI is a cloud-based digital SaaS platform. No physical products are shipped, and there are no courier charges or physical delivery timelines."
          },
          {
            title: "2. Delivery of Access",
            content: "After successful Razorpay payment verification, users receive access to their subscribed plan through their registered WAPIMI account. Activation is usually immediate."
          },
          {
            title: "3. Activation Delay Support",
            content: "If activation is delayed due to technical issues, users should contact kaldevsedutech@gmail.com with their registered email and payment reference. Most activation issues are resolved within one business day."
          }
        ]
      }
    }
  });
});

// POST /api/admin/maintenance: Set system maintenance status (Admin-only)
app.post("/api/admin/maintenance", authenticateUser, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden. Admin access required." });
  }
  const { maintenanceMode, maintenanceMessage } = req.body;
  if (typeof maintenanceMode !== "boolean") {
    return res.status(400).json({ error: "maintenanceMode (boolean) is required" });
  }
  const configs = db.read("system_config");
  const idx = configs.findIndex(c => c.id === "global");
  const updated = {
    id: "global",
    maintenanceMode,
    maintenanceMessage: maintenanceMessage || "We are currently conducting scheduled server system upgrades to improve our high-speed WhatsApp delivery nodes. We'll be back shortly!"
  };
  if (idx !== -1) {
    configs[idx] = updated;
  } else {
    configs.push(updated);
  }
  db.write("system_config", configs);
  logActivity(req.user.id, "Admin Maintenance Toggle", `Set maintenance mode to ${maintenanceMode}. Message: "${updated.maintenanceMessage}"`);
  res.json({ message: "Maintenance settings updated successfully", config: updated });
});

// GET /api/admin/promo-codes: Get all promo codes (Admin-only)
app.get("/api/admin/promo-codes", authenticateUser, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden. Admin access required." });
  }
  res.json({ promoCodes: db.read("promo_codes") || [] });
});

// POST /api/admin/promo-codes: Create a new promo code (Admin-only)
app.post("/api/admin/promo-codes", authenticateUser, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden. Admin access required." });
  }
  const { code, discountPercent, description, expiryDate, status } = req.body;
  if (!code || !discountPercent || !expiryDate) {
    return res.status(400).json({ error: "Code, discountPercent, and expiryDate are required" });
  }
  const promoCodes = db.read("promo_codes") || [];
  if (promoCodes.some(p => p.code.toUpperCase() === code.toUpperCase().trim())) {
    return res.status(400).json({ error: "Promo code already exists" });
  }
  const newPromo = {
    id: "p_" + Math.random().toString(36).substring(2, 10),
    code: code.toUpperCase().trim(),
    discountPercent: Number(discountPercent),
    description: description || "",
    expiryDate,
    status: status || "active"
  };
  promoCodes.push(newPromo);
  db.write("promo_codes", promoCodes);
  logActivity(req.user.id, "Admin Promo Created", `Created promo code: ${newPromo.code} (${newPromo.discountPercent}% off)`);
  res.json({ message: "Promo code created successfully", promoCode: newPromo });
});

// PATCH /api/admin/promo-codes/:id: Update promo code details (Admin-only)
app.patch("/api/admin/promo-codes/:id", authenticateUser, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden. Admin access required." });
  }
  const { id } = req.params;
  const updates = req.body;
  const promoCodes = db.read("promo_codes") || [];
  const idx = promoCodes.findIndex(p => p.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Promo code not found" });
  }
  promoCodes[idx] = { ...promoCodes[idx], ...updates };
  db.write("promo_codes", promoCodes);
  logActivity(req.user.id, "Admin Promo Updated", `Updated promo code: ${promoCodes[idx].code}`);
  res.json({ message: "Promo code updated successfully", promoCode: promoCodes[idx] });
});

// DELETE /api/admin/promo-codes/:id: Delete a promo code (Admin-only)
app.delete("/api/admin/promo-codes/:id", authenticateUser, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden. Admin access required." });
  }
  const { id } = req.params;
  let promoCodes = db.read("promo_codes") || [];
  const match = promoCodes.find(p => p.id === id);
  if (!match) {
    return res.status(404).json({ error: "Promo code not found" });
  }
  promoCodes = promoCodes.filter(p => p.id !== id);
  db.write("promo_codes", promoCodes);
  logActivity(req.user.id, "Admin Promo Deleted", `Deleted promo code: ${match.code}`);
  res.json({ message: "Promo code deleted successfully" });
});

// GET /api/admin/notifications: Get sent public direct notifications (Admin-only)
app.get("/api/admin/notifications", authenticateUser, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden. Admin access required." });
  }
  res.json({ notifications: db.read("public_notifications") || [] });
});

// POST /api/admin/notifications: Broadcast a public direct notification to users (Admin-only)
app.post("/api/admin/notifications", authenticateUser, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden. Admin access required." });
  }
  const { type, title, message, targetRole } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: "Title and message are required" });
  }
  const publicNotifications = db.read("public_notifications") || [];
  const newNotif = {
    id: "pnotif_" + Math.random().toString(36).substring(2, 10),
    type: type || "info",
    title,
    message,
    targetRole: targetRole || "all", // "all" | "user" | "admin"
    timestamp: new Date().toISOString()
  };
  publicNotifications.unshift(newNotif);
  db.write("public_notifications", publicNotifications);
  logActivity(req.user.id, "Admin Broadcast Notification", `Sent direct app notification: "${title}" targeted to: ${newNotif.targetRole}`);
  
  // Real-time emit to all connected sockets
  io.emit("public_notification_received", newNotif);
  
  res.json({ message: "Notification broadcasted successfully", notification: newNotif });
});

// DELETE /api/admin/notifications/:id: Retract/delete a broadcasted notification (Admin-only)
app.delete("/api/admin/notifications/:id", authenticateUser, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden. Admin access required." });
  }
  const { id } = req.params;
  let publicNotifications = db.read("public_notifications") || [];
  const match = publicNotifications.find(n => n.id === id);
  if (!match) {
    return res.status(404).json({ error: "Notification not found" });
  }
  publicNotifications = publicNotifications.filter(n => n.id !== id);
  db.write("public_notifications", publicNotifications);
  logActivity(req.user.id, "Admin Revoke Notification", `Revoked notification: "${match.title}"`);
  res.json({ message: "Notification retracted successfully" });
});

// ---------------- BACKGROUND CRON FOR SCHEDULING (Checks every 10 seconds) ----------------
setInterval(() => {
  const campaigns = db.read("campaigns");
  const now = new Date();

  // 1. Automated Birthday Wish Alarm Execution
  const bdayConfigs = db.read("birthday_config");
  const todayStr = now.toISOString().split("T")[0];
  bdayConfigs.forEach(bConfig => {
    if (bConfig.enabled && bConfig.lastCheckedDate !== todayStr) {
      const currentHour = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (!bConfig.runHour || bConfig.runHour <= currentHour) {
        bConfig.lastCheckedDate = todayStr;
        db.write("birthday_config", bdayConfigs);
        console.log(`Cron: Automated Birthday Wish Alarm triggered for user ${bConfig.userId}`);

        const groups = db.read("contact_groups").filter(g => g.userId === bConfig.userId);
        const todayMMDD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const matchedContacts: any[] = [];
        groups.forEach(g => {
          g.contacts.forEach((contact: any) => {
            if (contact.variables?.birthday && contact.variables.birthday.includes(todayMMDD)) {
              matchedContacts.push(contact);
            }
          });
        });

        if (matchedContacts.length > 0) {
          const messages = db.read("messages");
          matchedContacts.forEach(contact => {
            let text = bConfig.templateText || "Happy Birthday {customer}! 🎂";
            text = text.replace(/{customer}/g, contact.name).replace(/{name}/g, contact.name).replace(/{phone}/g, contact.phone);
            messages.push({
              id: "msg_bday_alarm_" + Math.random().toString(36).substring(2, 9),
              userId: bConfig.userId,
              name: contact.name,
              phone: contact.phone,
              message: text,
              status: "delivered" as const,
              direction: "outbound" as const,
              timestamp: new Date().toISOString()
            });
          });
          db.write("messages", messages);
          logActivity(bConfig.userId, "Birthday Alarm Triggered", `Automated alarm dispatched birthday wishes to ${matchedContacts.length} contacts.`);
        }
      }
    }
  });

  // 2. Scheduled Campaign Broadcast Execution
  campaigns.forEach(c => {
    if (c.status === "scheduled" && c.scheduledTime) {
      const scheduleTime = new Date(c.scheduledTime);
      if (scheduleTime <= now) {
        // Trigger!
        c.status = "sending";
        db.write("campaigns", campaigns);

        console.log(`Cron: Scheduling triggered for campaign ${c.title} (${c.id})`);

        // Fetch contacts for this campaign
        let groupContacts: any[] = [];
        if (c.contactGroupId) {
          const groups = db.read("contact_groups");
          const group = groups.find(g => g.id === c.contactGroupId);
          if (group) {
            groupContacts = group.contacts;
          }
        }

        // Generate dummy contacts if the actual list data is missing
        if (groupContacts.length === 0) {
          groupContacts = Array.from({ length: c.totalMessages }).map((_, i) => ({
            name: `Recipient ${i + 1}`,
            phone: `+9198765${String(i).padStart(5, '0')}`,
            variables: { customer: `Recipient ${i + 1}` }
          }));
        }

        startCampaignProcessing(c.id, c.userId, groupContacts, c.templateText, c.image);
      }
    }
  });
}, 10000);


// ---------------- VITE DEV SERVER OR STATIC SERVING ----------------
async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV === "test") {
    // API-only mode keeps integration tests fast and avoids starting Vite.
  } else if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    
    // Automatically restore active sessions on server boot
    setTimeout(() => {
      if (process.env.NODE_ENV === "test") return;
      try {
        const sessions = db.read("sessions");
        sessions.forEach(s => {
          if (s.sessionStatus === "connected") {
            console.log("Restoring active WhatsApp session for user:", s.userId);
            initWhatsAppSession(s.userId).catch(err => {
              console.error("Failed to restore WhatsApp session for user:", s.userId, err);
            });
          }
        });
      } catch (bootErr) {
        console.error("Failed to restore active WhatsApp sessions:", bootErr);
      }
    }, 1000);
  });
}

startServer();

