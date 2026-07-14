import React, { useEffect, useState } from "react";
import {
  Sparkles,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  HelpCircle,
  Cpu,
  Info,
  CheckCircle,
  MessageSquare,
  Send,
  RefreshCw,
  AlertCircle,
  Upload,
  FileText
} from "lucide-react";
import { api } from "../lib/api";
import { AutoReplyRule } from "../types";

export default function AutoReplyRules() {
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create Form State
  const [showForm, setShowForm] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [matchType, setMatchType] = useState<"equals" | "contains" | "starts_with">("contains");
  const [replyText, setReplyText] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  // CSV Import State
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);

  // Simulator State
  const [testMessage, setTestMessage] = useState("");
  const [testPhone, setTestPhone] = useState("+911234567890");
  const [simLogs, setSimLogs] = useState<Array<{ sender: "user" | "bot" | "sys"; text: string; time: string }>>([
    { sender: "sys", text: "Auto-reply tester online. Send messages matching your keywords to test.", time: new Date().toLocaleTimeString() }
  ]);
  const [simulating, setSimulating] = useState(false);

  const loadRules = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.getAutoReplyRules();
      setRules(res.rules || []);
    } catch (err: any) {
      setError(err.message || "Failed to load auto-reply rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) {
      setError("Keyword is required");
      return;
    }
    const savedReplyText = aiEnabled ? aiPrompt.trim() : replyText.trim();
    if (!savedReplyText) {
      setError("Auto-reply message is required");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await api.createAutoReplyRule({
        keyword: keyword.trim(),
        matchType,
        replyText: savedReplyText,
        aiEnabled: false,
        aiPrompt: ""
      });
      
      setSuccess("Auto-reply rule added successfully!");
      // Reset Form
      setKeyword("");
      setReplyText("");
      setAiPrompt("");
      setAiEnabled(false);
      setShowForm(false);

      await loadRules();

      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to save auto-reply rule");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRule = async (rule: AutoReplyRule) => {
    try {
      setError("");
      await api.updateAutoReplyRule(rule.id, { isActive: !rule.isActive });
      setRules(prev =>
        prev.map(r => (r.id === rule.id ? { ...r, isActive: !rule.isActive } : r))
      );
    } catch (err: any) {
      setError(err.message || "Failed to toggle rule state");
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!window.confirm("Delete this auto-reply rule?")) return;
    try {
      setError("");
      await api.deleteAutoReplyRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
      setSuccess("Rule deleted successfully.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to delete rule");
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      try {
        setCsvImporting(true);
        setError("");
        setSuccess("");

        const lines = text.split(/\r?\n/);
        const importedRules: any[] = [];

        // Check if header exists
        let startIndex = 0;
        if (lines[0] && (lines[0].toLowerCase().includes("keyword") || lines[0].toLowerCase().includes("reply"))) {
          startIndex = 1;
        }

        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Splitting CSV line considering potential enclosed commas
          const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          if (parts.length < 2) continue;

          const rawKeyword = parts[0]?.replace(/^"|"$/g, '').trim() || "";
          let rawMatchType = parts[1]?.replace(/^"|"$/g, '').trim().toLowerCase() || "contains";
          const rawReply = parts[2]?.replace(/^"|"$/g, '').trim() || "";
          const rawAiEnabled = parts[3]?.replace(/^"|"$/g, '').trim().toLowerCase() === "true";
          const rawAiPrompt = parts[4]?.replace(/^"|"$/g, '').trim() || "";

          if (!rawKeyword) continue;

          let validatedMatchType: "equals" | "contains" | "starts_with" = "contains";
          if (rawMatchType === "equals" || rawMatchType === "exact") {
            validatedMatchType = "equals";
          } else if (rawMatchType === "starts_with" || rawMatchType === "startswith") {
            validatedMatchType = "starts_with";
          }

          importedRules.push({
            keyword: rawKeyword,
            matchType: validatedMatchType,
            replyText: rawReply || rawAiPrompt,
            aiEnabled: false,
            aiPrompt: "",
            isActive: true
          });
        }

        if (importedRules.length === 0) {
          throw new Error("No valid keyword rules detected in the CSV. Format: keyword,matchType,replyText");
        }

        const res = await (api as any).importAutoReplyRulesBulk(importedRules);
        setSuccess(res.message || `Imported ${importedRules.length} rules successfully!`);
        setShowCsvImport(false);
        await loadRules();
        setTimeout(() => setSuccess(""), 5000);
      } catch (err: any) {
        setError(err.message || "Failed to import CSV auto reply rules");
      } finally {
        setCsvImporting(false);
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  // Chat Inbound Simulator Trigger
  const handleSimulateInbound = async () => {
    if (!testMessage.trim()) return;
    
    const userMsgText = testMessage;
    setTestMessage("");
    setSimulating(true);

    // Append user message to logs
    setSimLogs(prev => [
      ...prev,
      { sender: "user", text: userMsgText, time: new Date().toLocaleTimeString() }
    ]);

    try {
      // Direct API simulation call which runs through evaluateAutoReply on backend
      await api.simulateInboundMessage(testPhone, userMsgText, "Simulator Partner");

      // Wait 1.5 seconds to poll messages and fetch the response
      setTimeout(async () => {
        try {
          const chatsRes = await api.getChats();
          const chat = chatsRes.chats.find((c: any) => c.phone === testPhone);
          if (chat && chat.messages.length > 0) {
            // Sort by timestamp descending to find latest
            const sorted = [...chat.messages].sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            const latestOutbound = sorted.reverse().find((m: any) => m.direction === "outbound");
            if (latestOutbound) {
              setSimLogs(prev => [
                ...prev,
                { sender: "bot", text: latestOutbound.message, time: new Date().toLocaleTimeString() }
              ]);
            }
          }
        } catch (e) {
          console.error("Poller simulation reply error", e);
        } finally {
          setSimulating(false);
        }
      }, 1600);

    } catch (err: any) {
      setSimLogs(prev => [
        ...prev,
        { sender: "sys", text: `Error: ${err.message}`, time: new Date().toLocaleTimeString() }
      ]);
      setSimulating(false);
    }
  };

  return (
    <div id="autoreply-tab" className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-emerald-600" />
              <span>Smart Auto-Replies</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Define keyword triggers that send predefined or user-written WhatsApp responses instantly.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start md:self-auto">
            <button
              onClick={() => {
                setShowCsvImport(!showCsvImport);
                setShowForm(false);
              }}
              className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>Bulk Import (CSV)</span>
            </button>
            <button
              onClick={() => {
                setShowForm(!showForm);
                setShowCsvImport(false);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/10 flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Trigger Rule</span>
            </button>
          </div>
        </div>

        {/* CSV Import Panel */}
        {showCsvImport && (
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 animate-fadeIn">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Bulk Upload Keyword Autoreply Rules</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Prepare a standard comma-separated text file with rules to bulk configure your answering tree.
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                CSV Format
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 font-mono text-[11px] text-slate-600 space-y-1">
              <p className="font-bold text-slate-700">Expected Columns Header (Optional):</p>
              <p className="bg-slate-100/60 p-2 rounded text-slate-800 font-bold overflow-x-auto">
                keyword,matchType,replyText
              </p>
              <p className="font-bold text-slate-700 pt-2">Example Lines:</p>
              <p className="bg-slate-100/60 p-2 rounded text-slate-500 overflow-x-auto leading-relaxed">
                "pricing", "contains", "Our basic plan is available monthly."<br />
                "support", "equals", "Standard support hours are 9am-5pm."<br />
                "catalog", "contains", "Thanks for your interest. We will share the product catalog shortly."
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/10 cursor-pointer flex items-center gap-2 transition-colors">
                <Upload className="w-4 h-4" />
                <span>{csvImporting ? "Processing CSV..." : "Choose CSV File & Import"}</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVImport}
                  className="hidden"
                  disabled={csvImporting}
                />
              </label>
              <button
                onClick={() => setShowCsvImport(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

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

        {/* Form to Create New AutoReply Rule */}
        {showForm && (
          <form onSubmit={handleCreateRule} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Configure New Auto-Reply Rule</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Keyword Field */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Trigger Keyword / Phrase</label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g. price, catalog, help"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              {/* Match Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Matching Strategy</label>
                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                >
                  <option value="contains">Contains Keyword</option>
                  <option value="equals">Exact Equals (Case Insensitive)</option>
                  <option value="starts_with">Starts with Keyword</option>
                </select>
              </div>

              {/* Reply Mode */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Execution Mode</label>
                <div className="flex items-center gap-3 py-2">
                  <button
                    type="button"
                    onClick={() => setAiEnabled(!aiEnabled)}
                    className="text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    {aiEnabled ? (
                      <ToggleRight className="w-10 h-10 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-slate-300" />
                    )}
                  </button>
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">
                      {aiEnabled ? "Guided Rule Reply" : "Predefined Static Reply"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {aiEnabled ? "Uses your saved instruction text as the reply" : "Sends predefined text template"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Response Form Content */}
            {aiEnabled ? (
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                  <Cpu className="w-4 h-4 text-emerald-600" />
                  <span>Configure Saved Response Instructions</span>
                </div>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Thanks for contacting us. Please share your requirement and our team will respond during business hours."
                  className="w-full h-24 p-3 border border-emerald-200/60 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                />
                <p className="text-[10px] text-emerald-600/80">
                  This app sends only saved rule responses. No external AI API is required.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Automated Reply Message</label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type the exact message to auto-send when trigger keywords are matched..."
                  className="w-full h-24 p-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required={!aiEnabled}
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm shadow-emerald-600/10"
              >
                Save Trigger Rule
              </button>
            </div>
          </form>
        )}

        {/* Body Layout: Rules List vs Simulator */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Rules List area (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-800">Your Auto-Reply Matching Tree</h2>
                <button
                  onClick={loadRules}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer"
                  title="Reload rules"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {rules.length === 0 ? (
                <div className="text-center py-12">
                  <HelpCircle className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-800">No matching rules configured</h4>
                  <p className="text-xs text-slate-400 mt-1">Click Add Trigger Rule to configure your first automatic responder.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`p-5 rounded-2xl border transition-all ${
                        rule.isActive
                          ? "bg-slate-50/40 border-slate-100 hover:border-emerald-200"
                          : "bg-slate-50/20 border-slate-200/50 opacity-65"
                      } flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
                    >
                      {/* Left: keyword info */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 rounded text-xs font-bold">
                            "{rule.keyword}"
                          </span>
                          <span className="text-[10px] text-slate-400 bg-slate-100 font-bold px-2 py-0.5 rounded uppercase">
                            {rule.matchType.replace("_", " ")}
                          </span>
                          
                          {rule.aiEnabled && (
                            <span className="bg-emerald-50 text-emerald-700 text-[9px] px-2 py-0.5 rounded-full font-bold border border-emerald-100 flex items-center gap-0.5">
                              <Cpu className="w-3 h-3" />
                              <span>SAVED REPLY</span>
                            </span>
                          )}
                        </div>

                        {rule.aiEnabled ? (
                          <p className="text-xs text-slate-500 italic font-medium truncate max-w-md">
                            Reply: {rule.replyText || rule.aiPrompt || "Thanks for your message. Our team will get back to you shortly."}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-600 font-medium truncate max-w-md">
                            Reply: {rule.replyText}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 font-mono">ID: {rule.id}</p>
                      </div>

                      {/* Right: triggers & buttons */}
                      <div className="flex items-center gap-3.5 self-end sm:self-auto">
                        {/* Active toggle button */}
                        <button
                          onClick={() => handleToggleRule(rule)}
                          className="text-slate-400 hover:text-slate-900 transition-colors"
                          title={rule.isActive ? "Deactivate" : "Activate"}
                        >
                          {rule.isActive ? (
                            <ToggleRight className="w-9 h-9 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="w-9 h-9 text-slate-300" />
                          )}
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Delete rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Live Simulator Panel (1 col) */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[520px] overflow-hidden">
              
              {/* Header */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="font-bold text-xs uppercase tracking-wider">Auto-Reply Sandbox Simulator</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              </div>

              {/* Chat body viewport */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50 font-sans text-xs">
                {simLogs.map((log, idx) => {
                  if (log.sender === "sys") {
                    return (
                      <div key={idx} className="text-center py-1 text-[10px] text-slate-400 bg-slate-100 rounded-md p-2">
                        {log.text}
                      </div>
                    );
                  }
                  const isUser = log.sender === "user";
                  return (
                    <div key={idx} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                      <div
                        className={`max-w-[85%] p-3 rounded-2xl shadow-sm ${
                          isUser
                            ? "bg-emerald-600 text-white rounded-tr-none"
                            : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                        }`}
                      >
                        <p>{log.text}</p>
                      </div>
                      <span className="text-[9px] text-slate-400 mt-1 px-1">{log.time}</span>
                    </div>
                  );
                })}
                {simulating && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pl-1">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    <span>AI Responder typing...</span>
                  </div>
                )}
              </div>

              {/* Chat Input form */}
              <div className="p-3 border-t border-slate-100 bg-white flex gap-2">
                <input
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSimulateInbound()}
                  placeholder="Type query to trigger matches..."
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50 text-slate-900"
                />
                <button
                  onClick={handleSimulateInbound}
                  disabled={simulating || !testMessage.trim()}
                  className="p-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 text-white disabled:text-slate-400 rounded-xl transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

            </div>

            {/* Note box */}
            <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl text-[10px] text-slate-500 flex gap-2">
              <Info className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
              <p>
                Inbound simulation requests trigger the exact same matching pipeline as actual WhatsApp web hook handshakes. This lets you inspect your chatbot experience live in your browser sandbox.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

