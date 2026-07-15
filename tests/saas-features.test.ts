import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.TEST_BASE_URL || "http://127.0.0.1:3107";

const readJsonFile = (filePath: string) =>
  JSON.parse(fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, ""));

const readInternalDemoPhone = () => {
  const users = readJsonFile(path.resolve(__dirname, "../data/users.json"));
  const demoUser = users.find((u: any) => u.id === "u_demo");
  if (!demoUser?.allowedWhatsapp) throw new Error("Internal demo phone is missing");
  return demoUser.allowedWhatsapp;
};

describe("WAPISaaS REST API & Core Rules Integration Tests", () => {
  let authToken = "";

  it("should successfully log in the demo user using registered credentials", async () => {
    // The login route takes 'email' as the field name holding the phone input
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test-user-1",
        password: "user1"
      })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(data.user.id).toBe("u_demo");
    authToken = data.token;
  });

  it("should enforce daily limit checking when attempting to dispatch campaigns beyond budget", async () => {
    // Launch a campaign with more messages than remaining budget.
    // u_demo has a dailyMessageLimit of 10000. Attempting to dispatch 15000 contacts will exceed the limit.
    const contacts = Array.from({ length: 15000 }).map((_, i) => ({
      name: `User ${i}`,
      phone: `+9198765${String(i).padStart(5, "0")}`,
      variables: { customer: `User ${i}` }
    }));

    const res = await fetch(`${BASE_URL}/api/campaigns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({
        title: "Large Campaign Over Limit",
        templateText: "Hello {customer}",
        contacts: contacts
      })
    });

    expect(res.status).toBe(400);
    const errData = await res.json();
    expect(errData.error).toContain("Your subscription allows up to");
  });

  it("should reject QR scan simulation if the scanned number does not match the registered allowed number", async () => {
    // 1. Request QR code generation to transition state to qr_ready on backend
    await fetch(`${BASE_URL}/api/whatsapp/qr`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` }
    });

    // Wait for the simulated QR timeout (1.5 seconds) so backend transitions status to qr_ready
    await new Promise(resolve => setTimeout(resolve, 1800));

    // 2. Attempt to scan a different phone number
    const res = await fetch(`${BASE_URL}/api/whatsapp/simulate-scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({
        scannedNumber: "+910000099999"
      })
    });

    expect(res.status).toBe(400);
    const errData = await res.json();
    expect(errData.error).toContain("Security verification failed");
  });

  it("should retrieve billing plans and list detailed SaaS limits", async () => {
    const res = await fetch(`${BASE_URL}/api/billing/plans`, {
      headers: { "Authorization": `Bearer ${authToken}` }
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.plans).toBeDefined();
    expect(data.plans.length).toBeGreaterThan(0);
    
    // Premium plan should have limit definitions
    const premium = data.plans.find((p: any) => p.id === "premium");
    expect(premium).toBeDefined();
    expect(premium.dailyLimit).toBe(10000);
  });

  it("should create an auto-reply rule, simulate an incoming message, and verify auto-reply generation", async () => {
    // 0. Make sure the WhatsApp session is connected for this user
    await fetch(`${BASE_URL}/api/whatsapp/qr`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    await new Promise(resolve => setTimeout(resolve, 1800));
    await fetch(`${BASE_URL}/api/whatsapp/simulate-scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({
        scannedNumber: readInternalDemoPhone()
      })
    });

    // 1. Create a rule
    const ruleRes = await fetch(`${BASE_URL}/api/autoreply/rules`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({
        keyword: "discountCode",
        matchType: "contains",
        replyText: "Your discount code is SAVE20! Enjoy! 🚀",
        aiEnabled: false
      })
    });

    expect(ruleRes.status).toBe(200);
    const ruleData = await ruleRes.json();
    expect(ruleData.rule.id).toBeDefined();

    // 2. Simulate an incoming message matching the keyword "discountCode"
    const inboundRes = await fetch(`${BASE_URL}/api/chats/simulate-receive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({
        phone: readInternalDemoPhone(),
        message: "Can I get a discountCode please?"
      })
    });

    expect(inboundRes.status).toBe(200);

    // 3. Wait for the auto-reply engine stagger delay (1 second) to process and write the reply
    await new Promise(resolve => setTimeout(resolve, 1800));

    // 4. Fetch the chats/messages to verify the generated outbound message
    const chatsRes = await fetch(`${BASE_URL}/api/chats`, {
      headers: { "Authorization": `Bearer ${authToken}` }
    });

    expect(chatsRes.status).toBe(200);
    const chatsData = await chatsRes.json();
    
    const chat = chatsData.chats.find((c: any) => c.phone === readInternalDemoPhone());
    expect(chat).toBeDefined();

    // Look for our discountCode reply in the chat messages
    const autoReplyMsg = chat.messages.find((m: any) => 
      m.direction === "outbound" && m.message === "Your discount code is SAVE20! Enjoy! 🚀"
    );
    expect(autoReplyMsg).toBeDefined();

    // 5. Clean up the rule so it doesn't pollute the dev database
    const deleteRes = await fetch(`${BASE_URL}/api/autoreply/rules/${ruleData.rule.id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    expect(deleteRes.status).toBe(200);
  });

  it("should apply an active promo code and receive discount credit successfully", async () => {
    // Reset u_demo promo code in the db file to prevent test pollution
    const dbPath = path.resolve(__dirname, "../data/users.json");
    if (fs.existsSync(dbPath)) {
      const users = readJsonFile(dbPath);
      const uDemo = users.find((u: any) => u.id === "u_demo");
      if (uDemo) {
        delete uDemo.appliedPromoCode;
        delete uDemo.promoDiscountPercent;
        fs.writeFileSync(dbPath, JSON.stringify(users, null, 2), "utf-8");
      }
    }

    const res = await fetch(`${BASE_URL}/api/billing/apply-promo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({
        promoCode: "WAPI50"
      })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain("successfully applied");
    expect(data.user.appliedPromoCode).toBe("WAPI50");
    expect(data.user.promoDiscountPercent).toBe(50);
    expect(data.transaction.amount).toBeLessThan(0);
  });

  it("should configure birthday automation and trigger wishes scan", async () => {
    // 1. Save config
    const configRes = await fetch(`${BASE_URL}/api/birthday/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({
        enabled: true,
        templateText: "Happy Birthday {customer}! 🎂 Here is a 10% coupon: BDAY10",
        runHour: "10:00"
      })
    });

    expect(configRes.status).toBe(200);
    const configData = await configRes.json();
    expect(configData.config.enabled).toBe(true);

    // 2. Trigger the scan
    const triggerRes = await fetch(`${BASE_URL}/api/birthday/trigger`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` }
    });

    expect(triggerRes.status).toBe(200);
    const triggerData = await triggerRes.json();
    expect(triggerData.sentCount).toBeDefined();
  });

  it("should dispatch a campaign, pause it, and resume it successfully", async () => {
    // 1. Start a campaign
    const contacts = [
      { name: "Client A", phone: readInternalDemoPhone() },
      { name: "Client B", phone: "+910000000011" }
    ];

    const dispatchRes = await fetch(`${BASE_URL}/api/campaigns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({
        title: "Lifecycle Campaign Test",
        templateText: "Hello {name}, your code is 123",
        contacts: contacts,
        intervalMs: 3000
      })
    });

    expect(dispatchRes.status).toBe(200);
    const dispatchData = await dispatchRes.json();
    const campaignId = dispatchData.campaign.id;
    expect(campaignId).toBeDefined();
    expect(dispatchData.campaign.status).toBe("sending");

    // 2. Pause campaign
    const pauseRes = await fetch(`${BASE_URL}/api/campaigns/${campaignId}/pause`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` }
    });

    expect(pauseRes.status).toBe(200);
    const pauseData = await pauseRes.json();
    expect(pauseData.campaign.status).toBe("paused");

    // 3. Resume campaign
    const resumeRes = await fetch(`${BASE_URL}/api/campaigns/${campaignId}/resume`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` }
    });

    expect(resumeRes.status).toBe(200);
    const resumeData = await resumeRes.json();
    expect(resumeData.campaign.status).toBe("sending");

    // 4. Cancel/Stop campaign
    const stopRes = await fetch(`${BASE_URL}/api/campaigns/${campaignId}/stop`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` }
    });

    expect(stopRes.status).toBe(200);
    const stopData = await stopRes.json();
    expect(stopData.campaign.status).toBe("completed");
  });

  it("should successfully dispatch direct messages manually via the table campaigns route", async () => {
    const rows = [
      { name: "John", phone: readInternalDemoPhone(), message: "Hi John, this is direct msg 1", selected: true, repeat: 1 },
      { name: "Sam", phone: "+910000000012", message: "Hi Sam, this is direct msg 2", selected: true, repeat: 1 },
      { name: "Draft", phone: "+910000000013", message: "Skipped", selected: false, repeat: 1 }
    ];

    const res = await fetch(`${BASE_URL}/api/campaigns/direct`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({
        title: "Direct Table Campaign Test",
        rows: rows,
        removeDuplicates: true
      })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.campaign.id).toBeDefined();
    expect(data.campaign.totalMessages).toBe(2); // Only 2 selected rows
    expect(data.campaign.status).toBe("sending");

    // Clean up/cancel the campaign so it doesn't linger in sending state
    await fetch(`${BASE_URL}/api/campaigns/${data.campaign.id}/stop`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` }
    });
  });
});
