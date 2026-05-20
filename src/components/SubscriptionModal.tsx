import React, { useState } from "react";
import { Check, ShieldCheck, Sparkles, CreditCard, X, HelpCircle } from "lucide-react";

interface SubscriptionModalProps {
  onClose: () => void;
  uid: string;
  currentTier: "free" | "pro";
  onUpgradeSuccess: () => void;
}

export default function SubscriptionModal({
  onClose,
  uid,
  currentTier,
  onUpgradeSuccess,
}: SubscriptionModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");
  const [checkoutStep, setCheckoutStep] = useState<"pricing" | "checkout">("pricing");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSimulatedUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || !cardExpiry || !cardCvc || !cardName) {
      setErrorMsg("Please fill out all billing fields.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // Direct call to Express secure administrative upgrade endpoint
      const response = await fetch("/api/user/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          onUpgradeSuccess();
          onClose();
        }, 3000);
      } else {
        setErrorMsg(data.error || "Failed to upgrade subscription tier.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("An unexpected connection error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          <X size={20} />
        </button>

        {success ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <ShieldCheck size={36} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">GrammaFire Pro Unlocked!</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Congratulations! Your account has been upgraded successfully. You now have unlimited character checks, Myanmar grammar verification, and live collaboration.
            </p>
            <div className="text-xs text-gray-400 font-mono animate-pulse">
              Synchronizing permissions with Firestore cloud...
            </div>
          </div>
        ) : checkoutStep === "pricing" ? (
          <div className="p-6 md:p-8 space-y-6">
            <div className="text-center space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-amber-800 bg-amber-50 rounded-full">
                <Sparkles size={12} className="text-amber-500" />
                Special Workspace Pricing
              </span>
              <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Select premium plans for GrammaFire</h2>
              <p className="text-xs text-gray-400">Unlock linguistic brilliance across borders</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Free Plan Card */}
              <div className="border border-gray-200 rounded-xl p-5 space-y-4 relative bg-gray-50/50">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Standard Access</h3>
                  <p className="text-xs text-gray-400">Essential diagnostics for English writers</p>
                </div>
                <div className="text-2xl font-black text-gray-900">
                  $0 <span className="text-xs text-gray-400 font-normal">/ forever</span>
                </div>
                <ul className="space-y-2 text-xs text-gray-600">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-500" />
                    English language spellcheck
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-500" />
                    Up to 1,200 character checks
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-500" />
                    Save up to 3 documents
                  </li>
                  <li className="flex items-center gap-2 text-gray-400">
                    <X size={14} /> No Real-time Collaboration
                  </li>
                  <li className="flex items-center gap-2 text-gray-400">
                    <X size={14} /> No Myanmar Language checking
                  </li>
                </ul>
                <button
                  disabled
                  className="w-full py-2 bg-gray-200 text-gray-500 rounded-lg text-xs font-semibold"
                >
                  {currentTier === "free" ? "Current Tier Active" : "Downgrade Prohibited"}
                </button>
              </div>

              {/* Pro Plan Card */}
              <div className="border-2 border-slate-900 rounded-xl p-5 space-y-4 relative bg-slate-900 text-white shadow-lg">
                <span className="absolute top-3 right-3 bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded-full text-[10px] tracking-wide uppercase">
                  POPULAR
                </span>
                <div>
                  <h3 className="font-bold text-lg text-white">Linguistic Pro</h3>
                  <p className="text-xs text-slate-400">Bilingual proofreader with real-time sync</p>
                </div>
                <div className="text-2xl font-black text-white">
                  $9.99 <span className="text-xs text-slate-400 font-normal">/ month</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-amber-400" />
                    <strong>English & Myanmar (Bilingual)</strong>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-amber-400" />
                    Up to **15,000 characters** per check
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-amber-400" />
                    Unlimited Documents history
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-amber-400" />
                    **Real-time Multi-user Collaboration**
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-amber-400" />
                    Import & Export docs (.docx, .txt)
                  </li>
                </ul>
                <button
                  onClick={() => setCheckoutStep("checkout")}
                  className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  {currentTier === "pro" ? "You're Pro (Extend)" : "Unlock GrammaFire Pro"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Checkout Secure Form step */
          <div className="p-6 md:p-8 space-y-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="text-slate-900" size={20} />
              Secure Premium Payment Checkout
            </h3>
            
            <form onSubmit={handleSimulatedUpgrade} className="space-y-4">
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs text-slate-600 flex items-start gap-1.5">
                <HelpCircle size={16} className="text-slate-500 shrink-0 mt-0.5" />
                <span>
                  Provide mock credit card credentials below. This checkout executes a secure update process, unlocking advanced capabilities synchronously.
                </span>
              </div>

              {errorMsg && (
                <div className="text-xs font-semibold text-red-600 bg-red-50 rounded-lg p-2.5">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Cardholder Name</label>
                <input
                  type="text"
                  required
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="e.g. Mg Mg Win"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 focus:outline-none focus:border-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Card Number</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={19}
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim())}
                    placeholder="4242 4242 4242 4242"
                    className="w-full text-sm border border-gray-200 rounded-lg pl-10 pr-3 py-2.5 text-gray-800 focus:outline-none focus:border-slate-800 font-mono"
                  />
                  <CreditCard className="absolute left-3 top-3 text-gray-400" size={16} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Expiry Date</label>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="MM/YY"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 focus:outline-none focus:border-slate-800 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Secure CVC</label>
                  <input
                    type="password"
                    required
                    maxLength={4}
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    placeholder="•••"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 focus:outline-none focus:border-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCheckoutStep("pricing")}
                  className="w-1/3 py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs tracking-wide cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs tracking-wide flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    "Complete Upgrade ($9.99)"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
