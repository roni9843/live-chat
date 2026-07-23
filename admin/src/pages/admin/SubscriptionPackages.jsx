import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Check,
  Edit3,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
  Sparkles,
  Radio,
  CheckCircle2,
  Layers,
  Users,
  PhoneCall,
  Video,
  MessageSquare,
  Sliders,
  ShieldCheck,
  Clock
} from "lucide-react";
import useAdminAuthStore from "../../store/adminAuthStore";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://jh5nng6t-5000.asse.devtunnels.ms";

const defaultFeatures = {
  canCreateWidgets: true,
  maxWidgets: 1,
  canAddAgents: false,
  maxAgentsPerWidget: 0,
  canUseAudioCall: false,
  canUseVideoCall: false,
  canUseFaq: true,
  canUsePreChatForm: true,
  canUseOfflineForm: true,
  canCustomizeWidget: true,
  canUseLiveTracking: true,
};

const emptyForm = {
  name: "",
  description: "",
  price: "",
  durationValue: 1,
  durationUnit: "month",
  isActive: true,
  sortOrder: 0,
  features: defaultFeatures,
};

const booleanFeatures = [
  { key: "canCreateWidgets", label: "Create Chat Widgets", icon: Layers, desc: "Allow creating widgets" },
  { key: "canAddAgents", label: "Add Agents / Admins", icon: Users, desc: "Invite team members" },
  { key: "canUseLiveTracking", label: "Live Visitor Radar / Tracking", icon: Radio, desc: "Real-time traffic scanner" },
  { key: "canUseAudioCall", label: "Audio Calling", icon: PhoneCall, desc: "1-on-1 audio calls" },
  { key: "canUseVideoCall", label: "Video Calling", icon: Video, desc: "1-on-1 video calls" },
  { key: "canCustomizeWidget", label: "Widget Customization", icon: Sliders, desc: "Colors, position, logo" },
  { key: "canUseFaq", label: "Widget FAQ", icon: MessageSquare, desc: "Quick answer bot" },
  { key: "canUsePreChatForm", label: "Pre-Chat Form", icon: ShieldCheck, desc: "Collect visitor info first" },
  { key: "canUseOfflineForm", label: "Offline Form", icon: Clock, desc: "Offline ticketing" },
];

const SubscriptionPackages = () => {
  const { authConfig } = useAdminAuthStore();

  const [packages, setPackages] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const endpoint = `${API_URL}/api/subscriptions/admin/packages`;

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(endpoint, authConfig());
      setPackages(data.data || []);
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Failed to load packages"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (item) => {
    setEditingId(item._id);
    setForm({
      name: item.name || "",
      description: item.description || "",
      price: item.price ?? "",
      durationValue: item.durationValue || 1,
      durationUnit: item.durationUnit || "month",
      isActive: item.isActive !== false,
      sortOrder: item.sortOrder || 0,
      features: {
        ...defaultFeatures,
        ...(item.features || {}),
      },
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const payload = {
        ...form,
        price: Number(form.price),
        durationValue: Number(form.durationValue),
        sortOrder: Number(form.sortOrder),
        currency: "BDT",
        features: {
          ...form.features,
          maxWidgets: Number(form.features.maxWidgets),
          maxAgentsPerWidget: Number(
            form.features.maxAgentsPerWidget
          ),
        },
      };

      if (editingId) {
        await axios.put(
          `${endpoint}/${editingId}`,
          payload,
          authConfig()
        );
      } else {
        await axios.post(endpoint, payload, authConfig());
      }

      setMessage(
        editingId
          ? "Package updated successfully"
          : "Package created successfully"
      );
      resetForm();
      await fetchPackages();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Failed to save package"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this package?")) return;

    try {
      await axios.delete(`${endpoint}/${id}`, authConfig());
      setMessage("Package deleted successfully");
      fetchPackages();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Failed to delete package"
      );
    }
  };

  const formatDuration = (item) =>
    `${item.durationValue} ${
      item.durationUnit === "year"
        ? item.durationValue > 1
          ? "years"
          : "year"
        : item.durationValue > 1
          ? "months"
          : "month"
    }`;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="mx-auto max-w-7xl">
        {/* Top Bar Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/60 backdrop-blur-xl border border-slate-700/60 p-6 rounded-3xl shadow-2xl">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <Sparkles size={20} />
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                Subscription Packages
              </h1>
              <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {packages.length} Packages
              </span>
            </div>
            <p className="text-sm text-slate-400 pl-13">
              Configure BDT pricing, limits, and feature toggles including Live Visitor Radar.
            </p>
          </div>

          <button
            onClick={() => {
              setForm(emptyForm);
              setEditingId(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3.5 font-bold text-white shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-95 transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus size={20} />
            <span>Create New Package</span>
          </button>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-400 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 size={18} />
              <span>{message}</span>
            </div>
            <button onClick={() => setMessage("")} className="text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Modal / Form Drawer */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-10 rounded-3xl bg-slate-800 border border-slate-700/80 p-6 md:p-8 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300"
          >
            <div className="mb-6 flex items-center justify-between border-b border-slate-700 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  {editingId ? <Edit3 size={18} /> : <Plus size={18} />}
                </div>
                <h2 className="text-xl font-bold text-white">
                  {editingId ? "Edit Subscription Package" : "Create Subscription Package"}
                </h2>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Basic Info Fields */}
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <label className="xl:col-span-2">
                <span className="mb-1.5 block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Package Name *
                </span>
                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                  className="w-full rounded-2xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. Pro Business"
                />
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Price (BDT) *
                </span>
                <div className="flex">
                  <span className="rounded-l-2xl border border-r-0 border-slate-600 bg-slate-700 px-4 py-3 font-bold text-emerald-400">
                    ৳
                  </span>
                  <input
                    type="number"
                    min="0"
                    required
                    value={form.price}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        price: event.target.value,
                      })
                    }
                    className="w-full rounded-r-2xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    placeholder="1500"
                  />
                </div>
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Sort Order
                </span>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      sortOrder: event.target.value,
                    })
                  }
                  className="w-full rounded-2xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </label>

              <label className="xl:col-span-2">
                <span className="mb-1.5 block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Description
                </span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description: event.target.value,
                    })
                  }
                  placeholder="Brief description of this package..."
                  className="w-full rounded-2xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Duration Value *
                </span>
                <input
                  type="number"
                  min="1"
                  required
                  value={form.durationValue}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      durationValue: event.target.value,
                    })
                  }
                  className="w-full rounded-2xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Duration Unit
                </span>
                <select
                  value={form.durationUnit}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      durationUnit: event.target.value,
                    })
                  }
                  className="w-full rounded-2xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="month">Month(s)</option>
                  <option value="year">Year(s)</option>
                </select>
              </label>
            </div>

            {/* Feature Flags Section */}
            <div className="mt-8">
              <div className="flex items-center space-x-2 mb-4">
                <Sparkles size={18} className="text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Feature Permissions & Toggles
                </h3>
              </div>

              <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                {booleanFeatures.map(({ key, label, icon: IconComp, desc }) => {
                  const isChecked = Boolean(form.features[key]);
                  return (
                    <label
                      key={key}
                      className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all ${
                        isChecked
                          ? "border-emerald-500/50 bg-emerald-500/10 text-white shadow-md shadow-emerald-500/5"
                          : "border-slate-700 bg-slate-900/40 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-xl ${isChecked ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-500"}`}>
                          <IconComp size={18} />
                        </div>
                        <div>
                          <div className={`text-xs font-bold ${isChecked ? "text-white" : "text-slate-300"}`}>
                            {label}
                          </div>
                          <div className="text-[10px] text-slate-500">{desc}</div>
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            features: {
                              ...form.features,
                              [key]: event.target.checked,
                            },
                          })
                        }
                        className="h-5 w-5 rounded accent-emerald-500 cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>

              {/* Usage Numeric Limits */}
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="bg-slate-900/60 border border-slate-700 p-4 rounded-2xl">
                  <span className="mb-1 block text-xs font-bold text-slate-300 uppercase">
                    Maximum Allowed Widgets
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={form.features.maxWidgets}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        features: {
                          ...form.features,
                          maxWidgets: event.target.value,
                        },
                      })
                    }
                    className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </label>

                <label className="bg-slate-900/60 border border-slate-700 p-4 rounded-2xl">
                  <span className="mb-1 block text-xs font-bold text-slate-300 uppercase">
                    Max Agents / Admins Per Widget
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={form.features.maxAgentsPerWidget}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        features: {
                          ...form.features,
                          maxAgentsPerWidget: event.target.value,
                        },
                      })
                    }
                    className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </label>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-8 flex items-center justify-between border-t border-slate-700 pt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      isActive: event.target.checked,
                    })
                  }
                  className="h-5 w-5 accent-emerald-500"
                />
                <span className="text-sm font-bold text-slate-200">
                  Package Active (Visible for subscription)
                </span>
              </label>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-3 rounded-xl border border-slate-600 text-slate-300 font-semibold text-xs hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-bold text-white shadow-lg shadow-emerald-500/25 hover:brightness-110 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Save size={18} />
                  )}
                  <span>Save Package</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Package Grid Display */}
        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <Loader2 className="animate-spin text-emerald-400" size={40} />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {packages.map((item) => (
              <article
                key={item._id}
                className="group relative rounded-3xl bg-slate-800/80 border border-slate-700/80 p-6 md:p-7 shadow-xl hover:border-emerald-500/40 hover:shadow-emerald-500/5 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="mb-5 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2.5 mb-1">
                        <h3 className="text-xl font-black text-white group-hover:text-emerald-400 transition-colors">
                          {item.name}
                        </h3>
                        <span
                          className={`rounded-full px-3 py-0.5 text-[10px] font-bold tracking-wider uppercase border ${
                            item.isActive
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-slate-700 text-slate-400 border-slate-600"
                          }`}
                        >
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-400 flex items-center space-x-1">
                        <Clock size={12} className="text-slate-500" />
                        <span>{formatDuration(item)}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-black text-emerald-400">
                        ৳{Number(item.price).toLocaleString()}
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        BDT
                      </div>
                    </div>
                  </div>

                  <p className="mb-6 text-xs text-slate-300 min-h-10 leading-relaxed bg-slate-900/40 p-3 rounded-xl border border-slate-700/50">
                    {item.description || "Full feature access package for support management."}
                  </p>

                  <div className="space-y-2.5 mb-6">
                    {booleanFeatures.map(({ key, label }) => {
                      const isEnabled = Boolean(item.features?.[key]);
                      return (
                        <div
                          key={key}
                          className="flex items-center space-x-2.5 text-xs"
                        >
                          {isEnabled ? (
                            <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                              <Check size={11} />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-slate-700/50 text-slate-600 flex items-center justify-center flex-shrink-0">
                              <X size={11} />
                            </div>
                          )}
                          <span
                            className={
                              isEnabled
                                ? "text-slate-200 font-medium"
                                : "text-slate-500 line-through"
                            }
                          >
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-6 rounded-2xl bg-slate-900/60 border border-slate-700/80 p-3.5 grid grid-cols-2 gap-2 text-center text-xs">
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-semibold">Max Widgets</span>
                      <strong className="text-sm font-black text-white">{item.features?.maxWidgets || 0}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-semibold">Agents / Widget</span>
                      <strong className="text-sm font-black text-white">{item.features?.maxAgentsPerWidget || 0}</strong>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleEdit(item)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
                    >
                      <Edit3 size={15} />
                      <span>Edit Package</span>
                    </button>

                    <button
                      onClick={() => handleDelete(item._id)}
                      className="flex items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer"
                      title="Delete package"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionPackages;
