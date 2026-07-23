import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import useAdminAuthStore from "../../store/adminAuthStore";

const AdminLogin = () => {
  const { admin, login, loading, error } = useAdminAuthStore();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (admin?.token) {
    return <Navigate to="/admin/packages" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    const success = await login(email.trim(), password);
    if (success) navigate("/admin/packages");
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl"
      >
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <ShieldCheck size={30} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Admin Login
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage subscriptions and merchants
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" /> : "Login"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminLogin;
