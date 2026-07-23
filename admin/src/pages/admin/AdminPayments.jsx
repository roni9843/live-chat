import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  CreditCard,
  Search,
  Loader2,
  RefreshCw,
  CalendarDays,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const AdminPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");

  const getAdminToken = () => {
    try {
      const adminData = JSON.parse(
        localStorage.getItem("ochatAdmin") ||
        localStorage.getItem("superAdminUser")
      );
      return adminData?.token || "";
    } catch (e) {
      console.error("Admin token parse error:", e);
      return "";
    }
  };

  const getAuthConfig = () => {
    const token = getAdminToken();
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  const fetchPayments = async ({ showMainLoader = false, showRefreshLoader = false } = {}) => {
    if (showMainLoader) setLoading(true);
    if (showRefreshLoader) setRefreshing(true);
    setError("");

    try {
      const response = await axios.get(
        `${API_URL}/api/subscriptions/admin/history`,
        getAuthConfig()
      );
      if (response.data?.success) {
        setPayments(response.data.data || []);
      } else {
        setError("Failed to load payments history");
      }
    } catch (e) {
      console.error("Fetch payments error:", e);
      setError(e.response?.data?.message || e.message || "Failed to load payment logs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPayments({ showMainLoader: true });
  }, []);

  const filteredPayments = payments.filter((payment) => {
    const merchantName = payment.merchant?.name?.toLowerCase() || "";
    const merchantEmail = payment.merchant?.email?.toLowerCase() || "";
    const invoiceNum = payment.invoiceNumber?.toLowerCase() || "";
    const txId = payment.transactionId?.toLowerCase() || "";
    const packName = payment.packageName?.toLowerCase() || "";
    const query = search.toLowerCase().trim();

    const matchesSearch =
      merchantName.includes(query) ||
      merchantEmail.includes(query) ||
      invoiceNum.includes(query) ||
      txId.includes(query) ||
      packName.includes(query);

    const matchesStatus =
      statusFilter === "all" || payment.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalRevenue = payments
    .filter(p => p.status === "COMPLETED")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CreditCard className="text-emerald-600" />
            Payment & Transaction Logs
          </h1>
          <p className="text-sm text-slate-500">
            View and audit subscription billing records across all OChat merchants
          </p>
        </div>

        <button
          onClick={() => fetchPayments({ showRefreshLoader: true })}
          disabled={refreshing || loading}
          className="self-start md:self-auto flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Revenue Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
            Total Revenue
          </div>
          <div className="text-3xl font-extrabold text-emerald-950">
            {totalRevenue.toLocaleString()} <span className="text-lg font-bold">BDT</span>
          </div>
          <div className="text-xs text-emerald-700 mt-2">
            Accumulated from completed packages transactions
          </div>
        </div>

        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            Successful Payments
          </div>
          <div className="text-3xl font-extrabold text-slate-800">
            {payments.filter(p => p.status === "COMPLETED").length}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Completed packages billing events
          </div>
        </div>

        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            Pending / Fails
          </div>
          <div className="text-3xl font-extrabold text-slate-800">
            {payments.filter(p => p.status !== "COMPLETED").length}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Incomplete checkout processes
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-xs">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search merchant, invoice, package, transaction..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
          />
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-44 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="COMPLETED">Completed Only</option>
            <option value="PENDING">Pending Only</option>
            <option value="FAILED">Failed Only</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-2">
          <AlertCircle size={20} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500">
            <Loader2 size={36} className="animate-spin text-emerald-600 mb-3" />
            <span>Loading transaction logs...</span>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            <FileSpreadsheet size={48} className="mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-slate-700">No payment logs found</p>
            <p className="text-sm text-slate-500 mt-1">Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Billing Date</th>
                  <th className="px-6 py-4">Invoice #</th>
                  <th className="px-6 py-4">Merchant</th>
                  <th className="px-6 py-4">Package</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Transaction Details</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredPayments.map((payment) => {
                  const dateFormatted = new Date(payment.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  });

                  return (
                    <tr key={payment._id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                          <CalendarDays size={14} />
                          {dateFormatted}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs font-bold text-slate-900">
                        {payment.invoiceNumber}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">
                          {payment.merchant?.name || "Deleted Merchant"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {payment.merchant?.email || ""}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-slate-800">{payment.packageName}</span>
                        <div className="text-[10px] text-slate-500 capitalize">
                          {payment.durationValue} {payment.durationUnit}(s)
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
                        {payment.amount} <span className="text-[10px] text-slate-400">BDT</span>
                      </td>
                      <td className="px-6 py-4">
                        {payment.transactionId ? (
                          <div className="space-y-0.5">
                            <div className="text-xs font-mono font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                              ID: {payment.transactionId}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Via: <span className="font-bold text-slate-700 uppercase">{payment.bank || "N/A"}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">No payout details</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {payment.status === "COMPLETED" ? (
                          <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full text-xs font-bold">
                            <CheckCircle2 size={12} />
                            Completed
                          </span>
                        ) : payment.status === "FAILED" ? (
                          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full text-xs font-bold">
                            <XCircle size={12} />
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-bold">
                            <Loader2 size={12} className="animate-spin" />
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPayments;
