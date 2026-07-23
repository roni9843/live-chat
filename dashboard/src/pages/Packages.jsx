import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import useAuthStore from "../store/authStore";
import {
  Sparkles,
  CheckCircle,
  XCircle,
  HelpCircle,
  Zap,
  Calendar,
  AlertTriangle,
  Loader2,
  Clock,
  ArrowLeft
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "https://jh5nng6t-5000.asse.devtunnels.ms";

const Packages = () => {
  const { user, fetchProfile } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const activeSub = user?.subscription;
  const isSubActive = activeSub?.status === "active";

  const getRemainingTime = (expiresAt) => {
    if (!expiresAt) return null;
    const total = Date.parse(expiresAt) - Date.now();
    if (total <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true, total };
    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    return { days, hours, minutes, seconds, expired: false, total };
  };

  const getProgressPercentage = () => {
    if (!activeSub?.startedAt || !activeSub?.expiresAt) return 0;
    const start = Date.parse(activeSub.startedAt);
    const end = Date.parse(activeSub.expiresAt);
    const now = Date.now();
    if (now >= end) return 100;
    if (now <= start) return 0;
    const totalDuration = end - start;
    const elapsed = now - start;
    return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  };

  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (isSubActive && activeSub?.expiresAt) {
      const updateTimer = () => {
        setTimeLeft(getRemainingTime(activeSub.expiresAt));
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [isSubActive, activeSub?.expiresAt]);

  const fetchPackages = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/subscriptions/packages`);
      if (data.success) {
        setPackages(data.data || []);
      }
    } catch (e) {
      console.error("Error fetching packages:", e);
      setError("Failed to load subscription plans.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
    if (user) {
      fetchProfile();
    }

    if (status === "success") {
      setSuccessMsg("Your payment was successful! Your package has been activated.");
      // Clean up URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (status === "cancel") {
      setError("Payment was cancelled or failed. Please try again.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [status]);

  const handlePurchase = async (pkg) => {
    setPurchasingId(pkg._id);
    setError("");
    setSuccessMsg("");

    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      
      // Compute dashboard base url dynamically for callback / redirect
      const successUrl = `${window.location.origin}/packages?status=success`;
      const cancelUrl = `${window.location.origin}/packages?status=cancel`;

      const { data } = await axios.post(
        `${API_URL}/api/subscriptions/initialize-payment`,
        {
          packageId: pkg._id,
          success_redirect_url: successUrl,
          callback_url: `${API_URL}/api/subscriptions/webhook`
        },
        config
      );

      if (data.success) {
        if (data.isFree) {
          // Free package auto-activated
          setSuccessMsg("Free package has been successfully activated!");
          await fetchProfile();
        } else if (data.payment_page_url) {
          // Redirect to OraclePay payment gateway
          window.location.href = data.payment_page_url;
        } else {
          setError("Failed to initialize transaction page.");
        }
      }
    } catch (e) {
      console.error("Purchase error:", e);
      setError(e.response?.data?.message || "Failed to initiate payment gateway request.");
    } finally {
      setPurchasingId(null);
    }
  };

  // Helper to format Date
  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] py-10 px-4 md:px-8 text-slate-800">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Navbar Back Option */}
        <div className="flex items-center justify-between border-b pb-4">
          <button
            onClick={() => navigate("/configure")}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-850 text-sm font-semibold transition cursor-pointer"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
          
          <h1 className="text-sm font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full border">
            Billing & Subscriptions
          </h1>
        </div>

        {/* Notifications Banners */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-850 p-4 rounded-2xl flex items-start gap-3 shadow-xs animate-in fade-in duration-300">
            <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-sm">Action Successful</p>
              <p className="text-xs text-emerald-700 mt-0.5">{successMsg}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-850 p-4 rounded-2xl flex items-start gap-3 shadow-xs animate-in fade-in duration-300">
            <XCircle className="text-rose-600 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-sm">Transaction Alert</p>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Active plan overview details card */}
        {isSubActive && activeSub && (
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#0b2b24] to-slate-950 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-teal-500/20">
            <div className="absolute top-0 right-0 h-64 w-64 bg-[#00a884]/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 h-48 w-48 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center relative z-10">
              
              {/* Left detail column */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="bg-emerald-500/20 text-[#0df2c1] text-xs font-black px-4 py-1.5 rounded-full border border-teal-500/30 uppercase tracking-wider shadow-sm">
                    Active Subscription
                  </span>
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 bg-slate-800/40 px-3 py-1.5 rounded-full border border-slate-700/50">
                    <Clock size={13} className="text-[#0df2c1]" />
                    Auto Renewal Ready
                  </span>
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-teal-100 to-[#0df2c1] bg-clip-text text-transparent">
                  {activeSub.packageName || "Custom Enterprise Plan"}
                </h2>
                <p className="text-xs text-slate-350 max-w-xl">
                  You are currently using this plan. Your widget customization, agents limit, and live-chat modules are successfully compiled and active.
                </p>

                {/* Limits list */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  <div className="bg-slate-850/50 border border-slate-800 p-3 rounded-2xl backdrop-blur-xs">
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Max Widgets</span>
                    <span className="text-sm font-extrabold text-white">
                      {activeSub.featuresSnapshot?.maxWidgets || 0} Widgets
                    </span>
                  </div>
                  <div className="bg-slate-850/50 border border-slate-800 p-3 rounded-2xl backdrop-blur-xs">
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Agents Per Widget</span>
                    <span className="text-sm font-extrabold text-white">
                      {activeSub.featuresSnapshot?.maxAgentsPerWidget || 0} Agents
                    </span>
                  </div>
                  <div className="bg-slate-850/50 border border-slate-800 p-3 rounded-2xl backdrop-blur-xs">
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Support Level</span>
                    <span className="text-sm font-extrabold text-[#0df2c1]">Premium Support</span>
                  </div>
                </div>
              </div>

              {/* Right column: Dynamic Live countdown card */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 md:p-6 space-y-4 backdrop-blur-md shadow-2xl">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Time Remaining</span>
                  <span className="text-xs font-bold text-teal-400 bg-teal-950/60 px-2.5 py-0.5 rounded-md border border-teal-900/60">
                    Live Timer
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-700/60">
                    <div 
                      className="bg-gradient-to-r from-[#0df2c1] to-teal-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(13,242,193,0.4)]" 
                      style={{ width: `${Math.max(100 - getProgressPercentage(), 2)}%` }} 
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-0.5">
                    <span>Started: {formatDate(activeSub.startedAt)}</span>
                    <span className="text-[#0df2c1]">Expires: {formatDate(activeSub.expiresAt)}</span>
                  </div>
                </div>

                {/* Countdown cells grid */}
                <div className="grid grid-cols-4 gap-2 pt-2">
                  <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-2.5 rounded-xl text-center flex flex-col justify-center min-w-[55px]">
                    <span className="text-xl font-black text-white leading-none">
                      {timeLeft ? String(timeLeft.days).padStart(2, '0') : "00"}
                    </span>
                    <span className="text-[8px] font-extrabold text-slate-450 uppercase mt-1 tracking-wider">Days</span>
                  </div>
                  <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-2.5 rounded-xl text-center flex flex-col justify-center min-w-[55px]">
                    <span className="text-xl font-black text-[#0df2c1] leading-none">
                      {timeLeft ? String(timeLeft.hours).padStart(2, '0') : "00"}
                    </span>
                    <span className="text-[8px] font-extrabold text-slate-450 uppercase mt-1 tracking-wider">Hours</span>
                  </div>
                  <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-2.5 rounded-xl text-center flex flex-col justify-center min-w-[55px]">
                    <span className="text-xl font-black text-[#0df2c1] leading-none">
                      {timeLeft ? String(timeLeft.minutes).padStart(2, '0') : "00"}
                    </span>
                    <span className="text-[8px] font-extrabold text-slate-450 uppercase mt-1 tracking-wider">Mins</span>
                  </div>
                  <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-2.5 rounded-xl text-center flex flex-col justify-center min-w-[55px] relative overflow-hidden">
                    <span className="text-xl font-black text-amber-400 leading-none animate-pulse">
                      {timeLeft ? String(timeLeft.seconds).padStart(2, '0') : "00"}
                    </span>
                    <span className="text-[8px] font-extrabold text-slate-450 uppercase mt-1 tracking-wider">Secs</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Expired / No plan alert */}
        {!isSubActive && (
          <div className="bg-amber-50 border border-amber-200 text-amber-850 p-6 rounded-3xl flex flex-col sm:flex-row items-center gap-4 shadow-xs">
            <AlertTriangle className="text-amber-600 shrink-0" size={32} />
            <div className="space-y-1 text-center sm:text-left flex-1">
              <h3 className="font-bold text-base">Subscription Expired or Inactive</h3>
              <p className="text-xs text-amber-700">
                You do not have an active package subscription. Please select one of the following packages to unlock and enable your Ochat widget.
              </p>
            </div>
          </div>
        )}

        {/* Packages Showcase section */}
        <div className="space-y-4">
          <div className="text-center max-w-lg mx-auto space-y-2">
            <h3 className="text-xl font-extrabold text-slate-800">Select Subscription Plan</h3>
            <p className="text-xs text-slate-500">
              Upgrade, renew, or choose a plan to suit your business requirements. Simple billing, cancel anytime.
            </p>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500">
              <Loader2 size={36} className="animate-spin text-[#00a884] mb-3" />
              <span>Loading available plans...</span>
            </div>
          ) : packages.length === 0 ? (
            <div className="py-20 text-center text-slate-500 border border-dashed rounded-3xl bg-white">
              <Zap size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-700">No active plans found</p>
              <p className="text-xs text-slate-500 mt-1">Please check back again later or contact support.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {packages.map((pkg) => {
                const activePackageId = typeof activeSub?.package === "object" ? activeSub?.package?._id : activeSub?.package;
                const isActivePlan = isSubActive && activePackageId === pkg._id;
                const isFree = pkg.price === 0;

                return (
                  <div
                    key={pkg._id}
                    className={`bg-white border rounded-3xl p-6 shadow-xs flex flex-col justify-between transition relative overflow-hidden group hover:shadow-md ${
                      isActivePlan
                        ? "border-[#00a884] ring-2 ring-[#00a884]/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {isActivePlan && (
                      <span className="absolute top-0 right-0 bg-[#00a884] text-white text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-2xl">
                        Active Plan
                      </span>
                    )}

                    {/* Top Content */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-black text-slate-850 group-hover:text-[#00a884] transition">
                          {pkg.name}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {pkg.description || "Everything you need to engage customers instantly."}
                        </p>
                      </div>

                      {/* Pricing block */}
                      <div className="pb-4 border-b border-slate-100">
                        <div className="flex items-baseline">
                          <span className="text-3xl font-black text-slate-900">
                            {isFree ? "Free" : `${pkg.price}`}
                          </span>
                          {!isFree && (
                            <span className="text-xs text-slate-500 font-bold ml-1 uppercase">
                              BDT
                            </span>
                          )}
                          <span className="text-xs text-slate-500 ml-1">
                            /{pkg.durationValue} {pkg.durationUnit}
                          </span>
                        </div>
                      </div>

                      {/* Features list */}
                      <div className="space-y-3 pt-2 text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-[#00a884] shrink-0" />
                          <span className="font-semibold text-slate-700">
                            {pkg.features?.maxWidgets || 0} Widget(s) allowed
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-[#00a884] shrink-0" />
                          <span className="font-semibold text-slate-700">
                            {pkg.features?.maxAgentsPerWidget || 0} Agent(s) per widget
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0">{pkg.features?.canCustomizeWidget ? "✓" : "✗"}</span>
                          <span className={`${pkg.features?.canCustomizeWidget ? "text-slate-700 font-semibold" : "text-slate-400 font-medium line-through"}`}>
                            Widget Customization
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0">{pkg.features?.canUseFaq ? "✓" : "✗"}</span>
                          <span className={`${pkg.features?.canUseFaq ? "text-slate-700 font-semibold" : "text-slate-400 font-medium line-through"}`}>
                            FAQ Q&A module
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0">{pkg.features?.canUsePreChatForm ? "✓" : "✗"}</span>
                          <span className={`${pkg.features?.canUsePreChatForm ? "text-slate-700 font-semibold" : "text-slate-400 font-medium line-through"}`}>
                            Pre-Chat visitor form
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0">{pkg.features?.canUseOfflineForm ? "✓" : "✗"}</span>
                          <span className={`${pkg.features?.canUseOfflineForm ? "text-slate-700 font-semibold" : "text-slate-400 font-medium line-through"}`}>
                            Offline lead email form
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-6">
                      <button
                        onClick={() => handlePurchase(pkg)}
                        disabled={purchasingId !== null || (isActivePlan && isFree)}
                        className={`w-full py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-xs ${
                          isActivePlan
                            ? isFree
                              ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                              : "bg-[#00a884] hover:bg-[#008f6f] text-white hover:shadow-md"
                            : "bg-[#00a884] hover:bg-[#008f6f] text-white"
                        }`}
                      >
                        {purchasingId === pkg._id ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Processing...
                          </>
                        ) : isActivePlan ? (
                          isFree ? "Active Plan" : "Renew Plan"
                        ) : isFree ? (
                          "Get Started"
                        ) : (
                          "Upgrade Plan"
                        )}
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Packages;
