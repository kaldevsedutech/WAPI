import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Lock,
  Unlock,
  Calendar,
  Smartphone,
  CheckCircle,
  AlertOctagon,
  RefreshCw,
  Plus,
  ToggleLeft,
  ToggleRight,
  Megaphone,
  Tag,
  AlertTriangle,
  Info,
  Bell
} from "lucide-react";
import { api } from "../lib/api";
import { User } from "../types";
import { maskEmailAddress, maskPhoneNumber } from "../lib/experienceUtils";

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Webhook log inspector states
  const [webhookLogs, setWebhookLogs] = useState<any[]>(() => {
    const initialLogs: any[] = [];
    const eventTypes = ["message.received", "message.status_update", "session.status_update", "media.received"];
    const statusText = ["SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS", "FAILED"];
    const statusCodes = [200, 200, 200, 200, 400];
    
    for (let i = 0; i < 20; i++) {
      const minutesAgo = i * 4 + 2;
      const t = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
      const event = eventTypes[i % eventTypes.length];
      const isSuccess = statusText[i % statusText.length] === "SUCCESS";
      
      initialLogs.push({
        id: `web_init_${i}`,
        timestamp: t,
        event,
        status: statusText[i % statusText.length],
        code: statusCodes[i % statusCodes.length],
        payload: {
          webhook_id: `wh_evt_921839_${i}`,
          received_at: t,
          event_type: event,
          meta: {
            app_id: "wapi_saas_core",
            container_id: "sandbox_container_v3"
          },
          data: {
            messaging_product: "whatsapp",
            recipient_id: `+919876543${100 + i}`,
            status: isSuccess ? "delivered" : "failed",
            error: isSuccess ? null : {
              code: 131026,
              message: "Receiver is not registered on WhatsApp platform"
            },
            message_details: {
              from: `+919876543${100 + i}`,
              body: `Simulated transaction update query ${i + 1}`,
              type: "text"
            }
          }
        }
      });
    }
    return initialLogs;
  });
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  // New User Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [allowedWhatsapp, setAllowedWhatsapp] = useState("");
  const [subscription, setSubscription] = useState<any>("premium");
  const [expiryDate, setExpiryDate] = useState("");

  // Edit inline states
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editAllowedWhatsapp, setEditAllowedWhatsapp] = useState("");
  const [editExpiryDate, setEditExpiryDate] = useState("");

  // Tab control and audit trail state
  const [activeTab, setActiveTab] = useState<"directory" | "webhooks" | "audit" | "promos" | "broadcasts" | "maintenance">("directory");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [selectedActionFilter, setSelectedActionFilter] = useState("all");

  // --- NEW STATES FOR MAINTENANCE, PROMOS, BROADCASTS ---
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [newPromoCode, setNewPromoCode] = useState("");
  const [newPromoDiscount, setNewPromoDiscount] = useState<number>(10);
  const [newPromoDesc, setNewPromoDesc] = useState("");
  const [newPromoExpiry, setNewPromoExpiry] = useState("2026-12-31");
  const [newPromoStatus, setNewPromoStatus] = useState("active");

  const [broadcastNotifications, setBroadcastNotifications] = useState<any[]>([]);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [newNotifTitle, setNewNotifTitle] = useState("");
  const [newNotifMessage, setNewNotifMessage] = useState("");
  const [newNotifType, setNewNotifType] = useState("info");
  const [newNotifTargetRole, setNewNotifTargetRole] = useState("all");

  // --- ACTIONS ---
  const loadMaintenanceSettings = async () => {
    try {
      setMaintenanceLoading(true);
      const res = await api.getSystemStatus();
      setMaintenanceMode(res.maintenanceMode);
      setMaintenanceMessage(res.maintenanceMessage || "");
    } catch (err: any) {
      setError(err.message || "Failed to load maintenance settings.");
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      setMaintenanceLoading(true);
      await api.updateMaintenanceSettings(maintenanceMode, maintenanceMessage);
      setSuccess(`Maintenance settings applied! System maintenance mode is now ${maintenanceMode ? "ENABLED" : "DISABLED"}.`);
    } catch (err: any) {
      setError(err.message || "Failed to save maintenance settings.");
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const loadPromoCodes = async () => {
    try {
      setPromoLoading(true);
      const res = await api.getAdminPromoCodes();
      setPromoCodes(res.promoCodes || []);
    } catch (err: any) {
      setError(err.message || "Failed to load promo codes.");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoCode || !newPromoDiscount || !newPromoExpiry) {
      setError("Please specify Code, Discount percentage, and Expiry date.");
      return;
    }
    setError("");
    setSuccess("");
    try {
      setPromoLoading(true);
      await api.createPromoCode({
        code: newPromoCode,
        discountPercent: newPromoDiscount,
        description: newPromoDesc,
        expiryDate: newPromoExpiry,
        status: newPromoStatus
      });
      setSuccess(`Promo code "${newPromoCode.toUpperCase()}" generated successfully!`);
      setNewPromoCode("");
      setNewPromoDesc("");
      await loadPromoCodes();
    } catch (err: any) {
      setError(err.message || "Failed to create promo code.");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleDeletePromo = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this promo code?")) return;
    setError("");
    setSuccess("");
    try {
      setPromoLoading(true);
      await api.deletePromoCode(id);
      setSuccess("Promo code deleted successfully.");
      await loadPromoCodes();
    } catch (err: any) {
      setError(err.message || "Failed to delete promo code.");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleTogglePromoStatus = async (promo: any) => {
    const nextStatus = promo.status === "active" ? "inactive" : "active";
    setError("");
    setSuccess("");
    try {
      setPromoLoading(true);
      await api.updatePromoCode(promo.id, { status: nextStatus });
      setSuccess(`Promo code status switched to ${nextStatus}.`);
      await loadPromoCodes();
    } catch (err: any) {
      setError(err.message || "Failed to update promo status.");
    } finally {
      setPromoLoading(false);
    }
  };

  const loadBroadcastNotifications = async () => {
    try {
      setBroadcastLoading(true);
      const res = await api.getAdminNotifications();
      setBroadcastNotifications(res.notifications || []);
    } catch (err: any) {
      setError(err.message || "Failed to load broadcast notifications.");
    } finally {
      setBroadcastLoading(false);
    }
  };

  const handleBroadcastNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotifTitle || !newNotifMessage) {
       setError("Please specify Title and Message body.");
       return;
    }
    setError("");
    setSuccess("");
    try {
      setBroadcastLoading(true);
      await api.broadcastNotification({
        title: newNotifTitle,
        message: newNotifMessage,
        type: newNotifType,
        targetRole: newNotifTargetRole
      });
      setSuccess(`Broadcast notification successfully published to targeted "${newNotifTargetRole}" role!`);
      setNewNotifTitle("");
      setNewNotifMessage("");
      setNewNotifTargetRole("all");
      await loadBroadcastNotifications();
    } catch (err: any) {
      setError(err.message || "Failed to broadcast notification.");
    } finally {
      setBroadcastLoading(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete and retract this notification?")) return;
    setError("");
    setSuccess("");
    try {
      setBroadcastLoading(true);
      await api.deleteBroadcastNotification(id);
      setSuccess("Announcement retracted successfully.");
      await loadBroadcastNotifications();
    } catch (err: any) {
      setError(err.message || "Failed to retract announcement.");
    } finally {
      setBroadcastLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      setAuditLoading(true);
      const res = await api.getAdminActivityLogs();
      setAuditLogs(res.logs || []);
    } catch (err: any) {
      setError(err.message || "Failed to load admin audit logs.");
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "audit") {
      loadAuditLogs();
    } else if (activeTab === "maintenance") {
      loadMaintenanceSettings();
    } else if (activeTab === "promos") {
      loadPromoCodes();
    } else if (activeTab === "broadcasts") {
      loadBroadcastNotifications();
    }
  }, [activeTab]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.getUsers();
      setUsers(res.users);
    } catch (err: any) {
      setError(err.message || "Failed to load admin records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !allowedWhatsapp || !subscription || !expiryDate) {
      setError("Please fill in all customer parameters.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await api.createUser({
        name,
        email,
        password,
        allowedWhatsapp,
        subscription,
        expiryDate,
      });

      setSuccess("Customer account generated successfully!");
      // Reset
      setName("");
      setEmail("");
      setPassword("");
      setAllowedWhatsapp("");
      setExpiryDate("");
      setShowAddForm(false);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to create user.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlock = async (user: User) => {
    const newStatus = user.status === "active" ? "blocked" : "active";
    if (!window.confirm(`Are you sure you want to ${newStatus === "blocked" ? "block" : "unblock"} ${user.name}?`)) return;

    setError("");
    setSuccess("");
    try {
      await api.updateUser(user.id, { status: newStatus });
      setSuccess(`User status changed to ${newStatus}`);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || "Action failed.");
    }
  };

  const startEditing = (user: User) => {
    setEditingUserId(user.id);
    setEditAllowedWhatsapp(user.allowedWhatsapp);
    setEditExpiryDate(user.expiryDate.substring(0, 10)); // YYYY-MM-DD
  };

  const handleSaveEdit = async (userId: string) => {
    if (!editAllowedWhatsapp || !editExpiryDate) {
      setError("Please input a valid WhatsApp number and Expiry Date.");
      return;
    }

    setError("");
    setSuccess("");
    try {
      await api.updateUser(userId, {
        allowedWhatsapp: editAllowedWhatsapp,
        expiryDate: editExpiryDate,
      });
      setSuccess("Account variables updated successfully!");
      setEditingUserId(null);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to apply updates.");
    }
  };

  const filteredAuditLogs = auditLogs.filter(log => {
    const searchStr = `${log.action || ""} ${log.details || ""} ${log.userName || ""} ${log.userEmail || ""}`.toLowerCase();
    const matchesSearch = searchStr.includes(auditSearch.toLowerCase());

    let matchesAction = true;
    if (selectedActionFilter !== "all") {
      if (selectedActionFilter === "Campaign") {
        matchesAction = (log.action || "").toLowerCase().includes("campaign");
      } else if (selectedActionFilter === "Contact") {
        matchesAction = (log.action || "").toLowerCase().includes("contact");
      } else if (selectedActionFilter === "Subscription") {
        matchesAction = (log.action || "").toLowerCase().includes("subscription") || (log.action || "").toLowerCase().includes("billing") || (log.action || "").toLowerCase().includes("plan");
      } else if (selectedActionFilter === "Account") {
        matchesAction = (log.action || "").toLowerCase().includes("account") || (log.action || "").toLowerCase().includes("user") || (log.action || "").toLowerCase().includes("block");
      }
    }

    return matchesSearch && matchesAction;
  });

  return (
    <div id="admin-tab" className="flex-1 p-8 bg-slate-50 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Module Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-emerald-600" />
              <span>Admin Management Suite</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manually authorize clients, customize allowed device numbers, extend active plans, and block users.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Authorize Customer</span>
            </button>
            <button
              onClick={loadUsers}
              className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Visual 'System Health' Widget */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-white border border-slate-200 rounded-2xl shadow-xs" id="system-health-widget">
          {/* Card 1: Total Platform Users */}
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Authorized Users</p>
              <p className="text-xl font-extrabold text-slate-800">{users.length}</p>
              <p className="text-[9px] text-slate-400">Verified platform profiles</p>
            </div>
          </div>

          {/* Card 2: Active Connection Sessions */}
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-lg relative">
              <Smartphone className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active WA Sessions</p>
              <p className="text-xl font-extrabold text-slate-800">
                {users.filter(u => u.allowedWhatsapp && u.status === "active").length}
              </p>
              <p className="text-[9px] text-blue-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Live emulators running
              </p>
            </div>
          </div>

          {/* Card 3: Platform Node Status */}
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-4">
            <div className="p-3 bg-indigo-100 text-indigo-700 rounded-lg">
              <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: "8s" }} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">System Node Status</p>
              <p className="text-xl font-extrabold text-slate-800">Healthy</p>
              <p className="text-[9px] text-emerald-600 font-medium">Uptime: 99.98% • Latency: 12ms</p>
            </div>
          </div>

          {/* Card 4: Quick-Action Broadcast */}
          <div className="p-4 bg-emerald-50 border border-emerald-100/50 rounded-xl flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Rapid Outreach</span>
              <Bell className="w-4 h-4 text-emerald-600 animate-bounce" />
            </div>
            <button
              onClick={() => {
                setActiveTab("broadcasts");
                setTimeout(() => {
                  const el = document.getElementById("newNotifTitleInput");
                  if (el) el.focus();
                }, 150);
              }}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>Broadcast Notification</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === "directory"
                ? "border-emerald-600 text-emerald-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Client Directory
          </button>
          <button
            onClick={() => setActiveTab("webhooks")}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === "webhooks"
                ? "border-emerald-600 text-emerald-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Webhook Logs
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === "audit"
                ? "border-emerald-600 text-emerald-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Audit Logs
          </button>
          <button
            onClick={() => setActiveTab("promos")}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === "promos"
                ? "border-emerald-600 text-emerald-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Promo Codes
          </button>
          <button
            onClick={() => setActiveTab("broadcasts")}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === "broadcasts"
                ? "border-emerald-600 text-emerald-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            App Notifications
          </button>
          <button
            onClick={() => setActiveTab("maintenance")}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === "maintenance"
                ? "border-emerald-600 text-emerald-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Maintenance Config
          </button>
        </div>

        {error && (
          <div className="rounded-2xl bg-rose-50 p-4 border border-rose-100 text-sm text-rose-700 font-semibold flex gap-3">
            <AlertOctagon className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100 text-sm text-emerald-700 font-semibold flex gap-3">
            <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* Add user form */}
        {activeTab === "directory" && showAddForm && (
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm max-w-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Generate Customer Account</h3>
            
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="adminNewName" className="block text-xs font-semibold text-slate-600 mb-1">Company / Contact Name</label>
                <input
                  id="adminNewName"
                  name="adminNewName"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. ABC Marketing Inc"
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="adminNewEmail" className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
                <input
                  id="adminNewEmail"
                  name="adminNewEmail"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="adminNewPass" className="block text-xs font-semibold text-slate-600 mb-1">Login Password</label>
                <input
                  id="adminNewPass"
                  name="adminNewPass"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="adminNewAllowed" className="block text-xs font-semibold text-slate-600 mb-1">Allowed WhatsApp Number</label>
                <input
                  id="adminNewAllowed"
                  name="adminNewAllowed"
                  type="text"
                  required
                  value={allowedWhatsapp}
                  onChange={(e) => setAllowedWhatsapp(e.target.value)}
                  placeholder="e.g. +911234567890"
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label htmlFor="adminNewSub" className="block text-xs font-semibold text-slate-600 mb-1">SaaS Plan Level</label>
                <select
                  id="adminNewSub"
                  name="adminNewSub"
                  value={subscription}
                  onChange={(e) => setSubscription(e.target.value as any)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                >
                  <option value="basic">Basic (1,000 msg/day)</option>
                  <option value="premium">Premium (10,000 msg/day)</option>
                  <option value="business">Business (Unlimited broadcasts)</option>
                </select>
              </div>

              <div>
                <label htmlFor="adminNewExpiry" className="block text-xs font-semibold text-slate-600 mb-1">Expiration Date</label>
                <input
                  id="adminNewExpiry"
                  name="adminNewExpiry"
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div className="md:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Generate Account Credentials
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users table list */}
        {activeTab === "directory" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Registered Client Directory</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Client / email</th>
                  <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan / Limit</th>
                  <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Allowed Number</th>
                  <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">SaaS Expiration</th>
                  <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">State</th>
                  <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {users.map((item) => {
                  const isEditing = editingUserId === item.id;
                  const isUserBlocked = item.status === "blocked";

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/40">
                      
                      {/* Name / Email */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs font-bold text-slate-900">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{maskEmailAddress(item.email)}</div>
                      </td>

                      {/* Subscription level */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-[10px] px-2 py-0.5 font-bold rounded-full uppercase tracking-wider ${
                          item.subscription === "business"
                            ? "bg-purple-100 text-purple-700"
                            : item.subscription === "premium"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {item.subscription}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-1">
                          Limit: {item.dailyMessageLimit === 999999 ? "No limits" : `${item.dailyMessageLimit} / day`}
                        </span>
                      </td>

                      {/* WhatsApp Allowed */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            id="editAllowedInput"
                            name="editAllowedInput"
                            type="text"
                            value={editAllowedWhatsapp}
                            onChange={(e) => setEditAllowedWhatsapp(e.target.value)}
                            className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono w-36"
                          />
                        ) : (
                           <span className="text-xs font-mono text-slate-700 font-semibold">{item.allowedWhatsapp ? maskPhoneNumber(item.allowedWhatsapp) : "[None]"}</span>
                        )}
                      </td>

                      {/* Expiration date */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            id="editExpiryInput"
                            name="editExpiryInput"
                            type="date"
                            value={editExpiryDate}
                            onChange={(e) => setEditExpiryDate(e.target.value)}
                            className="px-2 py-1 border border-slate-200 rounded-lg text-xs w-36"
                          />
                        ) : (
                          <span className="text-xs text-slate-600 font-mono">{new Date(item.expiryDate).toLocaleDateString()}</span>
                        )}
                      </td>

                      {/* State */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-[10px] px-2 py-0.5 font-bold rounded-full uppercase tracking-wider ${
                          isUserBlocked ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {item.status}
                        </span>
                      </td>

                      {/* Actions inline */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(item.id)}
                                className="text-emerald-600 font-bold hover:underline cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingUserId(null)}
                                className="text-slate-400 hover:underline cursor-pointer"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              {item.role !== "admin" && (
                                <button
                                  onClick={() => startEditing(item)}
                                  className="text-slate-600 hover:text-emerald-600 font-semibold hover:underline cursor-pointer"
                                >
                                  Modify Plan
                                </button>
                              )}
                              {item.role !== "admin" && (
                                <button
                                  onClick={() => handleToggleBlock(item)}
                                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                    isUserBlocked
                                      ? "bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100"
                                      : "bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100"
                                  }`}
                                  title={isUserBlocked ? "Unblock User" : "Block User"}
                                >
                                  {isUserBlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* System Log Webhook Payload Inspector Panel */}
        {activeTab === "webhooks" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                <span>Webhook System Log Inspector</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Real-time delivery tracing and device payloads (last 20 logs)</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const simulatedLog = {
                    id: "web_" + Math.random().toString(36).substring(2, 9),
                    timestamp: new Date().toISOString(),
                    event: Math.random() > 0.5 ? "message.received" : "message.status_update",
                    status: "SUCCESS",
                    code: 200,
                    payload: {
                      object: "whatsapp_business_account",
                      entry: [{
                        id: "WABA_982189312389",
                        changes: [{
                          value: {
                            messaging_product: "whatsapp",
                            metadata: { display_phone_number: "+14155552671", phone_number_id: "109283921839" },
                            contacts: [{ profile: { name: "Simulated Webhook Client" }, wa_id: "+911234567890" }],
                            messages: [{
                              from: "+911234567890",
                              id: "wamid.HBgLOTE5ODc2NTQzMjEwFQIAERgSRTkxQkRDMjFFMkFEODVBNEY0AA==",
                              timestamp: Math.floor(Date.now() / 1000).toString(),
                              text: { body: Math.random() > 0.5 ? "Yes, please confirm my subscription!" : "How can I contact sales?" },
                              type: "text"
                            }]
                          },
                          field: "messages"
                        }]
                      }]
                    }
                  };
                  setWebhookLogs(prev => [simulatedLog, ...prev.slice(0, 19)]);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
              >
                Simulate Webhook Call
              </button>
              <button
                onClick={() => {
                  if (window.confirm("Clear webhook logs?")) {
                    setWebhookLogs([]);
                  }
                }}
                className="px-3 py-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
              >
                Clear Log
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
            {webhookLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No raw webhook payload logs recorded yet. Use the "Simulate Webhook Call" button to generate dynamic tracing packets.
              </div>
            ) : (
              webhookLogs.map((log) => {
                const isExpanded = expandedLogs.has(log.id);
                return (
                  <div key={log.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold ${
                          log.event.startsWith("message.received") ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                        }`}>
                          {log.event}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          log.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}>
                          HTTP {log.code} {log.status}
                        </span>
                        <button
                          onClick={() => {
                            const next = new Set(expandedLogs);
                            if (next.has(log.id)) {
                              next.delete(log.id);
                            } else {
                              next.add(log.id);
                            }
                            setExpandedLogs(next);
                          }}
                          className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold hover:underline cursor-pointer"
                        >
                          {isExpanded ? "Hide Payload" : "Inspect Payload"}
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-[10px] overflow-x-auto whitespace-pre leading-relaxed border border-slate-800 shadow-inner">
                        {JSON.stringify(log.payload, null, 2)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        )}

        {/* Administrative Audit Logs Panel */}
        {activeTab === "audit" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden space-y-4 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Administrative Audit Trails</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Chronological system ledger tracking modifications, actions, and user sessions.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={loadAuditLogs}
                  disabled={auditLoading}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? "animate-spin" : ""}`} />
                  <span>Refresh Logs</span>
                </button>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative rounded-xl flex-1 max-w-md border border-slate-200">
                <input
                  type="text"
                  placeholder="Search user, action or details..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="block w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <select
                  value={selectedActionFilter}
                  onChange={(e) => setSelectedActionFilter(e.target.value)}
                  className="block w-full px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                >
                  <option value="all">All Action Classes</option>
                  <option value="Campaign">Campaign Actions</option>
                  <option value="Contact">Contact Actions</option>
                  <option value="Subscription">Billing / Subscription</option>
                  <option value="Account">Account Operations</option>
                </select>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Performed By</th>
                    <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-50">
                  {auditLoading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-xs text-slate-400 font-semibold">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                          <span>Fetching audit trail details...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-xs text-slate-400">No matching audit entries recorded.</td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 whitespace-nowrap text-[10px] text-slate-400 font-mono">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs font-bold text-slate-900">{log.userName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{log.userEmail}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-[9px] px-2.5 py-0.5 font-bold rounded-full uppercase tracking-wider ${
                            log.action.toLowerCase().includes("campaign")
                              ? "bg-purple-50 text-purple-700 border border-purple-100"
                              : log.action.toLowerCase().includes("contact")
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : log.action.toLowerCase().includes("subscription") || log.action.toLowerCase().includes("billing") || log.action.toLowerCase().includes("plan")
                              ? "bg-amber-50 text-amber-700 border border-amber-100"
                              : "bg-slate-50 text-slate-600 border border-slate-100"
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600 max-w-md break-words">
                          {log.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- PROMO CODES PANEL --- */}
        {activeTab === "promos" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm max-w-2xl">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-emerald-600" />
                <span>Create New Promo Code / Offer</span>
              </h3>
              
              <form onSubmit={handleCreatePromo} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="newPromoCodeInput" className="block text-xs font-semibold text-slate-600 mb-1">Coupon Code</label>
                    <input
                      id="newPromoCodeInput"
                      type="text"
                      required
                      placeholder="e.g. SUMMER50"
                      value={newPromoCode}
                      onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                      className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 uppercase font-bold"
                    />
                  </div>
                  <div>
                    <label htmlFor="newPromoDiscountInput" className="block text-xs font-semibold text-slate-600 mb-1">Discount Percentage (%)</label>
                    <input
                      id="newPromoDiscountInput"
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={newPromoDiscount}
                      onChange={(e) => setNewPromoDiscount(Number(e.target.value))}
                      className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="newPromoExpiryInput" className="block text-xs font-semibold text-slate-600 mb-1">Expiry Date</label>
                    <input
                      id="newPromoExpiryInput"
                      type="date"
                      required
                      value={newPromoExpiry}
                      onChange={(e) => setNewPromoExpiry(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="newPromoStatusSelect" className="block text-xs font-semibold text-slate-600 mb-1">Initial Status</label>
                    <select
                      id="newPromoStatusSelect"
                      value={newPromoStatus}
                      onChange={(e) => setNewPromoStatus(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                    >
                      <option value="active">Active (Usable)</option>
                      <option value="inactive">Inactive (Disabled)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="newPromoDescInput" className="block text-xs font-semibold text-slate-600 mb-1">Offer Description</label>
                  <textarea
                    id="newPromoDescInput"
                    rows={2}
                    placeholder="Provide details about what users get with this coupon code..."
                    value={newPromoDesc}
                    onChange={(e) => setNewPromoDesc(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={promoLoading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Generate Offer Code
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-2xl border border-slate-150 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Configured Promo Codes</h3>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{promoCodes.length} codes total</span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-150">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Coupon Code</th>
                      <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Benefit</th>
                      <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expiration</th>
                      <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {promoLoading && promoCodes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-xs text-slate-400">Loading promo code details...</td>
                      </tr>
                    ) : promoCodes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-xs text-slate-400">No promotional discount codes created yet.</td>
                      </tr>
                    ) : (
                      promoCodes.map((promo: any) => (
                        <tr key={promo.id} className="hover:bg-slate-50/30">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-xs font-mono font-extrabold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-100">
                              {promo.code}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-xs font-bold text-slate-900">{promo.discountPercent}% Off</span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate" title={promo.description}>
                            {promo.description || <span className="text-slate-300 italic">No description</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                            {promo.expiryDate}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleTogglePromoStatus(promo)}
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                                promo.status === "active"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {promo.status === "active" ? "Active" : "Disabled"}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium">
                            <button
                              onClick={() => handleDeletePromo(promo.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Delete Promo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- APP BROADCAST ANNOUNCEMENTS PANEL --- */}
        {activeTab === "broadcasts" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm max-w-2xl">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Megaphone className="w-4 h-4 text-emerald-600 animate-bounce" />
                <span>Publish Public Notification Broadcast</span>
              </h3>
              
              <form onSubmit={handleBroadcastNotification} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="newNotifTitleInput" className="block text-xs font-semibold text-slate-600 mb-1">Announcement Title</label>
                    <input
                      id="newNotifTitleInput"
                      type="text"
                      required
                      placeholder="e.g. Scheduled Network Upgrade"
                      value={newNotifTitle}
                      onChange={(e) => setNewNotifTitle(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="newNotifTypeSelect" className="block text-xs font-semibold text-slate-600 mb-1">Notification Level</label>
                    <select
                      id="newNotifTypeSelect"
                      value={newNotifType}
                      onChange={(e) => setNewNotifType(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white text-slate-900"
                    >
                      <option value="info">💡 Information</option>
                      <option value="success">🎉 Feature Release</option>
                      <option value="warning">⚠️ Scheduled Maintenance</option>
                      <option value="error">🚨 Urgent Outage / Alert</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="newNotifTargetSelect" className="block text-xs font-semibold text-slate-600 mb-1">Target User Role</label>
                    <select
                      id="newNotifTargetSelect"
                      value={newNotifTargetRole}
                      onChange={(e) => setNewNotifTargetRole(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white text-slate-900"
                    >
                      <option value="all">🌐 All Users</option>
                      <option value="user">👥 Standard Users Only</option>
                      <option value="admin">🛡️ System Admins Only</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="newNotifMessageInput" className="block text-xs font-semibold text-slate-600 mb-1">Broadcast Message Body</label>
                  <textarea
                    id="newNotifMessageInput"
                    rows={3}
                    required
                    placeholder="This message will be instantly delivered to all active client dashboards through live in-app notifications..."
                    value={newNotifMessage}
                    onChange={(e) => setNewNotifMessage(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={broadcastLoading}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Send Public Broadcast</span>
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-2xl border border-slate-150 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Broadcast History</h3>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold uppercase">Live Broadcasts Active</span>
              </div>

              <div className="divide-y divide-slate-100">
                {broadcastLoading && broadcastNotifications.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400">Loading broadcast history...</div>
                ) : broadcastNotifications.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400">No public announcements broadcasted yet.</div>
                ) : (
                  broadcastNotifications.map((notif: any) => (
                    <div key={notif.id} className="p-5 flex items-start justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex gap-3">
                        <span className="mt-0.5">
                          {notif.type === "warning" && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                          {notif.type === "error" && <AlertOctagon className="w-5 h-5 text-rose-500" />}
                          {notif.type === "success" && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                          {notif.type === "info" && <Info className="w-5 h-5 text-blue-500" />}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-800">{notif.title}</h4>
                            <span className="text-[9px] text-slate-400 font-mono">ID: {notif.id}</span>
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                              notif.targetRole === "admin"
                                ? "bg-purple-100 text-purple-800 border border-purple-200"
                                : notif.targetRole === "user"
                                ? "bg-blue-100 text-blue-800 border border-blue-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}>
                              🎯 {notif.targetRole || "all"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">{notif.message}</p>
                          <span className="text-[10px] text-slate-400 block mt-2 font-semibold">
                            Broadcasted: {new Date(notif.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteNotification(notif.id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer self-center"
                        title="Delete & Retract Notification"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- MAINTENANCE PAGE SETTINGS PANEL --- */}
        {activeTab === "maintenance" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm max-w-2xl">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-emerald-600" />
                <span>Global System Maintenance Switch</span>
              </h3>
              
              <div className="mb-6 p-4.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Toggle Maintenance State</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-normal max-w-md">
                      When enabled, all registered non-admin client workspaces will be locked behind a static Maintenance Screen. Administrators can still access this dashboard to toggle it off.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMaintenanceMode(!maintenanceMode)}
                    className="focus:outline-none transition-transform active:scale-95 cursor-pointer"
                  >
                    {maintenanceMode ? (
                      <ToggleRight className="w-12 h-12 text-rose-600" />
                    ) : (
                      <ToggleLeft className="w-12 h-12 text-slate-300" />
                    )}
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-150 flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${maintenanceMode ? "bg-rose-500 animate-pulse" : "bg-emerald-500"}`} />
                  <span className="text-[11px] font-extrabold text-slate-700">
                    STATUS: {maintenanceMode ? "SYSTEM UNDER ACTIVE MAINTENANCE LOCKDOWN" : "SYSTEM ONLINE & FULLY RUNNING"}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveMaintenance} className="space-y-4">
                <div>
                  <label htmlFor="maintenanceMessageInput" className="block text-xs font-semibold text-slate-600 mb-1">Custom Maintenance Lockout Message</label>
                  <textarea
                    id="maintenanceMessageInput"
                    rows={4}
                    required
                    placeholder="Provide a professional message to display to users explaining the maintenance details..."
                    value={maintenanceMessage}
                    onChange={(e) => setMaintenanceMessage(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={maintenanceLoading}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Apply Maintenance Lockdown</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
