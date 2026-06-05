import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import useAuthStore from '../store/authStore';
import { Copy, Check, Code, Settings, Plus, Trash2, Globe, X } from 'lucide-react';

const API_URL = `${import.meta.env.VITE_API_URL || 'https://jh5nng6t-5000.asse.devtunnels.ms'}/api/auth/merchant`;
const WIDGET_SCRIPT_URL = `${import.meta.env.VITE_WIDGET_URL || 'http://localhost:5173'}/assets/widget.js`; // Will be replaced by prod URL in future

function Configure() {
  const { user, fetchProfile } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user?._id]);

  const widgets = user?.widgets || [];
  const sharedWidgets = user?.sharedWidgets || [];

  const [showAddForm, setShowAddForm] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('Ochat Support');
  const [isSaving, setIsSaving] = useState(false);

  const [copiedId, setCopiedId] = useState(null);

  const handleAddWidget = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.post(`${API_URL}/widgets`, {
        domain: newDomain,
        companyName: newCompanyName
      }, config);

      // Update local store
      const updatedWidgets = [...widgets, data];
      const updatedUser = { ...user, widgets: updatedWidgets };
      localStorage.setItem('merchantUser', JSON.stringify(updatedUser));
      useAuthStore.setState({ user: updatedUser });

      setNewDomain('');
      setNewCompanyName('Ochat Support');
      setShowAddForm(false);
    } catch (error) {
      console.error(error);
      alert('Failed to add widget');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWidget = async (widgetId) => {
    if (!window.confirm('Are you sure you want to delete this widget?')) return;

    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`${API_URL}/widgets/${widgetId}`, config);

      // Update local store
      const updatedWidgets = widgets.filter(w => w._id !== widgetId);
      const updatedUser = { ...user, widgets: updatedWidgets };
      localStorage.setItem('merchantUser', JSON.stringify(updatedUser));
      useAuthStore.setState({ user: updatedUser });
    } catch (error) {
      console.error(error);
      alert('Failed to delete widget');
    }
  };

  const getScriptCode = (widgetId) => {
    return `<script 
  src="${WIDGET_SCRIPT_URL}" 
  id="ochat-script" 
  data-merchant-id="${user?._id}"
  data-widget-id="${widgetId}"
></script>`;
  };

  const copyToClipboard = (widgetId) => {
    navigator.clipboard.writeText(getScriptCode(widgetId));
    setCopiedId(widgetId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f0f2f5] p-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-800">Widget Configuration</h1>
          {user?.canCreateWidgets && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-[#25D366] hover:bg-[#1da851] text-white px-5 py-2.5 rounded-lg flex items-center font-semibold shadow-md transition-all active:scale-95"
            >
              {showAddForm ? <X size={20} className="mr-2" /> : <Plus size={20} className="mr-2" />}
              {showAddForm ? 'Cancel' : 'Add New Widget'}
            </button>
          )}
        </div>

        {/* Add New Widget Form */}
        {showAddForm && user?.canCreateWidgets && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Create New Widget</h2>
            <form onSubmit={handleAddWidget} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Domain</label>
                <input
                  type="text"
                  required
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="e.g. yourwebsite.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name (Shows in Header)</label>
                <input
                  type="text"
                  required
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g. Ochat Support"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] outline-none"
                />
              </div>
              <div className="md:col-span-2 flex justify-end space-x-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-gray-800 hover:bg-gray-900 text-white font-medium py-2 px-6 rounded-lg transition disabled:opacity-70"
                >
                  {isSaving ? 'Saving...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Info for normal users */}
        {!user?.canCreateWidgets && widgets.length === 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center text-blue-700 mb-8">
            <Globe size={32} className="mx-auto mb-3 text-blue-400" />
            <h3 className="text-lg font-semibold mb-2">Welcome to your Dashboard</h3>
            <p className="text-sm">You currently don't own any widgets. Ask a Widget Owner to invite you to their widget to start chatting with visitors.</p>
          </div>
        )}

        {/* Widgets List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {widgets.length === 0 && user?.canCreateWidgets ? (
            <div className="col-span-full text-center py-12 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
              <Globe size={48} className="mx-auto mb-3 text-gray-400" />
              <p>No widgets configured yet.</p>
              <p className="text-sm">Click "Add New Widget" to create one for your website.</p>
            </div>
          ) : (
            widgets.map(widget => (
              <div key={widget._id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4 border-b pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 flex items-center">
                      <Globe size={18} className="mr-2 text-[#00a884]" />
                      {widget.domain}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Company Name: <strong>{widget.companyName}</strong></p>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => navigate(`/configure/settings/${widget._id}`)}
                      className="p-1.5 rounded-md transition text-gray-400 hover:text-[#00a884] hover:bg-gray-50"
                      title="Widget Settings"
                    >
                      <Settings size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteWidget(widget._id)}
                      className="text-red-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition"
                      title="Delete Widget"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Code className="text-gray-500" size={16} />
                    <h3 className="text-sm font-semibold text-gray-700">Embed Script</h3>
                  </div>

                  <div className="relative group mt-2">
                    <pre className="bg-gray-800 text-green-400 p-3 rounded-lg overflow-x-auto text-xs font-mono whitespace-pre-wrap leading-relaxed">
                      {getScriptCode(widget._id)}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(widget._id)}
                      className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
                      title="Copy to clipboard"
                    >
                      {copiedId === widget._id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Shared Widgets List */}
        {sharedWidgets.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
              <Globe size={24} className="mr-2 text-blue-500" />
              Shared With Me
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {sharedWidgets.map(widget => (
                <div key={widget._id} className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 flex flex-col h-full relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-400"></div>
                  <div className="flex justify-between items-start mb-4 border-b pb-4">
                    <div>
                      <h2 className="text-lg font-bold text-gray-800 flex items-center">
                        <Globe size={18} className="mr-2 text-blue-500" />
                        {widget.domain}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">Company Name: <strong>{widget.companyName}</strong></p>
                      <p className="text-xs text-blue-500 mt-2 bg-blue-50 inline-block px-2 py-1 rounded">
                        Owned by: <strong>{widget.ownerName}</strong> ({widget.ownerEmail})
                      </p>
                      <p className="text-xs text-purple-600 mt-1 font-semibold">Your Role: {widget.myRole === 'admin' ? 'Widget Admin' : 'Chat Agent'}</p>
                    </div>
                    {widget.myRole === 'admin' && (
                      <div className="flex space-x-2 relative z-10">
                        <button
                          onClick={() => navigate(`/configure/settings/${widget._id}`)}
                          className="p-2 rounded-lg transition border flex items-center justify-center text-gray-400 border-gray-200 hover:text-blue-600 hover:bg-gray-50 animate-all duration-200 active:scale-95"
                          title="Access Settings"
                        >
                          <Settings size={18} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Code className="text-gray-500" size={16} />
                      <h3 className="text-sm font-semibold text-gray-700">Embed Script</h3>
                    </div>

                    <div className="relative group mt-2">
                      <pre className="bg-gray-800 text-green-400 p-3 rounded-lg overflow-x-auto text-xs font-mono whitespace-pre-wrap leading-relaxed">
                        {getScriptCode(widget._id)}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(widget._id)}
                        className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
                        title="Copy to clipboard"
                      >
                        {copiedId === widget._id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Configure;
