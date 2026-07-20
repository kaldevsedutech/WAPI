import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/wapi_db";

export async function connectMongoDB() {
  if (mongoose.connection.readyState >= 1) return;
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB Atlas connected successfully.");
  } catch (error) {
    console.warn("MongoDB connection warning (falling back to disk db):", (error as Error).message);
  }
}

// User Schema
const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: "user" },
  allowedWhatsapp: { type: String, default: "" },
  subscription: { type: String, default: "basic" },
  billingCycle: { type: String, default: "monthly" },
  expiryDate: { type: String, default: "" },
  status: { type: String, default: "active" },
  createdAt: { type: String, default: () => new Date().toISOString() },
  dailyMessageLimit: { type: Number, default: 1000 },
  messagesSentToday: { type: Number, default: 0 },
  activeSessionToken: { type: String, default: "" }
}, { timestamps: true });

export const UserDoc = mongoose.models.User || mongoose.model("User", UserSchema);

// Contact Group Schema
const ContactGroupSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: "" },
  contacts: { type: Array, default: [] },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true });

export const ContactGroupDoc = mongoose.models.ContactGroup || mongoose.model("ContactGroup", ContactGroupSchema);

// Campaign Schema
const CampaignSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  totalMessages: { type: Number, default: 0 },
  sent: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  pending: { type: Number, default: 0 },
  status: { type: String, default: "sending" },
  scheduledTime: { type: String, default: "" },
  templateText: { type: String, default: "" },
  createdAt: { type: String, default: () => new Date().toISOString() },
  campaignType: { type: String, default: "marketing" }
}, { timestamps: true });

export const CampaignDoc = mongoose.models.Campaign || mongoose.model("Campaign", CampaignSchema);

// Message Schema
const MessageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  name: { type: String, default: "" },
  phone: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, default: "delivered" },
  direction: { type: String, default: "outbound" },
  timestamp: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true });

export const MessageDoc = mongoose.models.Message || mongoose.model("Message", MessageSchema);

// Auto Reply Rule Schema
const AutoReplyRuleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  triggerKeyword: { type: String, required: true },
  matchType: { type: String, default: "exact" },
  replyText: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  created: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true });

export const AutoReplyRuleDoc = mongoose.models.AutoReplyRule || mongoose.model("AutoReplyRule", AutoReplyRuleSchema);

// Birthday Config Schema
const BirthdayConfigSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  enabled: { type: Boolean, default: false },
  templateText: { type: String, default: "Happy Birthday {customer}! 🎂 Have a wonderful day!" },
  runHour: { type: String, default: "09:00" },
  lastCheckedDate: { type: String, default: "" }
}, { timestamps: true });

export const BirthdayConfigDoc = mongoose.models.BirthdayConfig || mongoose.model("BirthdayConfig", BirthdayConfigSchema);

// Transaction Schema
const TransactionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  planId: { type: String, required: true },
  cycle: { type: String, default: "monthly" },
  amount: { type: Number, required: true },
  status: { type: String, default: "paid" },
  invoiceNumber: { type: String, default: "" },
  timestamp: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true });

export const TransactionDoc = mongoose.models.Transaction || mongoose.model("Transaction", TransactionSchema);

// Activity Log Schema
const ActivityLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  action: { type: String, required: true },
  details: { type: String, default: "" },
  timestamp: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true });

export const ActivityLogDoc = mongoose.models.ActivityLog || mongoose.model("ActivityLog", ActivityLogSchema);
