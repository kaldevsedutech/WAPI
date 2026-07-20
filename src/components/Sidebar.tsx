import React from "react";
import {
  LayoutDashboard,
  QrCode,
  Send,
  FileBarChart2,
  Users,
  MessageSquare,
  ShieldCheck,
  LogOut,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Calendar,
  CreditCard,
  X,
  Settings,
  HelpCircle
} from "lucide-react";
import { WhatsAppSession } from "../types";
import { isFeatureVisible, ExperienceMode, maskEmailAddress, maskPhoneNumber } from "../lib/experienceUtils";

interface SidebarProps {
  currentTab: string;
  setTab: (tab: string) => void;
  user: any;
  session: WhatsAppSession | null;
  onLogout: () => void;
  onOpenSettings: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ currentTab, setTab, user, session, onLogout, onOpenSettings, isMobileOpen, onMobileClose }: SidebarProps) {
  const isConnected = session?.sessionStatus === "connected";
  const experienceMode = (user?.experienceMode || "daily") as ExperienceMode;
  const brandColor = user?.brandColor || "emerald";

  const colorMap: Record<string, { bg: string; text: string; bgLight: string; textLight: string; shadow: string }> = {
    emerald: { bg: "bg-emerald-600", text: "text-emerald-500", bgLight: "bg-emerald-500/10", textLight: "text-emerald-400", shadow: "shadow-emerald-900/20" },
    blue: { bg: "bg-blue-600", text: "text-blue-500", bgLight: "bg-blue-500/10", textLight: "text-blue-400", shadow: "shadow-blue-900/20" },
    indigo: { bg: "bg-indigo-600", text: "text-indigo-500", bgLight: "bg-indigo-500/10", textLight: "text-indigo-400", shadow: "shadow-indigo-900/20" },
    violet: { bg: "bg-violet-600", text: "text-violet-500", bgLight: "bg-violet-500/10", textLight: "text-violet-400", shadow: "shadow-violet-900/20" },
    rose: { bg: "bg-rose-600", text: "text-rose-500", bgLight: "bg-rose-500/10", textLight: "text-rose-400", shadow: "shadow-rose-900/20" },
    amber: { bg: "bg-amber-600", text: "text-amber-500", bgLight: "bg-amber-500/10", textLight: "text-amber-400", shadow: "shadow-amber-900/20" },
  };

  const activeColor = colorMap[brandColor] || colorMap.emerald;

  const allMenuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "scanner", label: "WhatsApp Link", icon: QrCode, badge: isConnected ? "Active" : "Scan" },
    { id: "campaign_create", label: "Create Campaign", icon: Send },
    { id: "campaign_reports", label: "Campaign Reports", icon: FileBarChart2, featureName: "campaign-reports" },
    { id: "contacts", label: "Contacts & Lists", icon: Users, featureName: "contacts-manager" },
    { id: "auto_reply", label: "Auto Replies", icon: Sparkles, featureName: "auto-replies" },
    { id: "birthday", label: "Message Schedule", icon: Calendar, featureName: "birthday-wishes" },
    { id: "billing", label: "Billing & Plans", icon: CreditCard },
    { id: "inbox", label: "2-Way Inbox", icon: MessageSquare },
    { id: "faq", label: "FAQ & Policies", icon: HelpCircle },
  ];

  const filteredMenuItems = allMenuItems.filter(item => {
    if (item.featureName) {
      return isFeatureVisible(item.featureName, experienceMode);
    }
    return true;
  });

  const menuItems = [...filteredMenuItems];

  if (user?.role === "admin") {
    menuItems.push({ id: "admin", label: "Admin Panel", icon: ShieldCheck });
  }

  return (
    <aside
      id="sidebar-panel"
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col h-screen border-r border-slate-800 shrink-0 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static ${
        isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      }`}
    >
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`${activeColor.bg} text-white p-1.5 rounded-lg`}>
            <Send className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg text-white tracking-wide">
            WAPI<span className={activeColor.text}>MI</span>
          </span>
        </div>
        
        {/* Mobile Close Button */}
        <button
          onClick={onMobileClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 md:hidden focus:outline-none cursor-pointer"
          title="Close Sidebar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="hidden md:block bg-slate-800 text-[10px] text-slate-400 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
          v1.2
        </div>
      </div>

      {/* Subscription Tier Info */}
      <div className="mx-4 mt-5 p-3.5 bg-slate-800/50 border border-slate-800 rounded-xl flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${activeColor.bgLight} flex items-center justify-center ${activeColor.textLight} shrink-0`}>
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white capitalize">{user?.subscription} Plan</p>
          <p className="text-[10px] text-slate-400 truncate">Exp: {user?.expiryDate?.substring(0, 10)}</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 mt-6 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group cursor-pointer ${
                isActive
                  ? `${activeColor.bg} text-white shadow-md ${activeColor.shadow}`
                  : "hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4.5 h-4.5 transition-transform group-hover:scale-105 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-2 py-0.5 font-bold rounded-full uppercase tracking-wider ${
                    isConnected
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Connection Quick Info */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/20">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div className={`w-3.5 h-3.5 rounded-full ${isConnected ? "bg-emerald-500 shadow-sm shadow-emerald-400" : "bg-amber-500 shadow-sm shadow-amber-400"}`} />
            {isConnected && <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white">
              {isConnected ? "WhatsApp Bound" : "No WhatsApp Bound"}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {isConnected ? maskPhoneNumber(user?.allowedWhatsapp) : "Action required"}
            </p>
          </div>
        </div>
      </div>

      {/* User Actions Profile Footer */}
      <div className="p-4 border-t border-slate-800 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold text-white truncate">{user?.name}</p>
          <p className="text-[10px] text-slate-500 truncate">{maskEmailAddress(user?.email)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            id="btn-settings"
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-emerald-400 transition-colors cursor-pointer"
            title="User Profile & Settings"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>
          <button
            id="btn-logout"
            onClick={onLogout}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-rose-400 transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
