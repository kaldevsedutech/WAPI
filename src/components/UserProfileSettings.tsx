import React, { useEffect, useState } from "react";
import { X, User, Shield, Calendar, Activity, RefreshCw, Smartphone, Sparkles, AlertCircle, LayoutTemplate, Palette, Check } from "lucide-react";
import { api } from "../lib/api";
import { maskPhoneNumber } from "../lib/experienceUtils";

interface UserProfileSettingsProps {
  user: any;
  onClose: () => void;
  onUserUpdate?: () => void;
}

interface ActivityLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
}

export default function UserProfileSettings({ user, onClose, onUserUpdate }: UserProfileSettingsProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentMode, setCurrentMode] = useState<"daily" | "professional" | "advanced">(user?.experienceMode || "daily");
  const [savingMode, setSavingMode] = useState(false);
  const [errorMode, setErrorMode] = useState("");

  const [currentColor, setCurrentColor] = useState<string>(user?.brandColor || "emerald");
  const [savingColor, setSavingColor] = useState(false);
  const [errorColor, setErrorColor] = useState("");

  const handleColorChange = async (color: string) => {
    setErrorColor("");
    setSavingColor(true);
    try {
      await api.updateBrandColor(color);
      setCurrentColor(color);
      if (onUserUpdate) {
        onUserUpdate();
      }
    } catch (err: any) {
      setErrorColor(err.message || "Failed to update brand color.");
    } finally {
      setSavingColor(false);
    }
  };

  const handleModeChange = async (mode: "daily" | "professional" | "advanced") => {
    setErrorMode("");
    setSavingMode(true);
    try {
      await api.updateExperienceMode(mode);
      setCurrentMode(mode);
      if (onUserUpdate) {
        onUserUpdate();
      }
    } catch (err: any) {
      setErrorMode(err.message || "Failed to update experience mode.");
    } finally {
      setSavingMode(false);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getActivityLogs();
      setLogs(res.logs);
    } catch (err: any) {
      setError(err.message || "Failed to load audit trail.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div id="profile-settings-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">User Profile Settings</h2>
              <p className="text-xs text-slate-400">Manage credentials and review activity audit logs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* User Profile Summary Card */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4.5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account Credentials</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-slate-50 text-slate-500 rounded-lg shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Account Name</p>
                  <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-slate-50 text-slate-500 rounded-lg shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Registered Mobile</p>
                  <p className="text-sm font-mono text-slate-800">{maskPhoneNumber(user?.allowedWhatsapp)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-slate-50 text-slate-500 rounded-lg shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Subscription Tier</p>
                  <p className="text-sm font-semibold text-slate-800 capitalize flex items-center gap-1.5">
                    {user?.subscription} Plan
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-slate-50 text-slate-500 rounded-lg shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Expiry Date</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {user?.expiryDate ? new Date(user.expiryDate).toLocaleDateString() : "Never"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Experience Mode Selector */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4.5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <LayoutTemplate className="w-4 h-4 text-emerald-600 animate-pulse" />
                  Experience Mode Selector
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Adapt the interface complexity to your specific goals</p>
              </div>
              <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full capitalize">
                {currentMode} Mode
              </span>
            </div>

            {errorMode && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{errorMode}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Daily / Basic Mode */}
              <button
                type="button"
                onClick={() => handleModeChange("daily")}
                disabled={savingMode}
                className={`border text-left p-3.5 rounded-xl cursor-pointer transition-all flex flex-col justify-between h-32 ${
                  currentMode === "daily"
                    ? "border-emerald-500 bg-emerald-50/10 shadow-sm"
                    : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50/50"
                } ${savingMode ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    <span className="text-xs font-bold text-slate-800">Daily Mode (Basic)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                    Simplified view. Hides A/B template variance, strict ms interval slider, or custom JSON group imports for daily focus.
                  </p>
                </div>
                {currentMode === "daily" ? (
                  <span className="text-[9px] font-bold text-emerald-600 font-mono">ACTIVE PREFERENCE</span>
                ) : (
                  <span className="text-[9px] font-bold text-slate-300 font-mono">SELECT</span>
                )}
              </button>

              {/* Professional Mode */}
              <button
                type="button"
                onClick={() => handleModeChange("professional")}
                disabled={savingMode}
                className={`border text-left p-3.5 rounded-xl cursor-pointer transition-all flex flex-col justify-between h-32 ${
                  currentMode === "professional"
                    ? "border-emerald-500 bg-emerald-50/10 shadow-sm"
                    : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50/50"
                } ${savingMode ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span className="text-xs font-bold text-slate-800">Professional Mode</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                    Standard business marketing. Exposes scheduling options, contact CSV uploads, and manual group creations.
                  </p>
                </div>
                {currentMode === "professional" ? (
                  <span className="text-[9px] font-bold text-emerald-600 font-mono">ACTIVE PREFERENCE</span>
                ) : (
                  <span className="text-[9px] font-bold text-slate-300 font-mono">SELECT</span>
                )}
              </button>

              {/* Advanced Mode */}
              <button
                type="button"
                onClick={() => handleModeChange("advanced")}
                disabled={savingMode}
                className={`border text-left p-3.5 rounded-xl cursor-pointer transition-all flex flex-col justify-between h-32 ${
                  currentMode === "advanced"
                    ? "border-emerald-500 bg-emerald-50/10 shadow-sm"
                    : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50/50"
                } ${savingMode ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-slate-800">Advanced Mode</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                    Full capabilities. Includes A/B test variations, microsecond blast staggers, raw inbound simulator, and complete system audit.
                  </p>
                </div>
                {currentMode === "advanced" ? (
                  <span className="text-[9px] font-bold text-emerald-600 font-mono">ACTIVE PREFERENCE</span>
                ) : (
                  <span className="text-[9px] font-bold text-slate-300 font-mono">SELECT</span>
                )}
              </button>
            </div>
            
            <p className="text-[9px] text-slate-400 italic leading-snug">
              * Preference is persistently saved to your account in the cloud. Sessions on any other device or browser will automatically reload this view.
            </p>
          </div>

          {/* Custom Brand Color Picker */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4.5 space-y-4 shadow-sm">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-slate-600 animate-pulse" />
                Select Theme Brand Color
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Customize WAPIMI colors to match your organization's unique brand identity</p>
            </div>

            {errorColor && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{errorColor}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
              {[
                { name: "emerald", label: "Classic Emerald", bg: "bg-emerald-500", text: "Emerald" },
                { name: "blue", label: "Corporate Blue", bg: "bg-blue-500", text: "Blue" },
                { name: "indigo", label: "Vibrant Indigo", bg: "bg-indigo-500", text: "Indigo" },
                { name: "violet", label: "Creative Violet", bg: "bg-violet-500", text: "Violet" },
                { name: "rose", label: "Modern Rose", bg: "bg-rose-500", text: "Rose" },
                { name: "amber", label: "Playful Amber", bg: "bg-amber-500", text: "Amber" },
              ].map((color) => {
                const isSelected = currentColor === color.name;
                return (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => handleColorChange(color.name)}
                    disabled={savingColor}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      isSelected
                        ? "border-slate-800 bg-white shadow-sm ring-1 ring-slate-850"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    } ${savingColor ? "opacity-60 cursor-not-allowed" : ""}`}
                    title={color.label}
                  >
                    <span className={`w-4 h-4 rounded-full ${color.bg} flex items-center justify-center text-white shrink-0 shadow-sm`}>
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </span>
                    <span className="text-slate-700">{color.text}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-[9px] text-slate-400 italic leading-snug">
              * This settings preference instantly adjusts header banners, buttons, sidebars, accent tags, and active navigation indicators.
            </p>
          </div>

          {/* Activity Logs chronological trail */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-slate-500" />
                Chronological Activity Audit Trail
              </h3>
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh Trail</span>
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="border border-slate-150 rounded-xl overflow-hidden bg-slate-50/50">
              {loading && logs.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-xs text-slate-400 font-medium">Retrieving chronological trail...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No activity logs found. All actions performed will be listed here chronologically.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {logs.map((log) => (
                    <div key={log.id} className="p-3.5 bg-white flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                      <div className="mt-0.5 w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 text-xs font-bold">
                        {log.action.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-800">{log.action}</p>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{log.details}</p>
                        <p className="text-[9px] font-semibold text-slate-400 mt-1">
                          {new Date(log.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <p className="text-[10px] text-slate-400 leading-normal">
              Note: This trail logs actions such as logins, campaign launches, plan changes, and session disconnects to ensure account integrity and SLA compliance.
            </p>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="py-2 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
