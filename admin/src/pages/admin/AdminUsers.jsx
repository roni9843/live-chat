import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Loader2,
  Search,
  ShieldCheck,
  XCircle,
  Users,
  Layout,
  CreditCard,
  Sliders,
  CheckCircle2,
  Globe,
  Settings,
  Trash2,
  X,
  Mail,
  User,
  Shield,
  Clock,
  ToggleLeft,
  ToggleRight,
  UserCheck,
  UserX,
  Edit2,
  Lock
} from "lucide-react";
import useAdminAuthStore from "../../store/adminAuthStore";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

const AdminUsers = () => {
  const { authConfig } = useAdminAuthStore();

  const resolveAvatarUrl = (path) => {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
      return path;
    }
    return `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const [users, setUsers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState("");
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  
  // Filtering states
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Selected merchant modal state
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeTab, setActiveTab] = useState("profile"); // profile, widgets, subscription
  
  // Edit Profile Form States (inside modal)
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [editCanCreate, setEditCanCreate] = useState(false);
  const [editPassword, setEditPassword] = useState("");
  const [savingUser, setSavingUser] = useState(false);

  // Edit Widget Form States
  const [editingWidgetId, setEditingWidgetId] = useState("");
  const [editWidgetCompany, setEditWidgetCompany] = useState("");
  const [editWidgetDomain, setEditWidgetDomain] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersResponse, packagesResponse] = await Promise.all([
        axios.get(
          `${API_URL}/api/admin/users?search=${encodeURIComponent(search)}&limit=150`,
          authConfig()
        ),
        axios.get(
          `${API_URL}/api/subscriptions/admin/packages`,
          authConfig()
        ),
      ]);

      const usersList = usersResponse.data.data || [];
      setUsers(usersList);
      setPackages(packagesResponse.data.data || []);
      
      // If modal is open, refresh selected user data
      if (selectedUser) {
        const refreshed = usersList.find(u => u._id === selectedUser._id);
        if (refreshed) {
          setSelectedUser(refreshed);
        }
      }
    } catch (error) {
      setErrorMsg(
        error.response?.data?.message || "Failed to load merchants data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Open Manage Modal
  const openManageModal = (user) => {
    setSelectedUser(user);
    setEditName(user.name || "");
    setEditEmail(user.email || "");
    setEditRole(user.role || "user");
    setEditCanCreate(user.canCreateWidgets || false);
    setEditPassword("");
    setActiveTab("profile");
    setEditingWidgetId("");
    setMessage("");
    setErrorMsg("");
  };

  // Save Merchant Profile changes
  const handleSaveProfile = async () => {
    if (!selectedUser) return;
    setSavingUser(true);
    setMessage("");
    setErrorMsg("");
    try {
      const payload = {
        name: editName,
        email: editEmail,
        role: editRole,
        canCreateWidgets: editCanCreate
      };
      if (editPassword.trim() !== "") {
        payload.password = editPassword;
      }
      await axios.put(
        `${API_URL}/api/admin/users/${selectedUser._id}`,
        payload,
        authConfig()
      );
      setMessage("Merchant profile updated successfully!");
      await fetchData();
    } catch (error) {
      setErrorMsg(error.response?.data?.message || "Failed to update profile");
    } finally {
      setSavingUser(false);
    }
  };

  // Toggle widget active state
  const handleToggleWidgetActive = async (widgetId, currentActive) => {
    if (!selectedUser) return;
    const updatedWidgets = selectedUser.widgets.map(w => {
      if (w._id === widgetId) {
        return { ...w, isActive: !currentActive };
      }
      return w;
    });

    try {
      await axios.put(
        `${API_URL}/api/admin/users/${selectedUser._id}`,
        { widgets: updatedWidgets },
        authConfig()
      );
      setMessage("Widget status toggled successfully!");
      await fetchData();
    } catch (error) {
      setErrorMsg("Failed to update widget status");
    }
  };

  // Delete widget from merchant
  const handleDeleteWidget = async (widgetId) => {
    if (!window.confirm("Are you sure you want to delete this widget permanently?")) return;
    if (!selectedUser) return;
    const updatedWidgets = selectedUser.widgets.filter(w => w._id !== widgetId);

    try {
      await axios.put(
        `${API_URL}/api/admin/users/${selectedUser._id}`,
        { widgets: updatedWidgets },
        authConfig()
      );
      setMessage("Widget deleted successfully!");
      await fetchData();
    } catch (error) {
      setErrorMsg("Failed to delete widget");
    }
  };

  // Save widget inline edit changes
  const handleSaveWidgetEdit = async (widgetId) => {
    if (!selectedUser) return;
    const updatedWidgets = selectedUser.widgets.map(w => {
      if (w._id === widgetId) {
        return { ...w, companyName: editWidgetCompany, domain: editWidgetDomain };
      }
      return w;
    });

    try {
      await axios.put(
        `${API_URL}/api/admin/users/${selectedUser._id}`,
        { widgets: updatedWidgets },
        authConfig()
      );
      setMessage("Widget settings updated successfully!");
      setEditingWidgetId("");
      await fetchData();
    } catch (error) {
      setErrorMsg("Failed to save widget configurations");
    }
  };

  // Assign Subscription Package
  const assignPackage = async (merchantId, packageId) => {
    if (!packageId) return;
    setAssigningId(merchantId);
    setMessage("");
    setErrorMsg("");

    try {
      await axios.post(
        `${API_URL}/api/subscriptions/admin/assign`,
        {
          merchantId,
          packageId,
          startNow: true,
        },
        authConfig()
      );

      setMessage("Package assigned successfully!");
      await fetchData();
    } catch (error) {
      setErrorMsg(
        error.response?.data?.message || "Failed to assign package"
      );
    } finally {
      setAssigningId("");
    }
  };

  // Cancel Subscription Package
  const cancelSubscription = async (merchantId) => {
    if (!window.confirm("Are you sure you want to cancel this merchant's subscription?")) return;
    setMessage("");
    setErrorMsg("");

    try {
      await axios.patch(
        `${API_URL}/api/subscriptions/admin/merchant/${merchantId}/cancel`,
        {},
        authConfig()
      );

      setMessage("Subscription cancelled successfully.");
      await fetchData();
    } catch (error) {
      setErrorMsg(
        error.response?.data?.message || "Failed to cancel subscription"
      );
    }
  };

  // Delete Merchant User
  const handleDeleteMerchant = async (merchantId) => {
    if (!window.confirm("CAUTION: Deleting this merchant will remove their account, widgets, and history permanently. Continue?")) return;
    setMessage("");
    setErrorMsg("");

    try {
      await axios.delete(
        `${API_URL}/api/admin/users/${merchantId}`,
        authConfig()
      );

      setMessage("Merchant deleted successfully.");
      setSelectedUser(null);
      await fetchData();
    } catch (error) {
      setErrorMsg(
        error.response?.data?.message || "Failed to delete merchant"
      );
    }
  };

  const formatDate = (date) =>
    date ? new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) : "Never";

  // Filtered Users List
  const filteredUsers = users.filter((user) => {
    const isSubActive =
      user.subscription?.status === "active" &&
      user.subscription?.expiresAt &&
      new Date(user.subscription.expiresAt) > new Date();
    
    // Status Filter
    if (statusFilter === "active" && !isSubActive) return false;
    if (statusFilter === "expired" && user.subscription?.status === "expired") return false;
    if (statusFilter === "none" && user.subscription?.status && user.subscription?.status !== "none") return false;

    // Plan Filter
    if (planFilter !== "all") {
      const planName = user.subscription?.packageName?.toLowerCase() || "";
      if (planFilter === "free" && !planName.includes("free")) return false;
      if (planFilter === "premium" && planName.includes("free")) return false;
      if (planFilter === "none" && planName !== "") return false;
    }

    return true;
  });

  // Calculate Metrics
  const totalMerchants = users.length;
  const activeSubs = users.filter(u => 
    u.subscription?.status === "active" &&
    u.subscription?.expiresAt &&
    new Date(u.subscription.expiresAt) > new Date()
  ).length;
  const totalWidgets = users.reduce((acc, curr) => acc + (curr.widgets?.length || 0), 0);
  const totalRevenue = users.reduce((acc, curr) => {
    const isSubActive = curr.subscription?.status === "active" &&
      curr.subscription?.expiresAt &&
      new Date(curr.subscription.expiresAt) > new Date();
    return acc + (isSubActive ? (curr.subscription?.price || 0) : 0);
  }, 0);

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 font-sans">
      <div className="mx-auto max-w-7xl">
        
        {/* Header Section */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Merchants & System Controls
            </h1>
            <p className="mt-2 text-slate-500">
              Manage accounts, configure widget access permissions, inspect live domains, and administer billing plans.
            </p>
          </div>
        </div>

        {/* System Message Notifications */}
        {message && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-emerald-800 shadow-sm transition-all duration-300">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            <div className="font-medium text-sm">{message}</div>
            <button onClick={() => setMessage("")} className="ml-auto text-emerald-600 hover:text-emerald-950">
              <X size={18} />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4 text-rose-800 shadow-sm transition-all duration-300">
            <XCircle size={20} className="text-rose-600 shrink-0" />
            <div className="font-medium text-sm">{errorMsg}</div>
            <button onClick={() => setErrorMsg("")} className="ml-auto text-rose-600 hover:text-rose-950">
              <X size={18} />
            </button>
          </div>
        )}

        {/* Stats Widgets/Metrics */}
        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          
          <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
            <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Merchants</p>
              <h3 className="text-2xl font-bold text-slate-900">{totalMerchants}</h3>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Subs</p>
              <h3 className="text-2xl font-bold text-slate-900">{activeSubs}</h3>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
            <div className="rounded-xl bg-sky-50 p-3 text-sky-600">
              <Layout size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Live Widgets</p>
              <h3 className="text-2xl font-bold text-slate-900">{totalWidgets}</h3>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
            <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
              <CreditCard size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Est. MRR</p>
              <h3 className="text-2xl font-bold text-slate-900">৳{totalRevenue}</h3>
            </div>
          </div>

        </div>

        {/* Filter and Search Controls */}
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex w-full md:max-w-md items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm border border-slate-100 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 transition-all duration-300">
            <Search className="text-slate-400 shrink-0" size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full text-sm text-slate-800 placeholder-slate-400 outline-none"
              placeholder="Search merchant, email, or package..."
            />
          </div>

          <div className="flex w-full md:w-auto items-center gap-3 overflow-x-auto">
            
            {/* Plan Filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-medium text-slate-400">Plan:</span>
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-emerald-500"
              >
                <option value="all">All Plans</option>
                <option value="free">Free Plans</option>
                <option value="premium">Premium Plans</option>
                <option value="none">No Plans Assigned</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-medium text-slate-400">Billing Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-emerald-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="expired">Expired Only</option>
                <option value="none">No Subscriptions</option>
              </select>
            </div>

          </div>
        </div>

        {/* Merchants Data Table */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-100">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center">
              <Loader2 className="animate-spin text-emerald-600" size={36} />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center text-slate-400">
              <Users size={48} className="mb-2 text-slate-300" />
              <p className="text-sm font-semibold">No merchants match your selection.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/75 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Merchant Account</th>
                    <th className="px-6 py-4">Current subscription</th>
                    <th className="px-6 py-4">Expiring Date</th>
                    <th className="px-6 py-4">Live widgets</th>
                    <th className="px-6 py-4">Enrolled Permissions</th>
                    <th className="px-6 py-4 text-right">Controls</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredUsers.map((user) => {
                    const active =
                      user.subscription?.status === "active" &&
                      user.subscription?.expiresAt &&
                      new Date(user.subscription.expiresAt) > new Date();

                    return (
                      <tr key={user._id} className="hover:bg-slate-50/50 transition-colors duration-200">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {user.profilePic ? (
                              <img
                                src={resolveAvatarUrl(user.profilePic)}
                                alt={user.name}
                                className="h-10 w-10 shrink-0 rounded-full object-cover shadow-xs border border-slate-100"
                              />
                            ) : (
                              <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm">
                                {user.name?.charAt(0).toUpperCase() || "M"}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-900 text-sm">
                                {user.name}
                              </div>
                              <div className="text-xs text-slate-400 font-medium">
                                {user.email}
                              </div>
                              {user.belongsTo && (
                                <div className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-150 rounded-lg px-2 py-0.5 mt-1.5 inline-block font-bold whitespace-normal max-w-[280px] leading-tight">
                                  Agent: {user.belongsTo.merchantName} ({user.belongsTo.merchantEmail}) — {user.belongsTo.widgetName}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {active ? (
                              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50"></span>
                            ) : (
                              <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 ring-4 ring-rose-50"></span>
                            )}
                            <div>
                              <div className="font-semibold text-slate-800 text-sm">
                                {user.subscription?.packageName || "None / Default"}
                              </div>
                              <div className="text-xs font-bold text-slate-400 capitalize">
                                {user.subscription?.status || "None"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-500">
                          {formatDate(user.subscription?.expiresAt)}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">
                            <Layout size={12} />
                            {user.widgets?.length || 0} Widgets
                          </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.canCreateWidgets ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                              <UserCheck size={12} />
                              Create Enabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                              <UserX size={12} />
                              Blocked Widget Creation
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <Link
                            to={`/merchants/${user._id}`}
                            className="inline-block rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
                          >
                            Manage Account
                          </Link>
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

      {/* Account Details & Control Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden transform transition-all duration-300">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6">
              <div className="flex items-center gap-3">
                {selectedUser.profilePic ? (
                  <img
                    src={resolveAvatarUrl(selectedUser.profilePic)}
                    alt={selectedUser.name}
                    className="h-12 w-12 rounded-full object-cover shadow-sm border border-slate-100"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-base shadow-sm">
                    {selectedUser.name?.charAt(0).toUpperCase() || "M"}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedUser.name}</h3>
                  <p className="text-xs font-medium text-slate-400">ID: {selectedUser._id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedUser(null)}
                className="rounded-xl bg-white p-2 text-slate-400 hover:text-slate-700 shadow-sm border border-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50/20 px-6">
              <button
                onClick={() => setActiveTab("profile")}
                className={`py-3 px-4 border-b-2 text-sm font-semibold transition-all duration-200 ${
                  activeTab === "profile" 
                    ? "border-emerald-600 text-emerald-700" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Profile & Status
              </button>
              <button
                onClick={() => setActiveTab("widgets")}
                className={`py-3 px-4 border-b-2 text-sm font-semibold transition-all duration-200 ${
                  activeTab === "widgets" 
                    ? "border-emerald-600 text-emerald-700" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Widgets ({selectedUser.widgets?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab("subscription")}
                className={`py-3 px-4 border-b-2 text-sm font-semibold transition-all duration-200 ${
                  activeTab === "subscription" 
                    ? "border-emerald-600 text-emerald-700" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Subscription Details
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="max-h-[50vh] overflow-y-auto p-6">
              
              {/* Tab 1: Profile and Status */}
              {activeTab === "profile" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Full Name</label>
                      <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-white focus-within:border-emerald-500">
                        <User size={16} className="text-slate-400" />
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full text-sm outline-none text-slate-800"
                          placeholder="Merchant full name"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Email Address</label>
                      <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-white focus-within:border-emerald-500">
                        <Mail size={16} className="text-slate-400" />
                        <input
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full text-sm outline-none text-slate-800"
                          placeholder="Email address"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Account Role</label>
                      <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-white focus-within:border-emerald-500">
                        <Shield size={16} className="text-slate-400" />
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="w-full text-sm outline-none text-slate-800 bg-white"
                        >
                          <option value="user">User / Merchant</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Reset Password (Leave blank to keep current)</label>
                      <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-white focus-within:border-emerald-500">
                        <Lock size={16} className="text-slate-400" />
                        <input
                          type="password"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          className="w-full text-sm outline-none text-slate-800"
                          placeholder="Enter new password"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <Clock size={12} />
                    <span>Joined System: {formatDate(selectedUser.createdAt)}</span>
                  </div>

                  {/* Widget Creation Toggle Permissions */}
                  <div className="rounded-2xl bg-slate-50 p-4 flex items-center justify-between border border-slate-100">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Widget Creation Permission</h4>
                      <p className="text-xs text-slate-500">Enable or block this merchant from creating new live chat widgets.</p>
                    </div>
                    <button
                      onClick={() => setEditCanCreate(!editCanCreate)}
                      className="text-slate-600 hover:text-emerald-600 transition-colors"
                    >
                      {editCanCreate ? (
                        <ToggleRight size={38} className="text-emerald-600" />
                      ) : (
                        <ToggleLeft size={38} className="text-slate-300" />
                      )}
                    </button>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                    <button
                      onClick={() => handleDeleteMerchant(selectedUser._id)}
                      className="rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 px-4 py-2.5 text-xs font-bold transition-all"
                    >
                      Delete Merchant Account
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={savingUser}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-xs font-bold shadow-sm disabled:opacity-50 flex items-center gap-2"
                    >
                      {savingUser && <Loader2 size={14} className="animate-spin" />}
                      Save Profile Changes
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 2: Widgets Management */}
              {activeTab === "widgets" && (
                <div className="space-y-4">
                  {selectedUser.widgets?.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Layout size={36} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-sm font-semibold">No live chat widgets created by this merchant.</p>
                    </div>
                  ) : (
                    selectedUser.widgets.map((widget) => {
                      const isEditing = editingWidgetId === widget._id;
                      return (
                        <div 
                          key={widget._id} 
                          className="rounded-2xl border border-slate-200 p-4 bg-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 transition-all duration-200"
                        >
                          <div className="flex-1 space-y-2">
                            {isEditing ? (
                              <div className="space-y-2">
                                <input
                                  value={editWidgetCompany}
                                  onChange={(e) => setEditWidgetCompany(e.target.value)}
                                  className="w-full text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-emerald-500"
                                  placeholder="Company Name"
                                />
                                <input
                                  value={editWidgetDomain}
                                  onChange={(e) => setEditWidgetDomain(e.target.value)}
                                  className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-emerald-500 font-mono"
                                  placeholder="Allowed Domain"
                                />
                              </div>
                            ) : (
                              <div>
                                <h4 className="text-sm font-bold text-slate-800">{widget.companyName || "No Company Name"}</h4>
                                <div className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                  <Globe size={12} />
                                  {widget.domain}
                                </div>
                                <div className="flex gap-2 mt-2">
                                  <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                                    {widget.launcherType || "icon"}
                                  </span>
                                  <span 
                                    className="inline-flex h-4 w-4 rounded-full border border-white"
                                    style={{ backgroundColor: widget.color || "#25D366" }}
                                  ></span>
                                </div>

                                {/* Authorized Agents list sub-section */}
                                <div className="mt-4 pt-3 border-t border-slate-100">
                                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Authorized Agents & Admins</h5>
                                  {!widget.authorizedUsers || widget.authorizedUsers.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No agents or admins authorized for this widget.</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {widget.authorizedUsers.map((auth, idx) => {
                                        const agentProfilePic = auth.profilePic || (auth.user && typeof auth.user === "object" ? auth.user.profilePic : "");
                                        const agentName = auth.nickname || (auth.user && typeof auth.user === "object" ? auth.user.name : "Agent User");
                                        return (
                                          <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                                            <div className="flex items-center gap-2">
                                              {agentProfilePic ? (
                                                <img src={resolveAvatarUrl(agentProfilePic)} className="h-6 w-6 rounded-full object-cover shadow-xs" />
                                              ) : (
                                                <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                                  {(agentName || "A").charAt(0).toUpperCase()}
                                                </div>
                                              )}
                                              <div>
                                                <p className="text-xs font-bold text-slate-700">
                                                  {agentName}
                                                  {auth.designation && <span className="text-[10px] font-medium text-slate-400 ml-1">({auth.designation})</span>}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                  {auth.user && typeof auth.user === "object"
                                                    ? auth.user.email
                                                    : (auth.user && typeof auth.user === "string" ? `ID: ${auth.user}` : "No email linked")
                                                  }
                                                </p>
                                              </div>
                                            </div>
                                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                            auth.role === "admin" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-650"
                                          }`}>
                                            {auth.role}
                                          </span>
                                        </div>
                                      );
                                    })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 self-end md:self-center">
                            
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveWidgetEdit(widget._id)}
                                  className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingWidgetId("")}
                                  className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                {/* Active toggle */}
                                <button
                                  onClick={() => handleToggleWidgetActive(widget._id, widget.isActive !== false)}
                                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                                    widget.isActive !== false
                                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                      : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  }`}
                                >
                                  {widget.isActive !== false ? "Active" : "Disabled"}
                                </button>

                                {/* Edit Button */}
                                <button
                                  onClick={() => {
                                    setEditingWidgetId(widget._id);
                                    setEditWidgetCompany(widget.companyName || "");
                                    setEditWidgetDomain(widget.domain || "");
                                  }}
                                  className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                                  title="Edit Widget Settings"
                                >
                                  <Edit2 size={14} />
                                </button>

                                {/* Trash button */}
                                <button
                                  onClick={() => handleDeleteWidget(widget._id)}
                                  className="rounded-lg border border-rose-100 p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                                  title="Delete Widget"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}

                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tab 3: Subscription details */}
              {activeTab === "subscription" && (
                <div className="space-y-6">
                  
                  {/* Plan Overview */}
                  <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current billing plan</p>
                      <h4 className="text-lg font-extrabold text-slate-900 mt-0.5">
                        {selectedUser.subscription?.packageName || "None / Default Free Plan"}
                      </h4>
                      <p className="text-xs font-bold text-slate-500 mt-1 capitalize">
                        Status: <span className={selectedUser.subscription?.status === "active" ? "text-emerald-600" : "text-rose-500"}>
                          {selectedUser.subscription?.status || "None"}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">Expires: {formatDate(selectedUser.subscription?.expiresAt)}</p>
                    </div>

                    <button
                      onClick={() => cancelSubscription(selectedUser._id)}
                      disabled={selectedUser.subscription?.status !== "active"}
                      className="rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 px-4 py-2.5 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel Subscription Plan
                    </button>
                  </div>

                  {/* Assign Plan Form */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-2">Assign / Upgrade Plan</h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <select
                        defaultValue=""
                        disabled={assigningId === selectedUser._id}
                        onChange={(event) =>
                          assignPackage(
                            selectedUser._id,
                            event.target.value
                          )
                        }
                        className="w-full sm:flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 bg-white"
                      >
                        <option value="">Select a system package</option>
                        {packages
                          .filter((item) => item.isActive)
                          .map((item) => (
                            <option
                              key={item._id}
                              value={item._id}
                            >
                              {item.name} — ৳{item.price} ({item.durationValue} {item.durationUnit})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Current Plan features snapshot list */}
                  {selectedUser.subscription?.featuresSnapshot && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Plan features checklist</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          <span>Max widgets: {selectedUser.subscription.featuresSnapshot.maxWidgets || 0}</span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          <span>Max agents/widget: {selectedUser.subscription.featuresSnapshot.maxAgentsPerWidget || 0}</span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          {selectedUser.subscription.featuresSnapshot.canUseVoiceMessage ? (
                            <CheckCircle2 size={14} className="text-emerald-500" />
                          ) : (
                            <XCircle size={14} className="text-slate-300" />
                          )}
                          <span>Voice Notes</span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          {selectedUser.subscription.featuresSnapshot.canUploadFiles ? (
                            <CheckCircle2 size={14} className="text-emerald-500" />
                          ) : (
                            <XCircle size={14} className="text-slate-300" />
                          )}
                          <span>File Attachments</span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          {selectedUser.subscription.featuresSnapshot.canUseDirectMessage ? (
                            <CheckCircle2 size={14} className="text-emerald-500" />
                          ) : (
                            <XCircle size={14} className="text-slate-300" />
                          )}
                          <span>Direct Messaging</span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          {selectedUser.subscription.featuresSnapshot.canUseGroupChat ? (
                            <CheckCircle2 size={14} className="text-emerald-500" />
                          ) : (
                            <XCircle size={14} className="text-slate-300" />
                          )}
                          <span>Group Chats</span>
                        </div>

                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 bg-slate-50/50 p-6 flex justify-end gap-3">
              <button
                onClick={() => setSelectedUser(null)}
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-5 py-2.5 text-xs font-bold text-slate-700 transition-all duration-200"
              >
                Close Control Panel
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default AdminUsers;
