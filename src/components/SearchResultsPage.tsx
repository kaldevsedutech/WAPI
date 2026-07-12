import React, { useState } from "react";
import { Search, Calendar, MessageSquare, Users, ArrowLeft, ChevronRight, Share2, CheckCircle, Clock } from "lucide-react";

interface SearchResultsPageProps {
  query: string;
  results: {
    campaigns: any[];
    contacts: any[];
    messages: any[];
  } | null;
  onNavigateCampaign: (id: string) => void;
  onNavigateContact: (id: string) => void;
  onNavigateMessage: (phone: string) => void;
  onBack: () => void;
}

export default function SearchResultsPage({
  query,
  results,
  onNavigateCampaign,
  onNavigateContact,
  onNavigateMessage,
  onBack
}: SearchResultsPageProps) {
  const [activeFilter, setActiveFilter] = useState<"all" | "campaigns" | "contacts" | "messages">("all");

  const totalCampaigns = results?.campaigns.length || 0;
  const totalContacts = results?.contacts.length || 0;
  const totalMessages = results?.messages.length || 0;
  const totalResults = totalCampaigns + totalContacts + totalMessages;

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50 overflow-y-auto animate-in fade-in duration-150">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-600 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Workspace</span>
          </button>
        </div>

        {/* Title Bar */}
        <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
              Search Results for <span className="text-emerald-600">"{query}"</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Found {totalResults} matching records in database datasets
            </p>
          </div>

          {/* Quick Filter Pill Selection */}
          <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-950"
              }`}
            >
              All ({totalResults})
            </button>
            <button
              onClick={() => setActiveFilter("campaigns")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeFilter === "campaigns" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-950"
              }`}
            >
              Campaigns ({totalCampaigns})
            </button>
            <button
              onClick={() => setActiveFilter("contacts")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeFilter === "contacts" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-950"
              }`}
            >
              Lists ({totalContacts})
            </button>
            <button
              onClick={() => setActiveFilter("messages")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeFilter === "messages" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-950"
              }`}
            >
              Messages ({totalMessages})
            </button>
          </div>
        </div>

        {totalResults === 0 ? (
          <div className="text-center py-20 bg-white border border-slate-150 rounded-2xl shadow-sm">
            <Search className="w-16 h-16 text-slate-200 mx-auto mb-4 animate-pulse" />
            <h3 className="text-base font-bold text-slate-900">No results found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              We couldn't find any campaigns, contacts, or chat messages matching your term. Try refining your spelling or searching for a phone number.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* 1. Campaigns matches segment */}
            {(activeFilter === "all" || activeFilter === "campaigns") && totalCampaigns > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Share2 className="w-4.5 h-4.5 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    Matched Campaigns ({totalCampaigns})
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results?.campaigns.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => onNavigateCampaign(c.id)}
                      className="bg-white p-5 rounded-2xl border border-slate-150 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-600 transition-colors">
                            {c.title}
                          </h4>
                          <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border ${
                            c.status === "completed" 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                              : "bg-amber-50 text-amber-700 border-amber-100"
                          }`}>
                            {c.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 italic mb-3 font-medium">
                          "{c.templateText}"
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(c.createdAt).toLocaleDateString()}
                        </span>
                        <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {c.totalMessages} targets
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Contacts matches segment */}
            {(activeFilter === "all" || activeFilter === "contacts") && totalContacts > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Users className="w-4.5 h-4.5 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    Matched Saved Lists ({totalContacts})
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results?.contacts.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => onNavigateContact(g.id)}
                      className="bg-white p-5 rounded-2xl border border-slate-150 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                    >
                      <div>
                        <div className="bg-blue-50 text-blue-600 p-2 rounded-xl border border-blue-100/30 w-fit mb-3">
                          <Users className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-600 transition-colors truncate">
                          {g.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Audience ID: {g.id}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded font-mono">
                          {g.count} contacts
                        </span>
                        <span className="text-blue-600 font-semibold flex items-center gap-0.5 group-hover:underline">
                          Inspect List
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Message History matches segment */}
            {(activeFilter === "all" || activeFilter === "messages") && totalMessages > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <MessageSquare className="w-4.5 h-4.5 text-purple-600" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    Matched Transmission Messages ({totalMessages})
                  </h3>
                </div>

                <div className="space-y-2">
                  {results?.messages.map((m, idx) => (
                    <div
                      key={idx}
                      onClick={() => onNavigateMessage(m.contactPhone)}
                      className="relative group bg-white p-4 rounded-2xl border border-slate-150 hover:shadow-md hover:border-purple-200 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      {/* Hover Tooltip Preview Window */}
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3.5 hidden group-hover:block z-50 w-80 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-800 text-xs pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 mb-2 font-bold text-[9px] text-slate-400 uppercase tracking-wider">
                          <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                          Full Transmission Log Preview
                        </div>
                        <div className="font-mono bg-slate-950 p-3 rounded-xl border border-slate-850 break-words leading-relaxed text-slate-200 text-[11px] max-h-48 overflow-y-auto">
                          {m.message}
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold mt-2 pt-1 border-t border-slate-850">
                          <span>Status: DELIVERED</span>
                          <span>Length: {m.message.length} chars</span>
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-slate-900">{m.contactName || "Unknown Customer"}</span>
                          <span className="text-slate-400 font-mono text-[10px]">{m.contactPhone}</span>
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                            m.direction === "outbound" 
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                              : "bg-purple-50 text-purple-700 border border-purple-100"
                          }`}>
                            {m.direction === "outbound" ? "Outbound" : "Inbound"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-100 max-w-3xl">
                          {m.message}
                        </p>
                      </div>

                      <div className="text-[10px] text-slate-400 font-semibold font-mono shrink-0 text-right">
                        {new Date(m.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
