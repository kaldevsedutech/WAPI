import { User, WhatsAppSession, Campaign, ContactGroup, Chat, DashboardStats } from "../types";

const getHeaders = () => {
  const token = localStorage.getItem("wapi_token") || "";
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
};

export const api = {
  // Auth API
  login: async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Login failed");
    }
    return res.json();
  },

  getCurrentUser: async () => {
    const res = await fetch("/api/auth/me", {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Unauthenticated");
    return res.json();
  },

  // Admin APIs
  getUsers: async () => {
    const res = await fetch("/api/admin/users", { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to load users");
    return res.json();
  },

  createUser: async (userData: Partial<User>) => {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create user");
    }
    return res.json();
  },

  updateUser: async (id: string, updates: Partial<User>) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update user");
    }
    return res.json();
  },

  // WhatsApp API
  getSession: async (): Promise<{ session: WhatsAppSession; qrState: any }> => {
    const res = await fetch("/api/whatsapp/session", { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to load session");
    return res.json();
  },

  requestQR: async () => {
    const res = await fetch("/api/whatsapp/qr", {
      method: "POST",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to request QR");
    return res.json();
  },

  simulateScan: async (scannedNumber: string) => {
    const res = await fetch("/api/whatsapp/simulate-scan", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ scannedNumber }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Scan rejected by system rules.");
    }
    return res.json();
  },

  logoutDevice: async () => {
    const res = await fetch("/api/whatsapp/logout", {
      method: "POST",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Logout failed");
    return res.json();
  },

  // Contact Groups API
  getContactGroups: async (): Promise<{ contactGroups: ContactGroup[] }> => {
    const res = await fetch("/api/contact-groups", { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to load contact groups");
    return res.json();
  },

  saveContactGroup: async (name: string, contacts: any[]) => {
    const res = await fetch("/api/contact-groups", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ name, contacts }),
    });
    if (!res.ok) throw new Error("Failed to save contact list");
    return res.json();
  },

  deleteContactGroup: async (id: string) => {
    const res = await fetch(`/api/contact-groups/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete list");
    return res.json();
  },

  // Campaigns API
  getCampaigns: async (): Promise<{ campaigns: Campaign[] }> => {
    const res = await fetch("/api/campaigns", { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to load campaigns");
    return res.json();
  },

  getCampaignLogs: async (id: string): Promise<{ campaign: Campaign; logs: any[] }> => {
    const res = await fetch(`/api/campaigns/${id}/logs`, { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to load campaign logs");
    return res.json();
  },

  createCampaign: async (campaignData: {
    title: string;
    templateText: string;
    contacts: any[];
    image?: string;
    scheduledTime?: string;
    saveContactListName?: string;
    isABTest?: boolean;
    templateTextB?: string;
    intervalMs?: number;
    pdfUrl?: string;
    mediaType?: string;
    mediaName?: string;
    enableRetry?: boolean;
  }) => {
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(campaignData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create campaign");
    }
    return res.json();
  },
  
  createDirectCampaign: async (campaignData: {
    title: string;
    rows: any[];
    removeDuplicates: boolean;
    scheduleMode: string;
    scheduleAt?: string;
    delayBetweenValue?: number;
    delayBetweenUnit?: string;
  }) => {
    const res = await fetch("/api/campaigns/direct", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(campaignData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create direct campaign");
    }
    return res.json();
  },

  pauseCampaign: async (id: string) => {
    const res = await fetch(`/api/campaigns/${id}/pause`, {
      method: "POST",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to pause campaign");
    return res.json();
  },

  resumeCampaign: async (id: string) => {
    const res = await fetch(`/api/campaigns/${id}/resume`, {
      method: "POST",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to resume campaign");
    }
    return res.json();
  },

  stopCampaign: async (id: string) => {
    const res = await fetch(`/api/campaigns/${id}/stop`, {
      method: "POST",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to stop campaign");
    return res.json();
  },

  // Media Library API
  getMedia: async (): Promise<{ media: any[] }> => {
    const res = await fetch("/api/media", { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to load media assets");
    return res.json();
  },

  createMedia: async (mediaData: { name: string; type: string; url: string; size?: string }) => {
    const res = await fetch("/api/media", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(mediaData),
    });
    if (!res.ok) throw new Error("Failed to upload/create media asset");
    return res.json();
  },

  // Chat/Inbox API
  getChats: async (): Promise<{ chats: Chat[] }> => {
    const res = await fetch("/api/chats", { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to load chats");
    return res.json();
  },

  sendInboxMessage: async (phone: string, text: string, name?: string, image?: string, pdfUrl?: string, mediaType?: string, mediaName?: string) => {
    const res = await fetch(`/api/chats/${phone}/messages`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ message: text, name, image, pdfUrl, mediaType, mediaName }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to send message");
    }
    return res.json();
  },

  simulateInboundMessage: async (phone: string, text: string, name?: string) => {
    const res = await fetch("/api/chats/simulate-receive", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ phone, message: text, name }),
    });
    if (!res.ok) throw new Error("Failed to simulate incoming message");
    return res.json();
  },

  // Stats Analytics API
  getStats: async (period?: string): Promise<{ stats: DashboardStats & { totalReplies: number; replyRate: number }; chartData: any[] }> => {
    const url = period ? `/api/reports/stats?period=${period}` : "/api/reports/stats";
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to load dashboard stats");
    return res.json();
  },

  // Auto Reply Rules APIs
  getAutoReplyRules: async () => {
    const res = await fetch("/api/autoreply/rules", { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to load auto-reply rules");
    return res.json();
  },

  createAutoReplyRule: async (ruleData: { keyword: string; matchType: string; replyText: string; aiEnabled: boolean; aiPrompt?: string }) => {
    const res = await fetch("/api/autoreply/rules", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(ruleData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create rule");
    }
    return res.json();
  },

  importAutoReplyRulesBulk: async (rules: any[]) => {
    const res = await fetch("/api/autoreply/rules/bulk", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ rules })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to bulk import rules");
    }
    return res.json();
  },

  updateAutoReplyRule: async (id: string, updates: any) => {
    const res = await fetch(`/api/autoreply/rules/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update rule");
    }
    return res.json();
  },

  deleteAutoReplyRule: async (id: string) => {
    const res = await fetch(`/api/autoreply/rules/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to delete rule");
    return res.json();
  },

  // Billing APIs
  getBillingPlans: async () => {
    const res = await fetch("/api/billing/plans", { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to load plans");
    return res.json();
  },

  subscribeToPlan: async (planId: string, cycle: string) => {
    const res = await fetch("/api/billing/subscribe", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ planId, cycle })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Subscription upgrade failed");
    }
    return res.json();
  },

  verifyRazorpayPayment: async (verificationData: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
    planId: string;
    cycle: string;
  }) => {
    const res = await fetch("/api/billing/verify-payment", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(verificationData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Payment verification failed.");
    }
    return res.json();
  },

  applyPromoToActiveCycle: async (promoCode: string) => {
    const res = await fetch("/api/billing/apply-promo", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ promoCode })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to apply promotional code");
    }
    return res.json();
  },

  getTransactions: async () => {
    const res = await fetch("/api/billing/transactions", { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to load invoices");
    return res.json();
  },

  // Birthday Automation APIs
  getBirthdayConfig: async () => {
    const res = await fetch("/api/birthday/config", { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to load birthday config");
    return res.json();
  },

  saveBirthdayConfig: async (configData: { enabled: boolean; templateText: string; runHour: string }) => {
    const res = await fetch("/api/birthday/config", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(configData)
    });
    if (!res.ok) throw new Error("Failed to save birthday automation settings");
    return res.json();
  },

  triggerBirthdayCheck: async () => {
    const res = await fetch("/api/birthday/trigger", {
      method: "POST",
      headers: getHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Birthday greetings scan failed.");
    }
    return res.json();
  },

  // Chronological Activity Logs API
  getActivityLogs: async () => {
    const res = await fetch("/api/activity-logs", { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to load activity logs");
    return res.json();
  },

  logActivity: async (action: string, details: string) => {
    const res = await fetch("/api/activity-logs/log", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ action, details }),
    });
    if (!res.ok) throw new Error("Failed to log activity");
    return res.json();
  },

  getAdminActivityLogs: async () => {
    const res = await fetch("/api/admin/activity-logs", { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to load administrative audit logs");
    return res.json();
  },

  // Campaign trend stats API
  getCampaignTrend: async (): Promise<{ trend: any[] }> => {
    const res = await fetch("/api/campaigns/trend", { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to load campaign trend stats");
    return res.json();
  },

  // Update experience mode API
  updateExperienceMode: async (experienceMode: "daily" | "professional" | "advanced") => {
    const res = await fetch("/api/user/experience-mode", {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ experienceMode }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to save experience mode setting.");
    }
    return res.json();
  },

  // Update brand color API
  updateBrandColor: async (brandColor: string) => {
    const res = await fetch("/api/user/brand-color", {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ brandColor }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to save brand color setting.");
    }
    return res.json();
  },

  // Smart Insights API
  getSmartInsights: async (): Promise<{ insights: any[] }> => {
    const res = await fetch("/api/campaigns/smart-insights", { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to load smart marketing insights");
    return res.json();
  },

  // System Status API
  getSystemStatus: async (): Promise<{ maintenanceMode: boolean; maintenanceMessage: string; notifications: any[]; promoCodes: any[] }> => {
    const res = await fetch("/api/system-status");
    if (!res.ok) throw new Error("Failed to load system status");
    return res.json();
  },

  // Admin Maintenance Config API
  updateMaintenanceSettings: async (maintenanceMode: boolean, maintenanceMessage: string) => {
    const res = await fetch("/api/admin/maintenance", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ maintenanceMode, maintenanceMessage }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update maintenance settings");
    }
    return res.json();
  },

  // Admin Promo Codes API
  getAdminPromoCodes: async (): Promise<{ promoCodes: any[] }> => {
    const res = await fetch("/api/admin/promo-codes", { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to load promo codes");
    return res.json();
  },

  createPromoCode: async (promo: { code: string; discountPercent: number; description: string; expiryDate: string; status: string }) => {
    const res = await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(promo),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create promo code");
    }
    return res.json();
  },

  updatePromoCode: async (id: string, updates: any) => {
    const res = await fetch(`/api/admin/promo-codes/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update promo code");
    }
    return res.json();
  },

  deletePromoCode: async (id: string) => {
    const res = await fetch(`/api/admin/promo-codes/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete promo code");
    return res.json();
  },

  // Admin Direct Notifications API
  getAdminNotifications: async (): Promise<{ notifications: any[] }> => {
    const res = await fetch("/api/admin/notifications", { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to load public notifications");
    return res.json();
  },

  broadcastNotification: async (notif: { type: string; title: string; message: string; targetRole?: string }) => {
    const res = await fetch("/api/admin/notifications", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(notif),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to broadcast notification");
    }
    return res.json();
  },

  deleteBroadcastNotification: async (id: string) => {
    const res = await fetch(`/api/admin/notifications/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete broadcast notification");
    return res.json();
  },

  // Password Recovery Flow APIs
  forgotPassword: async (phoneOrEmail: string): Promise<{ message: string; simulatedCode: string }> => {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneOrEmail }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to initiate password recovery.");
    }
    return res.json();
  },

  resetPassword: async (payload: { phoneOrEmail: string; code: string; newPassword: string }): Promise<{ message: string }> => {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to reset password.");
    }
    return res.json();
  },
};
