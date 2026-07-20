import React, { useEffect, useState } from "react";
import {
  Calendar,
  Save,
  Play,
  RefreshCw,
  Gift,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Search,
  Sparkles,
  Info
} from "lucide-react";
import { api } from "../lib/api";
import { ContactGroup } from "../types";

export default function BirthdayWishes() {
  const [enabled, setEnabled] = useState(false);
  const [templateText, setTemplateText] = useState("");
  const [runHour, setRunHour] = useState("09");
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Contact list stats
  const [birthdayContacts, setBirthdayContacts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError("");
      
      const res = await api.getBirthdayConfig();
      setEnabled(res.config.enabled);
      setTemplateText(res.config.templateText);
      setRunHour(res.config.runHour || "09");

      // Load all contact groups to extract contacts with birthday fields
      const groupsRes = await api.getContactGroups();
      const allBirthdayContacts: any[] = [];
      if (groupsRes.contactGroups) {
        groupsRes.contactGroups.forEach((group: ContactGroup) => {
          group.contacts.forEach((contact: any) => {
            if (contact.birthday) {
              allBirthdayContacts.push({
                ...contact,
                groupName: group.name
              });
            }
          });
        });
      }
      setBirthdayContacts(allBirthdayContacts);
    } catch (err: any) {
      setError(err.message || "Failed to load birthday automation configuration.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      await api.saveBirthdayConfig({
        enabled,
        templateText,
        runHour
      });
      setSuccess("Birthday greeting configurations saved successfully.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerRun = async () => {
    try {
      setTriggering(true);
      setError("");
      setSuccess("");
      
      const res = await api.triggerBirthdayCheck();
      
      if (res.dispatched && res.dispatched.length > 0) {
        setSuccess(`Birthday sweep complete! Dispatched greeting template to ${res.dispatched.length} match(es): ${res.dispatched.map((m: any) => m.name).join(", ")}`);
      } else {
        setSuccess("Birthday sweep complete. No contacts matched today's date.");
      }
      setTimeout(() => setSuccess(""), 8000);
    } catch (err: any) {
      setError(err.message || "Birthday execution query failed.");
    } finally {
      setTriggering(false);
    }
  };

  const filteredBirthdays = birthdayContacts.filter(contact =>
    (contact.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phone.includes(searchQuery) ||
    contact.birthday.includes(searchQuery)
  );

  return (
    <div id="birthday-tab" className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Gift className="w-6.5 h-6.5 text-emerald-600" />
              <span>Automated Message Schedule</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Engage clients effortlessly. Our platform runs an automated morning sweep, dispatching customized dynamic templates to clients celebrating birthdays.
            </p>
          </div>
          <button
            onClick={handleTriggerRun}
            disabled={triggering}
            className="px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/10 flex items-center gap-2 cursor-pointer self-start transition-colors"
          >
            {triggering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span>Run Greetings Sweep Now</span>
          </button>
        </div>

        {/* Notices */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Configurations Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Settings Column (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSaveConfig} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Wishes Automation Suite</h2>

              <div className="space-y-4">
                {/* Enabled Toggle State */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 block">Daily Automated Greetings Status</span>
                    <span className="text-[11px] text-slate-400">Trigger standard greetings sweep automatically every morning</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Sweep Timing */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Automated Execution Hour</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <select
                        value={runHour}
                        onChange={(e) => setRunHour(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white font-mono"
                      >
                        <option value="06">06:00 AM (Early Morning)</option>
                        <option value="07">07:00 AM</option>
                        <option value="08">08:00 AM</option>
                        <option value="09">09:00 AM (Recommended)</option>
                        <option value="10">10:00 AM</option>
                        <option value="11">11:00 AM</option>
                        <option value="12">12:00 PM (Noon)</option>
                        <option value="15">03:00 PM</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-3.5 bg-blue-50/40 border border-blue-100 rounded-xl text-[10px] text-slate-500 flex gap-2">
                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <span>Greetings sweep maps client timezones. Daily cron scheduler fires precisely at your selected hour.</span>
                  </div>
                </div>

                {/* Template text area */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Dynamic Greeting Template</label>
                    <span className="text-[10px] text-slate-400">Supports: <code className="bg-slate-100 px-1 py-0.5 font-bold text-emerald-700">{"{name}"}</code>, <code className="bg-slate-100 px-1 py-0.5 font-bold text-emerald-700">{"{city}"}</code></span>
                  </div>
                  <textarea
                    value={templateText}
                    onChange={(e) => setTemplateText(e.target.value)}
                    placeholder="e.g. Hello {name}! 🎉 Wishing you a very Happy Birthday from all of us at WAPI! Have an outstanding day filled with joy."
                    className="w-full h-32 p-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end border-t border-slate-50 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? "Saving..." : "Save Configs"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Registered birth lists (1 col) */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[450px]">
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4.5 h-4.5 text-slate-500" />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-800">Birthday Registry</span>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {birthdayContacts.length} Total
                </span>
              </div>

              {/* Filter search registry */}
              <div className="relative rounded-xl mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter name, phone, date..."
                  className="block w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50 text-slate-900"
                />
              </div>

              {/* Contact list viewer */}
              <div className="flex-1 overflow-y-auto space-y-2.5">
                {filteredBirthdays.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    No matching birthdays registered. Create contact lists with a birthday field!
                  </div>
                ) : (
                  filteredBirthdays.map((contact, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-100/60 rounded-xl flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-slate-800 truncate">{contact.name || "Customer"}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{contact.phone}</span>
                      </div>
                      <div className="text-right">
                        <span className="inline-block bg-purple-50 text-purple-700 font-bold text-[10px] px-2 py-0.5 rounded border border-purple-100 font-mono">
                          🎂 {contact.birthday}
                        </span>
                        <span className="block text-[8px] text-slate-400 mt-0.5 truncate">{contact.groupName}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>

            {/* Quick action helper card */}
            <div className="bg-emerald-950 text-emerald-100 p-5 rounded-2xl border border-emerald-900 shadow-sm space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>How to upload Birthdays?</span>
              </div>
              <p className="text-[10px] leading-relaxed text-emerald-200">
                To upload client birthdays, import a CSV under the <span className="font-semibold text-white">Contacts & Lists</span> page. Include a column named exactly <code className="bg-emerald-900/60 text-emerald-200 px-1 py-0.5 font-mono">birthday</code> with date strings formatted as <code className="bg-emerald-900/60 text-emerald-200 px-1 py-0.5 font-mono">MM-DD</code> (e.g. 05-24) or <code className="bg-emerald-900/60 text-emerald-200 px-1 py-0.5 font-mono">YYYY-MM-DD</code>.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
