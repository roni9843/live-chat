import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import useAuthStore from "../store/authStore";
import {
  CreditCard,
  Calendar,
  Loader2,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Inbox
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "https://jh5nng6t-5000.asse.devtunnels.ms";

const PaymentHistory = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchHistory = async ({ showMainLoader = false, showRefreshLoader = false } = {}) => {
    if (showMainLoader) setLoading(true);
    if (showRefreshLoader) setRefreshing(true);
    setError("");

    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get(`${API_URL}/api/subscriptions/history`, config);
      if (data.success) {
        setHistory(data.data || []);
      } else {
        setError("Failed to load your transaction logs.");
      }
    } catch (e) {
      console.error("History fetch error:", e);
      setError(e.response?.data?.message || "Failed to load payment history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchHistory({ showMainLoader: true });
    }
  }, [user?._id]);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] py-10 px-4 md:px-8 text-slate-800">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation back Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <button
            onClick={() => navigate("/configure")}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-850 text-sm font-semibold transition cursor-pointer"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
          
          <h1 className="text-sm font-bold bg-[#00a884]/10 text-[#00a884] px-3 py-1 rounded-full border border-[#00a884]/20">
            Payment Logs
          </h1>
        </div>

        {/* Header Details */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-850 flex items-center gap-2">
              <CreditCard className="text-[#00a884]" size={22} />
              Billing & Invoices History
            </h2>
            <p className="text-xs text-slate-500">
              Audit and track all transaction events recorded for subscription package renewals
            </p>
          </div>

          <button
            onClick={() => fetchHistory({ showRefreshLoader: true })}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50 shadow-xs active:scale-95 transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-bold">
            {error}
          </div>
        )}

        {/* Logs table list */}
        <div className="bg-white border rounded-3xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500">
              <Loader2 size={32} className="animate-spin text-[#00a884] mb-2" />
              <span className="text-xs">Loading transaction logs...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
              <Inbox size={40} className="mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-700">No payment logs recorded</p>
              <p className="text-xs text-slate-500 mt-1">When you purchase packages, your billing receipts will display here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Billing Date</th>
                    <th className="px-6 py-4">Invoice Number</th>
                    <th className="px-6 py-4">Plan Name</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Details</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {history.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 flex items-center gap-1">
                        <Calendar size={12} className="text-slate-400" />
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-slate-900">
                        {item.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">
                        {item.packageName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-extrabold text-slate-900">
                        {item.amount} <span className="text-[9px] text-slate-400">BDT</span>
                      </td>
                      <td className="px-6 py-4">
                        {item.transactionId ? (
                          <div className="space-y-0.5 font-medium">
                            <div className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded inline-block font-mono text-slate-800">
                              TXID: {item.transactionId}
                            </div>
                            <div className="text-[9px] text-slate-500">
                              Payment method: <span className="uppercase font-bold text-slate-700">{item.bank || "SYSTEM"}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.status === "COMPLETED" ? (
                          <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2.5 py-0.5 rounded-full font-bold">
                            <CheckCircle2 size={10} />
                            Success
                          </span>
                        ) : item.status === "FAILED" ? (
                          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full font-bold">
                            <XCircle size={10} />
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">
                            <Clock size={10} className="animate-spin" />
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default PaymentHistory;
