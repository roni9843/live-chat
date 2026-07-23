import React from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import useAuthStore from "./store/authStore";
import useAdminAuthStore from "./store/adminAuthStore";

import DashboardLayout from "./layouts/DashboardLayout";
import AdminLayout from "./layouts/AdminLayout";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Configure from "./pages/Configure";
import WidgetSettings from "./pages/WidgetSettings";
import MyAccount from "./pages/MyAccount";
import MySubscription from "./pages/MySubscription";

import AdminLogin from "./pages/admin/AdminLogin";
import SubscriptionPackages from "./pages/admin/SubscriptionPackages";
import AdminUsers from "./pages/admin/AdminUsers";

const MerchantProtectedRoute = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  return user ? children : <Navigate to="/login" replace />;
};

const MerchantPublicRoute = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  return user ? <Navigate to="/" replace /> : children;
};

const AdminProtectedRoute = ({ children }) => {
  const admin = useAdminAuthStore((state) => state.admin);
  return admin?.token
    ? children
    : <Navigate to="/admin/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <MerchantPublicRoute>
              <Login />
            </MerchantPublicRoute>
          }
        />

        <Route
          path="/register"
          element={
            <MerchantPublicRoute>
              <Register />
            </MerchantPublicRoute>
          }
        />

        <Route
          path="/"
          element={
            <MerchantProtectedRoute>
              <DashboardLayout />
            </MerchantProtectedRoute>
          }
        >
          <Route
            path="configure"
            element={<Configure />}
          />
          <Route
            path="configure/settings/:widgetId"
            element={<WidgetSettings />}
          />
          <Route path="account" element={<MyAccount />} />
          <Route
            path="subscription"
            element={<MySubscription />}
          />
        </Route>

        <Route
          path="/admin/login"
          element={<AdminLogin />}
        />

        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          }
        >
          <Route
            index
            element={
              <Navigate to="/admin/packages" replace />
            }
          />
          <Route
            path="packages"
            element={<SubscriptionPackages />}
          />
          <Route
            path="users"
            element={<AdminUsers />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
