import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";

export interface Country {
  name: string;
  code: string;
  emoji: string;
}

export const countries: Country[] = [
  { name: "India", code: "+91", emoji: "🇮🇳" },
  { name: "United States", code: "+1", emoji: "🇺🇸" },
  { name: "United Kingdom", code: "+44", emoji: "🇬🇧" },
  { name: "Canada", code: "+1", emoji: "🇨🇦" },
  { name: "Australia", code: "+61", emoji: "🇦🇺" },
  { name: "Singapore", code: "+65", emoji: "🇸🇬" },
  { name: "United Arab Emirates", code: "+971", emoji: "🇦🇪" },
  { name: "Saudi Arabia", code: "+966", emoji: "🇸🇦" },
  { name: "South Africa", code: "+27", emoji: "🇿🇦" },
  { name: "Bangladesh", code: "+880", emoji: "🇧🇩" },
  { name: "Pakistan", code: "+92", emoji: "🇵🇰" },
  { name: "Nepal", code: "+977", emoji: "🇳🇵" },
  { name: "Sri Lanka", code: "+94", emoji: "🇱🇰" },
  { name: "Malaysia", code: "+60", emoji: "🇲🇾" },
  { name: "Germany", code: "+49", emoji: "🇩🇪" },
  { name: "France", code: "+33", emoji: "🇫🇷" },
  { name: "Brazil", code: "+55", emoji: "🇧🇷" },
  { name: "Indonesia", code: "+62", emoji: "🇮🇩" },
  { name: "New Zealand", code: "+64", emoji: "🇳🇿" },
  { name: "Qatar", code: "+974", emoji: "🇶🇦" }
];

interface CountryCodeSelectorProps {
  selectedCode: string;
  onChange: (code: string) => void;
  className?: string;
}

export default function CountryCodeSelector({ selectedCode, onChange, className = "" }: CountryCodeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedCountry = countries.find(c => c.code === selectedCode) || countries[0];

  const filteredCountries = countries.filter(
    c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.includes(search)
  );

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-1.5 px-3 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-colors text-xs font-semibold text-slate-700 cursor-pointer shadow-sm min-w-[85px] h-[38px]"
      >
        <span className="flex items-center gap-1">
          <span className="text-base select-none">{selectedCountry.emoji}</span>
          <span className="font-mono text-[11px] text-slate-800">{selectedCountry.code}</span>
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-64 bg-white border border-slate-150 rounded-2xl shadow-xl z-50 animate-in fade-in slide-in-from-top-1 duration-150 p-2">
          {/* Search Input */}
          <div className="relative rounded-xl shadow-inner mb-2">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country/code..."
              className="block w-full pl-8 pr-2.5 py-1.5 border border-slate-100 rounded-xl text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50 text-slate-900"
              autoFocus
            />
          </div>

          {/* List */}
          <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5">
            {filteredCountries.length === 0 ? (
              <div className="text-center py-4 text-[10px] text-slate-400">
                No matching country codes
              </div>
            ) : (
              filteredCountries.map((c) => (
                <button
                  key={`${c.name}-${c.code}`}
                  type="button"
                  onClick={() => {
                    onChange(c.code);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors text-left cursor-pointer hover:bg-emerald-50 hover:text-emerald-900 ${
                    c.code === selectedCode ? "bg-emerald-500/10 text-emerald-800 font-bold" : "text-slate-700"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base select-none">{c.emoji}</span>
                    <span>{c.name}</span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">{c.code}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
