import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import {
  Loader2,
  ShieldCheck,
  XCircle,
  Layout,
  CreditCard,
  Globe,
  Trash2,
  Mail,
  User,
  Shield,
  Clock,
  ToggleLeft,
  ToggleRight,
  ArrowLeft,
  Lock,
  CheckCircle2,
  MessageSquare,
  X,
  Share2
} from "lucide-react";
import useAdminAuthStore from "../../store/adminAuthStore";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

const MerchantDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { authConfig } = useAdminAuthStore();

  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [packages, setPackages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [belongsTo, setBelongsTo] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [shareWidget, setShareWidget] = useState(null);
  const [activeTab, setActiveTab] = useState("profile"); // profile, widgets, subscription, chats
  
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [assigningId, setAssigningId] = useState("");

  // Edit Profile Form States
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

  const resolveAvatarUrl = (path) => {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
      return path;
    }
    return `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const fetchMerchantDetails = async () => {
    setLoading(true);
    try {
      const [userResponse, packagesResponse] = await Promise.all([
        axios.get(`${API_URL}/api/admin/users/${id}`, authConfig()),
        axios.get(`${API_URL}/api/subscriptions/admin/packages`, authConfig())
      ]);

      const user = userResponse.data.data;
      const chatSessions = userResponse.data.sessions || [];
      const parentInfo = userResponse.data.belongsTo || null;
      setSelectedUser(user);
      setSessions(chatSessions);
      setBelongsTo(parentInfo);
      setPackages(packagesResponse.data.data || []);
      
      // Initialize edit fields
      setEditName(user.name || "");
      setEditEmail(user.email || "");
      setEditRole(user.role || "user");
      setEditCanCreate(user.canCreateWidgets || false);
      setEditPassword("");
    } catch (error) {
      setErrorMsg(error.response?.data?.message || "Failed to load merchant details");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChatConversation = async (sessionId) => {
    setSelectedSessionId(sessionId);
    setLoadingMessages(true);
    try {
      const response = await axios.get(`${API_URL}/api/admin/sessions/${sessionId}/messages`, authConfig());
      setChatMessages(response.data.data || []);
    } catch (err) {
      console.error("Failed to load conversation", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchMerchantDetails();
  }, [id]);

  // Save Merchant Profile changes
  const handleSaveProfile = async () => {
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
        `${API_URL}/api/admin/users/${id}`,
        payload,
        authConfig()
      );
      setMessage("Merchant profile updated successfully!");
      
      // Refresh details
      const response = await axios.get(`${API_URL}/api/admin/users/${id}`, authConfig());
      setSelectedUser(response.data.data);
      setEditPassword("");
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
        `${API_URL}/api/admin/users/${id}`,
        { widgets: updatedWidgets },
        authConfig()
      );
      setMessage("Widget status toggled successfully!");
      // Refresh local widgets state
      setSelectedUser({ ...selectedUser, widgets: updatedWidgets });
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
        `${API_URL}/api/admin/users/${id}`,
        { widgets: updatedWidgets },
        authConfig()
      );
      setMessage("Widget deleted successfully!");
      setSelectedUser({ ...selectedUser, widgets: updatedWidgets });
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
        `${API_URL}/api/admin/users/${id}`,
        { widgets: updatedWidgets },
        authConfig()
      );
      setMessage("Widget settings updated successfully!");
      setEditingWidgetId("");
      setSelectedUser({ ...selectedUser, widgets: updatedWidgets });
    } catch (error) {
      setErrorMsg("Failed to save widget configurations");
    }
  };

  // Assign Subscription Package
  const assignPackage = async (packageId) => {
    if (!packageId) return;
    setAssigningId(id);
    setMessage("");
    setErrorMsg("");

    try {
      await axios.post(
        `${API_URL}/api/subscriptions/admin/assign`,
        {
          merchantId: id,
          packageId,
          startNow: true,
        },
        authConfig()
      );

      setMessage("Package assigned successfully!");
      // Refresh details
      const response = await axios.get(`${API_URL}/api/admin/users/${id}`, authConfig());
      setSelectedUser(response.data.data);
    } catch (error) {
      setErrorMsg(
        error.response?.data?.message || "Failed to assign package"
      );
    } finally {
      setAssigningId("");
    }
  };

  // Cancel Subscription Package
  const cancelSubscription = async () => {
    if (!window.confirm("Are you sure you want to cancel this merchant's subscription?")) return;
    setMessage("");
    setErrorMsg("");

    try {
      await axios.patch(
        `${API_URL}/api/subscriptions/admin/merchant/${id}/cancel`,
        {},
        authConfig()
      );

      setMessage("Subscription cancelled successfully.");
      // Refresh details
      const response = await axios.get(`${API_URL}/api/admin/users/${id}`, authConfig());
      setSelectedUser(response.data.data);
    } catch (error) {
      setErrorMsg(
        error.response?.data?.message || "Failed to cancel subscription"
      );
    }
  };

  // Delete Merchant User
  const handleDeleteMerchant = async () => {
    if (!window.confirm("CAUTION: Deleting this merchant will remove their account, widgets, and history permanently. Continue?")) return;
    setMessage("");
    setErrorMsg("");

    try {
      await axios.delete(
        `${API_URL}/api/admin/users/${id}`,
        authConfig()
      );

      navigate("/");
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="animate-spin text-emerald-600 mx-auto mb-3" size={40} />
          <p className="text-sm font-semibold text-slate-500">Loading merchant details workspace...</p>
        </div>
      </div>
    );
  }

  if (!selectedUser) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-center">
          <XCircle size={48} className="text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900">Merchant Not Found</h2>
          <p className="text-sm text-slate-500 mt-2">The merchant may have been deleted or the ID is invalid.</p>
          <Link to="/" className="inline-flex items-center gap-2 mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800">
            <ArrowLeft size={14} />
            Back to Merchants list
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 font-sans">
      <div className="mx-auto max-w-4xl">
        
        {/* Navigation & Back Button */}
        <div className="mb-6">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Merchants list
          </Link>
        </div>

        {/* Merchant Workspace Profile Banner */}
        <div className="mb-8 rounded-3xl bg-white p-6 shadow-xs border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-center gap-4">
            {selectedUser.profilePic ? (
              <img
                src={resolveAvatarUrl(selectedUser.profilePic)}
                alt={selectedUser.name}
                className="h-16 w-16 rounded-full object-cover shadow-sm border border-slate-100"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xl shadow-xs">
                {selectedUser.name?.charAt(0).toUpperCase() || "M"}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">{selectedUser.name}</h1>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">{selectedUser.email}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  selectedUser.subscription?.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                }`}>
                  Billing: {selectedUser.subscription?.status || "None"}
                </span>
                <span className="text-[10px] font-extrabold uppercase bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">
                  {selectedUser.widgets?.length || 0} Widgets
                </span>
                {belongsTo && (
                  <span className="text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-150 px-3 py-1 rounded-full whitespace-normal max-w-full sm:max-w-md leading-tight inline-block text-left">
                    Agent: {belongsTo.merchantName} ({belongsTo.merchantEmail}) — {belongsTo.widgetName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={handleDeleteMerchant}
              className="rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 px-4 py-2.5 text-xs font-bold transition-all"
            >
              Delete Account
            </button>
          </div>
        </div>

        {/* System Message Feedback */}
        {message && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-emerald-800 shadow-xs">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <div className="font-medium text-xs">{message}</div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4 text-rose-800 shadow-xs">
            <XCircle size={18} className="text-rose-600 shrink-0" />
            <div className="font-medium text-xs">{errorMsg}</div>
          </div>
        )}

        {/* Tab Selection */}
        <div className="mb-6 flex border-b border-slate-200 overflow-x-auto whitespace-nowrap scrollbar-none">
          <button
            onClick={() => setActiveTab("profile")}
            className={`py-3 px-6 border-b-2 text-sm font-bold transition-all duration-200 shrink-0 ${
              activeTab === "profile" 
                ? "border-emerald-600 text-emerald-700" 
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Profile & Controls
          </button>
          <button
            onClick={() => setActiveTab("widgets")}
            className={`py-3 px-6 border-b-2 text-sm font-bold transition-all duration-200 shrink-0 ${
              activeTab === "widgets" 
                ? "border-emerald-600 text-emerald-700" 
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Widgets ({selectedUser.widgets?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("subscription")}
            className={`py-3 px-6 border-b-2 text-sm font-bold transition-all duration-200 shrink-0 ${
              activeTab === "subscription" 
                ? "border-emerald-600 text-emerald-700" 
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Subscription Snapshot
          </button>
          <button
            onClick={() => setActiveTab("chats")}
            className={`py-3 px-6 border-b-2 text-sm font-bold transition-all duration-200 shrink-0 ${
              activeTab === "chats" 
                ? "border-emerald-600 text-emerald-700" 
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Chat Sessions ({sessions.length})
          </button>
        </div>

        {/* Workspace Panels */}
        <div className="rounded-3xl bg-white p-6 shadow-xs border border-slate-100">
          
          {/* Tab 1: Profile & Controls */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              
              <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">Merchant Info Workspace</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Full Name</label>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-white focus-within:border-emerald-500">
                    <User size={16} className="text-slate-400" />
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full text-sm outline-none text-slate-800"
                      placeholder="Merchant name"
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
                <span>Account Joined: {formatDate(selectedUser.createdAt)}</span>
              </div>

              {/* Widget Creation Toggle Permissions */}
              <div className="rounded-2xl bg-slate-50 p-4 flex items-center justify-between border border-slate-100">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Allow Widget Creation</h4>
                  <p className="text-xs text-slate-500">Enable or block this merchant from creating new live chat widgets.</p>
                </div>
                <button
                  onClick={() => setEditCanCreate(!editCanCreate)}
                  className="text-slate-650 hover:text-emerald-600 transition-colors"
                >
                  {editCanCreate ? (
                    <ToggleRight size={38} className="text-emerald-600" />
                  ) : (
                    <ToggleLeft size={38} className="text-slate-300" />
                  )}
                </button>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  onClick={handleSaveProfile}
                  disabled={savingUser}
                  className="rounded-xl bg-emerald-650 hover:bg-emerald-700 text-white px-5 py-2.5 text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-2"
                >
                  {savingUser && <Loader2 size={14} className="animate-spin" />}
                  Save Profile Changes
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Widgets Workspace */}
          {activeTab === "widgets" && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">Widgets List & Configurations</h3>

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

                            {/* Share Button */}
                            <button
                              onClick={() => setShareWidget(widget)}
                              className="rounded-lg border border-slate-200 p-1.5 text-indigo-650 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200"
                              title="Share Widget Integration"
                            >
                              <Share2 className="h-3.5 w-3.5" />
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
                              <User className="h-3.5 w-3.5" />
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
              
              <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">Plan Details Overview</h3>

              {/* Plan Overview */}
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current active billing plan</p>
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
                  onClick={cancelSubscription}
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
                    disabled={assigningId === id}
                    onChange={(event) => assignPackage(event.target.value)}
                    className="w-full sm:flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 bg-white"
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
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">Plan features checklist</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    
                    <div className="flex items-center gap-2 text-xs text-slate-650">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span>Max widgets: {selectedUser.subscription.featuresSnapshot.maxWidgets || 0}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-655">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span>Max agents/widget: {selectedUser.subscription.featuresSnapshot.maxAgentsPerWidget || 0}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-655">
                      {selectedUser.subscription.featuresSnapshot.canUseVoiceMessage ? (
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      ) : (
                        <XCircle size={14} className="text-slate-300" />
                      )}
                      <span>Voice Notes Support</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-655">
                      {selectedUser.subscription.featuresSnapshot.canUploadFiles ? (
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      ) : (
                        <XCircle size={14} className="text-slate-300" />
                      )}
                      <span>File Attachments</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-655">
                      {selectedUser.subscription.featuresSnapshot.canUseDirectMessage ? (
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      ) : (
                        <XCircle size={14} className="text-slate-300" />
                      )}
                      <span>Direct Messaging</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-655">
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

          {/* Tab 4: Chat History & Sessions */}
          {activeTab === "chats" && (
            <div className="space-y-6">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Widget Chat Analytics</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Summary of total support chat sessions per widget.</p>
                </div>
              </div>

              {/* Summary Cards of Chats per Widget */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {selectedUser.widgets?.map((widget) => {
                  const widgetSessions = sessions.filter(s => s.widgetId === widget._id);
                  const activeCount = widgetSessions.filter(s => s.status === "active").length;
                  const closedCount = widgetSessions.filter(s => s.status === "closed").length;
                  return (
                    <div key={widget._id} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                      <h4 className="text-xs font-bold text-slate-700 truncate">{widget.companyName}</h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{widget.domain}</p>
                      
                      <div className="mt-4 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Total Chats:</span>
                        <span className="font-extrabold text-slate-800">{widgetSessions.length}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="text-emerald-600 font-medium">Continuing: {activeCount}</span>
                        <span className="text-slate-400 font-medium">Ended: {closedCount}</span>
                      </div>
                    </div>
                  );
                })}

                {/* Group Chat & Direct Messages summary counts */}
                {(() => {
                  const dmSessions = sessions.filter(s => s.isDirectMessage);
                  const activeDm = dmSessions.filter(s => s.status === "active").length;
                  if (dmSessions.length > 0) {
                    return (
                      <div className="rounded-2xl border border-slate-200 bg-sky-50/20 p-4">
                        <h4 className="text-xs font-bold text-sky-850">Direct Messages (DMs)</h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">Agent to Agent / Client DMs</p>
                        
                        <div className="mt-4 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">Total Chats:</span>
                          <span className="font-extrabold text-slate-800">{dmSessions.length}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="text-emerald-600 font-medium">Continuing: {activeDm}</span>
                          <span className="text-slate-400 font-medium">Ended: {dmSessions.length - activeDm}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {(() => {
                  const groupSessions = sessions.filter(s => s.isGroupChat);
                  const activeGroups = groupSessions.filter(s => s.status === "active").length;
                  if (groupSessions.length > 0) {
                    return (
                      <div className="rounded-2xl border border-slate-200 bg-indigo-50/20 p-4">
                        <h4 className="text-xs font-bold text-indigo-850">Group Chats</h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">Multi-agent rooms</p>
                        
                        <div className="mt-4 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">Total Chats:</span>
                          <span className="font-extrabold text-slate-800">{groupSessions.length}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="text-emerald-600 font-medium">Continuing: {activeGroups}</span>
                          <span className="text-slate-400 font-medium">Ended: {groupSessions.length - activeGroups}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Sessions List Details Table */}
              <div className="border-t border-slate-100 pt-6">
                <h4 className="text-sm font-bold text-slate-800 mb-3">Live Chat Sessions List</h4>
                
                {sessions.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <MessageSquare size={36} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-semibold">No active or closed chat sessions found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-100 text-left">
                      <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Visitor / Chat Room</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Source Widget</th>
                          <th className="px-4 py-3">Assigned Agent</th>
                          <th className="px-4 py-3">Last Message</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white text-xs">
                        {sessions.map((s) => {
                          const widgetObj = selectedUser.widgets?.find(w => w._id === s.widgetId);
                          const widgetName = widgetObj?.companyName || s.source || "Website Chat";
                          const widgetDomain = widgetObj?.domain || s.visitorDomain || "";
                          
                          // Resolve Type display and styling
                          let typeLabel = "Client Session";
                          let typeStyle = "bg-emerald-50 text-emerald-700";
                          let roomLabel = s.visitorName || "Guest Visitor";
                          let roomDetail = s.visitorEmail || s.visitorDomain || "No email";

                          if (s.isGroupChat) {
                            typeLabel = "Group Chat";
                            typeStyle = "bg-indigo-50 text-indigo-700";
                            roomLabel = s.groupName || "Unnamed Group";
                            roomDetail = `${s.participants?.length || 0} participants`;
                          } else if (s.isDirectMessage) {
                            typeLabel = "Direct Message";
                            typeStyle = "bg-sky-50 text-sky-700";
                            
                            // Try to get other DM participant nickname or name
                            const otherParticipant = s.dmParticipants?.find(p => p.userId !== id);
                            roomLabel = otherParticipant?.name || "Direct Message";
                            roomDetail = otherParticipant?.email || "Agent DM";
                          }

                          return (
                            <tr key={s._id} onClick={() => handleOpenChatConversation(s._id)} className="hover:bg-slate-100/80 cursor-pointer transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-800">{roomLabel}</div>
                                <div className="text-[10px] text-slate-400 font-medium mt-0.5">{roomDetail}</div>
                              </td>
                              
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${typeStyle}`}>
                                  {typeLabel}
                                </span>
                              </td>

                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-700">{widgetName}</div>
                                {widgetDomain && widgetDomain !== "Unknown" && (
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{widgetDomain}</div>
                                )}
                              </td>

                              <td className="px-4 py-3 text-slate-600 font-medium">
                                {s.assignedAgent?.name || s.assignedAgentName || (
                                  <span className="text-slate-400 italic">Unassigned</span>
                                )}
                              </td>

                              <td className="px-4 py-3 max-w-[200px]">
                                <div className="truncate text-slate-700 font-medium" title={s.lastMessage}>
                                  {s.lastMessage || <span className="text-slate-400 italic">No messages sent</span>}
                                </div>
                                <div className="text-[9px] text-slate-400 mt-0.5">{formatDate(s.lastMessageAt)}</div>
                              </td>

                              <td className="px-4 py-3">
                                {s.status === "active" ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                                    Continuing
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-650">
                                    Ended
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
          )}

        </div>

      </div>

      {/* Slide-over Conversation Viewer Panel */}
      <div className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ${
        selectedSessionId ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}>
        
        {/* Backdrop overlay */}
        <div className="absolute inset-0 bg-black/45 backdrop-blur-xs transition-opacity duration-300" onClick={() => setSelectedSessionId(null)}></div>
        
        {/* Sliding Panel */}
        <div className={`relative w-full max-w-md bg-[#efeae2] h-full shadow-2xl flex flex-col border-l border-slate-200 transition-transform duration-300 ease-out transform ${
          selectedSessionId ? "translate-x-0" : "translate-x-full"
        }`}>
          
          {/* Panel Header (WhatsApp Style) */}
          <div className="flex items-center justify-between border-b border-[#e9edef] bg-[#f0f2f5] px-4 py-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                {(() => {
                  const activeSessionObj = sessions.find(s => s._id === selectedSessionId);
                  const name = activeSessionObj?.isGroupChat 
                    ? activeSessionObj.groupName 
                    : (activeSessionObj?.isDirectMessage 
                        ? activeSessionObj.dmParticipants?.find(p => p.userId !== id)?.name 
                        : activeSessionObj?.visitorName);
                  return (name || "C").charAt(0).toUpperCase();
                })()}
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#111b21]">
                  {(() => {
                    const activeSessionObj = sessions.find(s => s._id === selectedSessionId);
                    if (activeSessionObj?.isGroupChat) return activeSessionObj.groupName || "Group Chat";
                    if (activeSessionObj?.isDirectMessage) {
                      const other = activeSessionObj.dmParticipants?.find(p => p.userId !== id);
                      return other?.name || "Direct Message";
                    }
                    return activeSessionObj?.visitorName || "Chat Session Detail";
                  })()}
                </h3>
                <p className="text-[10px] text-[#667781] font-medium">Session ID: {selectedSessionId}</p>
              </div>
            </div>
            <button 
              onClick={() => setSelectedSessionId(null)}
              className="rounded-lg hover:bg-slate-200/60 p-1.5 text-[#54656f] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Panel Body / Messages scroll list (WhatsApp Chat Room layout) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingMessages ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="animate-spin text-[#00a884]" size={28} />
              </div>
            ) : chatMessages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-slate-400 text-xs text-center p-6 bg-white/70 rounded-2xl m-4 border border-slate-100">
                <MessageSquare size={32} className="mb-2 text-slate-350 mx-auto" />
                <p className="font-semibold text-slate-500">No messages found in this chat room.</p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isVisitor = msg.sender === "visitor";
                const isSystem = msg.sender === "system";
                
                // Message alignments and styles
                let msgContainerClass = "flex justify-end";
                let msgBubbleClass = "bg-[#d9fdd3] text-[#111b21] rounded-2xl rounded-tr-none shadow-xs border border-[#e1f7db]";
                let senderNameClass = "text-[#008069]"; // Dark Teal name for Agent side
                
                if (isVisitor) {
                  msgContainerClass = "flex justify-start";
                  msgBubbleClass = "bg-white text-[#111b21] border border-[#e9edef] rounded-2xl rounded-tl-none shadow-xs";
                  senderNameClass = "text-[#128c7e]"; // Deep green/blue name for Visitor side
                } else if (isSystem) {
                  msgContainerClass = "flex justify-center";
                  msgBubbleClass = "bg-[#ffe596]/30 text-[#111b21] text-[10px] py-1 px-3.5 rounded-lg font-medium shadow-2xs text-center border border-[#ffe596]/50 italic";
                }

                // Determine content rendering (text vs image vs voice vs file)
                const isImage = msg.fileUrl && (
                  msg.fileType?.startsWith("image/") ||
                  msg.fileUrl.match(/\.(jpeg|jpg|gif|png|webp)/i)
                );

                const isVoice = msg.fileUrl && (
                  msg.fileType?.startsWith("audio/") ||
                  msg.fileUrl.match(/\.(mp3|wav|ogg|m4a|aac)/i)
                );

                return (
                  <div key={msg._id} className={msgContainerClass}>
                    <div className={`max-w-[82%] px-3 py-2 shadow-xs ${msgBubbleClass}`}>
                      
                      {/* Sender Name with High Contrast Combination */}
                      {!isSystem && (
                        <span className={`text-[10px] font-bold ${senderNameClass} mb-1 block tracking-wide`}>
                          {isVisitor ? "Visitor" : (msg.senderName || "Agent")}
                        </span>
                      )}

                      {/* Content text */}
                      {msg.content && <p className="text-xs break-words leading-relaxed whitespace-pre-wrap text-[#111b21]">{msg.content}</p>}

                      {/* Image media rendering */}
                      {isImage && (
                        <div className="mt-1.5 rounded-lg overflow-hidden border border-slate-100 bg-[#f8f9fa]">
                          <a href={resolveAvatarUrl(msg.fileUrl)} target="_blank" rel="noopener noreferrer">
                            <img 
                              src={resolveAvatarUrl(msg.fileUrl)} 
                              className="max-w-full max-h-48 object-contain hover:opacity-95 transition-opacity" 
                              alt="Shared file"
                            />
                          </a>
                        </div>
                      )}

                      {/* Voice message player rendering */}
                      {isVoice && (
                        <div className="mt-1.5 py-1">
                          <audio 
                            controls 
                            src={resolveAvatarUrl(msg.fileUrl)} 
                            className="max-w-full scale-90 origin-left"
                          />
                        </div>
                      )}

                      {/* Document download link rendering */}
                      {msg.fileUrl && !isImage && !isVoice && (
                        <div className="mt-1.5 flex items-center gap-2 bg-[#f8f9fa] p-2 rounded-xl border border-slate-150 text-slate-800 text-xs">
                          <Globe size={15} className="text-slate-450 shrink-0" />
                          <a 
                            href={resolveAvatarUrl(msg.fileUrl)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-bold underline hover:text-[#008069] truncate"
                          >
                            Download Attachment
                          </a>
                        </div>
                      )}

                      {/* Message timestamp */}
                      {!isSystem && (
                        <div className="text-[9px] text-right mt-1 text-[#667781] font-medium">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}

                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>

      {/* Share Widget Integration Modal */}
      {shareWidget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4">
          <div className="absolute inset-0" onClick={() => setShareWidget(null)}></div>
          
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 flex flex-col gap-5 transform transition-all">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Share Chat Widget</h3>
                <p className="text-xs text-slate-400 mt-0.5">{shareWidget.companyName}</p>
              </div>
              <button 
                onClick={() => setShareWidget(null)}
                className="rounded-lg bg-slate-50 p-1.5 text-slate-400 hover:text-slate-700 border border-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            {/* Direct Link Section */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 block">Direct Chat URL</label>
              <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 rounded-xl px-3 py-2">
                <input
                  readOnly
                  value={`${import.meta.env.VITE_WIDGET_URL || "http://localhost:5173"}/?merchant=${id}&widget=${shareWidget._id}`}
                  className="w-full text-xs font-mono bg-transparent outline-none text-slate-600 select-all"
                  id="share-direct-url"
                />
                <button
                  onClick={() => {
                    const val = `${import.meta.env.VITE_WIDGET_URL || "http://localhost:5173"}/?merchant=${id}&widget=${shareWidget._id}`;
                    navigator.clipboard.writeText(val);
                    alert("Direct chat link copied to clipboard!");
                  }}
                  className="rounded-lg bg-emerald-50 border border-emerald-150 px-2.5 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Script Code Section */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 block">Website Script Code (HTML)</label>
              <div className="flex flex-col gap-2 border border-slate-200 bg-slate-50 rounded-xl p-3">
                <textarea
                  readOnly
                  rows={3}
                  value={`<script src="${import.meta.env.VITE_WIDGET_SCRIPT_URL || `${import.meta.env.VITE_WIDGET_URL || "http://localhost:5173"}/assets/widget.js`}" data-merchant="${id}" data-widget="${shareWidget._id}" async></script>`}
                  className="w-full text-[10px] font-mono bg-transparent outline-none text-slate-650 resize-none select-all"
                  id="share-script-code"
                />
                <button
                  onClick={() => {
                    const val = `<script src="${import.meta.env.VITE_WIDGET_SCRIPT_URL || `${import.meta.env.VITE_WIDGET_URL || "http://localhost:5173"}/assets/widget.js`}" data-merchant="${id}" data-widget="${shareWidget._id}" async></script>`;
                    navigator.clipboard.writeText(val);
                    alert("Website integration script code copied!");
                  }}
                  className="rounded-lg bg-emerald-50 border border-emerald-150 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 self-end"
                >
                  Copy Script Code
                </button>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                Copy and paste this script tag right before the closing <code className="bg-slate-100 px-1 py-0.5 rounded">&lt;/body&gt;</code> tag of the website HTML.
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default MerchantDetails;
