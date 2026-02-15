import React, { useState } from "react";
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  Map,
  Bell,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import logo from "../assets/logo.png";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { notifications, clearNotifications } = useWebSocket();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/incidents", label: "Incidents", icon: AlertTriangle },
    { path: "/tourists", label: "Tourists", icon: Users },
    { path: "/map", label: "Live Map", icon: Map },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white shadow-md px-4 md:px-6 py-3">
      <div className="flex items-center justify-between">

        {/* LEFT SIDE */}
        <div className="flex items-center gap-4">
          <button
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div
            onClick={() => navigate("/dashboard")}
            className="flex items-center cursor-pointer"
          >
            <img src={logo} alt="logo" className="h-10 w-14" />
            <span className="text-lg md:text-xl font-bold text-blue-600 whitespace-nowrap">
              Authority Dashboard
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 ml-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${
                    isActive(item.path)
                      ? "bg-blue-100 text-blue-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-4">

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-full hover:bg-gray-100 transition"
            >
              <Bell size={20} />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full animate-pulse">
                  {notifications.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white shadow-xl rounded-xl overflow-hidden z-50 animate-fadeIn">
                <div className="p-3 font-semibold border-b">
                  Notifications
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">
                      No new notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className="px-4 py-3 border-b text-sm hover:bg-gray-50 transition"
                      >
                        {n.message}
                      </div>
                    ))
                  )}
                </div>
                <button
                  onClick={clearNotifications}
                  className="w-full py-2 text-sm bg-gray-100 hover:bg-gray-200 transition"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          <button
            onClick={logout}
            className="hidden sm:flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden mt-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg hover:bg-gray-100"
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
