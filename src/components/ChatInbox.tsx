import React, { useEffect, useState, useRef } from "react";
import {
  MessageSquare,
  Search,
  Send,
  User,
  CheckCheck,
  Smartphone,
  Sparkles,
  Info,
  RefreshCw,
  Clock,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  ArrowLeft,
  Flag,
  Archive,
  Square,
  CheckSquare,
  Paperclip,
  FileText,
  FolderOpen,
  X
} from "lucide-react";
import { api } from "../lib/api";
import { Chat, Message, WhatsAppSession } from "../types";
import { isFeatureVisible, ExperienceMode, maskPhoneNumber } from "../lib/experienceUtils";

interface ChatInboxProps {
  session: WhatsAppSession | null;
  initialChatPhone?: string | null;
  user?: any;
}

export default function ChatInbox({ session, initialChatPhone, user }: ChatInboxProps) {
  const experienceMode = (user?.experienceMode || "daily") as ExperienceMode;
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatPhone, setSelectedChatPhone] = useState<string | null>(initialChatPhone || null);

  // Account Media Selection States
  const [mediaLibrary, setMediaLibrary] = useState<any[]>([]);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [selectedComposeMedia, setSelectedComposeMedia] = useState<any | null>(null);
  const [searchMedia, setSearchMedia] = useState("");

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const res = await api.getMedia();
        if (res && res.media) {
          setMediaLibrary(res.media);
        }
      } catch (err) {
        console.error("Failed to load media assets in ChatInbox:", err);
      }
    };
    fetchMedia();
  }, []);

  useEffect(() => {
    if (initialChatPhone !== undefined && initialChatPhone !== null) {
      setSelectedChatPhone(initialChatPhone);
    }
  }, [initialChatPhone]);
  const [searchQuery, setSearchQuery] = useState("");
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Inbound simulation controls
  const [simName, setSimName] = useState("");
  const [simPhone, setSimPhone] = useState("");
  const [simMessage, setSimMessage] = useState("");
  const [simError, setSimError] = useState("");

  // Multi-selection states
  const [selectedChatPhones, setSelectedChatPhones] = useState<Set<string>>(new Set());
  const [archivedPhones, setArchivedPhones] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("wapi_archived_chats");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleSelectChat = (phone: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const next = new Set(selectedChatPhones);
    if (next.has(phone)) {
      next.delete(phone);
    } else {
      next.add(phone);
    }
    setSelectedChatPhones(next);
  };

  const handleBulkArchive = () => {
    const nextArchived = new Set(archivedPhones);
    selectedChatPhones.forEach(phone => {
      nextArchived.add(phone);
    });
    setArchivedPhones(nextArchived);
    try {
      localStorage.setItem("wapi_archived_chats", JSON.stringify(Array.from(nextArchived)));
    } catch (err) {
      console.error(err);
    }
    // Clear selection
    setSelectedChatPhones(new Set());
    alert(`Archived ${selectedChatPhones.size} selected conversations!`);
  };

  const handleBulkFlag = () => {
    const nextFlagged = new Set(flaggedPhones);
    const someUnflagged = Array.from(selectedChatPhones).some(phone => !flaggedPhones.has(phone));
    
    selectedChatPhones.forEach(phone => {
      if (someUnflagged) {
        nextFlagged.add(phone);
      } else {
        nextFlagged.delete(phone);
      }
    });
    setFlaggedPhones(nextFlagged);
    try {
      localStorage.setItem("wapi_flagged_chats", JSON.stringify(Array.from(nextFlagged)));
    } catch (err) {
      console.error(err);
    }
    setSelectedChatPhones(new Set());
  };

  const handleBulkMarkRead = () => {
    setChats(prev => prev.map(c => {
      if (selectedChatPhones.has(c.phone)) {
        return { ...c, unreadCount: 0 };
      }
      return c;
    }));
    setSelectedChatPhones(new Set());
  };

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'flagged' | 'attention' | 'archived'>('all');
  const [flaggedPhones, setFlaggedPhones] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("wapi_flagged_chats");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleFlag = (phone: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const next = new Set(flaggedPhones);
    if (next.has(phone)) {
      next.delete(phone);
    } else {
      next.add(phone);
    }
    setFlaggedPhones(next);
    try {
      localStorage.setItem("wapi_flagged_chats", JSON.stringify(Array.from(next)));
    } catch (err) {
      console.error(err);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadInbox = async () => {
    try {
      const res = await api.getChats();
      setChats(res.chats);
      
      // Select first chat by default if none selected
      if (res.chats.length > 0 && !selectedChatPhone) {
        setSelectedChatPhone(res.chats[0].phone);
      }
    } catch (err) {
      console.error("Failed to load Chats", err);
    }
  };

  useEffect(() => {
    loadInbox();
    
    const handleNewMessage = () => {
      loadInbox();
    };

    window.addEventListener("wapi:new_message", handleNewMessage);
    window.addEventListener("wapi:message_status_updated", handleNewMessage);

    return () => {
      window.removeEventListener("wapi:new_message", handleNewMessage);
      window.removeEventListener("wapi:message_status_updated", handleNewMessage);
    };
  }, []);

  // Auto scroll messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [selectedChatPhone, chats]);

  const activeChat = chats.find(c => c.phone === selectedChatPhone);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText && !selectedComposeMedia) || !selectedChatPhone) return;

    setError("");
    const messageToSend = inputText;
    setInputText("");
    const mediaToSend = selectedComposeMedia;
    setSelectedComposeMedia(null);

    try {
      await api.sendInboxMessage(
        selectedChatPhone,
        messageToSend,
        activeChat?.contactName || selectedChatPhone,
        mediaToSend?.type === "image" ? mediaToSend.url : undefined,
        mediaToSend?.type === "pdf" ? mediaToSend.url : undefined,
        mediaToSend?.type || undefined,
        mediaToSend?.name || undefined
      );
      await loadInbox();
    } catch (err: any) {
      setError(err.message || "Failed to send message.");
      setInputText(messageToSend); // restore draft
      setSelectedComposeMedia(mediaToSend); // restore attachment
    }
  };

  const handleSimulateInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simPhone || !simMessage) {
      setSimError("Phone and Message text are required.");
      return;
    }

    setSimError("");
    try {
      const formattedPhone = simPhone.replace(/[\s\-\+]/g, "");
      await api.simulateInboundMessage(`+${formattedPhone}`, simName || "Simulated Customer", simMessage);
      setSimMessage("");
      setSelectedChatPhone(`+${formattedPhone}`); // Auto focus new chat
      await loadInbox();
    } catch (err) {
      setSimError("Failed to trigger simulation.");
    }
  };

  const handlePreFillInbound = (name: string, phone: string, msg: string) => {
    setSimName(name);
    setSimPhone(phone);
    setSimMessage(msg);
  };

  const isConnected = session?.sessionStatus === "connected";

  // Filter chats by search bar query and active filter tabs
  const filteredChats = chats.filter(chat => {
    // 1. Text search matching
    const matchesSearch = chat.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          chat.phone.includes(searchQuery);
    if (!matchesSearch) return false;

    // 2. Archive status filter
    const isArchived = archivedPhones.has(chat.phone);
    if (activeFilter === 'archived') {
      return isArchived;
    } else if (isArchived) {
      return false;
    }

    // 3. Active filter category
    if (activeFilter === 'unread') {
      return chat.unreadCount > 0;
    }
    if (activeFilter === 'flagged') {
      return flaggedPhones.has(chat.phone);
    }
    if (activeFilter === 'attention') {
      // Needs Attention if last message is inbound OR has unread count OR is flagged
      const lastMsg = chat.messages[chat.messages.length - 1];
      const lastIsIncoming = lastMsg ? lastMsg.direction === "inbound" : false;
      return lastIsIncoming || chat.unreadCount > 0 || flaggedPhones.has(chat.phone);
    }
    return true;
  });

  return (
    <div id="inbox-tab" className="flex-1 bg-slate-50 flex h-full overflow-hidden">
      
      {/* LEFT CONTAINER: Chat list pane (responsive width) */}
      <div className={`w-full md:w-80 border-r border-slate-200/80 bg-white flex flex-col h-full shrink-0 ${
        selectedChatPhone ? "hidden md:flex" : "flex"
      }`}>
        
        {/* Bulk Action Header instead of regular header if items are selected */}
        {selectedChatPhones.size > 0 ? (
          <div className="p-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between gap-2 animate-in slide-in-from-top duration-200 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-emerald-800">{selectedChatPhones.size} selected</span>
              <button
                onClick={() => setSelectedChatPhones(new Set())}
                className="text-[10px] text-slate-500 hover:text-slate-700 underline font-bold cursor-pointer"
              >
                Clear
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={handleBulkFlag}
                title="Toggle Flag"
                className="p-1.5 bg-white hover:bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-sm transition-all"
              >
                <Flag className="w-3 h-3 fill-current" />
                <span>Flag</span>
              </button>
              
              <button
                onClick={handleBulkArchive}
                title="Archive selected"
                className="p-1.5 bg-white hover:bg-purple-50 text-purple-600 border border-purple-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-sm transition-all"
              >
                <Archive className="w-3 h-3" />
                <span>{activeFilter === 'archived' ? 'Inbox' : 'Archive'}</span>
              </button>

              <button
                onClick={handleBulkMarkRead}
                title="Mark Read"
                className="p-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-sm transition-all"
              >
                <CheckCheck className="w-3 h-3" />
                <span>Read</span>
              </button>
            </div>
          </div>
        ) : (
          /* Search Header area */
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                <span>Inbox chats</span>
              </h2>
              <button
                onClick={loadInbox}
                className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                title="Refresh Chat Feed"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="relative rounded-xl shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="inboxSearch"
                name="inboxSearch"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chat list..."
                className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 bg-slate-50/50"
              />
            </div>

            {/* Filter tabs */}
            <div className="flex flex-wrap gap-1 pt-1">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  activeFilter === 'all'
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-100"
                }`}
              >
                All ({chats.filter(c => !archivedPhones.has(c.phone)).length})
              </button>
              <button
                onClick={() => setActiveFilter('unread')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activeFilter === 'unread'
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-100"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Unread ({chats.filter(c => !archivedPhones.has(c.phone) && c.unreadCount > 0).length})
              </button>
              <button
                onClick={() => setActiveFilter('flagged')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activeFilter === 'flagged'
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-100"
                }`}
              >
                <Flag className="w-2.5 h-2.5 fill-current" />
                Flagged ({chats.filter(c => !archivedPhones.has(c.phone) && flaggedPhones.has(c.phone)).length})
              </button>
              <button
                onClick={() => setActiveFilter('attention')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activeFilter === 'attention'
                    ? "bg-rose-500 text-white shadow-sm"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-100"
                }`}
              >
                <AlertCircle className="w-2.5 h-2.5" />
                Attention ({chats.filter(c => {
                  if (archivedPhones.has(c.phone)) return false;
                  const lastMsg = c.messages[c.messages.length - 1];
                  const lastIsIncoming = lastMsg ? lastMsg.direction === "inbound" : false;
                  return lastIsIncoming || c.unreadCount > 0 || flaggedPhones.has(c.phone);
                }).length})
              </button>
              <button
                onClick={() => setActiveFilter('archived')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activeFilter === 'archived'
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-100"
                }`}
              >
                <Archive className="w-2.5 h-2.5" />
                Archived ({chats.filter(c => archivedPhones.has(c.phone)).length})
              </button>
            </div>
          </div>
        )}

        {/* Chats Room Stream scrollable body */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {filteredChats.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400 px-4">
              No chats found. Use the right simulation panel to generate testing chats.
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isSelected = chat.phone === selectedChatPhone;
              const lastMsgDate = new Date(chat.lastMessageTime);
              const isFlagged = flaggedPhones.has(chat.phone);
              const isChecked = selectedChatPhones.has(chat.phone);

              return (
                <div
                  key={chat.phone}
                  onClick={() => setSelectedChatPhone(chat.phone)}
                  className={`p-4 flex items-start gap-2.5 cursor-pointer transition-colors relative group ${
                    isSelected ? "bg-emerald-50/50 hover:bg-emerald-50" : "hover:bg-slate-50"
                  }`}
                >
                  {/* Selection Checkbox */}
                  <div
                    onClick={(e) => toggleSelectChat(chat.phone, e)}
                    className="p-1 hover:bg-slate-200/50 rounded-lg shrink-0 flex items-center justify-center cursor-pointer text-slate-400 hover:text-emerald-600 transition-colors mt-0.5"
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 group-hover:text-slate-400 shrink-0" />
                    )}
                  </div>

                  <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 border border-slate-200/50 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {chat.contactName.startsWith("+") || /^\d+$/.test(chat.contactName.replace(/\D/g, "")) 
                          ? maskPhoneNumber(chat.contactName) 
                          : chat.contactName}
                      </h4>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {lastMsgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate leading-snug">
                      {chat.lastMessage}
                    </p>
                  </div>

                  {/* Flag and unread indicator column */}
                  <div className="flex flex-col items-end justify-between self-stretch shrink-0 gap-1.5">
                    {/* Flag button */}
                    <button
                      onClick={(e) => toggleFlag(chat.phone, e)}
                      className={`p-1 rounded hover:bg-slate-200/50 transition-colors cursor-pointer ${
                        isFlagged ? "text-amber-500" : "text-slate-300 opacity-0 group-hover:opacity-100"
                      }`}
                      title={isFlagged ? "Unflag conversation" : "Flag conversation"}
                    >
                      <Flag className={`w-3.5 h-3.5 ${isFlagged ? "fill-amber-500" : ""}`} />
                    </button>

                    {/* Unread dot */}
                    {chat.unreadCount > 0 && (
                      <span className="w-4 h-4 bg-emerald-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-sm">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Active selection accent line */}
                  {isSelected && (
                    <div className="absolute top-0 left-0 bottom-0 w-1 bg-emerald-600 rounded-r-full" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CENTER CONTAINER: Message Room View (Detailed timeline) */}
      <div className={`flex-1 flex flex-col h-full bg-slate-100 relative ${
        !selectedChatPhone ? "hidden md:flex" : "flex"
      }`}>
        {activeChat ? (
          <>
            {/* Conversation header bar */}
            <div className="p-4 bg-white border-b border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Back button on mobile */}
                <button
                  onClick={() => setSelectedChatPhone(null)}
                  className="p-1 -ml-1 text-slate-500 hover:text-slate-800 md:hidden cursor-pointer"
                  title="Back to chat list"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
                  <User className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 leading-none">
                     {activeChat.contactName.startsWith("+") || /^\d+$/.test(activeChat.contactName.replace(/\D/g, "")) 
                       ? maskPhoneNumber(activeChat.contactName) 
                       : activeChat.contactName}
                  </h3>
                  <span className="text-[9px] text-slate-400 font-mono leading-none mt-1 inline-block">
                    {maskPhoneNumber(activeChat.phone)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`}></div>
                <span className="text-[10px] font-semibold text-slate-500">
                  {isConnected ? "Device Linked" : "Simulated Offline"}
                </span>
              </div>
            </div>

            {/* Verification Device warning inside text area */}
            {!isConnected && (
              <div className="bg-amber-50 p-3 border-b border-amber-100 text-xs text-amber-700 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Manual dispatch disabled. Please link your WhatsApp device in the Scanner screen first.</span>
              </div>
            )}

            {/* Error notifications */}
            {error && (
              <div className="bg-rose-50 p-3 border-b border-rose-100 text-xs text-rose-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeChat.messages.map((msg) => {
                const isOutbound = msg.direction === "outbound";
                const msgDate = new Date(msg.timestamp);

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] p-3 rounded-2xl shadow-sm text-xs relative ${
                        isOutbound
                          ? "bg-emerald-800 text-white rounded-tr-none"
                          : "bg-white text-slate-800 rounded-tl-none border border-slate-200/50"
                      }`}
                    >
                      {/* Outbound chat text */}
                      <p className="whitespace-pre-line leading-relaxed">{msg.message}</p>
                      
                      {/* Attached PDF card indicator inside bubble if any */}
                      {(msg.pdfUrl || msg.mediaType === "pdf") && (
                        <a
                          href={msg.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2.5 flex items-center gap-2 bg-slate-900/10 hover:bg-slate-900/20 text-current border border-current/10 p-2.5 rounded-xl transition-all cursor-pointer"
                        >
                          <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center text-white font-bold text-[9px] shrink-0 shadow-sm">
                            PDF
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold truncate">{msg.mediaName || "document.pdf"}</p>
                            <p className="text-[8px] opacity-70 uppercase font-mono font-bold">Open Attachment &rarr;</p>
                          </div>
                        </a>
                      )}

                      {/* Attached image preview inside bubble if any */}
                      {(msg.image || msg.mediaType === "image") && (
                        <div className="rounded-xl overflow-hidden mt-2.5 border border-slate-200/10 shadow-inner">
                          <img src={msg.image || msg.pdfUrl} alt="In-chat file attachment" className="max-h-48 object-cover w-full" referrerPolicy="no-referrer" />
                        </div>
                      )}

                      {/* A/B Test Variant badge indicator if outbound */}
                      {isOutbound && msg.abVariation && (
                        <span className="inline-block mt-2 bg-white/20 text-[9px] font-semibold tracking-wider font-mono px-2 py-0.5 rounded uppercase">
                          ⚡ Variant {msg.abVariation}
                        </span>
                      )}

                      <div className="flex items-center justify-end gap-1 mt-1 text-[8px] text-opacity-70 text-slate-400">
                        <span className={isOutbound ? "text-emerald-300" : "text-slate-400"}>
                          {msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isOutbound && (
                          <CheckCheck
                            className={`w-3.5 h-3.5 ${
                              msg.status === "read"
                                ? "text-blue-400"
                                : msg.status === "delivered"
                                ? "text-slate-300"
                                : "text-slate-400/50"
                            }`}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Textarea Input Tray */}
            <div className="p-4 bg-white border-t border-slate-200/80">
              {/* Attached compose media preview if any */}
              {selectedComposeMedia && (
                <div className="mb-2 p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedComposeMedia.type === "pdf" ? (
                      <div className="w-8 h-8 bg-rose-100 text-rose-700 font-bold rounded-lg flex items-center justify-center text-[10px] shrink-0">
                        PDF
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg border overflow-hidden shrink-0">
                        <img src={selectedComposeMedia.url} alt="thumbnail" className="object-cover w-full h-full" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{selectedComposeMedia.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono uppercase">{selectedComposeMedia.type} &bull; {selectedComposeMedia.size}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedComposeMedia(null)}
                    className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                    title="Remove attachment"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex gap-2.5">
                <button
                  type="button"
                  disabled={!isConnected}
                  onClick={() => setShowMediaPicker(true)}
                  className="p-3.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 rounded-xl transition-colors cursor-pointer flex items-center justify-center shrink-0"
                  title="Attach asset from account library"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <input
                  id="chatTextInput"
                  name="chatTextInput"
                  type="text"
                  disabled={!isConnected}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={isConnected ? "Type manual WhatsApp response here..." : "Link WhatsApp on scanner screen to respond..."}
                  className="block flex-1 px-4 py-3.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 placeholder-slate-400 disabled:opacity-50"
                />
                
                <button
                  type="submit"
                  disabled={!isConnected || (!inputText && !selectedComposeMedia)}
                  className="p-3.5 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-colors shadow-md shadow-emerald-100 cursor-pointer flex items-center justify-center shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
            <MessageSquare className="w-16 h-16 text-slate-300 mb-4" />
            <h3 className="text-base font-bold text-slate-700">Inbox conversation workspace</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">No conversation selected. Use the simulation panel on the right to start dynamic text responses.</p>
          </div>
        )}
      </div>

      {/* RIGHT CONTAINER: Inbound Simulation Workspace Panel (responsive) */}
      {isFeatureVisible("inbound-simulator", experienceMode) && (
        <div className="hidden lg:flex lg:w-80 border-l border-slate-200/80 bg-white p-4 flex flex-col h-full shrink-0 overflow-y-auto space-y-6">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>Inbound Text Simulator</span>
            </h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Simulate customers texting your WhatsApp account. Perfect for evaluating live two-way chats and auto-replies.
            </p>
          </div>

          {simError && (
            <p className="text-[10px] font-semibold text-rose-600 bg-rose-50 p-2 border border-rose-100 rounded-lg">{simError}</p>
          )}

          <form onSubmit={handleSimulateInbound} className="space-y-4 pt-2">
            <div>
              <label htmlFor="simCustName" className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Customer Name</label>
              <input
                id="simCustName"
                name="simCustName"
                type="text"
                value={simName}
                onChange={(e) => setSimName(e.target.value)}
                placeholder="e.g. Priya Patel"
                className="block w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50/50"
              />
            </div>

            <div>
              <label htmlFor="simCustPhone" className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Sender Phone Number</label>
              <input
                id="simCustPhone"
                name="simCustPhone"
                type="text"
                value={simPhone}
                onChange={(e) => setSimPhone(e.target.value)}
                placeholder="e.g. 919876543210"
                className="block w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50/50 font-mono"
              />
            </div>

            <div>
              <label htmlFor="simCustMsg" className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Incoming Message Text</label>
              <textarea
                id="simCustMsg"
                name="simCustMsg"
                rows={3}
                value={simMessage}
                onChange={(e) => setSimMessage(e.target.value)}
                placeholder="e.g. Hi! What are your pricing plans?"
                className="block w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50/50"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              Simulate Customer Message 📲
            </button>
          </form>

          {/* Quick Testing Templates */}
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Testing Templates (Quick fill)</h4>
            <div className="space-y-2">
              
              <button
                onClick={() => handlePreFillInbound("Ravi Kumar", "919876543210", "Price of your campaign tool?")}
                className="w-full text-left p-2 hover:bg-slate-50 border border-slate-100 rounded-xl text-[10px] block transition-colors cursor-pointer"
              >
                <span className="font-bold text-slate-800 block">Ravi Kumar (919876543210)</span>
                <span className="text-slate-500 italic">"Price of your campaign tool?"</span>
              </button>

              <button
                onClick={() => handlePreFillInbound("John Doe", "15550192834", "Interested! Let's schedule a call.")}
                className="w-full text-left p-2 hover:bg-slate-50 border border-slate-100 rounded-xl text-[10px] block transition-colors cursor-pointer"
              >
                <span className="font-bold text-slate-800 block">John Doe (15550192834)</span>
                <span className="text-slate-500 italic">"Interested! Let's schedule a call."</span>
              </button>

            </div>
          </div>

          <div className="p-3 bg-blue-50/40 border border-blue-100 rounded-xl text-[10px] text-slate-500 flex gap-1.5">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="leading-snug">Auto-Replies respond instantly based on keywords. Type "price" or "interested" to trigger mock responsive agents.</p>
          </div>

        </div>
      )}

      {/* Media Library Picker Modal */}
      {showMediaPicker && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative border border-slate-100 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-150 shrink-0">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-emerald-600 animate-pulse" />
                <h3 className="font-bold text-slate-900 text-base">Account Media Library Assets</h3>
              </div>
              <button
                onClick={() => setShowMediaPicker(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Search Bar */}
            <div className="my-4 shrink-0">
              <input
                id="mediaSearchQueryInputInbox"
                type="text"
                value={searchMedia}
                onChange={(e) => setSearchMedia(e.target.value)}
                placeholder="Search flyers, brochures, PDFs, documents, or image assets..."
                className="block w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-400 bg-slate-50/50"
              />
            </div>

            {/* Assets Grid Container */}
            <div className="flex-1 overflow-y-auto min-h-[300px] pr-1">
              {mediaLibrary.filter(item => 
                item.name.toLowerCase().includes(searchMedia.toLowerCase()) || 
                item.type.toLowerCase().includes(searchMedia.toLowerCase())
              ).length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700">No media assets found</p>
                  <p className="text-xs text-slate-400 mt-1">Try tweaking your search or upload a custom asset.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {mediaLibrary.filter(item => 
                    item.name.toLowerCase().includes(searchMedia.toLowerCase()) || 
                    item.type.toLowerCase().includes(searchMedia.toLowerCase())
                  ).map((item) => {
                    const isSelected = selectedComposeMedia?.url === item.url;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedComposeMedia(item);
                          setShowMediaPicker(false);
                        }}
                        className={`border rounded-2xl p-3.5 cursor-pointer transition-all flex flex-col justify-between h-40 ${
                          isSelected 
                            ? "border-emerald-500 bg-emerald-50/20 shadow-sm shadow-emerald-50" 
                            : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
                        }`}
                      >
                        <div>
                          {item.type === "pdf" ? (
                            <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center text-rose-700 font-bold text-[10px] mb-2.5">
                              PDF
                            </div>
                          ) : (
                            <div className="w-12 h-8 rounded-lg border overflow-hidden mb-2.5 shrink-0">
                              <img src={item.url} alt={item.name} className="object-cover w-full h-full" />
                            </div>
                          )}
                          <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">{item.name}</h4>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100/60 text-[10px] text-slate-400">
                          <span className="font-mono uppercase text-[9px] font-semibold">{item.type}</span>
                          <span>{item.size || "1.2 MB"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="mt-6 pt-4 border-t border-slate-150 flex items-center justify-between shrink-0 bg-white">
              <p className="text-[10px] text-slate-400 leading-normal max-w-md">
                💡 Select any asset above to automatically bind it as a WhatsApp media message attachment.
              </p>
              <button
                type="button"
                onClick={() => setShowMediaPicker(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close Library
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
