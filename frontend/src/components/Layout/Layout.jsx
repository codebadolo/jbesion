import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import Sidebar from './Sidebar.jsx'
import ToastContainer from '../Common/ToastContainer.jsx'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen]   = useState(false)  // mobile drawer
  const [collapsed, setCollapsed]       = useState(false)  // desktop collapse

  const toggleCollapse = () => setCollapsed((v) => !v)

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />

      {/* Offset the content — 64px collapsed, 256px expanded, 0 on mobile */}
      <div
        className="flex flex-col min-h-screen transition-[padding] duration-300 ease-in-out lg:pl-[var(--sidebar-w)]"
        style={{ '--sidebar-w': collapsed ? '4rem' : '16rem' }}
      >
        <Navbar
          onMenuClick={() => setSidebarOpen(true)}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}
