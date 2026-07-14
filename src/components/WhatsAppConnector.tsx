import React, { useEffect, useState } from "react";
import {
  QrCode,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  HelpCircle,
  Smartphone,
  ShieldAlert,
  Terminal,
  Wifi
} from "lucide-react";
import { api } from "../lib/api";
import { WhatsAppSession } from "../types";
import { maskPhoneNumber } from "../lib/experienceUtils";

interface WhatsAppConnectorProps {
  user: any;
  session: WhatsAppSession | null;
  loadSession: () => Promise<void>;
  updateUserSessionState: (newSession: WhatsAppSession | null) => void;
}

export default function WhatsAppConnector({ user, session, loadSession, updateUserSessionState }: WhatsAppConnectorProps) {
  const [qrState, setQrState] = useState<any>(null);
  const [scannedNumber, setScannedNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchState = async () => {
    try {
      const res = await api.getSession();
      updateUserSessionState(res.session);
      setQrState(res.qrState);
    } catch (err) {
      console.error("Failed to fetch session state", err);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000); // Pool session state every 3s
    return () => clearInterval(interval);
  }, []);

  const handleGenerateQR = async () => {
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await api.requestQR();
      await fetchState();
    } catch (err: any) {
      setError("Failed to boot Puppeteer session.");
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedNumber) {
      setError("Please input a valid phone number to simulate scanning.");
      return;
    }

    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const res = await api.simulateScan(scannedNumber);
      setSuccessMsg(res.message);
      setScannedNumber("");
      await loadSession();
    } catch (err: any) {
      setError(err.message || "Security mismatch. Scan rejected.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm("Disconnect your active WhatsApp puppeteer session?")) return;
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await api.logoutDevice();
      await loadSession();
    } catch (err) {
      setError("Logout failed.");
    } finally {
      setLoading(false);
    }
  };

  const isConnected = session?.sessionStatus === "connected";
  const isConnecting = qrState?.status === "connecting";
  const isQrReady = qrState?.status === "qr_ready";
  const isAuthFailed = qrState?.status === "auth_failed";

  return (
    <div id="scanner-tab" className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        
        {/* Module Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">WhatsApp Device Link</h1>
          <p className="text-sm text-slate-500 mt-1">
            Generate an encrypted Puppeteer browser token session to bind your WhatsApp account.
          </p>
        </div>

        {/* Security Rule Warning Block */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-8 flex gap-4">
          <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wide">SaaS Authentication Limit Enforcement</h3>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              To avoid spam violations and adhere to your subscription guidelines, <strong>One Account supports One WhatsApp number only</strong>.
              Your allowed registered number is <span className="font-mono bg-amber-100 px-1.5 py-0.5 rounded font-bold">{maskPhoneNumber(user?.allowedWhatsapp)}</span>.
              The system scans the inbound session credentials on linkage. If the scanned number is different, the session will be immediately disconnected.
            </p>
          </div>
        </div>

        {/* Feedbacks */}
        {error && (
          <div className="rounded-2xl bg-rose-50 p-4 border border-rose-100 text-sm text-rose-700 font-semibold mb-6 flex gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
            <div>
              <p>{error}</p>
              <p className="text-xs font-normal text-rose-600/80 mt-1">SLA restriction block is applied. Connection auto-terminated.</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100 text-sm text-emerald-700 font-semibold mb-6 flex gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Main Card: QR Area */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col items-center justify-center min-h-[360px]">
            {isConnected ? (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                  <Wifi className="w-8 h-8 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">WhatsApp Session Active</h3>
                  <p className="text-xs text-slate-400 mt-1">Bound to {session?.whatsappNumber}</p>
                  <p className="text-[10px] text-emerald-600 bg-emerald-50 inline-block px-2 py-0.5 rounded font-mono font-bold mt-2">
                    STATUS: PUPPETEER_CONNECTED
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-100 w-64 mx-auto">
                  <p className="text-xs text-slate-500">Connected at: <span className="font-mono text-slate-700">{session?.connectedAt ? new Date(session.connectedAt).toLocaleTimeString() : "Just now"}</span></p>
                  <button
                    id="btn-disconnect-session"
                    onClick={handleLogout}
                    disabled={loading}
                    className="mt-4 w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect Device</span>
                  </button>
                </div>
              </div>
            ) : isConnecting ? (
              <div className="text-center">
                <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-4" />
                <h4 className="text-sm font-semibold text-slate-900">Booting Headless Chrome Instance...</h4>
                <p className="text-xs text-slate-400 mt-1">This will fetch the official WhatsApp QR from standard Web Client driver.</p>
              </div>
            ) : isQrReady ? (
              <div className="text-center flex flex-col items-center">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4 shadow-inner">
                  <img src={qrState.qrCode} alt="WhatsApp Scanning QR" className="w-52 h-52 object-contain" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Scan QR Code</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                  Open WhatsApp on your phone, tap Menu / Settings → Linked Devices, and scan this code.
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <QrCode className="w-14 h-14 text-slate-300 mx-auto mb-4" />
                <h4 className="text-sm font-semibold text-slate-900">Create Encrypted Connection</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1 mb-6 leading-relaxed">
                  Start the whatsapp-web.js Puppeteer host service to fetch a live QR code token.
                </p>
                <button
                  id="btn-generate-qr"
                  onClick={handleGenerateQR}
                  disabled={loading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-200 transition-colors flex items-center gap-2 mx-auto cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Generate QR Code</span>
                </button>
              </div>
            )}
          </div>

          {/* Interactive Simulation Panel */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-600" />
              <span>Session Simulator</span>
            </h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Test scanning and link status dynamically. Simulates scan inputs directly within this development container sandbox.
            </p>

            {isQrReady ? (
              <form onSubmit={handleSimulateScan} className="space-y-4">
                <div>
                  <label htmlFor="scannedNumber" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Enter Sender Phone Number:
                  </label>
                  <input
                    id="scannedNumber"
                    name="scannedNumber"
                    type="text"
                    value={scannedNumber}
                    onChange={(e) => setScannedNumber(e.target.value)}
                    placeholder="e.g. +911234567890"
                    className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-mono"
                  />
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-700">Quick Test Cases:</p>
                  <button
                    type="button"
                    onClick={() => setScannedNumber(user?.allowedWhatsapp)}
                    className="text-left text-emerald-600 font-semibold hover:underline block cursor-pointer"
                  >
                    🚀 Fill matching allowed number: {maskPhoneNumber(user?.allowedWhatsapp)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScannedNumber("+19998887777")}
                    className="text-left text-rose-600 font-semibold hover:underline block cursor-pointer"
                  >
                    ❌ Fill different number (simulates block audit)
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  {loading ? "Verifying alignment..." : "Simulate QR Scan 📱"}
                </button>
              </form>
            ) : (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
                <Terminal className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-500">Awaiting QR Generation</p>
                <p className="text-[10px] text-slate-400 mt-1">Please start the driver QR code generation before simulating scanning input.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
