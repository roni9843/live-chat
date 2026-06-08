import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, User, Settings, LogOut, MessageCircle, Bell, Check, X, Phone, PhoneOff } from 'lucide-react';
import axios from 'axios';
import useAuthStore from '../store/authStore';
import useChatStore from '../store/chatStore';
import Chat from '../pages/Chat';

const API_URL = import.meta.env.VITE_API_URL || 'https://jh5nng6t-5000.asse.devtunnels.ms';

function DashboardLayout() {
  const { user, logout, fetchProfile } = useAuthStore();
  const { totalUnread, activeSessionId, setActiveSessionId } = useChatStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [invites, setInvites] = useState([]);
  const [showInvites, setShowInvites] = useState(false);
  const popoverRef = useRef(null);

  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    const handleGlobalIncoming = (e) => {
      setIncomingCall(e.detail);
    };

    const handleGlobalDismiss = (e) => {
      const { sessionId } = e.detail || {};
      setIncomingCall(prev => (prev && prev.sessionId === sessionId) ? null : prev);
    };

    window.addEventListener('global_incoming_call', handleGlobalIncoming);
    window.addEventListener('global_call_dismiss', handleGlobalDismiss);

    return () => {
      window.removeEventListener('global_incoming_call', handleGlobalIncoming);
      window.removeEventListener('global_call_dismiss', handleGlobalDismiss);
    };
  }, []);

  const handleGlobalAccept = () => {
    if (!incomingCall) return;
    const { sessionId } = incomingCall;
    setActiveSessionId(sessionId);
    navigate('/');
    window.dispatchEvent(new CustomEvent('global_call_accepted', { detail: { sessionId } }));
    setIncomingCall(null);
  };

  const handleGlobalDecline = () => {
    if (!incomingCall) return;
    const { sessionId } = incomingCall;
    window.dispatchEvent(new CustomEvent('global_decline_call', { detail: { sessionId } }));
    setIncomingCall(null);
  };

  const fetchInvites = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get(`${API_URL}/api/auth/merchant/invites`, config);
      setInvites(data);
    } catch (error) {
      console.error('Error fetching invites:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchInvites();
      fetchProfile();
    }

    const handleNewInvite = (e) => {
      // Re-fetch invites or append from event detail
      fetchInvites();
      // Optionally show a toast here
    };

    const handleInviteResponded = (e) => {
      // Re-fetch profile to update widget access lists in Configure.jsx instantly
      fetchProfile();
    };

    window.addEventListener('new_invite_received', handleNewInvite);
    window.addEventListener('invite_responded_received', handleInviteResponded);

    return () => {
      window.removeEventListener('new_invite_received', handleNewInvite);
      window.removeEventListener('invite_responded_received', handleInviteResponded);
    };
  }, [user?._id]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowInvites(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInviteResponse = async (widgetId, status) => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.post(`${API_URL}/api/auth/merchant/invites/${widgetId}/respond`, { status }, config);
      setInvites(prev => prev.filter(inv => inv.widgetId !== widgetId));

      if (status === 'accept') {
        // Need to update the user context so the new widget shows up in their store
        // A simple way is to reload the window, or just call a refresh function if we had one
        window.location.reload();
      }
    } catch (error) {
      console.error('Error responding to invite:', error);
      alert('Failed to respond to invite');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) {
    return null; // or redirect, handled by ProtectedRoute later
  }

  const togglePresenceStatus = async () => {
    try {
      const newStatus = user.status === 'offline' ? 'online' : 'offline';
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(`${API_URL}/api/auth/merchant/profile`, { status: newStatus }, config);
      const updatedUser = { ...user, ...data };
      localStorage.setItem('merchantUser', JSON.stringify(updatedUser));
      useAuthStore.setState({ user: updatedUser });
    } catch (error) {
      console.error('Error toggling presence status:', error);
      alert('Failed to update presence status');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Main App Sidebar (Slim) */}
      <div className={`w-16 bg-[#075e54] flex flex-col items-center py-4 space-y-8 z-20 shadow-md flex-shrink-0 ${location.pathname === '/' && activeSessionId ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex flex-col items-center space-y-2">
          <div className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center text-white shadow-lg">
            <MessageCircle size={24} />
          </div>
          <span className="text-[10px] text-white font-bold tracking-wider">OCHAT</span>
        </div>

        <nav className="flex-1 flex flex-col space-y-4 w-full px-2 mt-4">
          <Link
            to="/"
            className={`relative w-12 h-12 flex items-center justify-center rounded-xl transition ${location.pathname === '/' ? 'bg-white/20 text-white' : 'text-green-200 hover:bg-white/10'}`}
            title="Inbox"
          >
            <MessageSquare size={24} />
            {totalUnread > 0 && (
              <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center translate-x-1 -translate-y-1 shadow-sm">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </Link>
          <Link
            to="/configure"
            className={`w-12 h-12 flex items-center justify-center rounded-xl transition ${location.pathname === '/configure' ? 'bg-white/20 text-white' : 'text-green-200 hover:bg-white/10'}`}
            title="Configure Script"
          >
            <Settings size={24} />
          </Link>
          <Link
            to="/account"
            className={`w-12 h-12 flex items-center justify-center rounded-xl transition ${location.pathname === '/account' ? 'bg-white/20 text-white' : 'text-green-200 hover:bg-white/10'}`}
            title="My Account"
          >
            {user.profilePic ? (
              <img
                src={user.profilePic}
                alt="profile"
                className="w-8 h-8 rounded-full object-cover border border-white/40 shadow-inner"
              />
            ) : (
              <User size={24} />
            )}
          </Link>
        </nav>

        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setShowInvites(!showInvites)}
            className={`w-12 h-12 flex items-center justify-center rounded-xl transition ${showInvites ? 'bg-white/20 text-white' : 'text-green-200 hover:bg-white/10'}`}
            title="Notifications"
          >
            <Bell size={24} />
            {invites.length > 0 && (
              <span className="absolute top-2 right-2 w-4 h-4 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center translate-x-1 -translate-y-1 shadow-sm">
                {invites.length}
              </span>
            )}
          </button>

          {showInvites && (
            <div className="absolute bottom-0 left-16 mb-0 ml-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
                <h3 className="font-semibold text-gray-700 text-sm">Notifications</h3>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {invites.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No new notifications.
                  </div>
                ) : (
                  invites.map(invite => (
                    <div key={invite.widgetId} className="p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
                      <p className="text-xs text-gray-500 mb-1">
                        <strong>{invite.ownerName}</strong> invited you as
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-bold uppercase">
                          {invite.role === 'admin' ? 'Widget Admin' : 'Agent'}
                        </span>
                      </p>
                      <p className="text-sm font-semibold text-gray-800">{invite.domain}</p>
                      <p className="text-xs text-gray-500 mb-3">{invite.companyName}</p>

                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleInviteResponse(invite.widgetId, 'accept')}
                          className="flex-1 bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold py-1.5 rounded flex items-center justify-center transition"
                        >
                          <Check size={14} className="mr-1" /> Accept
                        </button>
                        <button
                          onClick={() => handleInviteResponse(invite.widgetId, 'reject')}
                          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold py-1.5 rounded flex items-center justify-center transition"
                        >
                          <X size={14} className="mr-1" /> Decline
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Presence Toggle */}
        <button
          onClick={togglePresenceStatus}
          className="w-12 h-12 flex flex-col items-center justify-center rounded-xl transition hover:bg-white/10 text-white cursor-pointer"
          title={user.status === 'offline' ? 'Offline (Click to go Online)' : 'Online (Click to go Offline)'}
        >
          <div className={`w-3.5 h-3.5 rounded-full border border-[#075e54] ${user.status === 'offline' ? 'bg-red-550 bg-red-500' : 'bg-green-400 animate-pulse'}`} />
          <span className="text-[9px] text-green-200 mt-1.5 font-bold tracking-wide uppercase leading-none">
            {user.status === 'offline' ? 'Off' : 'On'}
          </span>
        </button>

        <button
          onClick={handleLogout}
          className="w-12 h-12 flex items-center justify-center text-green-200 hover:bg-white/10 rounded-xl transition"
          title="Logout"
        >
          <LogOut size={24} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Chat component is always mounted but hidden on other routes to keep socket active */}
        <div className={`absolute inset-0 bg-gray-50 flex flex-col ${location.pathname === '/' ? 'z-10 opacity-100' : '-z-10 opacity-0 pointer-events-none hidden'}`}>
          <Chat isChatVisible={location.pathname === '/'} />
        </div>
        <div className={`absolute inset-0 bg-gray-100 overflow-y-auto ${location.pathname !== '/' ? 'z-10 opacity-100' : '-z-10 opacity-0 pointer-events-none hidden'}`}>
          <Outlet />
        </div>
      </div>

      {/* Global Incoming Call Popup */}
      {incomingCall && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-[#202c33] border border-[#2a3942] rounded-2xl p-4 shadow-2xl flex items-center space-x-4 max-w-sm animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="w-12 h-12 rounded-full bg-[#00a884] flex items-center justify-center text-white font-bold text-lg flex-shrink-0 animate-pulse">
            {incomingCall.visitorName ? incomingCall.visitorName.charAt(0).toUpperCase() : 'G'}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-white truncate">{incomingCall.visitorName || 'Guest Visitor'}</h4>
            <p className="text-xs text-gray-400 mt-0.5">Incoming Voice Call...</p>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={handleGlobalDecline}
              className="p-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-md transition active:scale-95 cursor-pointer"
              title="Decline"
            >
              <PhoneOff size={16} />
            </button>
            <button
              onClick={handleGlobalAccept}
              className="p-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-md transition active:scale-95 cursor-pointer animate-bounce"
              title="Accept"
            >
              <Phone size={16} className="fill-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardLayout;
