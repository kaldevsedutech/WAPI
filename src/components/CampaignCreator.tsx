import React, { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  Play,
  Calendar,
  Image as ImageIcon,
  Check,
  CheckCircle,
  HelpCircle,
  Trash2,
  Columns,
  Eye,
  Info,
  X,
  BookOpen,
  Settings,
  Zap,
  Sparkles,
  FolderOpen,
  FileText,
  RefreshCw
} from "lucide-react";
import { api } from "../lib/api";
import { isFeatureVisible, ExperienceMode, maskPhoneNumber } from "../lib/experienceUtils";

interface CampaignCreatorProps {
  setTab: (tab: string) => void;
  loadCampaigns: () => Promise<void>;
  loadStats: () => Promise<void>;
  user?: any;
}

export default function CampaignCreator({ setTab, loadCampaigns, loadStats, user }: CampaignCreatorProps) {
  const experienceMode = user?.experienceMode || "daily";
  // Campaign Fields
  const [title, setTitle] = useState("");
  const [templateText, setTemplateText] = useState("Hello {name},\n\nWe have a special {offer} discount for you! Claim your reward in {city} now.");
  const [contacts, setContacts] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [phoneColumn, setPhoneColumn] = useState("");
  const [image, setImage] = useState<string | null>(null);

  // A/B Test States
  const [isABTest, setIsABTest] = useState(false);
  const [templateTextB, setTemplateTextB] = useState("Hi {name},\n\nCheck out this special alternative offer! Grab your reward today.");

  // Blast Mode Interval State
  const [intervalMs, setIntervalMs] = useState(1800);

  // Media Picker / Library States
  const [mediaLibrary, setMediaLibrary] = useState<any[]>([]);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any | null>(null);
  const [searchMedia, setSearchMedia] = useState("");
  
  // Mobile Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewVariation, setPreviewVariation] = useState<"A" | "B">("A");
  
  // Scheduling States
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState("");
  const [enableRetry, setEnableRetry] = useState(false);

  // Contact Saving States
  const [saveList, setSaveList] = useState(false);
  const [listName, setListName] = useState("");

  // Duplicate Checkers
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);

  // CSV Pre-upload Validation States
  const [validationIssues, setValidationIssues] = useState<any[]>([]);
  const [showValidationSummary, setShowValidationSummary] = useState(false);
  const [tempContacts, setTempContacts] = useState<any[]>([]);

  // Tab Navigation State
  const [activeTab, setActiveTab] = useState<"csv" | "direct">("csv");

  // Direct Messaging states
  const [directTitle, setDirectTitle] = useState("Direct Message Campaign");
  const [directRemoveDuplicates, setDirectRemoveDuplicates] = useState(true);
  const [directRows, setDirectRows] = useState<any[]>([
    {
      id: "r_initial_" + Math.random().toString(36).substring(2, 5),
      selected: true,
      name: "",
      phone: "",
      message: "Hello {name}, this is a personalized message.",
      repeat: 1,
      status: "",
      error: "",
      sentCount: 0
    }
  ]);

  const updateDirectRow = (id: string, patch: any) => {
    setDirectRows(rows => rows.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const addDirectRow = () => {
    setDirectRows(rows => [
      ...rows,
      {
        id: "r_" + Math.random().toString(36).substring(2, 9),
        selected: true,
        name: "",
        phone: "",
        message: "",
        repeat: 1,
        status: "",
        error: "",
        sentCount: 0
      }
    ]);
  };

  const removeDirectRow = (id: string) => {
    setDirectRows(rows => rows.length > 1 ? rows.filter(r => r.id !== id) : rows);
  };

  const clearDirectRows = () => {
    setDirectRows([
      {
        id: "r_initial_" + Math.random().toString(36).substring(2, 5),
        selected: true,
        name: "",
        phone: "",
        message: "",
        repeat: 1,
        status: "",
        error: "",
        sentCount: 0
      }
    ]);
  };

  const selectAllDirectRows = (selected: boolean) => {
    setDirectRows(rows => rows.map(r => ({ ...r, selected })));
  };

  const handleSendDirect = async () => {
    const selectedCount = directRows.filter((r) => r.selected && r.phone && r.message).length;
    if (selectedCount === 0) {
      setError("Please add at least one selected row with phone and message.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await api.createDirectCampaign({
        title: directTitle,
        rows: directRows,
        removeDuplicates: directRemoveDuplicates,
        scheduleMode: isScheduled ? (scheduledTime ? "at" : "now") : "now",
        scheduleAt: isScheduled ? scheduledTime : undefined,
        delayBetweenValue: intervalMs / 1000,
        delayBetweenUnit: "seconds",
      });

      setSuccess(isScheduled ? "Direct campaign scheduled successfully! Redirecting..." : "Direct campaign launched and processing! Redirecting...");
      setTimeout(() => {
        const targetTab = isFeatureVisible("campaign-reports", experienceMode) ? "campaign_reports" : "dashboard";
        setTab(targetTab);
        loadCampaigns();
        loadStats();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to start direct campaign.");
    } finally {
      setLoading(false);
    }
  };

  // File States
  const [fileName, setFileName] = useState("");
  const [dragActive, setDragActive] = useState(false);

  // General Status
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Template Manager States
  const [savedTemplates, setSavedTemplates] = useState<string[]>([]);

  useEffect(() => {
    const loaded = localStorage.getItem("wapi_saved_templates");
    if (loaded) {
      try {
        setSavedTemplates(JSON.parse(loaded));
      } catch (err) {
        console.error("Failed to parse saved templates", err);
      }
    } else {
      // Pre-populate high-quality defaults
      const defaults = [
        "Hello {name},\n\nWe have a special {offer} discount for you! Claim your reward in {city} now.",
        "Dear {name},\n\nThank you for choosing us! As a valued partner at {company}, we are happy to share your transaction details. Let us know if you need any assistance.",
        "Hey {name}! 🚀\n\nDon't miss out on our exclusive flash sale in {city}! Use code FLASH{offer} to get instant benefits today."
      ];
      setSavedTemplates(defaults);
      localStorage.setItem("wapi_saved_templates", JSON.stringify(defaults));
    }
  }, []);

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const res = await api.getMedia();
        if (res && res.media) {
          setMediaLibrary(res.media);
        }
      } catch (err) {
        console.error("Failed to fetch media library assets:", err);
      }
    };
    fetchMedia();
  }, []);

  const saveCurrentAsTemplate = () => {
    if (!templateText.trim()) return;
    if (savedTemplates.includes(templateText)) {
      alert("This template already exists in your library!");
      return;
    }
    const updated = [...savedTemplates, templateText];
    setSavedTemplates(updated);
    localStorage.setItem("wapi_saved_templates", JSON.stringify(updated));
  };

  const deleteTemplate = (indexToDelete: number) => {
    const updated = savedTemplates.filter((_, idx) => idx !== indexToDelete);
    setSavedTemplates(updated);
    localStorage.setItem("wapi_saved_templates", JSON.stringify(updated));
  };

  // Reset values
  const handleReset = () => {
    setTitle("");
    setContacts([]);
    setColumns([]);
    setPhoneColumn("");
    setImage(null);
    setFileName("");
    setDuplicates([]);
    setIsScheduled(false);
    setScheduledTime("");
    setSaveList(false);
    setListName("");
    setIsABTest(false);
    setSelectedMedia(null);
    setIntervalMs(1800);
  };

  // CSV Drag and Drop trigger
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCSVFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processCSVFile(e.target.files[0]);
    }
  };

  // Client-Side CSV file parser
  const processCSVFile = (file: File) => {
    setFileName(file.name);
    setError("");
    setListName(file.name.replace(/\.[^/.]+$/, "")); // Strip extension for default save name

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvData = event.target?.result as string;
      if (!csvData) return;

      const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== "");
      if (lines.length < 2) {
        setError("Invalid CSV format. It must contain at least a header and one data row.");
        return;
      }

      // Parse header columns
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      setColumns(headers);

      // Guess phone column index
      const guessedPhoneCol = headers.find(h => h.includes("phone") || h.includes("whatsapp") || h.includes("mobile") || h.includes("number"));
      setPhoneColumn(guessedPhoneCol || headers[0]);

      // Parse data rows
      const parsedContacts: any[] = [];
      const issues: any[] = [];
      const seenPhones = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        const rowValues = lines[i].split(",").map(v => v.trim());
        if (rowValues.length < headers.length) continue; // skip broken line

        const variables: Record<string, string> = {};
        headers.forEach((h, idx) => {
          variables[h] = rowValues[idx] || "";
        });

        // Determine name and phone value
        const phoneVal = variables[guessedPhoneCol || headers[0]] || "";
        const nameVal = variables["name"] || variables["customer"] || variables["contact"] || `Recipient ${i}`;

        const rawPhone = phoneVal.trim();
        const cleanPhone = rawPhone.replace(/[\s\-\+]/g, "");

        let isInvalid = false;
        let issueText = "";

        // Format checks
        if (!rawPhone) {
          isInvalid = true;
          issueText = "Required phone number is empty";
        } else if (!/^[0-9\s\-\+]+$/.test(rawPhone)) {
          isInvalid = true;
          issueText = "Contains invalid characters (only digits, spaces, hyphens, and + allowed)";
        } else if (cleanPhone.length < 8 || cleanPhone.length > 15) {
          isInvalid = true;
          issueText = `Invalid length (${cleanPhone.length} digits). Must be between 8 and 15 digits`;
        }

        // Duplicate checks
        let isDuplicate = false;
        if (cleanPhone && seenPhones.has(cleanPhone)) {
          isDuplicate = true;
        } else if (cleanPhone) {
          seenPhones.add(cleanPhone);
        }

        if (isInvalid) {
          issues.push({
            row: i + 1,
            name: nameVal,
            phone: rawPhone,
            issue: issueText,
            type: "format"
          });
        } else if (isDuplicate) {
          issues.push({
            row: i + 1,
            name: nameVal,
            phone: rawPhone,
            issue: "Duplicate entry in CSV",
            type: "duplicate"
          });
        }

        parsedContacts.push({
          id: `c_${i}_${Date.now()}`,
          name: nameVal,
          phone: rawPhone,
          variables,
          isValid: !isInvalid,
          isDuplicate: isDuplicate
        });
      }

      setTempContacts(parsedContacts);

      if (issues.length > 0) {
        setValidationIssues(issues);
        setShowValidationSummary(true);
      } else {
        setContacts(parsedContacts);
        setDuplicates([]);
        setShowValidationSummary(false);
      }
    };

    reader.readAsText(file);
  };

  const handleConfirmValidationImport = () => {
    const filtered = tempContacts.filter(c => c.isValid && !c.isDuplicate);
    setContacts(filtered);
    setDuplicates([]);
    setValidationIssues([]);
    setShowValidationSummary(false);
    alert(`Import complete! Loaded ${filtered.length} validated contact records.`);
  };

  const handleCancelValidationImport = () => {
    setFileName("");
    setContacts([]);
    setTempContacts([]);
    setValidationIssues([]);
    setShowValidationSummary(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Detect duplicates logic
  const checkDuplicates = (list: any[], phoneCol: string) => {
    const counts: Record<string, number[]> = {};
    const dupesFound: any[] = [];

    list.forEach((contact, idx) => {
      const phone = contact.phone.replace(/[\s\-\+]/g, "");
      if (phone) {
        if (!counts[phone]) {
          counts[phone] = [];
        }
        counts[phone].push(idx);
      }
    });

    Object.entries(counts).forEach(([phone, indices]) => {
      if (indices.length > 1) {
        dupesFound.push({
          phone,
          rows: indices.map(idx => idx + 2), // 1-indexed Excel view (header is Row 1)
        });
      }
    });

    setDuplicates(dupesFound);
  };

  // Remove duplicates helper
  const removeDuplicates = () => {
    const seen = new Set<string>();
    const cleaned = contacts.filter(contact => {
      const phone = contact.phone.replace(/[\s\-\+]/g, "");
      if (!phone) return true;
      if (seen.has(phone)) {
        return false;
      }
      seen.add(phone);
      return true;
    });

    setContacts(cleaned);
    setDuplicates([]);
    setShowDuplicatesModal(false);
  };

  // Image Upload helper
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Live preview builder
  const getPreviewText = () => {
    let resolved = (isABTest && previewVariation === "B") ? templateTextB : templateText;

    const mockData: Record<string, string> = {
      name: "Ravi Kumar",
      company: "Acme Corp",
      offer: "50% Special Discount",
      city: "Hyderabad"
    };

    if (contacts.length === 0) {
      // No contacts loaded - swap all custom tags or standard tags with mock data
      Object.entries(mockData).forEach(([key, val]) => {
        // Replace both {{key}} and {key}
        const regex1 = new RegExp(`{{${key}}}`, "g");
        const regex2 = new RegExp(`{${key}}`, "g");
        resolved = resolved.replace(regex1, val).replace(regex2, val);
      });
      // Replace any other generic {{anything}} or {anything} with capitalized placeholder string
      resolved = resolved.replace(/{{(.*?)}}/g, "$1").replace(/{(.*?)}/g, "$1");
      return resolved;
    }

    const firstContact = contacts[0];

    // Handle CSV columns first
    columns.forEach(col => {
      const regex1 = new RegExp(`{{${col}}}`, "g");
      const regex2 = new RegExp(`{${col}}`, "g");
      const val = firstContact.variables[col] || "";
      resolved = resolved.replace(regex1, val).replace(regex2, val);
    });

    // Handle generic mock fallbacks for {{name}}, {{company}}, etc.
    Object.entries(mockData).forEach(([key, val]) => {
      const regex1 = new RegExp(`{{${key}}}`, "g");
      const regex2 = new RegExp(`{${key}}`, "g");
      const finalVal = firstContact.variables[key] || (key === "name" ? firstContact.name : val);
      resolved = resolved.replace(regex1, finalVal).replace(regex2, finalVal);
    });

    // Handle fallback name and phone
    resolved = resolved.replace(/{{name}}/g, firstContact.name).replace(/{name}/g, firstContact.name);
    resolved = resolved.replace(/{{phone}}/g, firstContact.phone).replace(/{phone}/g, firstContact.phone);

    // Replace any remaining curly placeholders cleanly
    resolved = resolved.replace(/{{(.*?)}}/g, "$1").replace(/{(.*?)}/g, "$1");

    return resolved;
  };

  // WhatsApp formatting parser for bold, italics, strikethrough, and monospace
  const formatWhatsAppText = (text: string) => {
    if (!text) return "";
    let formatted = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    // Bold: *text* -> <strong>text</strong>
    formatted = formatted.replace(/\*(.*?)\*/g, "<strong>$1</strong>");
    
    // Italic: _text_ -> <em>text</em>
    formatted = formatted.replace(/_(.*?)_/g, "<em>$1</em>");
    
    // Strikethrough: ~text~ -> <del>text</del>
    formatted = formatted.replace(/~(.*?)~/g, "<del>$1</del>");
    
    // Monospace: ```text``` -> <code class="font-mono bg-slate-800/10 px-1 py-0.5 rounded text-xs">text</code>
    formatted = formatted.replace(/```([\s\S]*?)```/g, '<code class="font-mono bg-slate-800/20 px-1 py-0.5 rounded text-[10px]">$1</code>');

    return formatted;
  };

  // Execute Campaign
  const handleStartCampaign = async () => {
    if (!title) {
      setError("Please input a Campaign Name.");
      return;
    }
    if (contacts.length === 0) {
      setError("Please upload a CSV contact list before starting.");
      return;
    }
    if (!phoneColumn) {
      setError("Please map the CSV phone column.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Map correctly based on selected phone column
      const processedContacts = contacts.map(c => ({
        ...c,
        phone: c.variables[phoneColumn] || c.phone,
      }));

      await api.createCampaign({
        title,
        templateText,
        contacts: processedContacts,
        image: selectedMedia?.type === "image" ? selectedMedia.url : (image || undefined),
        pdfUrl: selectedMedia?.type === "pdf" ? selectedMedia.url : undefined,
        mediaType: selectedMedia ? selectedMedia.type : (image ? "image" : undefined),
        mediaName: selectedMedia ? selectedMedia.name : (image ? "uploaded_image.png" : undefined),
        isABTest,
        templateTextB: isABTest ? templateTextB : undefined,
        intervalMs: Number(intervalMs),
        scheduledTime: isScheduled ? scheduledTime : undefined,
        saveContactListName: saveList ? listName : undefined,
        enableRetry,
      });

      setSuccess(isScheduled ? "Campaign scheduled successfully! Redirecting..." : "Campaign launched and processing! Redirecting...");
      setTimeout(() => {
        const targetTab = isFeatureVisible("campaign-reports", experienceMode) ? "campaign_reports" : "dashboard";
        setTab(targetTab);
        loadCampaigns();
        loadStats();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to start campaign.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="campaign-create-tab" className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        
        {/* Module Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Launch Bulk Campaign</h1>
          <p className="text-sm text-slate-500 mt-1">
            Build dynamic text and media broadcasts using personalized variables from a CSV file or manual entry table.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 mb-8 bg-slate-200/50 p-1.5 rounded-2xl max-w-sm">
          <button
            type="button"
            className={`flex-1 text-center py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === "csv" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setActiveTab("csv")}
          >
            CSV Bulk Campaign
          </button>
          <button
            type="button"
            className={`flex-1 text-center py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === "direct" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setActiveTab("direct")}
          >
            Direct Messaging Table
          </button>
        </div>

        {error && (
          <div className="rounded-2xl bg-rose-50 p-4 border border-rose-100 text-sm text-rose-700 font-semibold mb-6 flex gap-3">
            <AlertTriangle className="w-5.5 h-5.5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100 text-sm text-emerald-700 font-semibold mb-6 flex gap-3">
            <CheckCircle className="w-5.5 h-5.5 shrink-0 text-emerald-600 animate-bounce" />
            <span>{success}</span>
          </div>
        )}

        {/* CSV Bulk Campaign Tab Content */}
        {activeTab === "csv" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column Left (2 cols wide) - Controls */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Block 1: Campaign Metadata */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">1. Campaign Parameters</h3>
              <div>
                <label htmlFor="campaignTitle" className="block text-xs font-semibold text-slate-600 mb-1.5">Campaign Name</label>
                <input
                  id="campaignTitle"
                  name="campaignTitle"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Summer Clearance Sale Blast"
                  className="block w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-400"
                />
              </div>
            </div>

            {/* Block 2: Drag & Drop CSV */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">2. Contact List Upload</h3>
                {contacts.length > 0 && (
                  <button
                    onClick={handleReset}
                    className="text-xs text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear File</span>
                  </button>
                )}
              </div>

              {contacts.length === 0 ? (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                    dragActive ? "border-emerald-500 bg-emerald-50/20" : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                  }`}
                >
                  <UploadCloud className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700">Drag and Drop your CSV file here</p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">Supports unlimited variables mapping automatically</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2 px-4 border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs shadow-sm transition-colors cursor-pointer"
                  >
                    Browse Local File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  {/* Sample CSV Download Reference */}
                  <div className="mt-6 pt-6 border-t border-slate-100 max-w-sm mx-auto text-[11px] text-slate-400">
                    <p className="font-semibold text-slate-500">Suggested CSV Headers Format:</p>
                    <code className="block bg-white p-1.5 rounded mt-1 text-[10px] text-emerald-700 font-mono select-all">
                      customer,city,offer,phone<br />
                      Ravi,Hyderabad,50%,+911234567890
                    </code>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <FileSpreadsheet className="w-8 h-8 text-emerald-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 truncate">{fileName}</p>
                      <p className="text-[10px] text-slate-400">{contacts.length} parsed records detected</p>
                    </div>
                    <div className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      Parsed Successfully
                    </div>
                  </div>

                  {/* Mapping options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label htmlFor="phoneColumn" className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                        <Columns className="w-3.5 h-3.5 text-slate-400" />
                        <span>Dynamic Phone Column Select</span>
                      </label>
                      <select
                        id="phoneColumn"
                        name="phoneColumn"
                        value={phoneColumn}
                        onChange={(e) => setPhoneColumn(e.target.value)}
                        className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 bg-white"
                      >
                        {columns.map((col, i) => (
                          <option key={i} value={col}>
                            {col.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Contact group save option */}
                    <div className="border border-slate-100 p-3.5 rounded-xl bg-slate-50/50 flex flex-col justify-center">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveList}
                          onChange={(e) => setSaveList(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                        />
                        <span>Save contact list for future use?</span>
                      </label>
                      {saveList && (
                        <input
                          id="saveListName"
                          name="saveListName"
                          type="text"
                          value={listName}
                          onChange={(e) => setListName(e.target.value)}
                          placeholder="List Name"
                          className="mt-2 block w-full px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 bg-white"
                        />
                      )}
                    </div>
                  </div>

                  {/* Duplicates Alerts */}
                  {duplicates.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span className="text-[11px] font-semibold text-amber-800">
                          {duplicates.length} duplicate phone records detected!
                        </span>
                      </div>
                      <button
                        onClick={removeDuplicates}
                        className="text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                      >
                        Purge Duplicates
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Block 3: Message Customizer & Media Selection */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">3. Message Customizer</h3>
                  <button
                    onClick={() => setShowPreviewModal(true)}
                    type="button"
                    className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-all cursor-pointer"
                    title="Open highly realistic mobile device mock with formatted rendering"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Mobile Preview</span>
                  </button>
                </div>
                {contacts.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {columns.map((col, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          if (isABTest && previewVariation === "B") {
                            setTemplateTextB(prev => prev + ` {${col}}`);
                          } else {
                            setTemplateText(prev => prev + ` {${col}}`);
                          }
                        }}
                        className="text-[10px] font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded cursor-pointer"
                        title="Click to insert placeholder tag"
                      >
                        +{col}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* A/B Test Toggle Panel */}
              {isFeatureVisible("ab-testing", experienceMode) && (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isABTest ? "bg-emerald-100 text-emerald-700" : "bg-slate-200/80 text-slate-500"}`}>
                      <Sparkles className="w-5 h-5 animate-pulse text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">A/B Testing Campaigns</h4>
                      <p className="text-[10px] text-slate-500">Enable split testing to dispatch different templates dynamically and compare performance.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      id="abTestToggleCheckbox"
                      type="checkbox"
                      checked={isABTest}
                      onChange={(e) => {
                        setIsABTest(e.target.checked);
                        if (e.target.checked && !templateTextB) {
                          setTemplateTextB("Hi {name},\n\nCheck out this special alternative offer! Grab your reward today.");
                        }
                      }}
                      className="sr-only peer cursor-pointer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              )}

              {/* A/B Variation Selector Tabs */}
              {isABTest && (
                <div className="flex border-b border-slate-100 pb-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewVariation("A")}
                    className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all ${
                      previewVariation === "A"
                        ? "bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600"
                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Draft Variant A (50% Split)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewVariation("B")}
                    className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all ${
                      previewVariation === "B"
                        ? "bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600"
                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Draft Variant B (50% Split)
                  </button>
                </div>
              )}

              <div>
                <label htmlFor="messageTemplate" className="block text-xs font-semibold text-slate-600 mb-1.5">
                  {isABTest ? `Draft Template Text for Variant ${previewVariation}:` : "Draft Template text:"}
                </label>
                <textarea
                  id="messageTemplate"
                  name="messageTemplate"
                  rows={4}
                  value={isABTest && previewVariation === "B" ? templateTextB : templateText}
                  onChange={(e) => {
                    if (isABTest && previewVariation === "B") {
                      setTemplateTextB(e.target.value);
                    } else {
                      setTemplateText(e.target.value);
                    }
                  }}
                  placeholder="Enter message template..."
                  className="block w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-400 font-sans"
                />
                
                {/* Custom Quick Placeholders Quick Insert */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5 p-2 bg-slate-50 border border-slate-100 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Insert Mock Tag:</span>
                  {["{{name}}", "{{company}}", "{{offer}}", "{{city}}"].map((placeholder) => (
                    <button
                      key={placeholder}
                      type="button"
                      onClick={() => {
                        if (isABTest && previewVariation === "B") {
                          setTemplateTextB(prev => prev + ` ${placeholder}`);
                        } else {
                          setTemplateText(prev => prev + ` ${placeholder}`);
                        }
                      }}
                      className="text-[10px] font-mono font-bold bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 px-2.5 py-1 rounded-lg transition-all cursor-pointer shadow-sm"
                      title={`Insert ${placeholder} placeholder tag`}
                    >
                      {placeholder}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rich Media Picker Selection Area */}
              <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-slate-500" />
                    <span>Attach Asset or Document</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowMediaPicker(true)}
                    className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold rounded-lg border border-emerald-200 transition-all cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Browse Media Library</span>
                  </button>
                </div>

                {selectedMedia ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      {selectedMedia.type === "pdf" ? (
                        <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center text-rose-700 font-bold text-xs shrink-0">
                          PDF
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg border overflow-hidden shrink-0">
                          <img src={selectedMedia.url} alt="Attached asset" className="object-cover w-full h-full" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate max-w-[200px]">{selectedMedia.name}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-mono font-semibold">{selectedMedia.type} &bull; {selectedMedia.size}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMedia(null);
                        setImage(null);
                      }}
                      className="text-xs font-bold text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      Deselect
                    </button>
                  </div>
                ) : image ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg border overflow-hidden shrink-0">
                        <img src={image} alt="Uploaded local asset" className="object-cover w-full h-full" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900 truncate max-w-[200px]">Custom Local Asset</p>
                        <p className="text-[10px] text-slate-400 uppercase font-semibold font-mono">IMAGE &bull; Uploaded</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImage(null)}
                      className="text-xs font-bold text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 border border-slate-200 border-dashed rounded-xl hover:bg-white text-xs font-semibold text-slate-600 cursor-pointer transition-colors"
                    >
                      <UploadCloud className="w-4 h-4 text-slate-400" />
                      <span>Upload Custom Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </button>
                  </div>
                )}
              </div>

              {/* Saved Templates Library */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                    <span>Saved Templates ({savedTemplates.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={saveCurrentAsTemplate}
                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-all cursor-pointer"
                    title="Save current editor text as template"
                  >
                    + Save Current Draft
                  </button>
                </div>

                {savedTemplates.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No saved templates yet. Click "+ Save Current Draft" to save your template.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto pr-1">
                    {savedTemplates.map((tmpl, idx) => (
                      <div
                        key={idx}
                        className="relative group p-2.5 border border-slate-200/60 bg-slate-50/50 hover:bg-emerald-50/30 hover:border-emerald-200 rounded-xl transition-all text-left cursor-pointer flex flex-col justify-between"
                        onClick={() => setTemplateText(tmpl)}
                      >
                        <p className="text-[10.5px] text-slate-600 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                          {tmpl}
                        </p>
                        <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-slate-100/50 text-[9px] text-slate-400">
                          <span className="font-medium">Template #{idx + 1}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTemplate(idx);
                            }}
                            className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
                            title="Delete template"
                          >
                            <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-500" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Block 4: Scheduling & Stagger Interval (Blast Mode) */}
            {experienceMode !== "daily" && (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">4. Queue & Speed Configuration</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={() => setIsScheduled(false)}
                    className={`border p-4 rounded-xl cursor-pointer flex flex-col justify-between transition-all ${
                      !isScheduled ? "border-emerald-500 bg-emerald-50/10 shadow-sm shadow-emerald-50" : "border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800">Send Now</span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${!isScheduled ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"}`}>
                        {!isScheduled && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400">Campaign queues begin processing immediately after validation.</p>
                  </div>

                  <div
                    onClick={() => setIsScheduled(true)}
                    className={`border p-4 rounded-xl cursor-pointer flex flex-col justify-between transition-all ${
                      isScheduled ? "border-emerald-500 bg-emerald-50/10 shadow-sm shadow-emerald-50" : "border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800">Schedule Broadcast</span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isScheduled ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"}`}>
                        {isScheduled && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                    {isScheduled ? (
                      <input
                        id="scheduledTimeInput"
                        name="scheduledTime"
                        type="datetime-local"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 block w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 bg-white"
                      />
                    ) : (
                      <p className="text-[11px] text-slate-400">Specify an absolute Date and Time for automated backend dispatch.</p>
                    )}
                  </div>
                </div>

                {/* Blast Mode interval input (Advanced Mode Only) */}
                {isFeatureVisible("interval-stagger", experienceMode) && (
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-emerald-600 animate-pulse shrink-0" />
                        <span className="text-xs font-bold text-slate-800">Blast Mode - Message Interval Staggering</span>
                      </div>
                      <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">{intervalMs}ms</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">Set a strict wait time between individual sends to bypass rapid anti-spam filters.</p>
                    
                    <div className="flex items-center gap-4">
                      <input
                        id="blastIntervalSlider"
                        type="range"
                        min={500}
                        max={10000}
                        step={100}
                        value={intervalMs}
                        onChange={(e) => setIntervalMs(Number(e.target.value))}
                        className="flex-1 accent-emerald-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg appearance-none"
                      />
                      <input
                        id="blastIntervalInput"
                        type="number"
                        min={500}
                        max={10000}
                        step={100}
                        value={intervalMs}
                        onChange={(e) => setIntervalMs(Math.max(500, Number(e.target.value)))}
                        className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono text-center focus:ring-1 focus:ring-emerald-500 focus:outline-none text-slate-900"
                      />
                    </div>

                    {/* Speed Assessment Labels */}
                    <div className="mt-2 flex items-center justify-between text-[10px] font-bold">
                      {intervalMs < 1000 ? (
                        <span className="text-rose-600 flex items-center gap-1">🔴 Extreme Spam Risk (Rapid triggers likely)</span>
                      ) : intervalMs < 2000 ? (
                        <span className="text-amber-600 flex items-center gap-1">🟡 Moderate Speed (Standard Queue)</span>
                      ) : intervalMs < 5000 ? (
                        <span className="text-emerald-600 flex items-center gap-1">🟢 Safe & Organic (Human staggering)</span>
                      ) : (
                        <span className="text-blue-600 flex items-center gap-1">🔵 Bulletproof (Maximum account security)</span>
                      )}
                      <span className="text-slate-400">Range: 500ms - 10000ms</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Smart Retry Option */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl mt-0.5 ${enableRetry ? "bg-emerald-50 text-emerald-600 border border-emerald-100 animate-pulse" : "bg-slate-50 text-slate-400 border border-slate-100"}`}>
                    <RefreshCw className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Smart Retry Protection</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed">Automatically detect transmission failures and trigger up to 3 automated retry attempts using safe exponential backoff delays (2s, 4s, 8s).</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0 self-end sm:self-auto">
                  <input
                    id="smartRetryToggle"
                    type="checkbox"
                    checked={enableRetry}
                    onChange={(e) => setEnableRetry(e.target.checked)}
                    className="sr-only peer cursor-pointer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {/* Launch Action */}
            <button
              id="btn-execute-campaign"
              onClick={handleStartCampaign}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-4 border border-transparent rounded-2xl shadow-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>{isScheduled ? "Schedule Campaign Pipeline" : "Execute Broadcast Campaign"}</span>
            </button>

          </div>

          {/* Column Right (1 col wide) - Live Preview & Diagnostics */}
          <div className="space-y-6">
            
            {/* Live Message Phone Frame */}
            <div className="bg-slate-900 text-white rounded-3xl p-4 shadow-xl relative border-8 border-slate-800 min-h-[460px] flex flex-col justify-between overflow-hidden">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-800 rounded-full z-10"></div>
              
              {/* Phone Header */}
              <div className="pt-3 pb-2 border-b border-slate-800/80 flex items-center gap-2 mb-2 bg-slate-950/20 px-1">
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-[10px]">W</div>
                <div>
                  <h4 className="text-[10px] font-bold text-white leading-none">Recipient Preview</h4>
                  <span className="text-[8px] text-emerald-400 leading-none flex items-center gap-0.5">
                    <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse"></span>
                    <span>Online</span>
                  </span>
                </div>
              </div>

              {/* Chat bubble body container */}
              <div className="flex-1 overflow-y-auto space-y-3 px-1 py-2 flex flex-col justify-end">
                {/* Outbound chat bubble */}
                <div className="bg-emerald-800/90 border border-emerald-800/20 text-[11px] text-white p-3.5 rounded-2xl max-w-[85%] self-end shadow-md relative">
                  
                  {/* Attached image/PDF asset preview */}
                  {selectedMedia?.type === "image" ? (
                    <div className="rounded-lg overflow-hidden mb-2 shadow-inner border border-emerald-900/10">
                      <img src={selectedMedia.url} alt="Preview asset" className="object-cover w-full h-24" />
                    </div>
                  ) : selectedMedia?.type === "pdf" ? (
                    <div className="bg-white/10 border border-white/10 rounded-xl p-2 mb-2 flex items-center gap-2 text-white">
                      <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                        PDF
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold truncate text-white">{selectedMedia.name}</p>
                        <p className="text-[8px] text-emerald-300 font-mono font-semibold uppercase">{selectedMedia.size || "1.2 MB"}</p>
                      </div>
                    </div>
                  ) : image ? (
                    <div className="rounded-lg overflow-hidden mb-2 shadow-inner border border-emerald-900/10">
                      <img src={image} alt="Preview asset" className="object-cover w-full h-24" />
                    </div>
                  ) : null}

                  <p className="whitespace-pre-line leading-relaxed">{getPreviewText()}</p>
                  
                  {/* Delivery time receipt simulation */}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[8px] text-emerald-300">
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                </div>
              </div>

              {/* Custom phone footer info banner */}
              <div className="mt-2 p-2 bg-slate-950/40 border border-slate-800/50 rounded-xl text-[10px] text-slate-400 flex gap-2">
                <Info className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                <p>This is a dynamic template render preview for the first recipient.</p>
              </div>
            </div>

            {/* Active Specs */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Specifications Checklist</h3>
              <div className="space-y-2 text-[11px] text-slate-600">
                <div className="flex items-center gap-2">
                  <div className={`p-0.5 rounded-full ${title ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Campaign Title Named</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`p-0.5 rounded-full ${contacts.length > 0 ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                    <Check className="w-3 h-3" />
                  </div>
                  <span>CSV contacts list parsed ({contacts.length} rows)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`p-0.5 rounded-full ${duplicates.length === 0 && contacts.length > 0 ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Duplicate numbers scrubbed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`p-0.5 rounded-full ${image ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Campaign Media Asset Attached</span>
                </div>
              </div>
            </div>

          </div>

        </div>
        )}

        {/* Direct Messaging Tab Content */}
        {activeTab === "direct" && (
          <div className="space-y-6">
            
            {/* Direct Message Parameters & Settings Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Direct Message Parameters</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Define metadata and deduplication settings for manual entries.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="directCampaignTitle" className="block text-xs font-semibold text-slate-600 mb-1.5">Campaign Name</label>
                  <input
                    id="directCampaignTitle"
                    type="text"
                    value={directTitle}
                    onChange={(e) => setDirectTitle(e.target.value)}
                    placeholder="Direct Message Campaign"
                    className="block w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-400 bg-white"
                  />
                </div>
                <div className="flex items-center md:pt-4">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={directRemoveDuplicates}
                      onChange={(e) => setDirectRemoveDuplicates(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Remove duplicate phone numbers</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Delay & Scheduler Settings Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Timing & Delay Controls</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Control the sending speed and timing parameters for the campaign.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Delivery Throttle Speed Interval Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="directIntervalMs" className="block text-xs font-semibold text-slate-600">Throttle Interval Delay</label>
                    <span className="text-xs font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-mono">{(intervalMs / 1000).toFixed(1)}s</span>
                  </div>
                  <input
                    id="directIntervalMs"
                    type="range"
                    min="1000"
                    max="10000"
                    step="100"
                    value={intervalMs}
                    onChange={(e) => setIntervalMs(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-slate-300" />
                    <span>Throttles the dispatch delay between each message in seconds.</span>
                  </p>
                </div>

                {/* Scheduler Settings */}
                <div>
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <input
                      id="directIsScheduled"
                      type="checkbox"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="directIsScheduled" className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>Schedule Campaign Delivery?</span>
                    </label>
                  </div>
                  {isScheduled && (
                    <input
                      id="directScheduledTime"
                      type="datetime-local"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="block w-full px-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 bg-white"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Manual Entry Send Message Table Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Manual Messaging Grid</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Directly input message content and recipient numbers below.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                    {directRows.filter(r => r.selected && r.phone && r.message).length} selected / {directRows.length} total
                  </span>
                </div>
              </div>

              {/* Table Wrapper */}
              <div className="border border-slate-150 rounded-2xl overflow-x-auto shadow-inner">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={directRows.every(r => r.selected)}
                          onChange={(e) => selectAllDirectRows(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-4 w-44">Recipient Name</th>
                      <th className="py-3 px-4 w-48">WhatsApp Number</th>
                      <th className="py-3 px-4">Custom Message</th>
                      <th className="py-3 px-4 w-28 text-center">Repeat Count</th>
                      <th className="py-3 px-4 w-28 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {directRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) => updateDirectRow(row.id, { selected: e.target.checked })}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            placeholder="e.g. John Doe"
                            value={row.name}
                            onChange={(e) => updateDirectRow(row.id, { name: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 bg-slate-50/50"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            placeholder="e.g. +911234567890"
                            value={row.phone}
                            onChange={(e) => updateDirectRow(row.id, { phone: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 bg-slate-50/50 font-mono"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <textarea
                            rows={1}
                            placeholder="Type a custom message for this contact..."
                            value={row.message}
                            onChange={(e) => updateDirectRow(row.id, { message: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 bg-slate-50/50 resize-y min-h-[36px]"
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={row.repeat}
                            onChange={(e) => updateDirectRow(row.id, { repeat: Math.max(1, Number(e.target.value)) })}
                            className="w-20 mx-auto px-2 py-1.5 border border-slate-200 rounded-xl text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 bg-slate-50/50 font-semibold"
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => removeDirectRow(row.id)}
                            className="text-xs text-rose-500 hover:text-rose-700 hover:underline cursor-pointer font-bold"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 justify-between">
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={addDirectRow}
                    className="flex-1 sm:flex-none py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs shadow-sm transition-colors cursor-pointer"
                  >
                    Add Contact Row
                  </button>
                  <button
                    type="button"
                    onClick={clearDirectRows}
                    className="flex-1 sm:flex-none py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs shadow-sm transition-colors cursor-pointer"
                  >
                    Clear Table Grid
                  </button>
                </div>
                
                <button
                  type="button"
                  onClick={handleSendDirect}
                  disabled={loading || !directRows.some(r => r.selected && r.phone && r.message)}
                  className="w-full sm:w-auto py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-500/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{loading ? "Processing..." : isScheduled ? "Schedule Campaign" : "Dispatch Messages Now"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Interactive Mobile Device Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative border border-slate-100 flex flex-col items-center">
            
            {/* Modal Header */}
            <div className="w-full flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                <h3 className="font-bold text-slate-900 text-sm">Exact Mobile Formatting</h3>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                title="Close Modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Smart Phone Frame Container */}
            <div className="relative w-72 h-[480px] bg-slate-950 rounded-[40px] border-[8px] border-slate-800 shadow-2xl overflow-hidden flex flex-col justify-between">
              {/* Phone Speaker Notch */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-800 rounded-full z-20"></div>

              {/* Chat Window Header */}
              <div className="pt-5 pb-2 border-b border-slate-800/80 flex items-center gap-2 bg-slate-900 px-3 z-10 shrink-0">
                <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-[10px]">W</div>
                <div>
                  <h4 className="text-[10px] font-bold text-white leading-none">Recipient Preview</h4>
                  <span className="text-[8px] text-emerald-400 leading-none flex items-center gap-0.5 mt-0.5">
                    <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse"></span>
                    <span>Online</span>
                  </span>
                </div>
              </div>

              {/* Chat Conversation Area (Light-theme WhatsApp Cream-Green Doodle Pattern Wallpaper) */}
              <div 
                className="flex-1 overflow-y-auto space-y-3 px-3 py-4 flex flex-col justify-end"
                style={{
                  backgroundColor: "#efeae2",
                  backgroundImage: "radial-gradient(#d5ebcc 1px, transparent 1px), radial-gradient(#d5ebcc 1px, #efeae2 1px)",
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0, 10px 10px"
                }}
              >
                {/* Outbound chat bubble */}
                <div className="bg-[#d9fdd3] border border-[#d1f4cb] text-[11px] text-[#111b21] p-3 rounded-2xl max-w-[90%] self-end shadow-sm relative">
                  
                  {/* Attached image/PDF asset preview */}
                  {selectedMedia?.type === "image" ? (
                    <div className="rounded-lg overflow-hidden mb-2 border border-emerald-900/10 shadow-inner">
                      <img src={selectedMedia.url} alt="Attached asset preview" className="object-cover w-full h-28" />
                    </div>
                  ) : selectedMedia?.type === "pdf" ? (
                    <div className="bg-white border border-slate-200/50 rounded-xl p-2 mb-2 flex items-center gap-2 text-slate-800">
                      <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center text-rose-700 font-bold text-[10px] shrink-0">
                        PDF
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold truncate text-slate-900">{selectedMedia.name}</p>
                        <p className="text-[8px] text-slate-400 font-mono font-semibold uppercase">{selectedMedia.size || "1.2 MB"}</p>
                      </div>
                    </div>
                  ) : image ? (
                    <div className="rounded-lg overflow-hidden mb-2 border border-slate-200 shadow-inner">
                      <img src={image} alt="Preview asset" className="object-cover w-full h-28" />
                    </div>
                  ) : null}

                  {/* Render formatting: bold (*), italics (_), strikethrough (~), monospace (```) */}
                  <p 
                    className="whitespace-pre-line leading-relaxed break-words text-[11px]"
                    dangerouslySetInnerHTML={{ 
                      __html: formatWhatsAppText(getPreviewText()) 
                    }}
                  />
                  
                  {/* Delivery time and blue check ticks */}
                  <div className="flex items-center justify-end gap-1 mt-1.5 text-[8px] text-slate-500">
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-sky-500 font-bold font-mono text-[9px] ml-0.5">✓✓</span>
                  </div>
                </div>
              </div>

              {/* Chat Input Bar simulation */}
              <div className="bg-slate-900 border-t border-slate-800/80 p-2 text-[8.5px] text-slate-400 flex items-center justify-between shrink-0">
                <span className="px-1.5">Type a message...</span>
                <span className="bg-emerald-600 text-white rounded-full px-2.5 py-1 mr-1 text-[8px] font-bold">Send</span>
              </div>
            </div>

            {/* Formatting Help Guide */}
            <div className="mt-5 w-full bg-slate-50 border border-slate-150 p-3 rounded-2xl text-[10px] text-slate-600 space-y-1.5">
              <p className="font-bold text-slate-700">💡 WhatsApp Formatting Tips:</p>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[9px] text-slate-500">
                <div><span className="font-bold text-slate-800">*bold*</span> &rarr; <strong>bold</strong></div>
                <div><span className="font-bold text-slate-800">_italic_</span> &rarr; <em>italic</em></div>
                <div><span className="font-bold text-slate-800">~strike~</span> &rarr; <del>strike</del></div>
                <div><span className="font-bold text-slate-800">```mono```</span> &rarr; mono</div>
              </div>
            </div>

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
                id="mediaSearchQueryInput"
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
                    const isSelected = selectedMedia?.url === item.url;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedMedia(item);
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
                💡 Select any asset above to automatically bind it. Images will render as picture tiles, and PDFs will show as document blocks.
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

      {/* CSV Pre-upload Validation Summary Modal */}
      {showValidationSummary && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-100 p-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">CSV Import Validation Issues</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Please review formatting issues and duplicates before importing.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelValidationImport}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Stat Summary Box */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-center">
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Rows</p>
                  <p className="text-lg font-extrabold text-slate-700 font-mono mt-0.5">{tempContacts.length}</p>
                </div>
                <div>
                  <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">Valid to Import</p>
                  <p className="text-lg font-extrabold text-emerald-600 font-mono mt-0.5">
                    {tempContacts.filter(c => c.isValid && !c.isDuplicate).length}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-amber-600 font-bold uppercase tracking-wider">Flagged Issues</p>
                  <p className="text-lg font-extrabold text-amber-600 font-mono mt-0.5">{validationIssues.length}</p>
                </div>
              </div>

              {/* Table of Issues */}
              <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white shadow-inner">
                <div className="max-h-[250px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] text-slate-500 font-bold border-b border-slate-150 sticky top-0">
                        <th className="p-3 bg-slate-50">Row</th>
                        <th className="p-3 bg-slate-50">Name</th>
                        <th className="p-3 bg-slate-50">Phone</th>
                        <th className="p-3 bg-slate-50">Detected Issue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {validationIssues.map((issue, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-slate-400 text-[10px]">Row {issue.row}</td>
                          <td className="p-3 font-semibold text-slate-700 max-w-[120px] truncate">{issue.name}</td>
                          <td className="p-3 font-mono text-slate-500">{issue.phone ? maskPhoneNumber(issue.phone) : <span className="italic text-slate-300">empty</span>}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1.5 font-bold text-[9px] px-2 py-0.5 rounded-full ${
                              issue.type === "format" 
                                ? "bg-rose-50 text-rose-700 border border-rose-100" 
                                : "bg-amber-50 text-amber-700 border border-amber-100"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${issue.type === "format" ? "bg-rose-500" : "bg-amber-500"}`} />
                              {issue.issue}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50/50 border border-amber-100 rounded-2xl text-[10px] text-amber-800 flex gap-2.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">
                  By clicking <strong>Resolve & Import</strong>, WAPIMI will automatically skip all invalid phone format rows and purge any duplicate entries, loading only pristine, compliant marketing records.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleCancelValidationImport}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Abort Upload
              </button>
              <button
                type="button"
                onClick={handleConfirmValidationImport}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors cursor-pointer flex items-center gap-2"
              >
                Resolve & Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
