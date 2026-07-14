import React, { useState, useEffect } from "react";
import {
  HelpCircle,
  BookOpen,
  Scale,
  Shield,
  CreditCard,
  MessageSquare,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle,
  FileText,
  Lock,
  Smartphone,
  Sparkles,
  RefreshCw,
  Info,
  DollarSign
} from "lucide-react";

interface FaqAndPoliciesProps {
  user: any;
}

type SidebarCategory = "billing" | "usage" | "privacy";

export default function FaqAndPolicies({ user }: FaqAndPoliciesProps) {
  const brandColor = user?.brandColor || "emerald";

  // Dynamic Color Palette Mapping
  const colorMap: Record<string, {
    bg: string;
    hover: string;
    text: string;
    bgLight: string;
    border: string;
    ring: string;
    badge: string;
    accent: string;
  }> = {
    emerald: {
      bg: "bg-emerald-600",
      hover: "hover:bg-emerald-700",
      text: "text-emerald-600",
      bgLight: "bg-emerald-50",
      border: "border-emerald-100",
      ring: "focus:ring-emerald-500",
      badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
      accent: "from-emerald-500 to-teal-600"
    },
    blue: {
      bg: "bg-blue-600",
      hover: "hover:bg-blue-700",
      text: "text-blue-600",
      bgLight: "bg-blue-50",
      border: "border-blue-100",
      ring: "focus:ring-blue-500",
      badge: "bg-blue-100 text-blue-800 border-blue-200",
      accent: "from-blue-500 to-indigo-600"
    },
    indigo: {
      bg: "bg-indigo-600",
      hover: "hover:bg-indigo-700",
      text: "text-indigo-600",
      bgLight: "bg-indigo-50",
      border: "border-indigo-100",
      ring: "focus:ring-indigo-500",
      badge: "bg-indigo-100 text-indigo-800 border-indigo-200",
      accent: "from-indigo-500 to-violet-600"
    },
    violet: {
      bg: "bg-violet-600",
      hover: "hover:bg-violet-700",
      text: "text-violet-600",
      bgLight: "bg-violet-50",
      border: "border-violet-100",
      ring: "focus:ring-violet-500",
      badge: "bg-violet-100 text-violet-800 border-violet-200",
      accent: "from-violet-500 to-fuchsia-600"
    },
    rose: {
      bg: "bg-rose-600",
      hover: "hover:bg-rose-700",
      text: "text-rose-600",
      bgLight: "bg-rose-50",
      border: "border-rose-100",
      ring: "focus:ring-rose-500",
      badge: "bg-rose-100 text-rose-800 border-rose-200",
      accent: "from-rose-500 to-pink-600"
    },
    amber: {
      bg: "bg-amber-600",
      hover: "hover:bg-amber-700",
      text: "text-amber-600",
      bgLight: "bg-amber-50",
      border: "border-amber-100",
      ring: "focus:ring-amber-500",
      badge: "bg-amber-100 text-amber-800 border-amber-200",
      accent: "from-amber-500 to-orange-600"
    },
  };

  const palette = colorMap[brandColor] || colorMap.emerald;

  const [activeCategory, setActiveCategory] = useState<SidebarCategory>("billing");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Dynamic state loaded from structured backend source
  const [loading, setLoading] = useState(true);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any>({
    terms: { lastUpdated: "July 9, 2026", version: "2.5", sections: [] },
    privacy: { lastUpdated: "July 9, 2026", guarantee: "", sections: [] },
    refunds: { lastUpdated: "July 9, 2026", sections: [] }
  });

  // Fetch structured FAQs and policies from backend on mount
  useEffect(() => {
    let active = true;
    const loadFaqData = async () => {
      try {
        const res = await fetch("/api/faq-data");
        if (!res.ok) throw new Error("Status code not ok");
        const data = await res.json();
        if (active) {
          setFaqs(data.faqs || []);
          setPolicies(data.policies || {});
        }
      } catch (err) {
        console.error("Failed to load structured FAQ data from API:", err);
        // Standard high-quality fallback states if fetch fails
        if (active) {
          setFaqs([
            {
              category: "general",
              question: "What is WAPIMI and how does it work?",
              answer: "WAPIMI is a high-speed WhatsApp marketing broadcast and conversational automation platform. It allows businesses to connect their WhatsApp numbers securely by scanning a dynamic QR code. Once linked, you can import client contact groups, design campaigns with custom variables, manage dual-inbox messaging, and analyze response rates."
            },
            {
              category: "billing",
              question: "How do plan subscriptions, renewals, and payments work?",
              answer: "WAPIMI offers Daily, Weekly, and Monthly plans. Subscriptions are billed automatically in advance. To view or adjust your subscription, navigate to the 'Billing & Plans' panel where you can upgrade instantly or cancel recurring billing."
            },
            {
              category: "billing",
              question: "What is your refund policy?",
              answer: "We offer a 100% full refund if cancelled within 48 hours of original purchase or renewal, provided your total WhatsApp broadcasts have not exceeded 100 messages. Beyond this threshold, subscription charges are non-refundable, but access continues until the cycle ends."
            },
            {
              category: "whatsapp",
              question: "Can my WhatsApp number get banned for broadcasting?",
              answer: "WhatsApp enforces strict anti-spam guidelines. To safeguard your account, we mandate that you only message recipients who have explicitly opted in. Additionally, utilizing dynamic parameters, A/B templates, and custom transmission intervals reduces risk."
            },
            {
              category: "whatsapp",
              question: "How do I scan the QR code to link my WhatsApp session?",
              answer: "Navigate to the WhatsApp Connection tab, wait for the dynamic QR code to generate, open WhatsApp on your phone, go to Settings -> Linked Devices -> Link a Device, and scan the QR code to instantly sync the session router."
            },
            {
              category: "data",
              question: "How safe is my contact data and message history?",
              answer: "We employ high-security database isolation and column-level encryption. Your contact lists, message histories, and campaign details are private, locked strictly under your unique user ID, and never rented or sold."
            }
          ]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadFaqData();
    return () => {
      active = false;
    };
  }, []);

  // Filter FAQs belonging to the selected category and matching search query
  const getFilteredFaqs = () => {
    return faqs.filter(faq => {
      let cat: SidebarCategory = "usage";
      if (faq.category === "billing") {
        cat = "billing";
      } else if (faq.category === "data" || faq.category === "privacy") {
        cat = "privacy";
      } else {
        cat = "usage";
      }

      if (cat !== activeCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q);
    });
  };

  // Get terms and policy documents for the selected category
  const getCategoryPolicies = () => {
    const termsSections = policies.terms?.sections || [];
    const privacySections = policies.privacy?.sections || [];
    const refundSections = policies.refunds?.sections || [];

    if (activeCategory === "billing") {
      return {
        title: "Billing & Refund Policies",
        description: "Review detailed cancellation terms, subscription renewals, and our 48-hour refund window.",
        sections: [
          // Terms section 4: Billing
          ...termsSections.filter((s: any) => s.title.includes("Billing") || s.title.includes("4.")).map((s: any) => ({
            ...s,
            source: "Terms of Service"
          })),
          // Refund sections
          ...refundSections.map((s: any) => ({
            ...s,
            source: "Refund Policy"
          }))
        ]
      };
    } else if (activeCategory === "privacy") {
      return {
        title: "Privacy & Compliance Standards",
        description: "Understand what information we collect, secure CSV database isolation, and your data protection rights.",
        guarantee: policies.privacy?.guarantee,
        sections: [
          ...privacySections.map((s: any) => ({
            ...s,
            source: "Privacy Policy"
          }))
        ]
      };
    } else { // usage
      return {
        title: "Terms of Service & Platform Rules",
        description: "Review our agreement, absolute anti-spam policies, and daily message transmission limits.",
        sections: [
          ...termsSections.filter((s: any) => !s.title.includes("Billing") && !s.title.includes("4.")).map((s: any) => ({
            ...s,
            source: "Terms of Service"
          }))
        ]
      };
    }
  };

  const filteredFaqs = getFilteredFaqs();
  const policyInfo = getCategoryPolicies();

  const categoriesList = [
    {
      id: "billing" as SidebarCategory,
      label: "Billing & Payments",
      desc: "Plans, renewals, and refunds",
      icon: CreditCard,
    },
    {
      id: "usage" as SidebarCategory,
      label: "Platform Usage",
      desc: "Device connection & spam limits",
      icon: Smartphone,
    },
    {
      id: "privacy" as SidebarCategory,
      label: "Data & Privacy",
      desc: "Compliance & secure databases",
      icon: Shield,
    }
  ];

  return (
    <main className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200" id="faq-policies-page">
      {/* Visual Page Header Banner */}
      <div className={`rounded-3xl bg-gradient-to-r ${palette.accent} p-6 md:p-8 text-white relative overflow-hidden shadow-md`}>
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5" />
            Compliance & Knowledge Hub
          </div>
          <h1 className="text-2xl md:text-3.5xl font-extrabold tracking-tight">FAQ & Central Policies</h1>
          <p className="text-white/80 text-xs md:text-sm font-medium leading-relaxed">
            Organized knowledge base with answers to standard billing queries, in-depth device syncing guidelines, anti-spam rules, and security frameworks.
          </p>
        </div>
        {/* Background Decorative Circles */}
        <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute right-1/4 -top-10 w-32 h-32 bg-white/5 rounded-full blur-xl" />
      </div>

      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 flex flex-col justify-center items-center gap-4 text-center">
          <RefreshCw className={`w-8 h-8 animate-spin ${palette.text}`} />
          <h3 className="text-sm font-bold text-slate-700">Retrieving Structured Policy Indices...</h3>
          <p className="text-xs text-slate-400">Communicating with the secure backend gateway repository.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
          
          {/* LEFT COLUMN: Sidebar Category Selector */}
          <div className="space-y-4 md:col-span-1">
            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-4">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-1">Navigation Categories</p>
              
              <div className="flex flex-col gap-1.5">
                {categoriesList.map((cat) => {
                  const CatIcon = cat.icon;
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setActiveCategory(cat.id);
                        setExpandedFaq(null);
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer text-left transition-all border ${
                        isActive
                          ? `bg-slate-50 border-slate-200/80 shadow-xs ${palette.text}`
                          : "bg-transparent border-transparent text-slate-600 hover:bg-slate-50/50 hover:border-slate-100"
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${isActive ? `${palette.bgLight} ${palette.text}` : "bg-slate-50 text-slate-400"}`}>
                        <CatIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold leading-tight">{cat.label}</p>
                        <p className="text-[10px] text-slate-400 truncate leading-snug mt-0.5">{cat.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Sidebar Search Input */}
              <div className="border-t border-slate-100 pt-3.5 space-y-1.5">
                <label htmlFor="faqSidebarSearch" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Search Keywords</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="faqSidebarSearch"
                    type="text"
                    placeholder="Search terms..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 ${palette.ring} bg-slate-50/40 text-slate-800`}
                  />
                </div>
              </div>
            </div>

            {/* Quick-Help Support Callout Card */}
            <div className="bg-slate-900 text-white rounded-2xl p-4.5 border border-slate-800 space-y-3.5 shadow-sm">
              <div className="space-y-1">
                <h4 className="text-xs font-bold flex items-center gap-1.5 text-slate-200">
                  <MessageSquare className={`w-4 h-4 text-emerald-400`} />
                  Have custom queries?
                </h4>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Our professional support engineering team is available 24/7 to solve custom deployment and campaign questions.
                </p>
              </div>
              <button
                onClick={() => {
                  const supportBtn = document.getElementById("fab-support-shortcut");
                  if (supportBtn) {
                    supportBtn.click();
                  } else {
                    alert("Click the Live Help bubble at the bottom right corner of your sidebar.");
                  }
                }}
                className={`w-full py-2 text-center text-white font-extrabold text-[10px] rounded-xl shadow-md transition-all cursor-pointer ${palette.bg} ${palette.hover}`}
              >
                Launch Help Support
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Content Hub */}
          <div className="md:col-span-3 space-y-6">
            
            {/* Header Content Info */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${palette.bg} animate-pulse`} />
                <h2 className="text-base font-extrabold text-slate-800 tracking-tight">{policyInfo.title}</h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">{policyInfo.description}</p>
            </div>

            {/* Accordion FAQs Panel */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 px-1">
                <HelpCircle className="w-4 h-4 shrink-0" />
                Frequently Asked Questions ({filteredFaqs.length})
              </h3>

              {filteredFaqs.length > 0 ? (
                <div className="space-y-2.5">
                  {filteredFaqs.map((faq, idx) => {
                    const isExpanded = expandedFaq === idx;
                    return (
                      <div
                        key={idx}
                        className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs transition-all hover:border-slate-300"
                      >
                        <button
                          onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                          className="w-full text-left p-4 flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                        >
                          <span className="text-xs font-bold text-slate-800 leading-snug">{faq.question}</span>
                          {isExpanded ? (
                            <ChevronUp className={`w-4 h-4 shrink-0 ${palette.text}`} />
                          ) : (
                            <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
                          )}
                        </button>
                        
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 border-t border-slate-50 text-xs text-slate-600 leading-relaxed bg-slate-50/20 animate-in slide-in-from-top-1 duration-100">
                            {faq.answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 bg-white rounded-2xl border border-slate-200">
                  <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">No matching FAQs in this category</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Try searching for other terms or check alternate categories.</p>
                </div>
              )}
            </div>

            {/* Structured Policy Documents Section */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 px-1">
                <FileText className="w-4 h-4 shrink-0" />
                Official Terms & Policy Frameworks
              </h3>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
                
                {activeCategory === "privacy" && policyInfo.guarantee && (
                  <div className={`p-4 ${palette.bgLight} border ${palette.border} rounded-2xl flex gap-3 text-slate-700`}>
                    <Lock className={`w-5 h-5 shrink-0 ${palette.text}`} />
                    <div className="space-y-1">
                      <h4 className="font-bold text-[11px] uppercase tracking-wider">Our Privacy Guarantee</h4>
                      <p className="text-[10px] font-semibold leading-relaxed">
                        {policyInfo.guarantee}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-5 leading-relaxed text-xs text-slate-600">
                  {policyInfo.sections.length > 0 ? (
                    policyInfo.sections.map((sec: any, sIdx: number) => (
                      <section key={sIdx} className="space-y-2 border-b border-slate-50 pb-4.5 last:border-b-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${palette.bg}`} />
                            {sec.title}
                          </h3>
                          {sec.source && (
                            <span className="text-[8.5px] font-bold font-mono tracking-wider text-slate-400 uppercase bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                              {sec.source}
                            </span>
                          )}
                        </div>
                        <p className="leading-relaxed">{sec.content}</p>

                        {/* Special interactive callouts within specific policy blocks */}
                        {sec.title.includes("Anti-Spam") && (
                          <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-[10.5px] text-rose-800 font-semibold flex gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                            <p>
                              <strong>Violation Penalty:</strong> Accounts found broadcasting unsolicited messages or violating WhatsApp policies will be permanently terminated immediately without refund eligibility.
                            </p>
                          </div>
                        )}

                        {sec.title.includes("48-Hour Full Refund Window") && (
                          <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl font-mono text-[9.5px] text-slate-700 space-y-1">
                            <div className="flex items-center gap-1.5 text-slate-800 font-bold mb-1 text-xs">
                              <Info className="w-4 h-4 text-amber-500 shrink-0" />
                              Refund Fair-Use Limit Condition
                            </div>
                            <p>• Total WhatsApp broadcasts processed must be less than <strong>100 messages</strong>.</p>
                            <p>• Profile must not have any past recorded anti-spam or terms violations.</p>
                          </div>
                        )}
                      </section>
                    ))
                  ) : (
                    <div className="text-center py-6 text-slate-400">
                      No policy data is loaded in this index.
                    </div>
                  )}
                </div>

                {/* Footer Policy Badge */}
                <div className="border-t border-slate-100 pt-5 text-center flex items-center justify-between gap-4 flex-wrap text-[10px] text-slate-400 font-medium">
                  <p>Legal Version: 2.5 • Effective July 9, 2026</p>
                  <p className="flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    WAPIMI Regulatory Compliance certified
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}
    </main>
  );
}
