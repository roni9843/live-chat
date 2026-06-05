import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, UserPlus, X, UserCheck, Loader2 } from 'lucide-react';
import useAuthStore from '../store/authStore';

const API_URL = `${import.meta.env.VITE_API_URL || 'https://jh5nng6t-5000.asse.devtunnels.ms'}/api/auth/merchant`;

function WidgetAccess({ widget }) {
  const { user } = useAuthStore();
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [inviteRole, setInviteRole] = useState('agent');

  const [authorizedUsers, setAuthorizedUsers] = useState(widget.authorizedUsers || []);
  const [pendingUsers, setPendingUsers] = useState(widget.pendingUsers || []);

  useEffect(() => {
    setAuthorizedUsers(widget.authorizedUsers || []);
    setPendingUsers(widget.pendingUsers || []);
  }, [widget.authorizedUsers, widget.pendingUsers]);

  const searchUsers = async (e) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;

    setIsSearching(true);
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get(`${API_URL}/search?email=${searchEmail}`, config);
      setSearchResults(data);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const updateAccess = async (newAuthorizedUsers, newPendingUsers) => {
    setIsUpdating(true);
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };

      const payload = {};
      // mapping array of { user: { _id, ... }, role } back to { user: _id, role } for backend
      if (newAuthorizedUsers) {
        payload.authorizedUsers = newAuthorizedUsers.map(u => ({ user: u.user?._id || u.user, role: u.role }));
      }
      if (newPendingUsers) {
        payload.pendingUsers = newPendingUsers.map(u => ({ user: u.user?._id || u.user, role: u.role }));
      }

      const { data } = await axios.put(`${API_URL}/widgets/${widget._id}`, payload, config);

      if (newAuthorizedUsers) setAuthorizedUsers(data.authorizedUsers || []);
      if (newPendingUsers) setPendingUsers(data.pendingUsers || []);

      // Update the global user store
      const updatedUser = { ...user };
      const widgetIndex = updatedUser.widgets.findIndex(w => w._id === widget._id);
      if (widgetIndex !== -1) {
        if (newAuthorizedUsers) updatedUser.widgets[widgetIndex].authorizedUsers = data.authorizedUsers;
        if (newPendingUsers) updatedUser.widgets[widgetIndex].pendingUsers = data.pendingUsers;
        localStorage.setItem('merchantUser', JSON.stringify(updatedUser));
        useAuthStore.setState({ user: updatedUser });
      }
    } catch (error) {
      console.error('Error updating access:', error);
      alert('Failed to update widget access');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddUser = async (userToAdd) => {
    // Check if user is already authorized
    if (authorizedUsers.find(u => (u.user?._id || u.user) === userToAdd._id)) {
      alert('User is already authorized');
      return;
    }
    // Check if user is already pending
    if (pendingUsers.find(u => (u.user?._id || u.user) === userToAdd._id)) {
      alert('User is already invited');
      return;
    }

    setIsUpdating(true);
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.post(`${API_URL}/widgets/${widget._id}/invite`, { email: userToAdd.email, role: inviteRole }, config);

      setPendingUsers(data.pendingUsers || []);

      // Update global user store
      const updatedUser = { ...user };
      const widgetIndex = updatedUser.widgets.findIndex(w => w._id === widget._id);
      if (widgetIndex !== -1) {
        updatedUser.widgets[widgetIndex].pendingUsers = data.pendingUsers;
        localStorage.setItem('merchantUser', JSON.stringify(updatedUser));
        useAuthStore.setState({ user: updatedUser });
      }

      setSearchEmail('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error sending invite:', error);
      alert(error.response?.data?.message || 'Failed to send invite');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveUser = (userIdToRemove) => {
    if (!window.confirm('Remove access for this user?')) return;
    const updatedUsers = authorizedUsers.filter(u => (u.user?._id || u.user) !== userIdToRemove);
    updateAccess(updatedUsers, null);
  };

  const handleCancelInvite = (userIdToRemove) => {
    if (!window.confirm('Cancel this pending invitation?')) return;
    const updatedPending = pendingUsers.filter(u => (u.user?._id || u.user) !== userIdToRemove);
    updateAccess(null, updatedPending);
  };

  return (
    <div className="mt-6 border-t pt-4">
      <div className="flex items-center space-x-2 mb-3">
        <UserCheck className="text-gray-500" size={16} />
        <h3 className="text-sm font-semibold text-gray-700">Access Settings</h3>
      </div>

      <p className="text-xs text-gray-500 mb-3">Allow other users to view and reply to messages from this widget.</p>

      {/* Search Form */}
      <form onSubmit={searchUsers} className="flex space-x-2 mb-4">
        <div className="relative flex-1 flex space-x-2">
          <div className="relative flex-1">
            <input
              type="email"
              placeholder="Search user by email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] outline-none"
            />
            <Search size={16} className="absolute left-3 top-2 text-gray-400" />
          </div>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="w-32 py-1.5 px-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] outline-none"
          >
            <option value="agent">Agent</option>
            <option value="admin">Widget Admin</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={isSearching || !searchEmail.trim()}
          className="bg-gray-800 hover:bg-gray-900 text-white text-sm px-4 py-1.5 rounded-lg disabled:opacity-70 flex items-center transition"
        >
          {isSearching ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
        </button>
      </form>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mb-4 bg-gray-50 rounded-lg border border-gray-200 p-2 max-h-32 overflow-y-auto">
          <h4 className="text-xs font-semibold text-gray-500 mb-2 px-2">Search Results:</h4>
          {searchResults.map(result => (
            <div key={result._id} className="flex justify-between items-center bg-white p-2 rounded border border-gray-100 mb-1 last:mb-0 shadow-sm">
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-gray-800 truncate">{result.name}</p>
                <p className="text-xs text-gray-500 truncate">{result.email}</p>
              </div>
              <button
                onClick={() => handleAddUser(result)}
                disabled={isUpdating}
                className="bg-[#00a884] hover:bg-[#008f6f] text-white p-1.5 rounded flex items-center transition disabled:opacity-50"
                title="Add User"
              >
                <UserPlus size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Authorized Users List */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-gray-500 mb-2">Authorized Users ({authorizedUsers.length})</h4>
        {authorizedUsers.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No other users have access yet.</p>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {authorizedUsers.map(u => (
              <div key={u.user?._id || Math.random()} className="flex justify-between items-center bg-green-50/50 p-2 rounded-lg border border-green-100">
                <div className="overflow-hidden flex items-center space-x-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800 truncate">{u.user?.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500 truncate">{u.user?.email}</p>
                  </div>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    {u.role === 'admin' ? 'Admin' : 'Agent'}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveUser(u.user?._id)}
                  disabled={isUpdating}
                  className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded transition disabled:opacity-50"
                  title="Remove Access"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Requests List */}
      {pendingUsers.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-orange-500 mb-2">Pending Requests ({pendingUsers.length})</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {pendingUsers.map(u => (
              <div key={u.user?._id || Math.random()} className="flex justify-between items-center bg-orange-50/30 p-2 rounded-lg border border-orange-100">
                <div className="overflow-hidden flex items-center space-x-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800 truncate">{u.user?.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500 truncate">{u.user?.email}</p>
                  </div>
                  <div className="flex flex-col items-start space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-orange-400">Waiting for approval</span>
                    <span className="text-[10px] uppercase font-semibold px-2 rounded-full bg-orange-100 text-orange-700">
                      {u.role === 'admin' ? 'Admin' : 'Agent'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleCancelInvite(u.user?._id)}
                  disabled={isUpdating}
                  className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded transition disabled:opacity-50"
                  title="Cancel Request"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

export default WidgetAccess;
