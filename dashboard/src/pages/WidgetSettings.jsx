import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import useAuthStore from '../store/authStore';
import {
  ArrowLeft, Save, Trash2, Search, UserPlus, X, UserCheck,
  Loader2, Globe, Palette, Layout, ToggleLeft, ToggleRight,
  MessageCircle, Copy, Check, Code, Send, Upload, Image as ImageIcon,
  ChevronUp, ChevronDown, ClipboardList, Lock, Mail
} from 'lucide-react';

const API_URL = `${import.meta.env.VITE_API_URL || 'https://jh5nng6t-5000.asse.devtunnels.ms'}/api/auth/merchant`;

function WidgetSettings() {
  const { widgetId } = useParams();
  const navigate = useNavigate();
  const { user, fetchProfile } = useAuthStore();

  // Find widget from owned or shared widgets list
  const isOwnedWidget = user?.widgets?.some(w => w._id === widgetId);
  const widget = user?.widgets?.find(w => w._id === widgetId) ||
    user?.sharedWidgets?.find(w => w._id === widgetId);

  // States for general widget settings
  const [domain, setDomain] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('#25D366');
  const [position, setPosition] = useState('right');
  const [isActive, setIsActive] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [spacingBottom, setSpacingBottom] = useState(20);
  const [spacingSide, setSpacingSide] = useState(20);
  const [launcherType, setLauncherType] = useState('icon_only');
  const [launcherText, setLauncherText] = useState('Chat');
  const [themeMode, setThemeMode] = useState('light');
  const [bgType, setBgType] = useState('image');
  const [bgColor, setBgColor] = useState('#efeae2');
  const [bgImage, setBgImage] = useState('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png');
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const bgFileInputRef = useRef(null);
  const [logo, setLogo] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoFileInputRef = useRef(null);
  const [faqs, setFaqs] = useState([{ question: '', answer: '' }]);
  const [preChatForm, setPreChatForm] = useState({
    enabled: false,
    fields: {
      name: { enabled: true, required: true, label: 'Name', placeholder: 'Enter your name...' },
      email: { enabled: true, required: true, label: 'Email', placeholder: 'Enter your email...' },
      phone: { enabled: false, required: false, label: 'Phone Number', placeholder: 'Enter your phone number...' },
      message: { enabled: false, required: false, label: 'Message', placeholder: 'How can we help you?' }
    }
  });
  const [offlineForm, setOfflineForm] = useState({
    enabled: true,
    title: 'Leave a message',
    message: 'All agents are offline. Please state your problems and post them.',
    fields: [
      { id: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Enter your name...' },
      { id: 'email', label: 'Email', type: 'email', required: true, placeholder: 'Enter your email...' },
      { id: 'phone', label: 'Phone Number', type: 'tel', required: false, placeholder: 'Enter your phone number...' },
      { id: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Describe your issue...' }
    ]
  });
  const [activeTab, setActiveTab] = useState('design'); // 'design', 'faqs', 'prechat', 'access', 'install'
  const [isMobilePreviewExpanded, setIsMobilePreviewExpanded] = useState(true);
  const [expandedAccordion, setExpandedAccordion] = useState('design'); // 'design', 'faqs', 'prechat', 'access', 'install'

  // Widget Owner profile states
  const [ownerNickname, setOwnerNickname] = useState('');
  const [ownerDesignation, setOwnerDesignation] = useState('');
  const [ownerProfilePic, setOwnerProfilePic] = useState('');
  const [editingUserProfile, setEditingUserProfile] = useState(null);
  const editingUserFileRef = useRef(null);

  // Access management states
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [inviteRole, setInviteRole] = useState('agent');

  const [authorizedUsers, setAuthorizedUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);

  const [copied, setCopied] = useState(false);

  // Populate form and access lists once widget is resolved
  useEffect(() => {
    if (widget) {
      setDomain(widget.domain || '');
      setCompanyName(widget.companyName || '');
      setTitle(widget.title || 'Chat with us');
      setColor(widget.color || '#25D366');
      setPosition(widget.position || 'right');
      setIsActive(widget.isActive !== undefined ? widget.isActive : true);
      setWelcomeMessage(widget.welcomeMessage || "Welcome! We're here to help you live chat with your visitors.");
      setSpacingBottom(widget.spacingBottom ?? 20);
      setSpacingSide(widget.spacingSide ?? 20);
      setLauncherType(widget.launcherType || 'icon_only');
      setLauncherText(widget.launcherText || 'Chat');
      setThemeMode(widget.themeMode || 'light');
      setBgType(widget.bgType || 'image');
      setBgColor(widget.bgColor || '#efeae2');
      setBgImage(widget.bgImage || 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png');
      setOwnerNickname(widget.ownerNickname || '');
      setOwnerDesignation(widget.ownerDesignation || '');
      setOwnerProfilePic(widget.ownerProfilePic || '');
      setLogo(widget.logo || '');
      setAuthorizedUsers(widget.authorizedUsers || []);
      setPendingUsers(widget.pendingUsers || []);
      setFaqs(widget.faqs && widget.faqs.length > 0 ? widget.faqs : [{ question: '', answer: '' }]);
      setPreChatForm(widget.preChatForm || {
        enabled: false,
        fields: {
          name: { enabled: true, required: true, label: 'Name', placeholder: 'Enter your name...' },
          email: { enabled: true, required: true, label: 'Email', placeholder: 'Enter your email...' },
          phone: { enabled: false, required: false, label: 'Phone Number', placeholder: 'Enter your phone number...' },
          message: { enabled: false, required: false, label: 'Message', placeholder: 'How can we help you?' }
        }
      });
      setOfflineForm(widget.offlineForm || {
        enabled: true,
        title: 'Leave a message',
        message: 'All agents are offline. Please state your problems and post them.',
        fields: [
          { id: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Enter your name...' },
          { id: 'email', label: 'Email', type: 'email', required: true, placeholder: 'Enter your email...' },
          { id: 'phone', label: 'Phone Number', type: 'tel', required: false, placeholder: 'Enter your phone number...' },
          { id: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Describe your issue...' }
        ]
      });
    }
  }, [widget]);

  // Fetch the latest profile data on mount to ensure freshness
  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [widgetId]);

  if (!widget) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#f0f2f5]">
        <div className="text-center space-y-4">
          <Globe size={48} className="mx-auto text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-700">Widget not found</h2>
          <p className="text-gray-500">The widget you are looking for does not exist or you do not have permission to view it.</p>
          <Link to="/configure" className="inline-block bg-[#00a884] hover:bg-[#008f6f] text-white px-4 py-2 rounded-lg font-medium transition">
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  const myRole = isOwnedWidget ? 'owner' : widget.myRole;
  const isWidgetAdmin = myRole === 'owner' || myRole === 'admin';

  if (!isWidgetAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#f0f2f5]">
        <div className="text-center space-y-4 max-w-md bg-white p-8 rounded-xl border border-gray-200 shadow-sm animate-in fade-in duration-300">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
            <X size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Access Denied</h2>
          <p className="text-sm text-gray-500">
            You are joined as a <strong>Chat Agent</strong> for this widget. Agents only have permission to view and reply to chats, and cannot access widget settings.
          </p>
          <div className="pt-2">
            <button
              onClick={() => navigate('/configure')}
              className="bg-[#00a884] hover:bg-[#008f6f] text-white px-5 py-2 rounded-lg font-semibold shadow transition active:scale-95"
            >
              Go Back to Widgets
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    if (!isWidgetAdmin) {
      alert('Only owners and widget admins can modify widget settings.');
      return;
    }

    setIsUpdating(true);
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const filteredFaqs = faqs.filter(faq => faq.question.trim() !== '' && faq.answer.trim() !== '');
      const payload = {
        domain,
        companyName,
        title,
        color,
        position,
        isActive,
        welcomeMessage,
        spacingBottom: Number(spacingBottom),
        spacingSide: Number(spacingSide),
        launcherType,
        launcherText,
        themeMode,
        bgType,
        bgColor,
        bgImage,
        faqs: filteredFaqs,
        preChatForm,
        offlineForm,
        logo
      };

      const { data } = await axios.put(`${API_URL}/widgets/${widgetId}`, payload, config);

      // Update global user store
      const updatedUser = { ...user };
      const ownIndex = updatedUser.widgets?.findIndex(w => w._id === widgetId);
      const sharedIndex = updatedUser.sharedWidgets?.findIndex(w => w._id === widgetId);

      if (ownIndex !== undefined && ownIndex !== -1) {
        updatedUser.widgets[ownIndex] = { ...updatedUser.widgets[ownIndex], ...data };
      } else if (sharedIndex !== undefined && sharedIndex !== -1) {
        const prevWidget = updatedUser.sharedWidgets[sharedIndex];
        updatedUser.sharedWidgets[sharedIndex] = {
          ...prevWidget,
          ...data,
          ownerName: prevWidget.ownerName,
          ownerEmail: prevWidget.ownerEmail,
          myRole: prevWidget.myRole
        };
      }

      localStorage.setItem('merchantUser', JSON.stringify(updatedUser));
      useAuthStore.setState({ user: updatedUser });
      alert('Widget settings saved successfully!');
    } catch (error) {
      console.error('Error saving widget details:', error);
      alert('Failed to save widget settings');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteWidget = async () => {
    if (!isOwnedWidget) {
      alert('Only the widget owner can delete this widget.');
      return;
    }
    if (!window.confirm('Are you sure you want to permanently delete this widget? This action cannot be undone.')) {
      return;
    }

    setIsUpdating(true);
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`${API_URL}/widgets/${widgetId}`, config);

      // Update local store
      const updatedUser = { ...user };
      updatedUser.widgets = updatedUser.widgets.filter(w => w._id !== widgetId);
      localStorage.setItem('merchantUser', JSON.stringify(updatedUser));
      useAuthStore.setState({ user: updatedUser });

      navigate('/configure');
    } catch (error) {
      console.error(error);
      alert('Failed to delete widget');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBgUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingBg(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadUrl = `${import.meta.env.VITE_API_URL || 'https://jh5nng6t-5000.asse.devtunnels.ms'}/api/upload`;
      const res = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.success && data.fileUrl) {
        setBgImage(data.fileUrl);
        setBgType('image');
      } else {
        alert('Upload failed');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to upload background image');
    } finally {
      setIsUploadingBg(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingLogo(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadUrl = `${import.meta.env.VITE_API_URL || 'https://jh5nng6t-5000.asse.devtunnels.ms'}/api/upload`;
      const res = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.success && data.fileUrl) {
        setLogo(data.fileUrl);
      } else {
        alert('Upload failed');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Access Settings Management functions
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

  const updateAccess = async (newAuthorizedUsers, newPendingUsers, customOwnerProfile) => {
    setIsUpdating(true);
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const payload = {};

      if (newAuthorizedUsers) {
        payload.authorizedUsers = newAuthorizedUsers.map(u => ({
          user: u.user?._id || u.user,
          role: u.role,
          nickname: u.nickname || '',
          designation: u.designation || '',
          profilePic: u.profilePic || ''
        }));
      }
      if (newPendingUsers) {
        payload.pendingUsers = newPendingUsers.map(u => ({ user: u.user?._id || u.user, role: u.role }));
      }
      if (customOwnerProfile) {
        payload.ownerNickname = customOwnerProfile.ownerNickname;
        payload.ownerDesignation = customOwnerProfile.ownerDesignation;
        payload.ownerProfilePic = customOwnerProfile.ownerProfilePic;
      }

      const { data } = await axios.put(`${API_URL}/widgets/${widgetId}`, payload, config);

      if (newAuthorizedUsers) setAuthorizedUsers(data.authorizedUsers || []);
      if (newPendingUsers) setPendingUsers(data.pendingUsers || []);
      if (data.ownerNickname !== undefined) {
        setOwnerNickname(data.ownerNickname || '');
        setOwnerDesignation(data.ownerDesignation || '');
        setOwnerProfilePic(data.ownerProfilePic || '');
      }

      // Update global user store
      const updatedUser = { ...user };
      const ownIndex = updatedUser.widgets?.findIndex(w => w._id === widgetId);
      const sharedIndex = updatedUser.sharedWidgets?.findIndex(w => w._id === widgetId);

      if (ownIndex !== undefined && ownIndex !== -1) {
        if (newAuthorizedUsers) updatedUser.widgets[ownIndex].authorizedUsers = data.authorizedUsers;
        if (newPendingUsers) updatedUser.widgets[ownIndex].pendingUsers = data.pendingUsers;
        updatedUser.widgets[ownIndex].ownerNickname = data.ownerNickname;
        updatedUser.widgets[ownIndex].ownerDesignation = data.ownerDesignation;
        updatedUser.widgets[ownIndex].ownerProfilePic = data.ownerProfilePic;
      } else if (sharedIndex !== undefined && sharedIndex !== -1) {
        if (newAuthorizedUsers) updatedUser.sharedWidgets[sharedIndex].authorizedUsers = data.authorizedUsers;
        if (newPendingUsers) updatedUser.sharedWidgets[sharedIndex].pendingUsers = data.pendingUsers;
        updatedUser.sharedWidgets[sharedIndex].ownerNickname = data.ownerNickname;
        updatedUser.sharedWidgets[sharedIndex].ownerDesignation = data.ownerDesignation;
        updatedUser.sharedWidgets[sharedIndex].ownerProfilePic = data.ownerProfilePic;
      }

      localStorage.setItem('merchantUser', JSON.stringify(updatedUser));
      useAuthStore.setState({ user: updatedUser });
    } catch (error) {
      console.error('Error updating access:', error);
      alert('Failed to update widget access');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    const updatedUsers = authorizedUsers.map(u => {
      const uId = u.user?._id || u.user;
      if (uId && uId.toString() === userId.toString()) {
        return { ...u, role: newRole };
      }
      return u;
    });
    updateAccess(updatedUsers, null);
  };

  const handleAddUser = async (userToAdd) => {
    if (authorizedUsers.find(u => (u.user?._id || u.user) === userToAdd._id)) {
      alert('User is already authorized');
      return;
    }
    if (pendingUsers.find(u => (u.user?._id || u.user) === userToAdd._id)) {
      alert('User is already invited');
      return;
    }

    setIsUpdating(true);
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.post(`${API_URL}/widgets/${widgetId}/invite`, { email: userToAdd.email, role: inviteRole }, config);

      setPendingUsers(data.pendingUsers || []);

      // Update global user store
      const updatedUser = { ...user };
      const ownIndex = updatedUser.widgets?.findIndex(w => w._id === widgetId);
      const sharedIndex = updatedUser.sharedWidgets?.findIndex(w => w._id === widgetId);

      if (ownIndex !== undefined && ownIndex !== -1) {
        updatedUser.widgets[ownIndex].pendingUsers = data.pendingUsers;
      } else if (sharedIndex !== undefined && sharedIndex !== -1) {
        updatedUser.sharedWidgets[sharedIndex].pendingUsers = data.pendingUsers;
      }

      localStorage.setItem('merchantUser', JSON.stringify(updatedUser));
      useAuthStore.setState({ user: updatedUser });

      setSearchEmail('');
      setSearchResults([]);
      alert(`Invitation sent to ${userToAdd.email} as ${inviteRole === 'admin' ? 'Widget Admin' : 'Agent'}!`);
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

  const getScriptCode = () => {
    const WIDGET_SCRIPT_URL = `${import.meta.env.VITE_WIDGET_URL || 'http://localhost:5173'}/assets/widget.js`;
    return `<script 
  src="${WIDGET_SCRIPT_URL}" 
  id="ochat-script" 
  data-merchant-id="${isOwnedWidget ? user?._id : widget.ownerId || ''}"
  data-widget-id="${widgetId}"
></script>`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getScriptCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderLivePreviewElement = () => {
    const isSideTab = launcherType === 'side_tab';
    const previewAgents = [];
    if (user) {
      previewAgents.push({
        name: user.name,
        profilePic: user.profilePic || ''
      });
    }
    authorizedUsers.slice(0, 2).forEach(au => {
      if (au.user) {
        previewAgents.push({
          name: au.user.name,
          profilePic: au.user.profilePic || ''
        });
      }
    });

    return (
      <div className="relative h-96 bg-gray-100 dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 flex flex-col justify-between p-4 overflow-hidden shadow-inner bg-gradient-to-br from-gray-50 to-gray-200 dark:from-zinc-900 dark:to-zinc-800">
        {/* Simulated Web Page Content */}
        <div className="space-y-2 opacity-30">
          <div className="h-4 bg-gray-400 rounded w-1/3"></div>
          <div className="h-2 bg-gray-400 rounded w-2/3"></div>
          <div className="h-2 bg-gray-400 rounded w-1/2"></div>
          <div className="h-4 bg-gray-400 rounded w-1/4 mt-4"></div>
          <div className="h-2 bg-gray-400 rounded w-3/4"></div>
        </div>

        {/* Floating Preview Chat Bubble / Widget */}
        <div
          style={isSideTab ? {
            top: '50%',
            transform: 'translateY(-50%)',
            [position === 'right' ? 'right' : 'left']: '0px',
            bottom: 'auto'
          } : {
            bottom: `${Math.max(0, Math.min(200, spacingBottom)) / 4}px`,
            [position === 'right' ? 'right' : 'left']: `${Math.max(0, Math.min(200, spacingSide)) / 4}px`
          }}
          className={`absolute flex ${isSideTab ? 'flex-col items-center' : `flex-col items-${position === 'right' ? 'end' : 'start'}`} space-y-2 z-10 max-w-xs transition-all duration-300`}
        >

          {/* Chat Box Popup Preview */}
          <div className={`rounded-xl shadow-lg border overflow-hidden w-64 text-left flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 ${themeMode === 'dark' ? 'bg-[#18181b] border-gray-800 text-white' : 'bg-[#efeae2] border-gray-200 text-gray-800'}`}>
            <div
              style={{ backgroundColor: color }}
              className="p-3 text-white flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                {logo ? (
                  <img
                    className="inline-block h-5 w-5 rounded-full aspect-square object-cover flex-shrink-0 ring-1 ring-white bg-white mr-1"
                    src={logo}
                    alt="Logo"
                  />
                ) : previewAgents.length > 0 ? (
                  <div className="flex -space-x-1.5 items-center mr-1">
                    {previewAgents.slice(0, 3).map((agent, i) => (
                      agent.profilePic ? (
                        <img
                          key={i}
                          className="inline-block h-5 w-5 rounded-full aspect-square object-cover flex-shrink-0 ring-1 ring-white bg-gray-200"
                          src={agent.profilePic}
                          alt={agent.name}
                          title={agent.name}
                        />
                      ) : (
                        <div
                          key={i}
                          style={{ color }}
                          className="inline-block h-5 w-5 rounded-full aspect-square flex-shrink-0 ring-1 ring-white bg-white flex items-center justify-center font-bold text-[8px] shadow-xs"
                          title={agent.name}
                        >
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                      )
                    ))}
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center font-bold text-[8px] text-gray-700 mr-1">
                    {companyName ? companyName.charAt(0).toUpperCase() : 'O'}
                  </div>
                )}
                <div className="truncate text-left">
                  <h4 className="font-bold text-xs truncate leading-none text-white">{title || companyName || 'Ochat Support'}</h4>
                  <span className="text-[8px] text-green-100 opacity-90 leading-none mt-1 inline-block">Online</span>
                </div>
              </div>
              <X size={14} className="opacity-80 text-white cursor-pointer" />
            </div>

            {preChatForm?.enabled ? (
              <div className="p-3 bg-white dark:bg-zinc-955 h-[152px] overflow-y-auto space-y-1.5 flex flex-col justify-start text-[9px] border-b border-gray-100 dark:border-zinc-800 text-left">
                <div className="text-center text-[7px] text-gray-400 mb-0.5 leading-tight">
                  Please fill out the form below to start chatting with us.
                </div>
                {Object.keys(preChatForm.fields).map(key => {
                  const field = preChatForm.fields[key];
                  if (!field.enabled) return null;
                  return (
                    <div key={key} className="space-y-0.5">
                      <label className="block text-[7px] font-bold text-gray-500 uppercase">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      <div className="w-full px-2 py-0.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded text-gray-400 text-[7px] truncate leading-tight">
                        {field.placeholder}
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  style={{ backgroundColor: color }}
                  className="w-full py-1.5 rounded-lg text-white font-bold text-[8px] text-center shadow-xs mt-1"
                >
                  Start Chat
                </button>
              </div>
            ) : (
              <>
                {/* Simulated Message Bubbles */}
                <div
                  style={{
                    backgroundColor: bgType === 'solid' ? bgColor : '#efeae2',
                    backgroundImage: bgType === 'image' && bgImage ? `url(${bgImage})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }}
                  className="p-3 h-28 overflow-y-auto space-y-2 flex flex-col justify-end"
                >
                  <div className={`text-center text-[9px] p-2 shadow-xs rounded border leading-relaxed ${themeMode === 'dark' ? 'bg-[#27272a]/95 text-gray-300 border-gray-800' : 'bg-white bg-opacity-95 text-gray-700 border-gray-100'}`}>
                    {welcomeMessage || "Welcome! We're here to help you live chat with your visitors."}
                  </div>

                  <div className="flex justify-center mb-0.5">
                    <span className="text-[8px] px-2 py-0.5 rounded-md flex items-center space-x-1"
                      style={{
                        backgroundColor: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                        color: '#8696a0'
                      }}>
                      <Lock size={9} className="text-[#8696a0]" />
                      <span>End-to-end encrypted</span>
                    </span>
                  </div>

                  <div className="flex justify-start">
                    <div className={`rounded-lg rounded-tl-none px-2 py-1 max-w-[85%] shadow-xs text-[10px] ${themeMode === 'dark' ? 'bg-[#26262b] text-white border border-gray-800' : 'bg-white text-gray-800'}`}>
                      How can we assist you today?
                    </div>
                  </div>
                </div>

                {/* Simulated Input Area */}
                <div className={`p-2 flex flex-col items-center border-t ${themeMode === 'dark' ? 'bg-[#27272a] border-gray-800' : 'bg-gray-100 border-gray-200'}`}>
                  {/* Branding "Powered by o-chat" */}
                  <div className="flex justify-center mb-1 select-none opacity-60 hover:opacity-100 transition-opacity">
                    <a
                      href="https://o-chat.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[8px] tracking-wide font-medium flex items-center space-x-0.5 hover:underline cursor-pointer"
                      style={{ color: themeMode === 'dark' ? '#8696a0' : '#667781' }}
                    >
                      <span>Powered by</span>
                      <span className="font-bold" style={{ color: color }}>o-chat</span>
                    </a>
                  </div>
                  <div className="flex items-center space-x-1.5 w-full">
                    <div className={`flex-1 rounded-full px-3 py-1 text-[10px] border ${themeMode === 'dark' ? 'bg-[#18181b] text-gray-500 border-gray-750' : 'bg-white text-gray-400 border-gray-300'}`}>
                      Type a message
                    </div>
                    <button
                      type="button"
                      style={{ backgroundColor: color }}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0"
                    >
                      <Send size={8} className="ml-0.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Bubble Trigger Button */}
          {isSideTab ? (
            <button
              type="button"
              style={{ backgroundColor: color }}
              className={`flex flex-col items-center justify-center text-white shadow-md border-t border-b border-white/10 ${position === 'right' ? 'rounded-l-xl rounded-r-none border-l' : 'rounded-r-xl rounded-l-none border-r'} py-3 px-1.5 w-7 text-[8px]`}
            >
              <MessageCircle size={12} className="mb-1" />
              <span
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                className="font-semibold uppercase tracking-wider select-none whitespace-nowrap"
              >
                {launcherText || 'Chat'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              style={{ backgroundColor: color }}
              className={`flex items-center justify-center text-white shadow-lg transform transition hover:scale-105 active:scale-95 ${launcherType === 'text_and_icon' ? 'px-4 py-2.5 rounded-full space-x-1.5 h-auto w-auto' : 'w-12 h-12 rounded-full'}`}
            >
              <MessageCircle size={launcherType === 'text_and_icon' ? 18 : 22} />
              {launcherType === 'text_and_icon' && (
                <span className="text-xs font-semibold whitespace-nowrap pr-0.5">{launcherText || 'Chat'}</span>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderDesignForm = () => (
    <form onSubmit={handleSaveGeneral} className="space-y-5 text-left">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-605 uppercase mb-1">Target Domain</label>
          <input
            type="text"
            required
            disabled={!isWidgetAdmin}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="e.g. yourwebsite.com"
            className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] outline-none disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-605 uppercase mb-1">Company Name</label>
          <input
            type="text"
            required
            disabled={!isWidgetAdmin}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Ochat Support"
            className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] outline-none disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-605 uppercase mb-1">Chat Widget Title</label>
          <input
            type="text"
            required
            disabled={!isWidgetAdmin}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Chat with us"
            className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] outline-none disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-650 uppercase mb-1">Theme Color</label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              disabled={!isWidgetAdmin}
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-9 p-0 border border-gray-300 rounded-md cursor-pointer outline-none"
            />
            <input
              type="text"
              maxLength={7}
              disabled={!isWidgetAdmin}
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full px-3 py-1.5 text-sm font-mono border border-gray-300 rounded-lg uppercase outline-none focus:ring-2 focus:ring-[#00a884]"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-605 uppercase mb-1">Welcome Greeting Message</label>
        <textarea
          rows={2}
          disabled={!isWidgetAdmin}
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
          placeholder="Welcome message displayed at the top of chat..."
          className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] outline-none disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-605 uppercase mb-1">Bottom Spacing (px)</label>
          <input
            type="number"
            min={0}
            max={200}
            disabled={!isWidgetAdmin}
            value={spacingBottom}
            onChange={(e) => setSpacingBottom(e.target.value)}
            className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] outline-none disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-605 uppercase mb-1">Side Spacing (px)</label>
          <input
            type="number"
            min={0}
            max={200}
            disabled={!isWidgetAdmin}
            value={spacingSide}
            onChange={(e) => setSpacingSide(e.target.value)}
            className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] outline-none disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-650 uppercase mb-2">Theme Mode</label>
          <div className="flex space-x-2">
            {[
              { mode: 'light', label: 'Light Mode' },
              { mode: 'dark', label: 'Dark Mode' }
            ].map((item) => (
              <button
                key={item.mode}
                type="button"
                disabled={!isWidgetAdmin}
                onClick={() => setThemeMode(item.mode)}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition ${themeMode === item.mode ? 'bg-gray-800 text-white border-gray-800 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-650 uppercase mb-2">Launcher Style</label>
          <div className="flex space-x-2">
            {[
              { type: 'icon_only', label: 'Icon Only' },
              { type: 'text_and_icon', label: 'Text & Icon' },
              { type: 'side_tab', label: 'Side Tab' }
            ].map((item) => (
              <button
                key={item.type}
                type="button"
                disabled={!isWidgetAdmin}
                onClick={() => setLauncherType(item.type)}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition ${launcherType === item.type ? 'bg-gray-800 text-white border-gray-800 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(launcherType === 'text_and_icon' || launcherType === 'side_tab') && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <label className="block text-xs font-semibold text-gray-605 uppercase mb-1">Launcher Tab/Button Text</label>
          <input
            type="text"
            maxLength={15}
            disabled={!isWidgetAdmin}
            value={launcherText}
            onChange={(e) => setLauncherText(e.target.value)}
            placeholder="e.g. Chat"
            className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] outline-none disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-650 uppercase mb-2">Widget Screen Position</label>
          <div className="flex space-x-2">
            {['left', 'right'].map((pos) => (
              <button
                key={pos}
                type="button"
                disabled={!isWidgetAdmin}
                onClick={() => setPosition(pos)}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border capitalize transition ${position === pos ? 'bg-gray-800 text-white border-gray-800 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                {pos} Side
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-650 uppercase mb-2">Widget Status</label>
          <button
            type="button"
            disabled={!isWidgetAdmin}
            onClick={() => setIsActive(!isActive)}
            className={`w-full py-2 px-4 rounded-lg text-sm font-medium border flex items-center justify-center transition ${isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
          >
            {isActive ? (
              <>
                <ToggleRight size={20} className="mr-2 text-green-600" /> Widget Active (Enabled)
              </>
            ) : (
              <>
                <ToggleLeft size={20} className="mr-2 text-gray-400" /> Widget Inactive (Disabled)
              </>
            )}
          </button>
        </div>
      </div>

      <div className="border-t border-gray-150 pt-4">
        <h3 className="text-xs font-semibold text-gray-605 uppercase mb-2.5">Chat Window Background</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Background Type</label>
            <div className="flex space-x-2">
              {[
                { type: 'image', label: 'Wallpaper Pattern' },
                { type: 'solid', label: 'Solid Color' }
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  disabled={!isWidgetAdmin}
                  onClick={() => setBgType(item.type)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border transition ${bgType === item.type ? 'bg-gray-800 text-white border-gray-800 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {bgType === 'solid' ? (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Solid Color</label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  disabled={!isWidgetAdmin}
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-8 h-8 p-0 border border-gray-300 rounded-md cursor-pointer outline-none"
                />
                <input
                  type="text"
                  maxLength={7}
                  disabled={!isWidgetAdmin}
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-full px-3 py-1 text-xs font-mono border border-gray-300 rounded-lg uppercase outline-none focus:ring-2 focus:ring-[#00a884]"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Custom Wallpaper Image</label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={!isWidgetAdmin || isUploadingBg}
                  onClick={() => bgFileInputRef.current?.click()}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-150 hover:bg-gray-200 border border-gray-255 text-gray-700 text-xs rounded-lg font-semibold transition active:scale-95 disabled:opacity-50"
                >
                  {isUploadingBg ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  <span>Upload Image</span>
                </button>
                <input
                  type="file"
                  ref={bgFileInputRef}
                  onChange={handleBgUpload}
                  accept="image/*"
                  className="hidden"
                />
                {bgImage && (
                  <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{bgImage.split('/').pop()}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {bgType === 'image' && (
          <div className="mt-3 animate-in fade-in duration-200">
            <label className="block text-xs text-gray-500 mb-1.5">Preset Wallpapers</label>
            <div className="flex items-center space-x-3 overflow-x-auto pb-1">
              {[
                { name: 'WhatsApp Classic', url: 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png' },
                { name: 'Elegant Mesh', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80' },
                { name: 'Soft Gradient', url: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=400&q=80' },
                { name: 'Clean Paper', url: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=400&q=80' },
                { name: 'Abstract Sky', url: 'https://images.unsplash.com/photo-1507499739999-097706ad8914?auto=format&fit=crop&w=400&q=80' }
              ].map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  disabled={!isWidgetAdmin}
                  onClick={() => setBgImage(preset.url)}
                  style={{ backgroundImage: `url(${preset.url})` }}
                  className={`w-12 h-12 rounded-lg border-2 bg-cover bg-center flex-shrink-0 relative transition hover:scale-105 active:scale-95 ${bgImage === preset.url ? 'border-[#00a884] ring-2 ring-[#00a884]/20' : 'border-gray-200 hover:border-gray-300'}`}
                  title={preset.name}
                >
                  {bgImage === preset.url && (
                    <div className="absolute inset-0 bg-[#00a884]/20 flex items-center justify-center rounded-md">
                      <Check size={14} className="text-white bg-[#00a884] rounded-full p-0.5" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-150 pt-4">
        <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2.5">Widget Logo</h3>
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
            {logo ? (
              <img src={logo} alt="Widget Logo" className="w-full h-full object-cover" />
            ) : (
              <Globe size={24} className="text-gray-400" />
            )}
          </div>
          <div className="space-y-1.5 text-left">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={!isWidgetAdmin || isUploadingLogo}
                onClick={() => logoFileInputRef.current?.click()}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-250 border border-gray-300 text-gray-700 text-xs rounded-lg font-semibold transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isUploadingLogo ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                <span>Upload Logo</span>
              </button>
              <input
                type="file"
                ref={logoFileInputRef}
                onChange={handleLogoUpload}
                accept="image/*"
                className="hidden"
              />
              {logo && (
                <button
                  type="button"
                  disabled={!isWidgetAdmin}
                  onClick={() => setLogo('')}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 hover:bg-red-50 rounded-md transition cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-400">
              This logo will be shown in the chat widget header when automated messages are sent, or when no agents are currently viewing/inside the chat inbox.
            </p>
          </div>
        </div>
      </div>

      {isWidgetAdmin && (
        <div className="flex justify-end pt-4 border-t border-gray-150">
          <button
            type="submit"
            disabled={isUpdating}
            className="bg-[#00a884] hover:bg-[#008f6f] text-white font-semibold py-2 px-6 rounded-lg shadow-xs flex items-center transition active:scale-95 disabled:opacity-50 cursor-pointer animate-in fade-in duration-200"
          >
            {isUpdating ? <Loader2 size={18} className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
            Save Design Settings
          </button>
        </div>
      )}
    </form>
  );

  const renderFaqsForm = () => (
    <form onSubmit={handleSaveGeneral} className="space-y-5 text-left">
      <div className="flex items-center justify-between border-b pb-3 mb-1">
        <div className="flex items-center space-x-2">
          <MessageCircle className="text-[#00a884]" size={20} />
          <div>
            <h2 className="text-lg font-bold text-gray-805">Default Questions & Auto-Answers (FAQs)</h2>
            <p className="text-xs text-gray-500">Define pre-recorded Q&A cards that trigger instant replies when clicked.</p>
          </div>
        </div>
        {isWidgetAdmin && (
          <button
            type="button"
            disabled={faqs.length >= 4}
            onClick={() => setFaqs([...faqs, { question: '', answer: '' }])}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg font-semibold transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            + Add Question
          </button>
        )}
      </div>

      <div className="space-y-4">
        {faqs.map((faq, idx) => (
          <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative group/faq animate-in fade-in slide-in-from-top-1 duration-200 text-left">
            {isWidgetAdmin && (
              <button
                type="button"
                onClick={() => {
                  const newFaqs = faqs.filter((_, i) => i !== idx);
                  setFaqs(newFaqs.length > 0 ? newFaqs : [{ question: '', answer: '' }]);
                }}
                className="absolute top-3 right-3 text-gray-400 hover:text-red-500 p-1 rounded-md hover:bg-gray-200/50 transition active:scale-90 cursor-pointer"
                title="Delete Question"
              >
                <Trash2 size={15} />
              </button>
            )}
            <div className="grid grid-cols-1 gap-3 mr-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Question {idx + 1}</label>
                <input
                  type="text"
                  disabled={!isWidgetAdmin}
                  value={faq.question}
                  onChange={(e) => {
                    const newFaqs = [...faqs];
                    newFaqs[idx].question = e.target.value;
                    setFaqs(newFaqs);
                  }}
                  placeholder="e.g. Do you have a pricing sheet?"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#00a884] bg-white outline-none disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Auto-Answer {idx + 1}</label>
                <textarea
                  rows={2}
                  disabled={!isWidgetAdmin}
                  value={faq.answer}
                  onChange={(e) => {
                    const newFaqs = [...faqs];
                    newFaqs[idx].answer = e.target.value;
                    setFaqs(newFaqs);
                  }}
                  placeholder="e.g. Yes! You can view our pricing details at website.com/pricing."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#00a884] bg-white outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  style={{ resize: 'none' }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {isWidgetAdmin && (
        <div className="flex justify-end pt-4 border-t border-gray-150">
          <button
            type="submit"
            disabled={isUpdating}
            className="bg-[#00a884] hover:bg-[#008f6f] text-white font-semibold py-2 px-6 rounded-lg shadow-xs flex items-center transition active:scale-95 disabled:opacity-50 cursor-pointer animate-in fade-in duration-200"
          >
            {isUpdating ? <Loader2 size={18} className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
            Save FAQ Answers
          </button>
        </div>
      )}
    </form>
  );

  const renderOfflineFormSettings = () => {
    const handleAddField = () => {
      setOfflineForm(prev => {
        const fields = [...(prev.fields || [])];
        const newId = `custom_field_${Date.now()}`;
        fields.push({
          id: newId,
          label: 'Custom Field',
          type: 'text',
          required: false,
          placeholder: 'Enter details...'
        });
        return { ...prev, fields };
      });
    };

    const handleRemoveField = (id) => {
      setOfflineForm(prev => {
        const fields = (prev.fields || []).filter(f => f.id !== id);
        return { ...prev, fields };
      });
    };

    const handleFieldChange = (id, key, value) => {
      setOfflineForm(prev => {
        const fields = (prev.fields || []).map(f => {
          if (f.id === id) {
            const updated = { ...f, [key]: value };
            if (key === 'label' && f.id.startsWith('custom_field_')) {
              updated.id = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_+|_+$)/g, '');
              if (!updated.id) updated.id = id;
            }
            return updated;
          }
          return f;
        });
        return { ...prev, fields };
      });
    };

    return (
      <form onSubmit={handleSaveGeneral} className="space-y-5 text-left">
        <div className="flex items-center justify-between border-b pb-3 mb-1">
          <div className="flex items-center space-x-2">
            <Mail className="text-[#00a884]" size={20} />
            <div>
              <h2 className="text-lg font-bold text-gray-805">Widget Offline Lead Form</h2>
              <p className="text-xs text-gray-500">Collect visitor queries in a form when all support agents are offline.</p>
            </div>
          </div>
          <button
            type="button"
            disabled={!isWidgetAdmin}
            onClick={() => setOfflineForm(prev => ({ ...prev, enabled: !prev.enabled }))}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition active:scale-95 cursor-pointer ${offlineForm.enabled
              ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
              }`}
          >
            {offlineForm.enabled ? '✓ Enabled' : 'Disabled'}
          </button>
        </div>

        {offlineForm.enabled && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header Text Settings */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
              <h3 className="text-xs font-bold text-gray-655 uppercase tracking-wider">Form Header Texts</h3>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Form Title</label>
                <input
                  type="text"
                  disabled={!isWidgetAdmin}
                  value={offlineForm.title || ''}
                  onChange={(e) => setOfflineForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg outline-none border bg-white border-gray-300 focus:ring-1 focus:ring-[#00a884]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Greeting/Instructions Message</label>
                <textarea
                  rows={2}
                  disabled={!isWidgetAdmin}
                  value={offlineForm.message || ''}
                  onChange={(e) => setOfflineForm(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg outline-none border bg-white border-gray-300 focus:ring-1 focus:ring-[#00a884] resize-none"
                />
              </div>
            </div>

            {/* Fields Settings */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-655 uppercase tracking-wider">Form Input Fields</h3>
                {isWidgetAdmin && (
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="bg-emerald-50 hover:bg-emerald-100 text-[#00a884] border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer"
                  >
                    + Add Field
                  </button>
                )}
              </div>

              {(offlineForm.fields || []).map((field, idx) => {
                const isDefaultField = ['name', 'email', 'phone', 'message'].includes(field.id);
                return (
                  <div key={field.id} className="bg-white p-4 rounded-xl border border-gray-200 space-y-3 shadow-xs">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">Field #{idx + 1}</span>
                        {isDefaultField && (
                          <span className="text-[10px] bg-gray-150 text-gray-600 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                            Standard
                          </span>
                        )}
                      </div>
                      {!isDefaultField && isWidgetAdmin && (
                        <button
                          type="button"
                          onClick={() => handleRemoveField(field.id)}
                          className="text-red-500 hover:text-red-750 text-xs font-semibold hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Field Label</label>
                        <input
                          type="text"
                          disabled={!isWidgetAdmin}
                          value={field.label}
                          onChange={(e) => handleFieldChange(field.id, 'label', e.target.value)}
                          placeholder="e.g. Order ID, Location..."
                          className="w-full px-3 py-2 text-sm rounded-lg outline-none border bg-white border-gray-200 focus:ring-1 focus:ring-[#00a884]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Input Type</label>
                        <select
                          disabled={!isWidgetAdmin || isDefaultField}
                          value={field.type}
                          onChange={(e) => handleFieldChange(field.id, 'type', e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-lg outline-none border bg-white border-gray-200 focus:ring-1 focus:ring-[#00a884] cursor-pointer"
                        >
                          <option value="text">Single Line Text</option>
                          <option value="email">Email Address</option>
                          <option value="tel">Phone Number</option>
                          <option value="textarea">Multi-line Textbox</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Placeholder Text</label>
                        <input
                          type="text"
                          disabled={!isWidgetAdmin}
                          value={field.placeholder || ''}
                          onChange={(e) => handleFieldChange(field.id, 'placeholder', e.target.value)}
                          placeholder="Instructions inside field..."
                          className="w-full px-3 py-2 text-sm rounded-lg outline-none border bg-white border-gray-200 focus:ring-1 focus:ring-[#00a884]"
                        />
                      </div>

                      <div className="flex items-center space-x-2 pt-5">
                        <input
                          type="checkbox"
                          id={`req-${field.id}`}
                          disabled={!isWidgetAdmin}
                          checked={field.required}
                          onChange={(e) => handleFieldChange(field.id, 'required', e.target.checked)}
                          className="w-4 h-4 text-[#00a884] border-gray-300 rounded focus:ring-[#00a884]"
                        />
                        <label htmlFor={`req-${field.id}`} className="text-xs font-semibold text-gray-650 cursor-pointer select-none">
                          Required Field
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isWidgetAdmin && (
          <button
            type="submit"
            disabled={isUpdating}
            className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white py-2.5 rounded-lg text-sm font-semibold transition shadow-sm flex items-center justify-center space-x-2 active:scale-98 cursor-pointer"
          >
            <Save size={16} />
            <span>Save Offline Form Settings</span>
          </button>
        )}
      </form>
    );
  };

  const renderPreChatFormSettings = () => {
    const handleFieldToggle = (fieldName, property) => {
      setPreChatForm(prev => {
        const updatedFields = { ...prev.fields };
        updatedFields[fieldName] = {
          ...updatedFields[fieldName],
          [property]: !updatedFields[fieldName][property]
        };
        // If disabled, it cannot be required
        if (property === 'enabled' && !updatedFields[fieldName].enabled) {
          updatedFields[fieldName].required = false;
        }
        // If required is enabled, then enabled must be true
        if (property === 'required' && updatedFields[fieldName].required) {
          updatedFields[fieldName].enabled = true;
        }
        return { ...prev, fields: updatedFields };
      });
    };

    const handleTextChange = (fieldName, property, value) => {
      setPreChatForm(prev => {
        const updatedFields = { ...prev.fields };
        updatedFields[fieldName] = {
          ...updatedFields[fieldName],
          [property]: value
        };
        return { ...prev, fields: updatedFields };
      });
    };

    return (
      <form onSubmit={handleSaveGeneral} className="space-y-5 text-left">
        <div className="flex items-center justify-between border-b pb-3 mb-1">
          <div className="flex items-center space-x-2">
            <ClipboardList className="text-[#00a884]" size={20} />
            <div>
              <h2 className="text-lg font-bold text-gray-805">Pre-Chat Registration Form</h2>
              <p className="text-xs text-gray-500">Collect visitor information before starting a chat session.</p>
            </div>
          </div>
          <button
            type="button"
            disabled={!isWidgetAdmin}
            onClick={() => setPreChatForm(prev => ({ ...prev, enabled: !prev.enabled }))}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition active:scale-95 cursor-pointer ${preChatForm.enabled
              ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
              }`}
          >
            {preChatForm.enabled ? '✓ Enabled' : 'Disabled'}
          </button>
        </div>

        {preChatForm.enabled && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {Object.keys(preChatForm.fields).map((key) => {
              const field = preChatForm.fields[key];
              return (
                <div key={key} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700 capitalize">{key} Field</span>
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center space-x-1.5 text-xs text-gray-650 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!isWidgetAdmin}
                          checked={field.enabled}
                          onChange={() => handleFieldToggle(key, 'enabled')}
                          className="rounded text-[#00a884] focus:ring-[#00a884] w-3.5 h-3.5"
                        />
                        <span>Show</span>
                      </label>
                      <label className="flex items-center space-x-1.5 text-xs text-gray-650 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!isWidgetAdmin}
                          checked={field.required}
                          onChange={() => handleFieldToggle(key, 'required')}
                          className="rounded text-[#00a884] focus:ring-[#00a884] w-3.5 h-3.5"
                        />
                        <span>Required</span>
                      </label>
                    </div>
                  </div>

                  {field.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in slide-in-from-top-1 duration-200">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Field Label</label>
                        <input
                          type="text"
                          disabled={!isWidgetAdmin}
                          value={field.label}
                          onChange={(e) => handleTextChange(key, 'label', e.target.value)}
                          className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-[#00a884] bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Placeholder Text</label>
                        <input
                          type="text"
                          disabled={!isWidgetAdmin}
                          value={field.placeholder}
                          onChange={(e) => handleTextChange(key, 'placeholder', e.target.value)}
                          className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-[#00a884] bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isWidgetAdmin && (
          <div className="flex justify-end pt-4 border-t border-gray-150">
            <button
              type="submit"
              disabled={isUpdating}
              className="bg-[#00a884] hover:bg-[#008f6f] text-white font-semibold py-2 px-6 rounded-lg shadow-xs flex items-center transition active:scale-95 disabled:opacity-50 cursor-pointer animate-in fade-in duration-200"
            >
              {isUpdating ? <Loader2 size={18} className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
              Save Pre-Chat Settings
            </button>
          </div>
        )}
      </form>
    );
  };

  const renderAccessControl = () => (
    <div className="space-y-6 text-left">
      {/* Invite Form (Widget Admins only) */}
      {isWidgetAdmin ? (
        <div className="space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Invite Employee</h3>
          <form onSubmit={searchUsers} className="space-y-2">
            <div className="relative">
              <input
                type="email"
                placeholder="Type user's email address..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] bg-white outline-none"
              />
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full py-2 px-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] outline-none"
                >
                  <option value="agent">Chat Agent</option>
                  <option value="admin">Widget Admin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchEmail.trim()}
                className="bg-gray-800 hover:bg-gray-900 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50 flex items-center justify-center transition duration-200 active:scale-95 cursor-pointer"
              >
                {isSearching ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
              </button>
            </div>
          </form>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-3 bg-white rounded-lg border border-gray-200 p-2 max-h-48 overflow-y-auto divide-y divide-gray-50">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2 px-2 tracking-wide">Matches found:</h4>
              {searchResults.map(result => (
                <div key={result._id} className="flex justify-between items-center py-2 px-2 first:pt-0 last:pb-0">
                  <div className="overflow-hidden mr-2">
                    <p className="text-xs font-semibold text-gray-800 truncate">{result.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{result.email}</p>
                  </div>
                  <button
                    onClick={() => handleAddUser(result)}
                    disabled={isUpdating}
                    className="bg-[#00a884] hover:bg-[#008f6f] text-white p-1.5 rounded-lg flex items-center transition disabled:opacity-50 active:scale-90 cursor-pointer"
                    title={`Send invite as ${inviteRole}`}
                  >
                    <UserPlus size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 bg-orange-50 border border-orange-100 text-orange-700 rounded-lg text-xs">
          You are viewing this widget as a Chat Agent. You cannot invite or manage users.
        </div>
      )}

      {/* Authorized Users List */}
      <div className="space-y-3">
        <div className="flex justify-between items-center border-b pb-2">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Authorized Users</h4>
          <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{authorizedUsers.length + 1}</span>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {/* Widget Owner Item */}
          <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-150">
            <div className="flex items-center space-x-3 overflow-hidden mr-2">
              {ownerProfilePic ? (
                <img src={ownerProfilePic} alt="avatar" className="w-8 h-8 rounded-full object-cover border border-gray-250 bg-white flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs border border-purple-100 flex-shrink-0">
                  {(ownerNickname || (isOwnedWidget ? user?.name : widget.ownerName) || 'O').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="overflow-hidden">
                <div className="flex items-center space-x-1.5">
                  <p className="text-xs font-semibold text-gray-800 truncate">
                    {ownerNickname || (isOwnedWidget ? user?.name : widget.ownerName) || 'Owner'}
                  </p>
                  <span className="text-[8px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                    Owner
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 truncate">{ownerDesignation || 'Widget Owner'}</p>
              </div>
            </div>
            {isWidgetAdmin && (
              <button
                type="button"
                onClick={() => setEditingUserProfile({
                  userId: isOwnedWidget ? user?._id : 'owner',
                  name: isOwnedWidget ? user?.name : (widget.ownerName || 'Owner'),
                  nickname: ownerNickname,
                  designation: ownerDesignation,
                  profilePic: ownerProfilePic,
                  isOwner: true,
                  fileInputRef: editingUserFileRef
                })}
                className="text-xs bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded px-2.5 py-1 shadow-xs active:scale-95 transition cursor-pointer"
              >
                Edit Profile
              </button>
            )}
          </div>

          {authorizedUsers.map(u => {
            const uId = u.user?._id || u.user;
            const isSelf = uId && uId.toString() === user?._id.toString();
            return (
              <div key={uId || Math.random()} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-150">
                <div className="flex items-center space-x-3 overflow-hidden mr-2">
                  {u.profilePic ? (
                    <img src={u.profilePic} alt="avatar" className="w-8 h-8 rounded-full object-cover border border-gray-250 bg-white flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-100 flex-shrink-0">
                      {(u.nickname || u.user?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <div className="flex items-center space-x-1.5">
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {u.nickname || u.user?.name || 'Unknown'}
                      </p>
                      {!isWidgetAdmin || isSelf ? (
                        <span className={`text-[8px] uppercase font-extrabold px-1.5 py-0.5 rounded ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {u.role === 'admin' ? 'Admin' : 'Agent'}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-gray-500 truncate">
                      {u.designation || (u.role === 'admin' ? 'Widget Admin' : 'Agent')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {isWidgetAdmin && (
                    <button
                      type="button"
                      onClick={() => setEditingUserProfile({
                        userId: uId,
                        name: u.user?.name,
                        nickname: u.nickname || '',
                        designation: u.designation || '',
                        profilePic: u.profilePic || '',
                        isOwner: false,
                        fileInputRef: editingUserFileRef
                      })}
                      className="text-xs bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded px-2.5 py-1 shadow-xs active:scale-95 transition cursor-pointer"
                    >
                      Edit Profile
                    </button>
                  )}

                  {isWidgetAdmin && !isSelf && (
                    <select
                      value={u.role}
                      onChange={(e) => handleChangeRole(uId, e.target.value)}
                      disabled={isUpdating}
                      className="text-xs bg-white border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#00a884]"
                    >
                      <option value="agent">Agent</option>
                      <option value="admin">Widget Admin</option>
                    </select>
                  )}

                  {isWidgetAdmin && (
                    <button
                      onClick={() => handleRemoveUser(uId)}
                      disabled={isUpdating}
                      className="text-red-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition disabled:opacity-50 cursor-pointer"
                      title="Remove User"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Requests List */}
      {pendingUsers.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b pb-2">
            <h4 className="text-xs font-bold text-orange-600 uppercase tracking-wider">Pending Invites</h4>
            <span className="text-xs font-semibold bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">{pendingUsers.length}</span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {pendingUsers.map(u => (
              <div key={u.user?._id || Math.random()} className="flex justify-between items-center bg-orange-50/30 p-2.5 rounded-lg border border-orange-100">
                <div className="overflow-hidden mr-2">
                  <div className="flex items-center space-x-1.5">
                    <p className="text-xs font-semibold text-gray-800 truncate">{u.user?.name || 'Unknown'}</p>
                    <span className={`text-[8px] uppercase font-extrabold px-1.5 py-0.5 rounded ${u.role === 'admin' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                      {u.role === 'admin' ? 'Admin' : 'Agent'}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-550 truncate">{u.user?.email || ''}</p>
                  <span className="text-[9px] font-medium text-orange-500">Awaiting approval</span>
                </div>
                {isWidgetAdmin && (
                  <button
                    onClick={() => handleCancelInvite(u.user?._id)}
                    disabled={isUpdating}
                    className="text-gray-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition disabled:opacity-50 cursor-pointer"
                    title="Cancel Invite"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderInstallScript = () => (
    <div className="space-y-5 text-left">
      <p className="text-xs text-gray-500">Copy and paste this script tag into your website's HTML source (before the closing <code>&lt;/body&gt;</code> tag) to display Ochat on your site.</p>

      <div className="relative group">
        <pre className="bg-gray-855 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono whitespace-pre-wrap leading-relaxed border border-gray-700">
          {getScriptCode()}
        </pre>
        <button
          onClick={copyToClipboard}
          className="absolute top-3 right-3 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition shadow-md active:scale-90 cursor-pointer animate-in fade-in"
          title="Copy to clipboard"
        >
          {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#f0f2f5] p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/configure')}
              className="p-2 bg-white rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 shadow-sm transition hover:scale-105 active:scale-95"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-gray-800 truncate">{domain}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                  {isActive ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">Widget Settings &bull; Role: <strong className="capitalize">{myRole === 'owner' ? 'Owner' : (myRole === 'admin' ? 'Widget Admin' : 'Agent')}</strong></p>
            </div>
          </div>

          {isOwnedWidget && (
            <button
              onClick={handleDeleteWidget}
              disabled={isUpdating}
              className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 border border-red-200 rounded-lg text-sm font-semibold flex items-center shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              <Trash2 size={16} className="mr-2" /> Delete Widget
            </button>
          )}
        </div>

        <div className="hidden lg:flex border-b border-gray-200 overflow-x-auto no-scrollbar whitespace-nowrap bg-white rounded-xl p-1.5 shadow-xs border border-gray-150 mb-6 gap-1">
          {[
            { id: 'design', name: 'Design & Basics', icon: Palette },
            { id: 'faqs', name: 'Auto-Answers (FAQs)', icon: MessageCircle },
            { id: 'prechat', name: 'Pre-Chat Form', icon: ClipboardList },
            { id: 'offline', name: 'Offline Form', icon: Mail },
            { id: 'access', name: 'Team Access', icon: UserCheck },
            { id: 'install', name: 'Install Script', icon: Code }
          ].map(tab => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition active:scale-95 cursor-pointer flex-shrink-0 ${isSelected
                  ? 'bg-[#00a884] text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
              >
                <Icon size={16} />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Desktop Layout Grid (screen width >= lg) */}
        <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Column - Form Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-6">
              {activeTab === 'design' && renderDesignForm()}
              {activeTab === 'faqs' && renderFaqsForm()}
              {activeTab === 'prechat' && (
                <div className="animate-in fade-in duration-200">
                  {renderPreChatFormSettings()}
                </div>
              )}
              {activeTab === 'offline' && (
                <div className="animate-in fade-in duration-200">
                  {renderOfflineFormSettings()}
                </div>
              )}
              {activeTab === 'access' && (
                <div className="space-y-6">
                  <div className="flex items-center space-x-2 border-b pb-3 mb-1">
                    <UserCheck className="text-[#00a884]" size={20} />
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">Team Access Control</h2>
                      <p className="text-xs text-gray-500">Authorize and configure agent widget profiles or invite new members.</p>
                    </div>
                  </div>
                  {renderAccessControl()}
                </div>
              )}
              {activeTab === 'install' && (
                <div className="space-y-5">
                  <div className="flex items-center space-x-2 border-b pb-3 mb-1">
                    <Code className="text-purple-500" size={20} />
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">Embed Script Tag</h2>
                      <p className="text-xs text-gray-500">Add the tag below before the closing body tag of your website HTML.</p>
                    </div>
                  </div>
                  {renderInstallScript()}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Sticky Preview sidebar */}
          <div className="lg:col-span-1 sticky top-6 space-y-6">
            <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-6">
              <div className="flex items-center space-x-2 border-b pb-3 mb-4">
                <Globe className="text-blue-500" size={20} />
                <h2 className="text-lg font-bold text-gray-800">Live Appearance Preview</h2>
              </div>
              <p className="text-xs text-gray-500 mb-4">Real-time styling rendering matching your widget specifications.</p>
              {renderLivePreviewElement()}
            </div>
          </div>
        </div>

        {/* Mobile Layout Grid (screen width < lg) */}
        <div className="lg:hidden space-y-4">
          {/* Collapsible Live Preview Card */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsMobilePreviewExpanded(!isMobilePreviewExpanded)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition cursor-pointer font-bold text-gray-800 text-sm border-b border-gray-200 outline-none"
            >
              <div className="flex items-center space-x-2">
                <Globe size={16} className="text-blue-500" />
                <span>📱 Live Appearance Preview</span>
              </div>
              {isMobilePreviewExpanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>
            {isMobilePreviewExpanded && (
              <div className="p-4 bg-white animate-in slide-in-from-top-1 duration-200 border-t border-gray-100">
                {renderLivePreviewElement()}
              </div>
            )}
          </div>

          {/* Accordion 1: Design & Basics */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedAccordion(expandedAccordion === 'design' ? null : 'design')}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition cursor-pointer font-bold text-gray-800 text-sm outline-none"
            >
              <div className="flex items-center space-x-2">
                <Palette size={16} className="text-[#00a884]" />
                <span>Design & Basics</span>
              </div>
              {expandedAccordion === 'design' ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>
            {expandedAccordion === 'design' && (
              <div className="p-5 border-t border-gray-100 animate-in slide-in-from-top-1 duration-200">
                {renderDesignForm()}
              </div>
            )}
          </div>

          {/* Accordion 2: Auto-Answers (FAQs) */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedAccordion(expandedAccordion === 'faqs' ? null : 'faqs')}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition cursor-pointer font-bold text-gray-800 text-sm outline-none"
            >
              <div className="flex items-center space-x-2">
                <MessageCircle size={16} className="text-[#00a884]" />
                <span>Auto-Answers (FAQs)</span>
              </div>
              {expandedAccordion === 'faqs' ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>
            {expandedAccordion === 'faqs' && (
              <div className="p-5 border-t border-gray-100 animate-in slide-in-from-top-1 duration-200">
                {renderFaqsForm()}
              </div>
            )}
          </div>

          {/* Accordion 2.5: Pre-Chat Form */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedAccordion(expandedAccordion === 'prechat' ? null : 'prechat')}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition cursor-pointer font-bold text-gray-808 text-sm outline-none"
            >
              <div className="flex items-center space-x-2">
                <ClipboardList size={16} className="text-[#00a884]" />
                <span>Pre-Chat Form</span>
              </div>
              {expandedAccordion === 'prechat' ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>
            {expandedAccordion === 'prechat' && (
              <div className="p-5 border-t border-gray-100 animate-in slide-in-from-top-1 duration-200">
                {renderPreChatFormSettings()}
              </div>
            )}
          </div>

          {/* Accordion: Offline Form */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedAccordion(expandedAccordion === 'offline' ? null : 'offline')}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition cursor-pointer font-bold text-gray-808 text-sm outline-none"
            >
              <div className="flex items-center space-x-2">
                <Mail size={16} className="text-[#00a884]" />
                <span>Offline Form</span>
              </div>
              {expandedAccordion === 'offline' ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>
            {expandedAccordion === 'offline' && (
              <div className="p-5 border-t border-gray-100 animate-in slide-in-from-top-1 duration-200">
                {renderOfflineFormSettings()}
              </div>
            )}
          </div>

          {/* Accordion 3: Team Access */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedAccordion(expandedAccordion === 'access' ? null : 'access')}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition cursor-pointer font-bold text-gray-800 text-sm outline-none"
            >
              <div className="flex items-center space-x-2">
                <UserCheck size={16} className="text-[#00a884]" />
                <span>Team Access Control</span>
              </div>
              {expandedAccordion === 'access' ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>
            {expandedAccordion === 'access' && (
              <div className="p-5 border-t border-gray-100 animate-in slide-in-from-top-1 duration-200">
                {renderAccessControl()}
              </div>
            )}
          </div>

          {/* Accordion 4: Install Script */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedAccordion(expandedAccordion === 'install' ? null : 'install')}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition cursor-pointer font-bold text-gray-800 text-sm outline-none"
            >
              <div className="flex items-center space-x-2">
                <Code size={16} className="text-purple-500" />
                <span>Install Script Tag</span>
              </div>
              {expandedAccordion === 'install' ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>
            {expandedAccordion === 'install' && (
              <div className="p-5 border-t border-gray-100 animate-in slide-in-from-top-1 duration-200">
                {renderInstallScript()}
              </div>
            )}
          </div>

        </div>
      </div>

      {editingUserProfile && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-gray-800 text-sm">
                Edit Widget Profile: {editingUserProfile.isOwner ? 'Owner' : (editingUserProfile.name || 'Agent')}
              </h3>
              <button onClick={() => setEditingUserProfile(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col items-center py-2">
              <div
                className="w-16 h-16 rounded-full overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center cursor-pointer relative group"
                onClick={() => editingUserFileRef.current?.click()}
              >
                {editingUserProfile.profilePic ? (
                  <img src={editingUserProfile.profilePic} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-gray-400">
                    {editingUserProfile.nickname?.charAt(0).toUpperCase() || editingUserProfile.name?.charAt(0).toUpperCase() || 'A'}
                  </span>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Upload size={14} className="text-white" />
                </div>
              </div>
              <input
                type="file"
                ref={editingUserFileRef}
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append('file', file);
                  try {
                    const uploadUrl = `${import.meta.env.VITE_API_URL || 'https://jh5nng6t-5000.asse.devtunnels.ms'}/api/upload`;
                    const res = await fetch(uploadUrl, { method: 'POST', body: formData });
                    const data = await res.json();
                    if (data.success && data.fileUrl) {
                      setEditingUserProfile(prev => ({ ...prev, profilePic: data.fileUrl }));
                    }
                  } catch (err) {
                    console.error(err);
                    alert('Upload failed');
                  }
                }}
                accept="image/*"
                className="hidden"
              />
              <span className="text-[10px] text-gray-500 mt-1 font-medium">Click photo to upload</span>
            </div>

            <div className="space-y-3 text-left">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Widget Nickname</label>
                <input
                  type="text"
                  value={editingUserProfile.nickname}
                  onChange={(e) => setEditingUserProfile(prev => ({ ...prev, nickname: e.target.value }))}
                  placeholder="e.g. Support John"
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-[#00a884]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Widget Designation</label>
                <input
                  type="text"
                  value={editingUserProfile.designation}
                  onChange={(e) => setEditingUserProfile(prev => ({ ...prev, designation: e.target.value }))}
                  placeholder="e.g. Support Team Lead"
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-[#00a884]"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t">
              <button
                onClick={() => setEditingUserProfile(null)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-lg transition active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (editingUserProfile.isOwner) {
                    setOwnerNickname(editingUserProfile.nickname);
                    setOwnerDesignation(editingUserProfile.designation);
                    setOwnerProfilePic(editingUserProfile.profilePic);
                    await updateAccess(null, null, {
                      ownerNickname: editingUserProfile.nickname,
                      ownerDesignation: editingUserProfile.designation,
                      ownerProfilePic: editingUserProfile.profilePic
                    });
                  } else {
                    const updatedUsers = authorizedUsers.map(au => {
                      const auId = au.user?._id || au.user;
                      if (auId?.toString() === editingUserProfile.userId?.toString()) {
                        return {
                          ...au,
                          nickname: editingUserProfile.nickname,
                          designation: editingUserProfile.designation,
                          profilePic: editingUserProfile.profilePic
                        };
                      }
                      return au;
                    });
                    await updateAccess(updatedUsers, null, null);
                  }
                  setEditingUserProfile(null);
                  alert('Profile updated successfully!');
                }}
                className="px-3 py-1.5 bg-[#00a884] hover:bg-[#008f6f] text-white text-xs rounded-lg transition active:scale-95"
              >
                Save Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WidgetSettings;
