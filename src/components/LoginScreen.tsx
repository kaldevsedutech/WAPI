import React, { useState } from "react";
import { 
  Lock, Smartphone, Send, User, Mail, ArrowLeft, CheckCircle2, 
  Globe, ShieldCheck, Scale, FileSpreadsheet, Layers, MessageSquare, 
  Clock, Zap, BookOpen, Heart, HelpCircle, Phone, MapPin, Building, 
  ChevronDown, Check, Sparkles, AlertCircle, ShoppingCart, ArrowRight,
  Shield, CreditCard, RefreshCw, Star, ArrowUpRight, X, Info
} from "lucide-react";
import CountryCodeSelector from "./CountryCodeSelector";

interface LoginScreenProps {
  onLoginSuccess: (token: string, user: any) => void;
}

const DAILY_STARTER_PLAN = {
  id: "premium",
  name: "Daily WhatsApp Marketing",
  price: "Rs 15",
  billing: "billed daily",
  cycle: "daily"
};

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  // Navigation Tabs for the Public Website
  // "home" | "about" | "features" | "pricing" | "contact" | "terms" | "privacy" | "refund" | "login" | "register" | "checkout"
  const [activeTab, setActiveTab] = useState<string>("home");
  
  // Registration & Plan States
  const [selectedPlan, setSelectedPlan] = useState<any>(DAILY_STARTER_PLAN);

  // Login States
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  
  // Registration States
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regCountryCode, setRegCountryCode] = useState("+91");
  const [regPassword, setRegPassword] = useState("");

  // Real-time Email & Phone validation state
  const [emailCheck, setEmailCheck] = useState<{ status: "idle" | "checking" | "valid" | "invalid"; msg?: string }>({ status: "idle" });
  const [phoneCheck, setPhoneCheck] = useState<{ status: "idle" | "checking" | "valid" | "invalid"; msg?: string }>({ status: "idle" });

  // Check email availability with debounce
  React.useEffect(() => {
    if (!regEmail.trim()) {
      setEmailCheck({ status: "idle" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regEmail.trim())) {
      setEmailCheck({ status: "invalid", msg: "Invalid email format." });
      return;
    }

    setEmailCheck({ status: "checking" });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/check-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: regEmail.trim() }),
        });
        const data = await res.json();
        if (data.available) {
          setEmailCheck({ status: "valid", msg: "Email is available!" });
        } else {
          setEmailCheck({ status: "invalid", msg: data.error || "Email already taken." });
        }
      } catch (err) {
        setEmailCheck({ status: "idle" });
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [regEmail]);

  // Check phone availability with debounce
  React.useEffect(() => {
    if (!regPhone.trim()) {
      setPhoneCheck({ status: "idle" });
      return;
    }
    const fullPhone = regCountryCode + regPhone.trim().replace(/\D/g, "");
    const digits = fullPhone.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      setPhoneCheck({ status: "invalid", msg: "Total phone length (including country code) must be 8-15 digits." });
      return;
    }

    setPhoneCheck({ status: "checking" });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/check-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: fullPhone }),
        });
        const data = await res.json();
        if (data.available) {
          setPhoneCheck({ status: "valid", msg: "WhatsApp number is available!" });
        } else {
          setPhoneCheck({ status: "invalid", msg: data.error || "WhatsApp number already taken." });
        }
      } catch (err) {
        setPhoneCheck({ status: "idle" });
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [regPhone, regCountryCode]);
  
  // Common States
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot Password States
  const [showForgotFlow, setShowForgotFlow] = useState(false);
  const [forgotPhoneOrEmail, setForgotPhoneOrEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [stepOfRecovery, setStepOfRecovery] = useState<"request" | "verify" | "reset-link">("request");
  const [simulatedCodeReceived, setSimulatedCodeReceived] = useState("");
  const [simulatedLinkReceived, setSimulatedLinkReceived] = useState("");
  const [recoveryLinkToken, setRecoveryLinkToken] = useState("");

  // Check for recovery_token query param in URL on mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("recovery_token");
    if (token) {
      setRecoveryLinkToken(token);
      setShowForgotFlow(true);
      setStepOfRecovery("reset-link");
      
      // Clean query parameter from URL bar to keep it pristine
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      setSuccess("Secure recovery link detected! Please enter your new password below.");
    }
  }, []);

  const handleResetPasswordWithTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryLinkToken || !newPassword.trim()) {
      setError("Recovery token and new password are required.");
      return;
    }
    if (newPassword.trim().length < 5) {
      setError("New password must be at least 5 characters long.");
      return;
    }
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password-with-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: recoveryLinkToken,
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Password reset failed.");
      }

      setSuccess("Your password was updated successfully!");
      
      // Auto-fill login details
      setPassword(newPassword.trim());

      setTimeout(() => {
        setShowForgotFlow(false);
        setStepOfRecovery("request");
        setForgotPhoneOrEmail("");
        setNewPassword("");
        setRecoveryLinkToken("");
        setSimulatedLinkReceived("");
        setSuccess("Password recovered! Press Sign In below to enter your panel.");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPhoneOrEmail.trim()) {
      setError("Please enter your registered mobile number or email address.");
      return;
    }
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneOrEmail: forgotPhoneOrEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate recovery request.");
      }

      setSuccess(data.message);
      if (data.simulatedCode) {
        setSimulatedCodeReceived(data.simulatedCode);
      }
      if (data.simulatedLink) {
        setSimulatedLinkReceived(data.simulatedLink);
      }
      setStepOfRecovery("verify");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPhoneOrEmail.trim() || !resetCode.trim() || !newPassword.trim()) {
      setError("Please fill in all recovery verification fields.");
      return;
    }
    if (newPassword.trim().length < 5) {
      setError("New password must be at least 5 characters long.");
      return;
    }
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneOrEmail: forgotPhoneOrEmail.trim(),
          code: resetCode.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Password reset failed.");
      }

      setSuccess(data.message);
      // Automatically fill the login form and switch back to normal login mode
      setPhone(forgotPhoneOrEmail.trim());
      setPassword(newPassword.trim());
      
      // Delay transition for visual feedback
      setTimeout(() => {
        setShowForgotFlow(false);
        setStepOfRecovery("request");
        setForgotPhoneOrEmail("");
        setResetCode("");
        setNewPassword("");
        setSimulatedCodeReceived("");
        setSuccess("Password recovered! Press Sign In below to enter your panel.");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // Contact Form States
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactSubject, setContactSubject] = useState("");
  const [contactMsg, setContactMsg] = useState("");
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

  // Simulated Payment States
  const [paymentMethod, setPaymentMethod] = useState<"card" | "upi" | "netbanking" | "wallet">("card");
  const [checkoutStep, setCheckoutStep] = useState<"form" | "paying" | "success">("form");
  const [pendingCheckoutAccount, setPendingCheckoutAccount] = useState<any | null>(null);
  const [simulatedCardNumber, setSimulatedCardNumber] = useState("4111 2222 3333 4444");
  const [simulatedCardExpiry, setSimulatedCardExpiry] = useState("12/28");
  const [simulatedCardCVV, setSimulatedCardCVV] = useState("123");
  const [simulatedUPIId, setSimulatedUPIId] = useState("user@okaxis");

  const isValidLoginIdentifier = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.includes("@")) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    }

    if (/^test-user-[12]$/i.test(trimmed)) {
      return true;
    }

    const digits = trimmed.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15;
  };

  const isValidFormat = (num: string) => {
    const digits = num.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15;
  };

  const readApiResponse = async (res: Response) => {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      const preview = text.trim().slice(0, 120) || res.statusText;
      throw new Error(`Server returned a non-JSON response (${res.status}). ${preview}`);
    }
  };

  const handlePhoneChange = (val: string, type: "login" | "register") => {
    if (type === "login") {
      setPhone(val.replace(/[^a-zA-Z0-9@._\s\-\+\(\)]/g, ""));
    } else {
      const cleaned = val.replace(/[^0-9\s\-\+\(\)]/g, "");
      setRegPhone(cleaned);
    }
  };

  // Regular Sign In submit handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      setError("Please fill in all fields.");
      return;
    }

    if (!isValidLoginIdentifier(phone)) {
      setError("Please enter a valid registered mobile number or email address.");
      return;
    }

    setError("");
    setSuccess("");
    setPendingCheckoutAccount(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: phone, password }), // Passed as email for API compatibility
      });

      const data = await readApiResponse(res);
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      localStorage.setItem("wapi_token", data.token);
      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // Form Registration & Auto Payment trigger
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPhone.trim() || !regPassword) {
      setError("Please fill in all fields.");
      return;
    }

    const fullPhone = regCountryCode + regPhone.trim().replace(/\D/g, "");
    if (!isValidFormat(fullPhone)) {
      setError("Please enter a valid WhatsApp mobile number (must be between 8 and 15 digits including country code).");
      return;
    }

    if (regPassword.length < 5) {
      setError("Password must be at least 5 characters long.");
      return;
    }

    if (emailCheck.status === "checking" || phoneCheck.status === "checking") {
      setError("Please wait while we verify the availability of your email and phone number.");
      return;
    }

    if (emailCheck.status === "invalid") {
      setError(emailCheck.msg || "The email address is invalid or already taken.");
      return;
    }

    if (phoneCheck.status === "invalid") {
      setError(phoneCheck.msg || "The mobile number is invalid or already registered.");
      return;
    }

    setError("");
    setSuccess("");

    setSelectedPlan((current: any) => current?.id ? current : DAILY_STARTER_PLAN);
    setCheckoutStep("form");
    setActiveTab("checkout");
  };

  // Complete Registration & Log in with optional Razorpay checkout
  const handleRazorpayCheckout = async () => {
    setError("");
    setCheckoutStep("paying");
    try {
      let regData = pendingCheckoutAccount;
      if (!regData?.token) {
        const fullPhone = regCountryCode + regPhone.trim().replace(/\D/g, "");
        const regRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: regName.trim(),
            email: regEmail.trim(),
            password: regPassword,
            allowedWhatsapp: fullPhone
          })
        });

        regData = await readApiResponse(regRes);
        if (!regRes.ok) {
          throw new Error(regData.error || "Registration profile creation failed.");
        }
        setPendingCheckoutAccount(regData);
      }

      // Fetch Razorpay Order from backend
      const billingCycle = selectedPlan.cycle || "daily";
      const orderRes = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${regData.token}`
        },
        body: JSON.stringify({ planId: selectedPlan.id, cycle: billingCycle })
      });

      const orderData = await readApiResponse(orderRes);
      if (!orderRes.ok) {
        throw new Error(orderData.error || "Failed to initialize Razorpay checkout session.");
      }

      const RazorpayConstructor = (window as any).Razorpay;
      if (!RazorpayConstructor) {
        throw new Error("Razorpay SDK is not loaded yet. Please refresh the page.");
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "WAPIMI SENDER",
        description: `${selectedPlan.name} (${billingCycle})`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            // Verify payment on the backend
            const verifyRes = await fetch("/api/billing/verify-payment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${regData.token}`
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                planId: selectedPlan.id,
                cycle: billingCycle
              })
            });

            const verifyData = await readApiResponse(verifyRes);
            if (!verifyRes.ok) {
              throw new Error(verifyData.error || "Signature verification failed.");
            }

            setCheckoutStep("success");
            setSuccess("Account registered and plan upgraded successfully!");
            localStorage.setItem("wapi_token", regData.token);
            
            setTimeout(() => {
              onLoginSuccess(regData.token, verifyData.user);
            }, 1500);

          } catch (verifyErr: any) {
            setError(verifyErr.message || "Payment verification failed.");
            setCheckoutStep("form");
          }
        },
        prefill: {
          name: regData.user.name,
          email: regData.user.email,
          contact: regData.user.allowedWhatsapp,
        },
        theme: {
          color: "#059669",
        },
      };

      const rzp = new RazorpayConstructor({
        ...options,
        modal: {
          ondismiss: function () {
            setCheckoutStep("form");
          }
        }
      });
      rzp.on("payment.failed", function (response: any) {
        setError(response.error.description || "Razorpay transaction failed.");
        setCheckoutStep("form");
      });

      rzp.open();

    } catch (err: any) {
      setError(err.message || "Failed to complete transaction.");
      setCheckoutStep("form");
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactSubject || !contactMsg) {
      alert("Please fill in all fields.");
      return;
    }
    setContactLoading(true);
    try {
      const res = await fetch("/api/contact-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          subject: contactSubject,
          message: contactMsg,
        }),
      });
      const data = await readApiResponse(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit inquiry.");
      }
      setContactLoading(false);
      setContactSuccess(true);
      setContactName("");
      setContactEmail("");
      setContactSubject("");
      setContactMsg("");
      setTimeout(() => setContactSuccess(false), 8000);
    } catch (err: any) {
      setContactLoading(false);
      alert(err.message || "Failed to submit inquiry. Please email kaldevsedutech@gmail.com.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans text-slate-800">
      
      {/* 1. COMPLIANT MULTI-PAGE PUBLIC HEADER */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo */}
          <button 
            onClick={() => setActiveTab("home")} 
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-md shadow-emerald-200">
              <Send className="w-5.5 h-5.5" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-950 font-sans">
              WAPI<span className="text-emerald-600 font-medium">MI</span>
            </span>
          </button>

          {/* Nav Items */}
          <nav className="hidden md:flex items-center gap-7">
            <button 
              onClick={() => setActiveTab("home")} 
              className={`text-sm font-semibold transition-colors cursor-pointer ${activeTab === "home" ? "text-emerald-600 font-bold" : "text-slate-600 hover:text-slate-900"}`}
            >
              Home
            </button>
            <button 
              onClick={() => setActiveTab("features")} 
              className={`text-sm font-semibold transition-colors cursor-pointer ${activeTab === "features" ? "text-emerald-600 font-bold" : "text-slate-600 hover:text-slate-900"}`}
            >
              Features
            </button>
            <button 
              onClick={() => setActiveTab("pricing")} 
              className={`text-sm font-semibold transition-colors cursor-pointer ${activeTab === "pricing" ? "text-emerald-600 font-bold" : "text-slate-600 hover:text-slate-900"}`}
            >
              Pricing
            </button>
            <button 
              onClick={() => setActiveTab("about")} 
              className={`text-sm font-semibold transition-colors cursor-pointer ${activeTab === "about" ? "text-emerald-600 font-bold" : "text-slate-600 hover:text-slate-900"}`}
            >
              About
            </button>
            <button 
              onClick={() => setActiveTab("contact")} 
              className={`text-sm font-semibold transition-colors cursor-pointer ${activeTab === "contact" ? "text-emerald-600 font-bold" : "text-slate-600 hover:text-slate-900"}`}
            >
              Contact
            </button>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { setActiveTab("login"); setError(""); setSuccess(""); }} 
              className="px-4 py-2 text-sm font-bold text-slate-700 hover:text-emerald-600 transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button 
              onClick={() => {
                setSelectedPlan(DAILY_STARTER_PLAN);
                setActiveTab("register");
                setError("");
                setSuccess("");
              }} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4.5 py-2.5 rounded-xl shadow-md shadow-emerald-200 transition-all cursor-pointer"
            >
              Start Rs 15 / Day
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT VIEW CONTROLLER */}
      <main className="flex-1">

        {/* --- HOME TAB --- */}
        {activeTab === "home" && (
          <div className="animate-fade-in">
            {/* Hero Section */}
            <section className="relative overflow-hidden py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-slate-50">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-emerald-100 blur-3xl opacity-50"></div>
              <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-teal-100 blur-3xl opacity-40"></div>
              
              <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
                <div className="space-y-6 text-center lg:text-left">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>WAPIMI = WhatsApp Powered Marketing Intelligence</span>
                  </div>
                  <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
                    WhatsApp Marketing <br />
                    <span className="text-emerald-600">Automation Suite</span>
                  </h1>
                  <p className="text-base text-slate-500 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                    A secure enterprise SaaS suite for launching scheduled broadcasts, customizing CSV recipient cohorts, managing 2-way inbox chats, tracking delivery and read receipts, and setting predefined auto-reply rules.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                    <button 
                      onClick={() => {
                        setSelectedPlan(DAILY_STARTER_PLAN);
                        setActiveTab("register");
                      }}
                      className="w-full sm:w-auto px-7 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                    >
                      <span>Start for Rs 15 / Day</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setActiveTab("pricing")}
                      className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold shadow-sm transition-colors cursor-pointer text-sm"
                    >
                      View Premium Pricing
                    </button>
                  </div>

                  <div className="flex items-center justify-center lg:justify-start gap-8 pt-6 border-t border-slate-100">
                    <div>
                      <p className="text-2xl font-extrabold text-slate-900">99.8%</p>
                      <p className="text-xs text-slate-400 font-semibold uppercase">Delivery Rate</p>
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold text-slate-900">10M+</p>
                      <p className="text-xs text-slate-400 font-semibold uppercase">Messages Sent</p>
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold text-slate-900">4.9/5</p>
                      <p className="text-xs text-slate-400 font-semibold uppercase">Rating on G2</p>
                    </div>
                  </div>
                </div>

                {/* Simulated Platform Dashboard Graphics */}
                <div className="relative">
                  <div className="bg-slate-950 text-slate-200 rounded-2xl p-5 shadow-2xl border border-slate-800 font-mono text-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                        <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      </div>
                      <span className="text-[10px] text-slate-500">Live Campaign Processor</span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-emerald-400">$ wapi-broadcast --dispatch-campaign "Festive Promo"</p>
                      <p className="text-slate-400">⚡ Initializing secure WhatsApp marketing session...</p>
                      <p className="text-slate-400">📊 CSV loaded: 450 cohorts detected.</p>
                      <p className="text-slate-400">✅ Duplicates filtered out: 12 duplicate lines removed.</p>
                      <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 mt-2 space-y-2 font-sans">
                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                          <span>CAMPAIGN DISPATCH SPEED</span>
                          <span className="text-emerald-400">100% COMPLETE</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div className="bg-emerald-500 h-full w-full rounded-full animate-pulse"></div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center pt-1">
                          <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                            <span className="block text-[9px] text-slate-500">SENT</span>
                            <span className="text-xs text-white font-bold font-mono">438</span>
                          </div>
                          <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                            <span className="block text-[9px] text-slate-500">READ</span>
                            <span className="text-xs text-emerald-400 font-bold font-mono">392</span>
                          </div>
                          <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                            <span className="block text-[9px] text-slate-500">REPLIES</span>
                            <span className="text-xs text-teal-400 font-bold font-mono">118</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Floating badget */}
                  <div className="absolute -bottom-6 -right-4 bg-white p-3 rounded-xl shadow-lg border border-slate-100 flex items-center gap-3 animate-bounce">
                    <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SECURE CONNECT</p>
                      <p className="text-xs font-extrabold text-slate-900">Verified QR Node</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Benefit Grid */}
            <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 border-t border-slate-100">
              <div className="max-w-7xl mx-auto space-y-12">
                <div className="text-center max-w-2xl mx-auto space-y-4">
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900 font-sans">
                    Everything you need to automate conversations
                  </h2>
                  <p className="text-sm text-slate-500">
                    Launch highly tailored outreach operations with client side templates and server side safety protocols.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Dynamic CSV Templates</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Upload your spreadsheet, match customer parameters, and automatically inject custom fields such as names, offers, custom URLs, and coupon variables into every message.
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                      <Clock className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Scheduled Broadcasts</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Schedule campaigns to run at specific peak hours. Our background queues automatically handle execution delays to prevent bulk message congestion.
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">2-Way Shared Inbox</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Don't just broadcast. Have meaningful follow-ups, answer incoming customer messages in real time, and toggle saved reply rules.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* --- FEATURES TAB --- */}
        {activeTab === "features" && (
          <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16 animate-fade-in">
            <div className="text-center space-y-4">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Enterprise Level Features</h1>
              <p className="text-sm text-slate-500 max-w-2xl mx-auto">
                Our features are carefully constructed to balance speed and stability, matching compliance policies.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex gap-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl h-12 w-12 shrink-0 flex items-center justify-center">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Smart Duplicates Filtering</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Our system automatically analyzes target lists, detects repeat numbers, and resolves overlaps to make sure customers don't get double pinged.
                    </p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex gap-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl h-12 w-12 shrink-0 flex items-center justify-center">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Instant Rule-Based Auto-Replies</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Define keyword triggers and saved response text for pricing, catalog, support, and follow-up questions.
                    </p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex gap-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl h-12 w-12 shrink-0 flex items-center justify-center">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Real-time Delivery Analytics</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Track the detailed pipeline: Dispatched &rarr; Delivered &rarr; Opened/Read status receipts for every campaign broadcast in real-time.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-md space-y-6">
                <h3 className="text-xl font-bold text-slate-900">Comprehensive Campaign Reports</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Generate beautiful summary reports instantly. Export completed campaign lists directly to high-quality PDF files featuring delivery ratios, read trends, and successful recipient lists.
                </p>
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="text-emerald-600 w-5 h-5 shrink-0" />
                    <span className="text-xs font-bold text-slate-700">PDF Report Export Module Ready</span>
                  </div>
                  <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded font-mono">JS-PDF</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- PRICING TAB (TIERS TO INITIATE SECURE CHECKOUT) --- */}
        {activeTab === "pricing" && (
          <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12 animate-fade-in">
            <div className="text-center space-y-4">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Flexible, Predictable Plans</h1>
              <p className="text-sm text-slate-500 max-w-2xl mx-auto">
                No surprises. Select the best marketing limit plan for your organization. Upgrade, downgrade, or cancel any time.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6">
              {/* Plan 1 */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between space-y-6 hover:shadow-md transition-shadow">
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase">Daily Starter</span>
                    <h3 className="text-xl font-bold text-slate-900 mt-1">Daily WhatsApp Marketing</h3>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900">Rs 15</span>
                    <span className="text-xs text-slate-400 font-semibold uppercase">/ Day</span>
                  </div>
                  <p className="text-xs text-slate-500">Start WhatsApp marketing with a daily Razorpay subscription.</p>
                  <ul className="space-y-2.5 text-xs text-slate-600 pt-3 border-t border-slate-100">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>1,000 Messages Daily Limit</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>1 Registered Active Device</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-300">
                      <X className="w-4 h-4" />
                      <span className="line-through">Advanced Auto-Reply Rules</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-300">
                      <X className="w-4 h-4" />
                      <span className="line-through">PDF Export Campaign Reports</span>
                    </li>
                  </ul>
                </div>
                <button 
                  onClick={() => {
                    setSelectedPlan(DAILY_STARTER_PLAN);
                    setActiveTab("register");
                  }}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Pay Rs 15 & Start
                </button>
              </div>

              {/* Plan 2 */}
              <div className="bg-white rounded-2xl border-2 border-emerald-500 p-6 shadow-lg relative flex flex-col justify-between space-y-6">
                <span className="absolute -top-3 left-6 bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Popular Choice
                </span>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-bold text-emerald-600 uppercase">Mid-Scale Marketing</span>
                    <h3 className="text-xl font-bold text-slate-900 mt-1">Professional Plan</h3>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900">Rs 300</span>
                    <span className="text-xs text-slate-400 font-semibold uppercase">/ Month</span>
                  </div>
                  <p className="text-xs text-slate-500">For active sellers and business campaign operations.</p>
                  <ul className="space-y-2.5 text-xs text-slate-600 pt-3 border-t border-slate-100">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>50,000 Messages Quota Limit</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>3 Registered Active Devices</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>Advanced Auto-Reply Rules</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>PDF Campaign Exports</span>
                    </li>
                  </ul>
                </div>
                <button 
                  onClick={() => {
                    setSelectedPlan({ id: "premium", name: "Professional Plan", price: "Rs 300", billing: "billed monthly", cycle: "monthly" });
                    setActiveTab("register");
                  }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-200 transition-colors cursor-pointer"
                >
                  Subscribe & Checkout
                </button>
              </div>

              {/* Plan 3 */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between space-y-6 hover:shadow-md transition-shadow">
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase">Enterprise Outreach</span>
                    <h3 className="text-xl font-bold text-slate-900 mt-1">Enterprise Business</h3>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900">Rs 500</span>
                    <span className="text-xs text-slate-400 font-semibold uppercase">/ Month</span>
                  </div>
                  <p className="text-xs text-slate-500">Uncapped broadcasting pipeline with dedicated nodes.</p>
                  <ul className="space-y-2.5 text-xs text-slate-600 pt-3 border-t border-slate-100">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>Unlimited Message Quota Limit</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>Unlimited Devices Supported</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>Dedicated Server Nodes Support</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>Premium 24/7 Priority SLA Desk</span>
                    </li>
                  </ul>
                </div>
                <button 
                  onClick={() => {
                    setSelectedPlan({ id: "business", name: "Enterprise Business", price: "Rs 500", billing: "billed monthly", cycle: "monthly" });
                    setActiveTab("register");
                  }}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-950 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Subscribe & Checkout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- ABOUT TAB --- */}
        {activeTab === "about" && (
          <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-12 animate-fade-in">
            <div className="text-center space-y-4">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">About WAPIMI</h1>
              <p className="text-sm text-slate-500 max-w-xl mx-auto">
                WAPIMI stands for WhatsApp Powered Marketing Intelligence, providing standard, robust solutions for business automation and bulk customer notifications.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-8">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                  <Building className="w-5 h-5 text-emerald-600" />
                  <span>Company Ownership Details</span>
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  WAPIMI is a specialized WhatsApp campaign management software suite proudly owned and operated by:
                </p>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase">OWNER / PROPRIETOR</span>
                    <span className="text-slate-800 font-bold">Fayaz Rahman</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase">OFFICIAL REGISTRATION</span>
                    <span className="text-slate-800 font-semibold">WAPIMI Automation Technologies Pvt Ltd</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase">PHYSICAL OFFICE ADDRESS</span>
                    <span className="text-slate-800 font-semibold">Suite 404, Tech Hub Park, Sector 62, Noida, UP, India</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase">OFFICIAL EMAIL DESK</span>
                    <span className="text-slate-800 font-bold text-emerald-600">kaldevsedutech@gmail.com</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-lg font-bold text-slate-950">Our Product Mission</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Our suite represents a clean, full-stack environment leveraging real-time socket.io communication pipes and automated cron jobs on Node/Express servers. We adhere strictly to WhatsApp spam regulations by enabling customizable broadcast intervals, making sure that mass broadcasts resemble human pacing.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                    <ShieldCheck className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-slate-800">Secure APIs</p>
                    <p className="text-[10px] text-slate-400">JWT Token Encryption</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                    <Scale className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-slate-800">Compliant Flow</p>
                    <p className="text-[10px] text-slate-400">Spam Prevention Delays</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                    <Globe className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-slate-800">Global Coverage</p>
                    <p className="text-[10px] text-slate-400">Supports All Country Codes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- CONTACT TAB --- */}
        {activeTab === "contact" && (
          <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-12 animate-fade-in">
            <div className="text-center space-y-4">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Contact Our Help Desk</h1>
              <p className="text-sm text-slate-500 max-w-xl mx-auto">
                Have a query regarding licensing, custom templates, or webhook configuration? Contact us directly.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
              
              {/* Direct Info */}
              <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Direct Contact</h3>
                  <p className="text-xs text-slate-400 mt-1">Get in touch via phone, email, or physical address.</p>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800">Email Address</p>
                      <a href="mailto:kaldevsedutech@gmail.com" className="text-emerald-600 hover:underline">kaldevsedutech@gmail.com</a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800">Support Hotline</p>
                      <p className="text-slate-600">+9493165230</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800">Office Location</p>
                      <p className="text-slate-600">Suite 404, Tech Hub Park, Sector 62, Noida, UP, India</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-xs">
                  <p className="font-bold text-emerald-800">Working Hours</p>
                  <p className="text-[11px] text-emerald-700 mt-1">Monday - Friday: 9:00 AM to 6:00 PM IST</p>
                  <p className="text-[10px] text-slate-400">Response time is guaranteed within 4 working hours.</p>
                </div>
              </div>

              {/* Inquiry Form */}
              <div className="md:col-span-3 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                {contactSuccess ? (
                  <div className="p-8 text-center space-y-4">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Message Sent Successfully!</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Thank you for contacting WAPIMI. A customer support representative has logged ticket #T-{Math.floor(Math.random()*89999+10000)} and will reply shortly.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Your Full Name</label>
                      <input 
                        type="text" 
                        required 
                        value={contactName} 
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="John Doe" 
                        className="block w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                        <input 
                          type="email" 
                          required 
                          value={contactEmail} 
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="john@example.com" 
                          className="block w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Inquiry Type</label>
                        <select
                          required 
                          value={contactSubject} 
                          onChange={(e) => setContactSubject(e.target.value)}
                          className="block w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900 focus:outline-none"
                        >
                          <option value="">Select inquiry type</option>
                          <option value="Suggestion">Suggestion</option>
                          <option value="Issue">Issue</option>
                          <option value="Details">Details</option>
                          <option value="Others">Others</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed Message</label>
                      <textarea 
                        rows={4} 
                        required 
                        value={contactMsg} 
                        onChange={(e) => setContactMsg(e.target.value)}
                        placeholder="How can our technical support help you today?" 
                        className="block w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900 focus:outline-none"
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={contactLoading}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
                    >
                      {contactLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Dispatching Inquiry...</span>
                        </>
                      ) : (
                        <span>Submit Inquiry Ticket</span>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- SIGN IN TAB --- */}
        {activeTab === "login" && (
          <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-md mx-auto animate-fade-in">
            <div className="bg-white py-8 px-6 shadow-xl border border-slate-100 rounded-2xl sm:px-10">
              <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 font-sans mb-2">
                Sign In to Dashboard
              </h2>
              <p className="text-center text-xs text-slate-400 mb-6">
                Access your premium WhatsApp Marketing Console
              </p>

              {error && (
                <div className="mb-5 rounded-xl bg-rose-50 p-4 border border-rose-100 text-xs text-rose-700 font-semibold flex gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0"></span>
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="mb-5 rounded-xl bg-emerald-50 p-4 border border-emerald-100 text-xs text-emerald-700 font-semibold flex gap-2 items-start">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{success}</span>
                </div>
              )}

              {showForgotFlow ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
                    <h3 className="text-sm font-extrabold text-slate-800">Password Recovery Panel</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotFlow(false);
                        setError("");
                        setSuccess("");
                      }}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Login</span>
                    </button>
                  </div>

                  {stepOfRecovery === "request" ? (
                    <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                      <div>
                        <label htmlFor="forgotPhoneOrEmail" className="block text-xs font-semibold text-slate-700 mb-1">
                          Registered Mobile or Email
                        </label>
                        <div className="relative rounded-xl shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Mail className="h-4.5 w-4.5" />
                          </div>
                          <input
                            id="forgotPhoneOrEmail"
                            type="text"
                            required
                            value={forgotPhoneOrEmail}
                            onChange={(e) => setForgotPhoneOrEmail(e.target.value)}
                            className="block w-full pl-11 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 text-xs"
                            placeholder="Registered phone or email"
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400 leading-relaxed">
                          Enter your exact registered WhatsApp mobile number or email address to lookup your profile.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {loading ? (
                          <div className="flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Verifying Account...</span>
                          </div>
                        ) : (
                          "Request Password Reset"
                        )}
                      </button>
                    </form>
                  ) : stepOfRecovery === "verify" ? (
                    <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                      <div className="bg-amber-50 border border-amber-100 p-3.5 rounded-xl text-xs text-amber-800 space-y-2">
                        <div>
                          <div className="flex items-center gap-2 font-bold mb-1">
                            <Sparkles className="w-4 h-4 text-amber-600 animate-pulse" />
                            <span>Simulated Code Dispatched!</span>
                          </div>
                          <p className="text-[11px] leading-relaxed">
                            Physical SMS/WhatsApp carriers are bypassed in dev sandbox. Input the security pin code below to verify:
                          </p>
                          <div className="bg-white px-3 py-1.5 rounded-lg border border-amber-200/50 font-mono font-black text-center text-sm text-slate-800 tracking-widest mt-1.5 select-all">
                            {simulatedCodeReceived || "123456"}
                          </div>
                        </div>
                      </div>

                      {simulatedLinkReceived && (
                        <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-xl text-xs text-emerald-800">
                          <div className="flex items-center gap-2 font-bold mb-1">
                            <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Simulated Reset Link!</span>
                          </div>
                          <p className="text-[11px] leading-relaxed mb-2 text-slate-700">
                            You can also click the secure email recovery link to reset your password directly:
                          </p>
                          <a
                            href={simulatedLinkReceived}
                            className="inline-block w-full text-center py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold font-mono transition-all truncate"
                          >
                            Reset Password via Link
                          </a>
                        </div>
                      )}

                      <div>
                        <label htmlFor="resetCode" className="block text-xs font-semibold text-slate-700 mb-1">
                          6-Digit Verification Code
                        </label>
                        <input
                          id="resetCode"
                          type="text"
                          required
                          value={resetCode}
                          onChange={(e) => setResetCode(e.target.value)}
                          className="block w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 text-xs font-mono tracking-widest text-center"
                          placeholder="••••••"
                          maxLength={6}
                        />
                      </div>

                      <div>
                        <label htmlFor="newPassword" className="block text-xs font-semibold text-slate-700 mb-1">
                          Create New Password
                        </label>
                        <div className="relative rounded-xl shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Lock className="h-4.5 w-4.5" />
                          </div>
                          <input
                            id="newPassword"
                            type="password"
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="block w-full pl-11 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900"
                            placeholder="Min 5 characters"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {loading ? (
                          <div className="flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Updating Security Settings...</span>
                          </div>
                        ) : (
                          "Verify & Reset Password"
                        )}
                      </button>

                      <div className="text-center pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setStepOfRecovery("request");
                            setError("");
                            setSuccess("");
                          }}
                          className="text-[11px] text-slate-400 hover:text-slate-600 font-bold underline cursor-pointer"
                        >
                          Resend Code / Change Target
                        </button>
                      </div>
                    </form>
                  ) : (
                    // stepOfRecovery === "reset-link"
                    <form onSubmit={handleResetPasswordWithTokenSubmit} className="space-y-4">
                      <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-xl text-xs text-emerald-800">
                        <div className="flex items-center gap-2 font-bold mb-1">
                          <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Secure Token Loaded</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-700">
                          Your security recovery token is loaded and active. Enter your new password below.
                        </p>
                        <p className="mt-1 font-mono text-[9px] bg-white/60 px-2 py-0.5 rounded border border-emerald-200/50 truncate">
                          Token: {recoveryLinkToken}
                        </p>
                      </div>

                      <div>
                        <label htmlFor="resetLinkPassword" className="block text-xs font-semibold text-slate-700 mb-1">
                          Enter New Password
                        </label>
                        <div className="relative rounded-xl shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Lock className="h-4.5 w-4.5" />
                          </div>
                          <input
                            id="resetLinkPassword"
                            type="password"
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="block w-full pl-11 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900"
                            placeholder="Min 5 characters"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {loading ? (
                          <div className="flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Updating Security Settings...</span>
                          </div>
                        ) : (
                          "Reset Password via Token"
                        )}
                      </button>

                      <div className="text-center pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setStepOfRecovery("request");
                            setError("");
                            setSuccess("");
                          }}
                          className="text-[11px] text-slate-400 hover:text-slate-600 font-bold underline cursor-pointer"
                        >
                          Request New Reset Link
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                <form className="space-y-5" onSubmit={handleLoginSubmit}>
                  <div>
                    <label htmlFor="phone" className="block text-xs font-semibold text-slate-700 mb-1">
                      Registered Mobile Number or Email
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Smartphone className="h-4.5 w-4.5" />
                      </div>
                      <input
                        id="phone"
                        name="phone"
                        type="text"
                        required
                        value={phone}
                        onChange={(e) => handlePhoneChange(e.target.value, "login")}
                        className="block w-full pl-11 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 placeholder-slate-400 text-xs font-mono"
                        placeholder="Registered phone or email"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">
                      Use your registered WhatsApp number with country code, or your account email.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotFlow(true);
                          setStepOfRecovery("request");
                          setError("");
                          setSuccess("");
                        }}
                        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="h-4.5 w-4.5" />
                      </div>
                      <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-11 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 placeholder-slate-400 text-xs"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2.5 border border-transparent rounded-xl shadow-sm text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Authenticating Credentials...</span>
                      </div>
                    ) : (
                      "Sign In & Enter Panel"
                    )}
                  </button>

                  <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                    <p className="text-xs text-slate-400">
                      Don't have an account?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPlan(DAILY_STARTER_PLAN);
                          setActiveTab("register");
                          setError("");
                          setSuccess("");
                        }}
                        className="font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                      >
                        Register Now
                      </button>
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* --- REGISTER TAB --- */}
        {activeTab === "register" && (
          <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-md mx-auto animate-fade-in">
            <div className="bg-white py-8 px-6 shadow-xl border border-slate-100 rounded-2xl sm:px-10">
              <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 font-sans mb-1">
                Create Account
              </h2>
              <p className="text-center text-xs text-slate-400 mb-5">
                Pre-selected plan: <span className="text-emerald-600 font-bold">{selectedPlan.name} ({selectedPlan.price})</span>
              </p>

              {error && (
                <div className="mb-5 rounded-xl bg-rose-50 p-4 border border-rose-100 text-xs text-rose-700 font-semibold flex gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0"></span>
                  <span>{error}</span>
                </div>
              )}



              <form className="space-y-4" onSubmit={handleRegisterSubmit}>
                <div>
                  <label htmlFor="regName" className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="h-4.5 w-4.5" />
                    </div>
                    <input
                      id="regName"
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="block w-full pl-11 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                 <div>
                  <label htmlFor="regEmail" className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4.5 w-4.5" />
                    </div>
                    <input
                      id="regEmail"
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className={`block w-full pl-11 pr-3 py-2 border rounded-xl focus:outline-none focus:ring-2 text-xs text-slate-900 ${
                        emailCheck.status === "valid"
                          ? "border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 bg-emerald-50/10"
                          : emailCheck.status === "invalid"
                          ? "border-rose-300 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/10"
                          : "border-slate-200 focus:ring-emerald-500 focus:border-emerald-500"
                      }`}
                      placeholder="john@example.com"
                    />
                  </div>
                  {emailCheck.status !== "idle" && (
                    <div className="mt-1 flex items-center gap-1 text-[10px]">
                      {emailCheck.status === "checking" && (
                        <>
                          <RefreshCw className="w-2.5 h-2.5 text-slate-400 animate-spin" />
                          <span className="text-slate-500 font-medium">Checking email availability...</span>
                        </>
                      )}
                      {emailCheck.status === "valid" && (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="text-emerald-600 font-bold">{emailCheck.msg}</span>
                        </>
                      )}
                      {emailCheck.status === "invalid" && (
                        <>
                          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                          <span className="text-rose-600 font-bold">{emailCheck.msg}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="regPhone" className="block text-xs font-semibold text-slate-700 mb-1">
                    WhatsApp Mobile Number
                  </label>
                  <div className="flex gap-2">
                    <CountryCodeSelector
                      selectedCode={regCountryCode}
                      onChange={setRegCountryCode}
                      className="shrink-0"
                    />
                    <div className="relative rounded-xl shadow-sm flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <input
                        id="regPhone"
                        type="text"
                        required
                        value={regPhone}
                        onChange={(e) => handlePhoneChange(e.target.value, "register")}
                        className={`block w-full pl-9 pr-3 py-2 border rounded-xl focus:outline-none focus:ring-2 text-xs text-slate-900 font-mono ${
                          phoneCheck.status === "valid"
                            ? "border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 bg-emerald-50/10"
                            : phoneCheck.status === "invalid"
                            ? "border-rose-300 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/10"
                            : "border-slate-200 focus:ring-emerald-500 focus:border-emerald-500"
                        }`}
                        placeholder="e.g. 9876543210"
                      />
                    </div>
                  </div>
                  {phoneCheck.status !== "idle" && (
                    <div className="mt-1 flex items-center gap-1 text-[10px]">
                      {phoneCheck.status === "checking" && (
                        <>
                          <RefreshCw className="w-2.5 h-2.5 text-slate-400 animate-spin" />
                          <span className="text-slate-500 font-medium">Checking mobile availability...</span>
                        </>
                      )}
                      {phoneCheck.status === "valid" && (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="text-emerald-600 font-bold">{phoneCheck.msg}</span>
                        </>
                      )}
                      {phoneCheck.status === "invalid" && (
                        <>
                          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                          <span className="text-rose-600 font-bold">{phoneCheck.msg}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="regPassword" className="block text-xs font-semibold text-slate-700 mb-1">
                    Dashboard Password
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4.5 w-4.5" />
                    </div>
                    <input
                      id="regPassword"
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="block w-full pl-11 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900"
                      placeholder="Minimum 5 characters"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
                >
                  {`Pay ${selectedPlan.price} & Register`}
                </button>

                <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                  <p className="text-xs text-slate-400">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("login");
                        setError("");
                        setSuccess("");
                      }}
                      className="font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                    >
                      Sign In here
                    </button>
                  </p>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- PREMIUM CHECKOUT SIMULATOR --- */}
        {activeTab === "checkout" && (
          <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-xl mx-auto animate-fade-in">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
              
              {/* Header */}
              <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-emerald-500 text-white p-1.5 rounded-lg">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">WAPIMI PayDesk</h3>
                    <p className="text-[10px] text-slate-400">SECURED BY RAZORPAY GATEWAY</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">PLAN TOTAL</p>
                  <p className="text-lg font-mono font-extrabold text-emerald-400">{selectedPlan.price}</p>
                </div>
              </div>

              {checkoutStep === "form" && (
                <div className="p-6 space-y-6 animate-fade-in">
                  {error && (
                    <div className="rounded-xl bg-rose-50 p-4 border border-rose-100 text-xs text-rose-700 font-semibold flex gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Order summary */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800">{selectedPlan.name} Plan</p>
                        <p className="text-[10px] text-slate-400">Standard business authorization node</p>
                      </div>
                      <span className="font-mono font-bold text-slate-800">{selectedPlan.price}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-3 flex justify-between text-[10px] text-slate-500">
                      <span>Billing Cycle</span>
                      <span className="font-bold uppercase text-slate-700">{selectedPlan.cycle || "daily"}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl flex gap-3 text-slate-700">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="font-bold text-[10px] uppercase text-emerald-800 tracking-wider">Secured by Razorpay</h4>
                      <p className="text-[9px] leading-relaxed text-emerald-700">
                        We delegate payment options to Razorpay's overlay. You can pay securely using Cards, UPI, Netbanking, or mobile wallets in the next step.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button 
                      type="button"
                      onClick={handleRazorpayCheckout}
                      disabled={checkoutStep === "paying"}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-200 cursor-pointer flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Proceed to Secure Payment</span>
                    </button>
                    <p className="text-[9px] text-center text-slate-400 mt-2">
                      Your transaction details are encrypted using SSL and processed via secure webhook tokens.
                    </p>
                  </div>
                </div>
              )}

              {checkoutStep === "paying" && (
                <div className="p-12 text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-sm font-bold text-slate-800">Processing secure transaction...</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Connecting to central Razorpay webhook endpoints and verifying secure encryption tokens. Please do not close this window.
                  </p>
                </div>
              )}

              {checkoutStep === "success" && (
                <div className="p-12 text-center space-y-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">Payment Authorized!</p>
                  <p className="text-xs text-slate-500">
                    Provisions upgraded successfully! Activating your premium dashboard session...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TERMS & CONDITIONS TAB --- */}
        {activeTab === "terms" && (
          <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
            <h1 className="text-3xl font-extrabold text-slate-900">Terms and Conditions</h1>
            <p className="text-xs text-slate-400">Last updated: July 15, 2026</p>
            
            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6 text-xs text-slate-600 leading-relaxed">
              <p>Welcome to WAPIMI Automation Technologies. These Terms and Conditions govern your access to the WAPIMI WhatsApp marketing automation SaaS platform, website, dashboard, subscription plans, and related support services.</p>
              
              <h3 className="text-sm font-bold text-slate-900">1. Terms of Use</h3>
              <p>By accessing this website, creating an account, or purchasing a subscription, you agree to follow these terms. If you do not agree, you must not use WAPIMI.</p>
              
              <h3 className="text-sm font-bold text-slate-900">2. Service Description</h3>
              <p>WAPIMI is a digital software platform for contact group management, scheduled WhatsApp broadcasts, CSV recipient cohorts, two-way inbox monitoring, delivery/read receipt tracking, and predefined auto-reply rules.</p>
              
              <h3 className="text-sm font-bold text-slate-900">3. Account Registration</h3>
              <p>You must provide accurate account details, including your name, email address, registered WhatsApp number, and password. You are responsible for keeping your login credentials confidential and for all activity under your account.</p>
              
              <h3 className="text-sm font-bold text-slate-900">4. Subscription Plans and Payments</h3>
              <p>Public pricing is displayed on the Pricing page. Current plans include Daily Plan at Rs 15/day, Professional Plan at Rs 300/month, and Enterprise Plan at Rs 500/month. Payments are processed securely through Razorpay. Access is activated after successful payment confirmation.</p>

              <h3 className="text-sm font-bold text-slate-900">5. User Responsibilities and Acceptable Use</h3>
              <p>You must use WAPIMI only for lawful business messaging to recipients who have consented to receive communication from you. Spam, phishing, illegal promotions, harassment, adult content, fraudulent offers, and violation of WhatsApp/Meta policies are strictly prohibited.</p>

              <h3 className="text-sm font-bold text-slate-900">6. Suspension and Termination</h3>
              <p>We may suspend or terminate accounts that misuse the platform, violate applicable law, breach these terms, attempt unauthorized access, or create compliance risks for WAPIMI, Razorpay, WhatsApp, Meta, or customers.</p>

              <h3 className="text-sm font-bold text-slate-900">7. Intellectual Property</h3>
              <p>All software, branding, interfaces, workflows, and documentation belonging to WAPIMI remain the intellectual property of WAPIMI Automation Technologies. You may not copy, resell, reverse engineer, or misuse the platform.</p>

              <h3 className="text-sm font-bold text-slate-900">8. Limitation of Liability</h3>
              <p>WAPIMI is provided as a digital software service. We are not responsible for recipient-side network issues, WhatsApp/Meta platform restrictions, customer misuse, third-party outages, or indirect business losses.</p>

              <h3 className="text-sm font-bold text-slate-900">9. Governing Law and Contact</h3>
              <p>These terms are governed by the laws of India. For questions, contact WAPIMI Automation Technologies, Sector 62, Noida, Uttar Pradesh, India, at kaldevsedutech@gmail.com.</p>
            </div>
          </div>
        )}

        {/* --- PRIVACY POLICY TAB --- */}
        {activeTab === "privacy" && (
          <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
            <h1 className="text-3xl font-extrabold text-slate-900">Privacy Policy</h1>
            <p className="text-xs text-slate-400">Last updated: July 15, 2026</p>
            
            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6 text-xs text-slate-600 leading-relaxed">
              <p>At WAPIMI Automation Technologies, privacy and data safety are important. This Privacy Policy explains what information we collect, how we use it, and how users can contact us about their data.</p>
              
              <h3 className="text-sm font-bold text-slate-900">1. Information We Collect</h3>
              <p>We may collect your name, email address, registered phone number, account password, business contact lists uploaded by you, campaign records, support messages, subscription status, and payment confirmation details. Card, UPI, netbanking, and wallet credentials are handled by Razorpay and are not stored by WAPIMI.</p>
              
              <h3 className="text-sm font-bold text-slate-900">2. How We Use Information</h3>
              <p>We use information to create accounts, authenticate users, activate subscriptions, provide dashboard access, process campaigns requested by users, maintain delivery/read records, respond to support requests, improve reliability, and comply with legal or payment obligations.</p>
              
              <h3 className="text-sm font-bold text-slate-900">3. Cookies and Session Storage</h3>
              <p>We use essential browser storage and authentication tokens to keep users signed in and operate the dashboard. We do not use these tools to sell user data or run unrelated advertising trackers.</p>

              <h3 className="text-sm font-bold text-slate-900">4. Payment Security</h3>
              <p>Payments are processed through Razorpay. Razorpay may collect payment-related information under its own security and compliance standards. WAPIMI stores only payment references, order IDs, subscription records, and status needed for account activation and support.</p>

              <h3 className="text-sm font-bold text-slate-900">5. Third-Party Services</h3>
              <p>WAPIMI may interact with Razorpay for payment processing and Meta/WhatsApp services for WhatsApp-related workflows. Your use of WhatsApp features must also comply with WhatsApp and Meta policies.</p>

              <h3 className="text-sm font-bold text-slate-900">6. Data Protection</h3>
              <p>We use access controls and reasonable security measures to protect account data and uploaded contact lists. Users are responsible for ensuring they have lawful permission to upload and message recipients.</p>

              <h3 className="text-sm font-bold text-slate-900">7. User Rights</h3>
              <p>You may contact us to request correction, export, or deletion of your account data where legally permitted. Some records may be retained where required for payment, security, legal, or fraud-prevention purposes.</p>

              <h3 className="text-sm font-bold text-slate-900">8. Contact Information</h3>
              <p>For privacy requests, contact WAPIMI Automation Technologies at kaldevsedutech@gmail.com. Business address: Sector 62, Noida, Uttar Pradesh, India.</p>
            </div>
          </div>
        )}

        {/* --- REFUND POLICY TAB --- */}
        {activeTab === "refund" && (
          <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
            <h1 className="text-3xl font-extrabold text-slate-900">Refund and Cancellation Policy</h1>
            <p className="text-xs text-slate-400">Last updated: July 15, 2026</p>
            
            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6 text-xs text-slate-600 leading-relaxed">
              <p>At WAPIMI Automation Technologies, customer satisfaction is important. Since WAPIMI provides digital software services, subscriptions are activated after successful payment and access is delivered electronically.</p>
              
              <h3 className="text-sm font-bold text-slate-900">1. Cancellation Policy</h3>
              <p>Users may cancel their subscription at any time from their dashboard or by contacting support. Cancellation prevents future renewals but does not automatically generate a refund. Access remains available until the end of the paid billing cycle unless the account is suspended for misuse.</p>
              
              <h3 className="text-sm font-bold text-slate-900">2. Refund Eligibility</h3>
              <p>Payments already made are generally non-refundable because access to the digital service is provided instantly. Refunds may be considered only for duplicate payments, technical issues that permanently prevent service activation, or incorrect charges caused by a payment processing error.</p>

              <h3 className="text-sm font-bold text-slate-900">3. Refund Processing Time</h3>
              <p>Approved refunds will be processed to the original payment method within 7 to 10 business days, subject to Razorpay and bank processing timelines.</p>

              <h3 className="text-sm font-bold text-slate-900">4. Refund Contact</h3>
              <p>For refund or cancellation requests, email <a href="mailto:kaldevsedutech@gmail.com" className="text-emerald-600 font-bold hover:underline">kaldevsedutech@gmail.com</a> with your registered email, payment reference, and reason for the request.</p>
            </div>
          </div>
        )}

        {/* --- SHIPPING & DELIVERY POLICY TAB --- */}
        {activeTab === "shipping" && (
          <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
            <h1 className="text-3xl font-extrabold text-slate-900">Shipping and Delivery Policy</h1>
            <p className="text-xs text-slate-400">Last updated: July 15, 2026</p>

            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6 text-xs text-slate-600 leading-relaxed">
              <p>WAPIMI is a cloud-based digital software platform. No physical goods are sold, packed, shipped, or delivered by courier.</p>

              <h3 className="text-sm font-bold text-slate-900">1. Digital Delivery</h3>
              <p>After successful payment, users receive access to their subscribed plan through their registered WAPIMI account. The dashboard, plan limits, and software features are provided online.</p>

              <h3 className="text-sm font-bold text-slate-900">2. Activation Timeline</h3>
              <p>In most cases, plan activation is immediate after successful Razorpay payment verification. If activation is delayed due to technical issues, most cases are resolved within one business day.</p>

              <h3 className="text-sm font-bold text-slate-900">3. No Physical Shipping Charges</h3>
              <p>Because WAPIMI is a digital SaaS product, there are no shipping charges, courier tracking numbers, or physical delivery timelines.</p>

              <h3 className="text-sm font-bold text-slate-900">4. Support</h3>
              <p>If your account is not activated after successful payment, contact support at <a href="mailto:kaldevsedutech@gmail.com" className="text-emerald-600 font-bold hover:underline">kaldevsedutech@gmail.com</a>. Include your registered email and Razorpay payment reference.</p>
            </div>
          </div>
        )}

      </main>

      {/* 3. COMPLIANT SAAS VISUAL FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-600 text-white p-1.5 rounded-lg">
                <Send className="w-4 h-4" />
              </div>
              <span className="text-sm font-extrabold text-white">WAPIMI</span>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              WhatsApp Powered Marketing Intelligence
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
                Enterprise WhatsApp marketing automation software. Build contact groups, schedule campaigns, send predefined auto-replies, and track receipts.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Product</h4>
            <ul className="space-y-2 text-[11px]">
              <li><button onClick={() => setActiveTab("features")} className="hover:text-white transition-colors cursor-pointer">Features Overview</button></li>
              <li><button onClick={() => setActiveTab("pricing")} className="hover:text-white transition-colors cursor-pointer">SaaS Pricing Plans</button></li>
              <li><button onClick={() => setActiveTab("about")} className="hover:text-white transition-colors cursor-pointer">Who We Are</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Legal & Compliance</h4>
            <ul className="space-y-2 text-[11px]">
              <li><button onClick={() => setActiveTab("terms")} className="hover:text-white transition-colors cursor-pointer">Terms and Conditions</button></li>
              <li><button onClick={() => setActiveTab("privacy")} className="hover:text-white transition-colors cursor-pointer">Privacy Policy</button></li>
              <li><button onClick={() => setActiveTab("refund")} className="hover:text-white transition-colors cursor-pointer">Refund and Cancellation</button></li>
              <li><button onClick={() => setActiveTab("shipping")} className="hover:text-white transition-colors cursor-pointer">Shipping and Delivery</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Office Desk</h4>
            <ul className="space-y-2 text-[11px] text-slate-500">
              <li className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Sector 62, Noida, UP, India</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <a href="mailto:kaldevsedutech@gmail.com" className="hover:text-white transition-colors">kaldevsedutech@gmail.com</a>
              </li>
              <li className="flex items-start gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>+9493165230</span>
              </li>
            </ul>
          </div>

        </div>

        <div className="max-w-7xl mx-auto border-t border-slate-800 mt-8 pt-6 text-center text-[10px] text-slate-600">
          <p>© 2026 WAPIMI Automation Technologies. All Rights Reserved. WhatsApp is a registered trademark of Meta Platforms Inc.</p>
        </div>
      </footer>

    </div>
  );
}

