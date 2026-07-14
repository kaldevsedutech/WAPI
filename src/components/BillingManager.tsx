import React, { useEffect, useState } from "react";
import {
  CreditCard,
  Check,
  CheckCircle,
  AlertCircle,
  Sparkles,
  DollarSign,
  FileText,
  Clock,
  ArrowUpRight,
  RefreshCw,
  Coins,
  ToggleLeft,
  ToggleRight,
  Eye,
  Printer,
  X,
  ShieldCheck
} from "lucide-react";
import { api } from "../lib/api";
import { processRazorpaySubscription } from "../lib/razorpay";
import { maskEmailAddress } from "../lib/experienceUtils";

interface BillingManagerProps {
  user: any;
  onUserUpdate: () => Promise<void>;
}

export default function BillingManager({ user, onUserUpdate }: BillingManagerProps) {
  const [plans, setPlans] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [cycle, setCycle] = useState<"daily" | "weekly" | "monthly" | "annual">("monthly");
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Promo coupon states
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState("");
  const [promoSuccess, setPromoSuccess] = useState("");
  const [activePromo, setActivePromo] = useState<any | null>(null);

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromoError("");
    setPromoSuccess("");
    if (!promoInput.trim()) {
      setPromoError("Please enter a coupon code.");
      return;
    }

    try {
      setPromoError("");
      const codeToApply = promoInput.trim().toUpperCase();
      const res = await api.applyPromoToActiveCycle(codeToApply);
      
      // Update local state with applied promo details
      setActivePromo({
        code: codeToApply,
        discountPercent: res.user.promoDiscountPercent || 0
      });

      setPromoSuccess(res.message || `Promo code "${codeToApply}" successfully applied to your active billing cycle!`);
      
      // Reload user profile in main state to reflect updated active subscription attributes
      await onUserUpdate();

      // Reload transactions to reflect the credit adjustment invoice
      const transactionsRes = await api.getTransactions();
      setInvoices(transactionsRes.transactions || []);
      
      setPromoInput("");
    } catch (err: any) {
      setPromoError(err.message || "Failed to apply coupon code to active cycle.");
      setActivePromo(null);
    }
  };

  // Payment Methods & Auto-renew State
  const [paymentMethod, setPaymentMethod] = useState({
    brand: "Visa",
    last4: "8842",
    expiry: "08/2029",
    name: user?.name || "SFayaz MR"
  });
  const [autoRenew, setAutoRenew] = useState(true);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardFormError, setCardFormError] = useState("");
  const [cardName, setCardName] = useState(user?.name || "");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCVC, setCardCVC] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const loadBillingData = async () => {
    try {
      setLoading(true);
      setError("");
      
      const plansRes = await api.getBillingPlans();
      setPlans(plansRes.plans || []);

      const transactionsRes = await api.getTransactions();
      setInvoices(transactionsRes.transactions || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch billing ledger information.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, []);

  const handleSubscribe = async (planId: string) => {
    try {
      setSubmitting(planId);
      setError("");
      setSuccess("");

      // 1. Fetch Razorpay Order from backend
      const orderData = await api.subscribeToPlan(planId, cycle);
      
      // 2. Launch Razorpay Checkout Modal
      processRazorpaySubscription(
        orderData,
        planId,
        cycle,
        async (verifyRes) => {
          setSuccess(`Congratulations! Successfully subscribed to ${planId.toUpperCase()} (${cycle}) plan! Your payment has been verified.`);
          
          // Reload user profile in main state to reflect updated limits and billing
          await onUserUpdate();

          // Reload transactions
          const transactionsRes = await api.getTransactions();
          setInvoices(transactionsRes.transactions || []);
          
          setTimeout(() => setSuccess(""), 8000);
          setSubmitting(null);
        },
        (err) => {
          setError(err.message || "Razorpay subscription payment failed.");
          setSubmitting(null);
        }
      );
    } catch (err: any) {
      setError(err.message || "Failed to initialize Razorpay checkout session.");
      setSubmitting(null);
    }
  };

  if (loading && plans.length === 0) {
    return (
      <div className="flex-1 p-8 bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-medium text-slate-500">Compiling premium tiers and invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="billing-tab" className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <CreditCard className="w-6.5 h-6.5 text-emerald-600" />
              <span>SaaS Subscription & Pricing</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Select your marketing limit plan. We offer flexible daily, weekly, and annual cycles designed for companies of all sizes.
            </p>
          </div>

          {/* Cycle Toggler */}
          <div className="bg-white border border-slate-200 p-1 rounded-xl flex items-center shadow-sm self-start">
            <button
              onClick={() => setCycle("daily")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                cycle === "daily" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setCycle("weekly")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                cycle === "weekly" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setCycle("monthly")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                cycle === "monthly" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setCycle("annual")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                cycle === "annual" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Annual <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1 py-0.5 rounded ml-1">Save 35%</span>
            </button>
          </div>
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

        {/* Dynamic Billing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = user?.subscription === plan.id;
            const originalPricing = plan.pricing[cycle];
            const pricing = activePromo 
              ? Math.round(originalPricing * (1 - activePromo.discountPercent / 100))
              : originalPricing;
            const anchorPricing = originalPricing * 1.35; // Mock retail anchor comparison

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl border p-6 flex flex-col justify-between transition-all relative ${
                  isCurrent
                    ? "ring-2 ring-emerald-500 border-transparent shadow-lg"
                    : "border-slate-100 shadow-sm hover:shadow-md"
                }`}
              >
                {/* Current Badge */}
                {isCurrent && (
                  <span className="absolute -top-3 left-6 bg-emerald-600 text-white text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                    <Sparkles className="w-3 h-3" />
                    <span>Your Active Tier</span>
                  </span>
                )}

                {/* Plan Metadata */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 capitalize">{plan.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">{plan.description}</p>
                  </div>

                  {/* Pricing Meter */}
                  <div className="py-2.5 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900 font-sans">₹{pricing}</span>
                    <span className="text-xs text-slate-400 font-semibold uppercase font-mono">/ {cycle}</span>
                    {activePromo && (
                      <span className="text-[10px] text-rose-500 font-bold font-mono line-through ml-2">
                        ₹{originalPricing}
                      </span>
                    )}
                    {!activePromo && cycle === "annual" && (
                      <span className="text-[10px] text-slate-400 font-mono line-through ml-2">
                        ₹{Math.round(anchorPricing)}
                      </span>
                    )}
                  </div>

                  {/* Dynamic Limits Indicator */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <div className="flex items-center justify-between text-slate-700 font-bold mb-1">
                      <span>Message Cap:</span>
                      <span className="font-mono text-emerald-600 font-extrabold">
                        {plan.dailyLimit === 999999 ? "Unlimited" : `${plan.dailyLimit.toLocaleString()}`}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Dynamic system allowance quota reset daily at midnight.</p>
                  </div>

                  {/* Core Features bullets */}
                  <ul className="space-y-2.5 pt-2">
                    {plan.features.map((feature: string, fidx: number) => (
                      <li key={fidx} className="flex items-start gap-2 text-xs text-slate-600">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Upgrade Trigger Button */}
                <button
                  id={`btn-subscribe-${plan.id}`}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={submitting !== null || isCurrent}
                  className={`mt-6 w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${
                    isCurrent
                      ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/10"
                  }`}
                >
                  {submitting === plan.id ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Account...</span>
                    </>
                  ) : isCurrent ? (
                    <span>Currently Active Plan</span>
                  ) : (
                    <>
                      <span>Activate {plan.name}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* --- PROMO COUPON CODE SECTION --- */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
              <span>Have a Promotional Promo Code?</span>
            </h3>
            <p className="text-xs text-slate-400">Apply admin promo codes to receive instant discounts on subscription plan pricing tiers.</p>
          </div>
          
          <form onSubmit={handleApplyPromo} className="w-full md:w-auto flex items-stretch gap-2">
            <div className="relative">
              <input
                id="promoCouponInput"
                type="text"
                placeholder="Enter Coupon Code"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold uppercase w-full md:w-48"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
            >
              Apply Coupon
            </button>
          </form>
        </div>

        {promoError && (
          <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-semibold">
            {promoError}
          </div>
        )}

        {promoSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold">
            {promoSuccess}
          </div>
        )}

        {/* Manage Payment Methods */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-slate-400" />
              <h2 className="text-base font-bold text-slate-800">Manage Payment Methods</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SSL Secured Gateway</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Active Card Visualizer */}
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-between h-44">
              <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl"></div>
              
              <div className="flex justify-between items-start z-10">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Active Card on File</span>
                  <h4 className="text-sm font-bold mt-0.5">{paymentMethod.brand} Professional</h4>
                </div>
                <div className="w-10 h-7 bg-white/10 rounded-md flex items-center justify-center font-mono font-bold text-xs">
                  {paymentMethod.brand}
                </div>
              </div>

              <div className="z-10 mt-4">
                <span className="text-lg font-mono font-semibold tracking-wider">•••• •••• •••• {paymentMethod.last4}</span>
              </div>

              <div className="flex justify-between items-end z-10 mt-2">
                <div>
                  <span className="text-[9px] uppercase text-slate-400 block font-mono">Cardholder</span>
                  <span className="text-xs font-semibold uppercase">{paymentMethod.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase text-slate-400 block font-mono">Expires</span>
                  <span className="text-xs font-semibold font-mono">{paymentMethod.expiry}</span>
                </div>
              </div>
            </div>

            {/* Config & Auto-renew Toggler */}
            <div className="flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Auto-Renew Subscription</span>
                    <span className="text-[10px] text-slate-400">Keep account active seamlessly at next period reset.</span>
                  </div>
                  <button
                    onClick={() => {
                      setAutoRenew(!autoRenew);
                      setSuccess(`Auto-renewal ${!autoRenew ? "ENABLED" : "DISABLED"} successfully.`);
                      setTimeout(() => setSuccess(""), 4000);
                    }}
                    className="text-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    {autoRenew ? (
                      <ToggleRight className="w-10 h-10 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-slate-300" />
                    )}
                  </button>
                </div>

                <div className="p-3 bg-blue-50/50 border border-blue-100/50 rounded-xl text-[10px] text-slate-500">
                  <p>All pricing is dynamically adjusted based on active marketing message limits. Next scheduled debit date is set to <strong>July 14, 2026</strong>.</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowCardForm(!showCardForm);
                  setCardFormError("");
                }}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer self-start"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{showCardForm ? "Close Form" : "Change Payment Method"}</span>
              </button>
            </div>
          </div>

          {/* Expandable Change Payment Form */}
          {showCardForm && (
            <div className="p-5 border border-slate-100 rounded-2xl bg-slate-50/50 space-y-4 animate-fadeIn">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Update Card Credentials</h3>
              
              {cardFormError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{cardFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Cardholder Name</label>
                  <input
                    type="text"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="e.g. SFayaz MR"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">16-Digit Card Number</label>
                  <input
                    type="text"
                    maxLength={16}
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="4111 2222 3333 4444"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Expiry Date (MM/YY)</label>
                  <input
                    type="text"
                    maxLength={5}
                    value={cardExpiry}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val.length === 2 && !val.includes("/")) val += "/";
                      setCardExpiry(val);
                    }}
                    placeholder="12/28"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">CVC Code</label>
                  <input
                    type="password"
                    maxLength={3}
                    value={cardCVC}
                    onChange={(e) => setCardCVC(e.target.value.replace(/\D/g, ""))}
                    placeholder="•••"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCardForm(false)}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!cardName.trim()) {
                      setCardFormError("Cardholder name is required");
                      return;
                    }
                    if (cardNumber.length < 16) {
                      setCardFormError("Please enter a valid 16-digit card number");
                      return;
                    }
                    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
                      setCardFormError("Please use MM/YY formatting for expiry date");
                      return;
                    }
                    if (cardCVC.length < 3) {
                      setCardFormError("Please enter a valid 3-digit CVC security code");
                      return;
                    }
                    setPaymentMethod({
                      brand: cardNumber.startsWith("5") ? "Mastercard" : cardNumber.startsWith("3") ? "Amex" : "Visa",
                      last4: cardNumber.slice(-4),
                      expiry: cardExpiry,
                      name: cardName
                    });
                    setShowCardForm(false);
                    setSuccess("Secure payment gateway card reference registered successfully!");
                    setTimeout(() => setSuccess(""), 4000);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Update Credentials
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Transaction ledger list (Invoice History) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              <h2 className="text-base font-bold text-slate-800">Dynamic Transaction Ledger & Invoices</h2>
            </div>
            <button
              onClick={loadBillingData}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer"
              title="Refresh ledger"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Invoice Reference</th>
                  <th className="px-4 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Payment Date</th>
                  <th className="px-4 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Selected Tier</th>
                  <th className="px-4 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Billing Period</th>
                  <th className="px-4 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Amount Charged</th>
                  <th className="px-4 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Gateway Status</th>
                  <th className="px-4 py-3.5 text-right font-bold text-slate-500 uppercase tracking-wider text-[10px]">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      No invoices found on file. Activate a paid tier above to test payment processing.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-4 font-mono font-bold text-slate-800">{inv.invoiceNum}</td>
                      <td className="px-4 py-4 text-slate-500">{new Date(inv.timestamp).toLocaleDateString()}</td>
                      <td className="px-4 py-4 capitalize font-semibold text-slate-700">{inv.planId}</td>
                      <td className="px-4 py-4 capitalize text-slate-500">{inv.cycle}</td>
                      <td className="px-4 py-4 font-bold text-slate-900 font-sans">₹{inv.amount}</td>
                      <td className="px-4 py-4">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold px-2 py-0.5 rounded text-[10px] uppercase inline-flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Paid</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer ml-auto"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span>View Invoice</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3.5 bg-blue-50/40 border border-blue-100 rounded-xl text-[10px] text-slate-500 flex gap-2">
            <Coins className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p>Our payment gateway operates in developer sandbox mode. Subscribing generates mock invoices, completes simulated processing instantly, and adjusts limits instantly.</p>
          </div>
        </div>

      </div>

      {/* Itemized Invoice Viewer Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden animate-scaleIn">
            
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm tracking-tight">Invoice Receipt Details</h3>
                  <p className="text-[10px] text-slate-400 font-mono">Reference: {selectedInvoice.invoiceNum}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
              {/* Brand Banner */}
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-lg font-black tracking-tight text-slate-900">WAPIMI SENDER</h1>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">Enterprise SaaS</span>
                </div>
                <div className="text-right text-[10px] text-slate-400">
                  <p>WAPIMI Sender Ltd.</p>
                  <p>79 Tech Square, Suite 400</p>
                  <p>Singapore, 138637</p>
                  <p>billing@wapimi-sender.com</p>
                </div>
              </div>

              <div className="border-t border-b border-slate-100 py-4 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Billed To</span>
                  <p className="font-bold text-slate-800 mt-0.5">{paymentMethod.name}</p>
                  <p className="text-slate-500 font-mono text-[10px]">{maskEmailAddress(user?.email) || "billing account"}</p>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Transaction Date</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {new Date(selectedInvoice.timestamp).toLocaleDateString()}
                  </p>
                  <p className="text-slate-400 font-mono text-[10px]">
                    {new Date(selectedInvoice.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="space-y-2">
                <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Itemized Ledger</span>
                <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/40">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                      <tr>
                        <th className="px-4 py-2 text-left">Description</th>
                        <th className="px-4 py-2 text-center">Qty</th>
                        <th className="px-4 py-2 text-right">Rate</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      <tr>
                        <td className="px-4 py-3 font-medium">
                          WAPIMI Premium Plan — <span className="capitalize">{selectedInvoice.planId}</span>
                          <p className="text-[10px] text-slate-400 font-normal">Active cycle: {selectedInvoice.cycle}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-mono">1</td>
                        <td className="px-4 py-3 text-right font-mono">₹{selectedInvoice.amount}</td>
                        <td className="px-4 py-3 text-right font-semibold font-mono">₹{selectedInvoice.amount}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Calculation */}
              <div className="flex flex-col items-end space-y-1.5 text-xs pt-2">
                <div className="flex justify-between w-48 text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-mono">₹{(selectedInvoice.amount * 0.92).toFixed(2)}</span>
                </div>
                <div className="flex justify-between w-48 text-slate-500">
                  <span>Tax (8% GST):</span>
                  <span className="font-mono">₹{(selectedInvoice.amount * 0.08).toFixed(2)}</span>
                </div>
                <div className="flex justify-between w-48 text-sm font-bold text-slate-900 pt-2 border-t border-slate-100">
                  <span>Total Paid:</span>
                  <span className="font-mono">₹{selectedInvoice.amount}</span>
                </div>
              </div>

              {/* Payment Info */}
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="font-bold text-slate-800">Paid via {paymentMethod.brand} •••• {paymentMethod.last4}</p>
                    <p className="text-[10px] text-slate-400">SSL Reference: txn_{Math.random().toString(36).substring(2, 10)}</p>
                  </div>
                </div>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold px-2 py-0.5 rounded text-[10px] uppercase flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>Success</span>
                </span>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Invoice</span>
              </button>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 rounded-xl text-xs font-bold text-white cursor-pointer shadow-sm"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
