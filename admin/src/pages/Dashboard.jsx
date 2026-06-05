import React, { useState, useEffect } from 'react';
import { Users, Settings, Activity, LogOut, Search, Edit2, Trash2, X } from 'lucide-react';
import axios from 'axios';
import useAuthStore from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function Dashboard() {
  const { user, logout } = useAuthStore();
  const [merchants, setMerchants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', canCreateWidgets: false, role: 'user' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get(`${API_URL}/api/admin/users`, config);
      setMerchants(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (merchant) => {
    setEditingUser(merchant);
    setEditForm({ 
      name: merchant.name, 
      email: merchant.email, 
      canCreateWidgets: merchant.canCreateWidgets || false,
      role: merchant.role
    });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(`${API_URL}/api/admin/users/${editingUser._id}`, editForm, config);
      
      setMerchants(merchants.map(m => m._id === data._id ? { ...m, ...data } : m));
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
      alert(error.response?.data?.message || 'Failed to update user');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this user and all their widgets? This action cannot be undone.')) {
      return;
    }
    
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`${API_URL}/api/admin/users/${id}`, config);
      setMerchants(merchants.filter(m => m._id !== id));
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const filteredMerchants = merchants.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white flex flex-col z-10">
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-wider text-green-400">Admin Panel</h1>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <a href="#" className="flex items-center px-4 py-3 bg-gray-800 rounded-lg text-white">
            <Users size={20} className="mr-3" />
            Users & Roles
          </a>
          <a href="#" className="flex items-center px-4 py-3 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
            <Activity size={20} className="mr-3" />
            System Logs
          </a>
          <a href="#" className="flex items-center px-4 py-3 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
            <Settings size={20} className="mr-3" />
            Settings
          </a>
        </nav>
        <div className="p-4 border-t border-gray-800">
          <button onClick={logout} className="flex items-center px-4 py-2 w-full text-gray-400 hover:text-white transition-colors">
            <LogOut size={20} className="mr-3" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          <h2 className="text-xl font-semibold text-gray-800">User Management</h2>
          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-600 mr-4">{user?.name}</span>
            <div className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            
            <div className="px-6 py-5 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center bg-white gap-4">
              <h3 className="font-semibold text-gray-800 text-lg">Registered Users ({merchants.length})</h3>
              
              <div className="relative w-full sm:w-72">
                <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search by name or email..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition-shadow"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                    <th className="px-6 py-4 font-semibold">User Details</th>
                    <th className="px-6 py-4 font-semibold">Role</th>
                    <th className="px-6 py-4 font-semibold">Can Create Widgets</th>
                    <th className="px-6 py-4 font-semibold">Joined Date</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-gray-500">Loading users...</td>
                    </tr>
                  ) : filteredMerchants.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-gray-500">No users found.</td>
                    </tr>
                  ) : (
                    filteredMerchants.map(merchant => (
                      <tr key={merchant._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold mr-3 flex-shrink-0">
                              {merchant.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{merchant.name}</div>
                              <div className="text-gray-500 text-xs">{merchant.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            merchant.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {merchant.role === 'super_admin' ? 'Super Admin' : 'User'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            merchant.canCreateWidgets ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {merchant.canCreateWidgets ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {new Date(merchant.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right space-x-3">
                          <button 
                            onClick={() => handleEditClick(merchant)}
                            className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                            title="Edit User"
                          >
                            <Edit2 size={18} />
                          </button>
                          {merchant.role !== 'super_admin' && merchant._id !== user._id && (
                            <button 
                              onClick={() => handleDeleteUser(merchant._id)}
                              className="text-gray-400 hover:text-red-600 transition-colors p-1"
                              title="Delete User"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* Edit Modal */}
        {editingUser && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-gray-800">Edit User Profile</h3>
                <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleUpdateUser} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input 
                      type="text" 
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input 
                      type="email" 
                      required
                      value={editForm.email}
                      onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only" 
                          checked={editForm.canCreateWidgets}
                          onChange={(e) => setEditForm({...editForm, canCreateWidgets: e.target.checked})}
                          disabled={editingUser.role === 'super_admin'}
                        />
                        <div className={`block w-14 h-8 rounded-full transition-colors ${editForm.canCreateWidgets ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${editForm.canCreateWidgets ? 'transform translate-x-6' : ''}`}></div>
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        Allow creating new chat widgets
                      </span>
                    </label>
                    {editingUser.role === 'super_admin' && (
                      <p className="text-xs text-orange-500 mt-2">Super admins always have all permissions.</p>
                    )}
                  </div>
                </div>
                
                <div className="mt-8 flex justify-end space-x-3">
                  <button 
                    type="button" 
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-70 flex items-center"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
