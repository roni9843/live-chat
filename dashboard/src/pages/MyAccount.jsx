import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import useAuthStore from '../store/authStore';
import { User, Camera, Loader2 } from 'lucide-react';

const API_URL = `${import.meta.env.VITE_API_URL || 'https://jh5nng6t-5000.asse.devtunnels.ms'}/api/auth/merchant`;

function MyAccount() {
  const { user } = useAuthStore();

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleStart, setScheduleStart] = useState('09:00');
  const [scheduleEnd, setScheduleEnd] = useState('18:00');

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        email: user.email || '',
        websiteUrl: user.websiteUrl || '',
        profilePic: user.profilePic || ''
      });
      setScheduleEnabled(user.schedule?.enabled || false);
      setScheduleStart(user.schedule?.start || '09:00');
      setScheduleEnd(user.schedule?.end || '18:00');
    }
  }, [user]);

  const handleScheduleUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setProfileMessage({ type: '', text: '' });

    try {
      const config = {
        headers: { Authorization: `Bearer ${user.token}` }
      };
      const schedulePayload = {
        schedule: {
          enabled: scheduleEnabled,
          start: scheduleStart,
          end: scheduleEnd
        }
      };
      const { data } = await axios.put(`${API_URL}/profile`, schedulePayload, config);

      const updatedUser = { ...user, ...data };
      localStorage.setItem('merchantUser', JSON.stringify(updatedUser));
      useAuthStore.setState({ user: updatedUser });

      setProfileMessage({ type: 'success', text: 'Availability schedule updated successfully!' });
    } catch (error) {
      setProfileMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to update schedule'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfilePicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingPic(true);
    setProfileMessage({ type: '', text: '' });

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
        setProfile(prev => ({ ...prev, profilePic: data.fileUrl }));
        setProfileMessage({ type: 'success', text: 'Photo uploaded! Click "Update Profile" below to save.' });
      } else {
        setProfileMessage({ type: 'error', text: 'Upload failed' });
      }
    } catch (err) {
      console.error(err);
      setProfileMessage({ type: 'error', text: 'Failed to upload photo' });
    } finally {
      setIsUploadingPic(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setProfileMessage({ type: '', text: '' });

    try {
      const config = {
        headers: { Authorization: `Bearer ${user.token}` }
      };
      const { data } = await axios.put(`${API_URL}/profile`, profile, config);

      // Update local storage via authStore by updating the user object
      const updatedUser = { ...user, ...data };
      localStorage.setItem('merchantUser', JSON.stringify(updatedUser));
      useAuthStore.setState({ user: updatedUser });

      setProfileMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error) {
      setProfileMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to update profile'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMessage({ type: '', text: '' });

    if (passwords.newPassword !== passwords.confirmPassword) {
      return setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
    }

    setIsLoading(true);
    try {
      const config = {
        headers: { Authorization: `Bearer ${user.token}` }
      };
      await axios.put(`${API_URL}/password`, {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      }, config);

      setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to change password'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f0f2f5] p-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-800">My Account</h1>
          <p className="text-gray-500 mt-1">Manage your profile and security settings.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Profile Form */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 border-b pb-2">Profile Information</h2>

            {profileMessage.text && (
              <div className={`p-3 rounded-lg mb-4 text-sm ${profileMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {profileMessage.text}
              </div>
            )}

            <form onSubmit={handleProfileUpdate} className="space-y-4">
              {/* Profile Picture Upload */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 flex items-center justify-center bg-gray-50 shadow-inner">
                    {isUploadingPic ? (
                      <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
                    ) : profile.profilePic ? (
                      <img
                        src={profile.profilePic}
                        alt="profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-10 w-10 text-gray-400" />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black bg-opacity-40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="text-white h-6 w-6" />
                  </div>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleProfilePicUpload}
                  accept="image/*"
                  className="hidden"
                />
                <span className="text-xs text-gray-500 mt-2 font-medium">Click photo to change profile picture</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business/Full Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] focus:border-transparent outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-4 py-2 border border-gray-250 bg-gray-50 text-gray-500 rounded-lg outline-none cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
                <input
                  type="url"
                  value={profile.websiteUrl}
                  onChange={(e) => setProfile({ ...profile, websiteUrl: e.target.value })}
                  placeholder="https://yourwebsite.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] focus:border-transparent outline-none transition"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-2 rounded-lg transition shadow-sm mt-4 disabled:opacity-70"
              >
                Update Profile
              </button>
            </form>
          </div>

          {/* Password Form */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 border-b pb-2">Change Password</h2>

            {passwordMessage.text && (
              <div className={`p-3 rounded-lg mb-4 text-sm ${passwordMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {passwordMessage.text}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={passwords.currentPassword}
                  onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] focus:border-transparent outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] focus:border-transparent outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] focus:border-transparent outline-none transition"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white font-medium py-2 rounded-lg transition shadow-sm mt-4 disabled:opacity-70"
              >
                Change Password
              </button>
            </form>
          </div>

          {/* Availability Schedule Form */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1 md:col-span-2">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 border-b pb-2">Availability Schedule</h2>
            <form onSubmit={handleScheduleUpdate} className="space-y-4">
              <div className="flex items-center space-x-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  id="scheduleEnabled"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                  className="w-4 h-4 text-[#00a884] border-gray-300 rounded focus:ring-[#00a884] focus:ring-opacity-50 cursor-pointer"
                />
                <label htmlFor="scheduleEnabled" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  Enable Daily Online Schedule (If disabled, you will be online 24/7 unless manually set to offline)
                </label>
              </div>

              {scheduleEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Online Start Time</label>
                    <input
                      type="time"
                      value={scheduleStart}
                      onChange={(e) => setScheduleStart(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] focus:border-transparent outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Online End Time</label>
                    <input
                      type="time"
                      value={scheduleEnd}
                      onChange={(e) => setScheduleEnd(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] focus:border-transparent outline-none transition"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="bg-[#00a884] hover:bg-[#008f6f] text-white font-medium px-6 py-2.5 rounded-lg transition shadow-sm disabled:opacity-70 cursor-pointer"
              >
                Save Schedule Settings
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}

export default MyAccount;
