import React, { useState } from "react";
import {
  NavLink,
  Navigate,
  Outlet,
  useNavigate,
} from "react-router-dom";
import {
  Boxes,
  LogOut,
  Users,
  ShieldCheck,
  Volume2,
  CreditCard,
  Menu,
  X,
} from "lucide-react";
import useAdminAuthStore from "../store/adminAuthStore";
import useAuthStore from "../store/authStore";

const AdminLayout = () => {
  const { admin, logout: adminLogout } = useAdminAuthStore();
  const { user, logout: merchantLogout } = useAuthStore();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const token = admin?.token || user?.token;

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    adminLogout();
    merchantLogout();
    navigate("/login");
  };

  const itemClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
      isActive
        ? "bg-emerald-600 text-white"
        : "text-slate-300 hover:bg-slate-800 hover:text-white"
    }`;

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:block">
      
      {/* Mobile Top Header */}
      <header className="flex h-16 w-full items-center justify-between border-b border-slate-200 bg-slate-900 px-4 text-white md:hidden sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="rounded-lg p-1.5 hover:bg-slate-800 text-slate-200 transition-colors"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
              <ShieldCheck size={18} />
            </div>
            <span className="font-bold text-sm tracking-wide">OChat Admin</span>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay Backdrop */}
      {isSidebarOpen && (
        <div 
          onClick={closeSidebar}
          className="fixed inset-0 z-30 bg-black/45 backdrop-blur-xs md:hidden"
        ></div>
      )}

      {/* Sidebar (Desktop Persistent & Mobile Drawer) */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-950 p-5 flex flex-col justify-between transition-transform duration-300 ease-in-out md:translate-x-0 ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div>
          {/* Header area inside Sidebar */}
          <div className="mb-8 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600">
                <ShieldCheck size={24} />
              </div>
              <div>
                <div className="font-bold">OChat Admin</div>
                <div className="text-xs text-slate-400">Subscription Control</div>
              </div>
            </div>
            {/* Close button inside drawer for mobile */}
            <button 
              onClick={closeSidebar} 
              className="rounded-lg p-1 hover:bg-slate-850 text-slate-400 hover:text-white transition-colors md:hidden"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            <NavLink to="/" onClick={closeSidebar} className={itemClass} end>
              <Users size={19} />
              Merchants
            </NavLink>

            <NavLink to="/packages" onClick={closeSidebar} className={itemClass}>
              <Boxes size={19} />
              Packages
            </NavLink>

            <NavLink to="/payments" onClick={closeSidebar} className={itemClass}>
              <CreditCard size={19} />
              Payments History
            </NavLink>

            <NavLink to="/sound-settings" onClick={closeSidebar} className={itemClass}>
              <Volume2 size={19} />
              Sound Settings
            </NavLink>
          </nav>
        </div>

        {/* Logout at bottom */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition"
        >
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      {/* Main Content Workspace wrapper */}
      <main className="min-h-screen md:pl-64 flex-1 overflow-x-hidden">
        <Outlet />
      </main>

    </div>
  );
};

export default AdminLayout;
