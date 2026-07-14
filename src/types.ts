export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  allowedWhatsapp: string;
  subscription: 'basic' | 'premium' | 'business' | 'none';
  billingCycle?: 'daily' | 'weekly' | 'annually' | 'none';
  expiryDate: string;
  status: 'active' | 'blocked';
  role: 'admin' | 'user';
  createdAt: string;
  dailyMessageLimit: number;
  messagesSentToday: number;
  experienceMode?: 'daily' | 'professional' | 'advanced';
}

export interface WhatsAppSession {
  userId: string;
  whatsappNumber: string;
  sessionStatus: 'disconnected' | 'qr_ready' | 'connecting' | 'connected' | 'auth_failed';
  qrCode?: string;
  lastError?: string;
  connectedAt?: string;
}

export interface Campaign {
  id: string;
  title: string;
  userId: string;
  totalMessages: number;
  sent: number;
  failed: number;
  pending: number;
  status: 'draft' | 'scheduled' | 'sending' | 'paused' | 'completed';
  scheduledTime?: string; // ISO String
  templateText: string;
  image?: string; // Base64 or URL
  pdfUrl?: string;
  mediaType?: string;
  mediaName?: string;
  isABTest?: boolean;
  templateTextB?: string;
  intervalMs?: number;
  createdAt: string;
  contactGroupId?: string;
  campaignType?: 'marketing' | 'birthday' | 'custom';
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  variables: Record<string, string>; // e.g. { "city": "Hyderabad", "discount": "50%", "birthday": "YYYY-MM-DD" }
  tags?: string[];
  status: 'pending' | 'sent' | 'failed' | 'delivered' | 'read';
  messageSent?: string;
  message?: string;
  timestamp?: string;
  error?: string;
}

export interface ContactGroup {
  id: string;
  name: string;
  userId: string;
  count: number;
  contacts: Omit<Contact, 'status' | 'messageSent' | 'timestamp' | 'error'>[];
  createdAt: string;
}

export interface AutoReplyRule {
  id: string;
  userId: string;
  keyword: string;
  matchType: 'equals' | 'contains' | 'starts_with';
  replyText: string;
  aiEnabled: boolean;
  aiPrompt?: string; // Legacy field retained for imported rule compatibility
  isActive: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  userId: string;
  campaignId?: string;
  name: string;
  phone: string;
  message: string;
  image?: string;
  pdfUrl?: string;
  mediaType?: string;
  mediaName?: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered' | 'read';
  direction: 'inbound' | 'outbound';
  timestamp: string;
  abVariation?: 'A' | 'B';
}

export interface Chat {
  id: string; // usually phone number
  contactName: string;
  phone: string;
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: string;
  messages: Message[];
}

export interface DashboardStats {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
  activeCampaigns: number;
  connectedDevices: number;
  deliveryRate: number;
  readRate: number;
}
