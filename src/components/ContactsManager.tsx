import React, { useEffect, useState } from "react";
import {
  Users,
  Search,
  Trash2,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Plus,
  RefreshCw,
  Table,
  Eraser,
  Save,
  Info,
  Sparkles,
  GripVertical,
  Download
} from "lucide-react";
import { api } from "../lib/api";
import { ContactGroup } from "../types";
import { maskPhoneNumber } from "../lib/experienceUtils";

interface SpreadsheetContact {
  name: string;
  phone: string;
  metadataKey: string;
  metadataValue: string;
}

interface ContactsManagerProps {
  initialGroupId?: string | null;
}

export default function ContactsManager({ initialGroupId }: ContactsManagerProps = {}) {
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId || null);
  const [detailedGroup, setDetailedGroup] = useState<ContactGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dragOverGroup, setDragOverGroup] = useState(false);
  const [selectedContactPhones, setSelectedContactPhones] = useState<string[]>([]);

  // Group drag-and-drop reordering states
  const [draggedGroupIndex, setDraggedGroupIndex] = useState<number | null>(null);
  const [dragOverGroupIndex, setDragOverGroupIndex] = useState<number | null>(null);

  // Spreadsheet state
  const [spreadsheetRows, setSpreadsheetRows] = useState<SpreadsheetContact[]>([
    { name: "", phone: "", metadataKey: "", metadataValue: "" },
    { name: "", phone: "", metadataKey: "", metadataValue: "" },
    { name: "", phone: "", metadataKey: "", metadataValue: "" }
  ]);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const res = await api.getContactGroups();
      let fetchedGroups = res.contactGroups;
      
      // Apply persistent order sorting if it exists
      try {
        const savedOrder = localStorage.getItem("wapi_group_order");
        if (savedOrder) {
          const orderArray: string[] = JSON.parse(savedOrder);
          fetchedGroups = [...fetchedGroups].sort((a, b) => {
            const idxA = orderArray.indexOf(a.id);
            const idxB = orderArray.indexOf(b.id);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          });
        }
      } catch (err) {
        console.error("Failed to parse persistent group order:", err);
      }
      
      setGroups(fetchedGroups);
    } catch (err) {
      console.error("Failed to load contact groups", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGroupDragStart = (e: React.DragEvent, index: number) => {
    setDraggedGroupIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleGroupDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverGroupIndex(index);
  };

  const handleGroupDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedGroupIndex === null || draggedGroupIndex === targetIndex) return;

    const updated = [...groups];
    const [removed] = updated.splice(draggedGroupIndex, 1);
    updated.splice(targetIndex, 0, removed);

    setGroups(updated);

    // Persist list order
    const newOrder = updated.map(g => g.id);
    try {
      localStorage.setItem("wapi_group_order", JSON.stringify(newOrder));
    } catch (err) {
      console.error(err);
    }

    setDraggedGroupIndex(null);
    setDragOverGroupIndex(null);
  };

  const handleGroupDragEnd = () => {
    setDraggedGroupIndex(null);
    setDragOverGroupIndex(null);
  };

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (initialGroupId !== undefined) {
      setSelectedGroupId(initialGroupId);
    }
  }, [initialGroupId]);

  useEffect(() => {
    if (selectedGroupId) {
      const match = groups.find(g => g.id === selectedGroupId);
      setDetailedGroup(match || null);
    } else {
      setDetailedGroup(null);
    }
    setSelectedContactPhones([]);
  }, [selectedGroupId, groups]);

  const handleDeleteGroup = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Permanently delete this saved contacts list?")) return;
    try {
      await api.deleteContactGroup(id);
      if (selectedGroupId === id) {
        setSelectedGroupId(null);
      }
      await loadGroups();
    } catch (err) {
      alert("Failed to delete contact group.");
    }
  };

  const handleQuickClean = async () => {
    if (!detailedGroup) return;
    
    const seen = new Set<string>();
    const cleanedContacts: any[] = [];
    const duplicatesRemoved: any[] = [];

    detailedGroup.contacts.forEach((contact) => {
      // Normalize phone number to find actual duplicates (strip non-digits)
      const normalizedPhone = contact.phone.replace(/[^0-9]/g, "");
      if (seen.has(normalizedPhone)) {
        duplicatesRemoved.push(contact);
      } else {
        seen.add(normalizedPhone);
        cleanedContacts.push(contact);
      }
    });

    if (duplicatesRemoved.length === 0) {
      alert("No duplicate phone numbers found! This list is already perfectly clean.");
      return;
    }

    if (!window.confirm(`Found ${duplicatesRemoved.length} duplicate phone records. Would you like to automatically run Quick Clean to remove them?`)) {
      return;
    }

    try {
      setLoading(true);
      // Save/update the contact list
      await api.saveContactGroup(detailedGroup.name, cleanedContacts);
      alert(`Quick Clean successful! Purged ${duplicatesRemoved.length} duplicate contacts.`);
      await loadGroups();
    } catch (err) {
      console.error("Failed to execute Quick Clean:", err);
      alert("Failed to save the cleaned contacts list.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportContacts = async () => {
    if (!detailedGroup || !detailedGroup.contacts || detailedGroup.contacts.length === 0) {
      alert("No contacts to export.");
      return;
    }
    try {
      // Dynamically extract all unique custom variables keys to create clean flat CSV columns
      const variableKeys: string[] = Array.from(
        new Set(
          detailedGroup.contacts.flatMap((c: any) => Object.keys(c.variables || {}))
        )
      ) as string[];

      const headers = ["Name", "Phone", ...variableKeys];
      const rows = detailedGroup.contacts.map((c: any) => [
        c.name,
        c.phone,
        ...variableKeys.map(k => (c.variables || {})[k] || "")
      ]);

      const csvContent = [headers, ...rows]
        .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${detailedGroup.name.replace(/\s+/g, "_")}_export.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Log action to audit logs
      await api.logActivity("Contact List Exported", `Exported contact list "${detailedGroup.name}" containing ${detailedGroup.contacts.length} contacts to CSV with dynamic variable columns [${variableKeys.join(", ")}].`);
    } catch (err: any) {
      console.error(err);
      alert("Failed to export contacts");
    }
  };

  const handleBatchMove = async (targetGroupId: string) => {
    if (!detailedGroup) return;
    const targetGroup = groups.find(g => g.id === targetGroupId);
    if (!targetGroup) return;

    const selectedContacts = detailedGroup.contacts.filter(c => selectedContactPhones.includes(c.phone));
    if (selectedContacts.length === 0) return;

    if (!window.confirm(`Move ${selectedContacts.length} contacts to "${targetGroup.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      
      // 1. Remove from current group
      const remainingContacts = detailedGroup.contacts.filter(c => !selectedContactPhones.includes(c.phone));
      
      // 2. Add to target group (prevent duplicates)
      const targetExistingPhones = new Set(targetGroup.contacts.map(c => c.phone));
      const newContactsForTarget = selectedContacts.filter(c => !targetExistingPhones.has(c.phone));
      const updatedTargetContacts = [...targetGroup.contacts, ...newContactsForTarget];

      // Save both groups
      await api.saveContactGroup(detailedGroup.name, remainingContacts);
      await api.saveContactGroup(targetGroup.name, updatedTargetContacts);

      alert(`Successfully moved ${selectedContacts.length} contacts to "${targetGroup.name}".`);
      setSelectedContactPhones([]);
      await loadGroups();
    } catch (err) {
      console.error("Batch move error:", err);
      alert("Failed to execute batch move operation.");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchExport = () => {
    if (!detailedGroup) return;
    const selectedContacts = detailedGroup.contacts.filter(c => selectedContactPhones.includes(c.phone));
    if (selectedContacts.length === 0) {
      alert("No contacts selected for export.");
      return;
    }

    try {
      const variableKeys: string[] = Array.from(
        new Set(
          selectedContacts.flatMap((c: any) => Object.keys(c.variables || {}))
        )
      ) as string[];

      const headers = ["Name", "Phone", ...variableKeys];
      const rows = selectedContacts.map((c: any) => [
        c.name,
        c.phone,
        ...variableKeys.map(k => (c.variables || {})[k] || "")
      ]);

      const csvContent = [headers, ...rows]
        .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${detailedGroup.name.replace(/\s+/g, "_")}_selected_export.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert("Failed to export selected contacts");
    }
  };

  const handleBatchDelete = async () => {
    if (!detailedGroup) return;
    const count = selectedContactPhones.length;
    if (count === 0) return;

    if (!window.confirm(`Are you sure you want to delete the ${count} selected contacts from "${detailedGroup.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      const remainingContacts = detailedGroup.contacts.filter(c => !selectedContactPhones.includes(c.phone));
      await api.saveContactGroup(detailedGroup.name, remainingContacts);
      alert(`Successfully deleted ${count} contacts.`);
      setSelectedContactPhones([]);
      await loadGroups();
    } catch (err) {
      console.error("Batch delete error:", err);
      alert("Failed to delete selected contacts.");
    } finally {
      setLoading(false);
    }
  };

  const handleCSVImport = async (file: File) => {
    if (!detailedGroup) return;
    setError("");
    setSuccess("");
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvData = event.target?.result as string;
      if (!csvData) {
        setLoading(false);
        return;
      }

      const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== "");
      if (lines.length < 2) {
        alert("Invalid CSV format. It must contain at least a header and one data row.");
        setLoading(false);
        return;
      }

      // Parse header columns
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const guessedPhoneCol = headers.find(h => h.includes("phone") || h.includes("whatsapp") || h.includes("mobile") || h.includes("number"));

      // Parse data rows
      const importedContacts: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const rowValues = lines[i].split(",").map(v => v.trim());
        if (rowValues.length < headers.length) continue; // skip broken line

        const variables: Record<string, string> = {};
        headers.forEach((h, idx) => {
          variables[h] = rowValues[idx] || "";
        });

        const phoneVal = variables[guessedPhoneCol || headers[0]] || "";
        const nameVal = variables["name"] || variables["customer"] || variables["contact"] || `Recipient ${i}`;

        if (phoneVal) {
          importedContacts.push({
            id: `c_imp_${i}_${Date.now()}`,
            name: nameVal,
            phone: phoneVal,
            variables,
          });
        }
      }

      if (importedContacts.length === 0) {
        alert("No valid contacts found in the CSV file.");
        setLoading(false);
        return;
      }

      // Merge with existing contacts of the specific group
      const combined = [...detailedGroup.contacts, ...importedContacts];
      
      // Run Quick Clean automatically (keep first occurrence)
      const seen = new Set<string>();
      const cleanedContacts: any[] = [];
      let duplicateCount = 0;

      combined.forEach((contact) => {
        const normalizedPhone = contact.phone.replace(/[^0-9]/g, "");
        if (seen.has(normalizedPhone)) {
          duplicateCount++;
        } else {
          seen.add(normalizedPhone);
          cleanedContacts.push(contact);
        }
      });

      try {
        await api.saveContactGroup(detailedGroup.name, cleanedContacts);
        alert(`Successfully imported ${importedContacts.length} contacts! Quick Clean automatically triggered and resolved ${duplicateCount} duplicate records.`);
        await loadGroups();
      } catch (err) {
        console.error("Failed to save imported contacts:", err);
        alert("Failed to save the imported contacts.");
      } finally {
        setLoading(false);
      }
    };

    reader.readAsText(file);
  };

  // Spreadsheet modification actions
  const handleAddRow = () => {
    setSpreadsheetRows([...spreadsheetRows, { name: "", phone: "", metadataKey: "", metadataValue: "" }]);
  };

  const handleDeleteRow = (index: number) => {
    if (spreadsheetRows.length <= 1) {
      setSpreadsheetRows([{ name: "", phone: "", metadataKey: "", metadataValue: "" }]);
    } else {
      setSpreadsheetRows(spreadsheetRows.filter((_, i) => i !== index));
    }
  };

  const handleCellChange = (index: number, field: keyof SpreadsheetContact, value: string) => {
    const updated = [...spreadsheetRows];
    updated[index][field] = value;
    setSpreadsheetRows(updated);
  };

  const handleClearTable = () => {
    if (window.confirm("Are you sure you want to clear all spreadsheet rows?")) {
      setSpreadsheetRows([
        { name: "", phone: "", metadataKey: "", metadataValue: "" },
        { name: "", phone: "", metadataKey: "", metadataValue: "" },
        { name: "", phone: "", metadataKey: "", metadataValue: "" }
      ]);
      setError("");
    }
  };

  const handleSaveSpreadsheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      setError("Please input a valid list name.");
      return;
    }

    // Filter rows that have at least a phone number
    const validRows = spreadsheetRows.filter(r => r.phone.trim() !== "");
    if (validRows.length === 0) {
      setError("Please fill out at least one row with a valid WhatsApp phone number.");
      return;
    }

    // Phone number digit validation
    const invalidPhoneRowIdx = validRows.findIndex(r => !/^\+?[0-9\s\-]{8,15}$/.test(r.phone.trim()));
    if (invalidPhoneRowIdx !== -1) {
      setError(`Row ${invalidPhoneRowIdx + 1} has an invalid phone number format: "${validRows[invalidPhoneRowIdx].phone}". Must contain 8 to 15 digits.`);
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const parsedContacts = validRows.map((row, idx) => {
        const nameVal = row.name.trim() || `Recipient ${idx + 1}`;
        const phoneVal = row.phone.trim();
        const variables: Record<string, string> = { customer: nameVal, name: nameVal, phone: phoneVal };
        
        // Add custom metadata variable if key is specified
        if (row.metadataKey.trim()) {
          variables[row.metadataKey.trim()] = row.metadataValue.trim() || "true";
        }

        return {
          id: `c_man_${idx}_${Date.now()}`,
          name: nameVal,
          phone: phoneVal,
          variables,
        };
      });

      await api.saveContactGroup(newGroupName, parsedContacts);
      setSuccess(`Successfully created audience list "${newGroupName}" with ${parsedContacts.length} contacts!`);
      setNewGroupName("");
      setSpreadsheetRows([
        { name: "", phone: "", metadataKey: "", metadataValue: "" },
        { name: "", phone: "", metadataKey: "", metadataValue: "" },
        { name: "", phone: "", metadataKey: "", metadataValue: "" }
      ]);
      setShowAddForm(false);
      await loadGroups();
    } catch (err) {
      setError("Failed to save the manual contacts spreadsheet.");
    } finally {
      setLoading(false);
    }
  };

  // Filter contacts within details view
  const filteredGroupContacts = detailedGroup?.contacts.filter(c =>
    (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  ) || [];

  const allFilteredPhones = filteredGroupContacts.map(c => c.phone);
  const allSelected = allFilteredPhones.length > 0 && allFilteredPhones.every(p => selectedContactPhones.includes(p));
  const someSelected = allFilteredPhones.some(p => selectedContactPhones.includes(p)) && !allSelected;

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedContactPhones(prev => prev.filter(p => !allFilteredPhones.includes(p)));
    } else {
      setSelectedContactPhones(prev => Array.from(new Set([...prev, ...allFilteredPhones])));
    }
  };

  return (
    <div id="contacts-tab" className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50 overflow-y-auto">
      
      {!selectedGroupId ? (
        // CONTACT LISTS OVERVIEW
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-150">
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Saved Audiences & Lists</h1>
              <p className="text-sm text-slate-500 mt-1">
                Organize saveable groups and contact sheets for rapid campaign targeting.
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Build List Manually</span>
              </button>
              <button
                onClick={loadGroups}
                className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Spreadsheet manual entry grid form */}
          {showAddForm && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-lg space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Table className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Spreadsheet Manual Contacts Entry</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearTable}
                    type="button"
                    className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100 cursor-pointer transition-all"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>Clear Table</span>
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-semibold">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 font-semibold">
                  {success}
                </div>
              )}
              
              <form onSubmit={handleSaveSpreadsheet} className="space-y-5">
                <div className="max-w-md">
                  <label htmlFor="manualListName" className="block text-xs font-bold text-slate-700 mb-1.5">Audience List Name</label>
                  <input
                    id="manualListName"
                    name="manualListName"
                    type="text"
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. Black Friday VIP Buyers"
                    className="block w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  />
                </div>

                {/* Spreadsheet Table */}
                <div className="overflow-x-auto border border-slate-150 rounded-xl bg-slate-50/50">
                  <table className="min-w-full divide-y divide-slate-150 border-collapse">
                    <thead className="bg-slate-100/80">
                      <tr>
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase w-12 text-center">S.No</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase min-w-[150px]">Contact Name</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase min-w-[150px]">WhatsApp Phone (with Country Code)</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase min-w-[130px]">Metadata Field Name</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase min-w-[130px]">Metadata Value</th>
                        <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-500 uppercase w-16">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {spreadsheetRows.map((row, index) => (
                        <tr key={index} className="hover:bg-slate-50/50">
                          {/* Serial No */}
                          <td className="px-3 py-1.5 text-xs font-mono text-slate-400 text-center">
                            {index + 1}
                          </td>
                          {/* Contact Name */}
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => handleCellChange(index, "name", e.target.value)}
                              placeholder="e.g. Ramesh Patel"
                              className="w-full px-2 py-1.5 border border-slate-150 focus:border-emerald-500 focus:outline-none rounded-lg text-xs"
                            />
                          </td>
                          {/* WhatsApp Phone */}
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              required={index === 0}
                              value={row.phone}
                              onChange={(e) => handleCellChange(index, "phone", e.target.value)}
                              placeholder="e.g. +919876543210"
                              className="w-full px-2 py-1.5 border border-slate-150 focus:border-emerald-500 focus:outline-none rounded-lg text-xs font-mono"
                            />
                          </td>
                          {/* Metadata Key */}
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={row.metadataKey}
                              onChange={(e) => handleCellChange(index, "metadataKey", e.target.value)}
                              placeholder="e.g. discount, offer_code"
                              className="w-full px-2 py-1.5 border border-slate-150 focus:border-emerald-500 focus:outline-none rounded-lg text-xs font-mono"
                            />
                          </td>
                          {/* Metadata Value */}
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={row.metadataValue}
                              onChange={(e) => handleCellChange(index, "metadataValue", e.target.value)}
                              placeholder="e.g. FEST20, DELHI"
                              className="w-full px-2 py-1.5 border border-slate-150 focus:border-emerald-500 focus:outline-none rounded-lg text-xs"
                            />
                          </td>
                          {/* Action */}
                          <td className="px-3 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(index)}
                              className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              title="Remove Row"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Add Row</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Info className="w-3.5 h-3.5" />
                      <span>Supports custom template tags corresponding to Metadata Key names.</span>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save & Generate List</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {groups.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <h3 className="text-base font-bold text-slate-900">No contact lists found</h3>
              <p className="text-xs text-slate-500 mt-1">Generate lists inside the Campaign Launcher, or build them with the spreadsheet above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups.map((group, idx) => {
                const isDragging = idx === draggedGroupIndex;
                const isDragOver = idx === dragOverGroupIndex;

                return (
                  <div
                    key={group.id}
                    draggable
                    onDragStart={(e) => handleGroupDragStart(e, idx)}
                    onDragOver={(e) => handleGroupDragOver(e, idx)}
                    onDrop={(e) => handleGroupDrop(e, idx)}
                    onDragEnd={handleGroupDragEnd}
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`bg-white p-5 rounded-2xl border hover:shadow-md transition-all cursor-pointer flex flex-col justify-between min-h-[160px] relative ${
                      isDragging ? "opacity-40 border-slate-300 scale-95" : ""
                    } ${
                      isDragOver ? "border-emerald-500 bg-emerald-50/10 scale-[1.02] shadow-inner" : "border-slate-200 hover:border-emerald-200 shadow-sm"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="bg-slate-50 text-slate-600 p-2 rounded-xl border border-slate-100 shrink-0 flex items-center justify-center">
                            <Users className="w-5.5 h-5.5 text-emerald-600" />
                          </div>
                          {/* Drag indicator handle */}
                          <div 
                            className="p-1 hover:bg-slate-100 rounded-lg cursor-grab text-slate-300 hover:text-slate-500 transition-colors"
                            title="Drag to reorder segment list"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteGroup(group.id, e)}
                          className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          title="Delete List"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm truncate">{group.name}</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(group.createdAt).toLocaleDateString()}</span>
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md font-mono">{group.count} contacts</span>
                      <span className="text-emerald-600 font-semibold flex items-center gap-0.5 group hover:underline">
                        <span>Inspect</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      ) : (
        // CONTACTS INSPECT DETAILED DRILLDOWN
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-150">
          
          <button
            onClick={() => setSelectedGroupId(null)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-600 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Lists</span>
          </button>

          {detailedGroup && (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              
              <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{detailedGroup.name}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Audience ID: {detailedGroup.id} | Size: {detailedGroup.count} contacts</p>
                </div>
                <div className="flex gap-2">
                  <button
                    id="quick-clean-btn"
                    onClick={handleQuickClean}
                    className="px-3.5 py-2 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Automatically find and remove duplicate phone numbers"
                  >
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Quick Clean</span>
                  </button>
                  <button
                    id="export-contacts-btn"
                    onClick={handleExportContacts}
                    className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Export contacts to CSV"
                  >
                    <Download className="w-4 h-4 text-emerald-600" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={(e) => handleDeleteGroup(detailedGroup.id, e)}
                    className="px-3.5 py-2 bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 font-semibold rounded-xl text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Audience</span>
                  </button>
                </div>
              </div>

              {/* CSV Drop Zone */}
              <div
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverGroup(true); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverGroup(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverGroup(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverGroup(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleCSVImport(e.dataTransfer.files[0]);
                  }
                }}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                  dragOverGroup ? "border-emerald-500 bg-emerald-50/20 shadow-inner" : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-emerald-400"
                }`}
                onClick={() => {
                  const fileInput = document.getElementById("csv-group-import-file") as HTMLInputElement;
                  if (fileInput) fileInput.click();
                }}
              >
                <Sparkles className="w-6 h-6 text-emerald-500 animate-pulse" />
                <p className="text-xs font-bold text-slate-800">
                  Drag and Drop CSV file here or <span className="text-emerald-600 underline font-semibold">Browse Local File</span>
                </p>
                <p className="text-[10px] text-slate-500 max-w-md">
                  Automatically parse CSV columns and append contacts to <strong>{detailedGroup.name}</strong>. The <strong>Quick Clean</strong> helper runs instantly to remove duplicate numbers.
                </p>
                <input
                  id="csv-group-import-file"
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleCSVImport(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
              </div>

              {/* Batch Operations Header */}
              {selectedContactPhones.length > 0 && (
                <div className="bg-emerald-900 text-white px-5 py-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md border border-emerald-800 animate-in slide-in-from-top-4 duration-200">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-800 px-3 py-1 rounded-lg text-xs font-bold font-mono">
                      {selectedContactPhones.length} Selected
                    </div>
                    <p className="text-xs font-semibold text-emerald-100">Batch operations on selected contacts</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Move to Group Option */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-emerald-200 font-bold uppercase tracking-wider">Move to:</span>
                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            handleBatchMove(val);
                            e.target.value = "";
                          }
                        }}
                        className="bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-700 focus:outline-none cursor-pointer transition-all"
                      >
                        <option value="">Select List...</option>
                        {groups
                          .filter(g => g.id !== detailedGroup.id)
                          .map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleBatchExport}
                        className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold border border-emerald-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Download className="w-4 h-4 text-emerald-600" />
                        <span>Export Selected</span>
                      </button>

                      <button
                        onClick={handleBatchDelete}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-rose-300" />
                        <span>Delete Selected</span>
                      </button>

                      <button
                        onClick={() => setSelectedContactPhones([])}
                        className="text-[11px] hover:underline text-emerald-200 font-semibold px-2"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Table search bar */}
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Contact Records</h3>
                
                <div className="relative rounded-xl max-w-xs w-full">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    id="contactSearch"
                    name="contactSearch"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name or number..."
                    className="block w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              {/* Contacts table view */}
              <div className="overflow-x-auto border border-slate-100 rounded-xl shadow-inner">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="w-12 px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={el => {
                            if (el) el.indeterminate = someSelected;
                          }}
                          onChange={handleToggleAll}
                          className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">WhatsApp Number</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Variables Mapping</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-50">
                    {filteredGroupContacts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-xs text-slate-400">No matching records found.</td>
                      </tr>
                    ) : (
                      filteredGroupContacts.map((contact, i) => (
                        <tr key={contact.id || i} className="hover:bg-slate-50/50">
                          <td className="w-12 px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedContactPhones.includes(contact.phone)}
                              onChange={() => setSelectedContactPhones(prev => prev.includes(contact.phone) ? prev.filter(p => p !== contact.phone) : [...prev, contact.phone])}
                              className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-slate-900">{contact.name}</td>
                          <td className="px-4 py-3 text-xs text-slate-500 font-mono">{maskPhoneNumber(contact.phone)}</td>
                          <td className="px-4 py-3 text-xs text-slate-600 max-w-sm truncate">
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(contact.variables || {}).map(([k, v]) => (
                                <span key={k} className="bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded text-[10px] border border-slate-200/40">
                                  {k}:{String(v)}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
