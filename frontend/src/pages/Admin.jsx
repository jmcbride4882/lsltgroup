import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  Target,
  Shield, 
  FileText, 
  LogOut,
  Menu,
  X,
  Bell
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import AdminSettings from './AdminSettings'
import AdminCampaigns from './AdminCampaigns'

const Admin = () => {
  const { user, logout } = useAuth()
  const { t } = useLanguage()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Campaigns', href: '/admin/campaigns', icon: Target },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
    { name: 'Audit Logs', href: '/admin/audit', icon: Shield },
    { name: 'Reports', href: '/admin/reports', icon: FileText }
  ]

  const AdminDashboard = () => (
    <div className="min-h-screen bg-secondary-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-secondary-900">
            Admin Dashboard
          </h1>
          <p className="text-secondary-600 mt-2">
            Welcome back, {user?.name}. Manage your LSLT portal from here.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-secondary-900">1,234</p>
                  <p className="text-secondary-600 text-sm">Total Users</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Target className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-secondary-900">12</p>
                  <p className="text-secondary-600 text-sm">Active Campaigns</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-secondary-900">99.9%</p>
                  <p className="text-secondary-600 text-sm">System Uptime</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <FileText className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-secondary-900">567</p>
                  <p className="text-secondary-600 text-sm">New Events</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Quick Actions</h3>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                <Link to="/admin/settings" className="btn btn-outline w-full justify-start">
                  <Settings className="w-4 h-4 mr-2" />
                  Configure System Settings
                </Link>
                <Link to="/admin/campaigns" className="btn btn-outline w-full justify-start">
                  <Target className="w-4 h-4 mr-2" />
                  Create New Campaign
                </Link>
                <Link to="/admin/users" className="btn btn-outline w-full justify-start">
                  <Users className="w-4 h-4 mr-2" />
                  Manage Users
                </Link>
                <Link to="/admin/audit" className="btn btn-outline w-full justify-start">
                  <Shield className="w-4 h-4 mr-2" />
                  View Audit Logs
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Activity</h3>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">New user registered</p>
                    <p className="text-xs text-secondary-500">2 minutes ago</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Campaign activated</p>
                    <p className="text-xs text-secondary-500">5 minutes ago</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Settings updated</p>
                    <p className="text-xs text-secondary-500">10 minutes ago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const AdminUsers = () => (
    <div className="min-h-screen bg-secondary-50 p-8">
      <div className="card">
        <div className="card-body text-center">
          <Users className="w-16 h-16 text-secondary-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-secondary-900 mb-2">
            User Management
          </h3>
          <p className="text-secondary-600">
            User management functionality will be implemented here.
          </p>
        </div>
      </div>
    </div>
  )

  const AdminAudit = () => (
    <div className="min-h-screen bg-secondary-50 p-8">
      <div className="card">
        <div className="card-body text-center">
          <Shield className="w-16 h-16 text-secondary-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-secondary-900 mb-2">
            Audit Logs
          </h3>
          <p className="text-secondary-600">
            Audit logs and security monitoring will be implemented here.
          </p>
        </div>
      </div>
    </div>
  )

  const AdminReports = () => (
    <div className="min-h-screen bg-secondary-50 p-8">
      <div className="card">
        <div className="card-body text-center">
          <FileText className="w-16 h-16 text-secondary-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-secondary-900 mb-2">
            Reports & Analytics
          </h3>
          <p className="text-secondary-600">
            Detailed reports and analytics will be implemented here.
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-secondary-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-secondary-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 bg-white shadow-lg">
          <div className="flex items-center h-16 flex-shrink-0 px-4 bg-primary-600">
            <h1 className="text-xl font-bold text-white">LSLT Admin</h1>
          </div>
          <div className="flex-1 flex flex-col overflow-y-auto">
            <nav className="flex-1 px-2 py-4 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.href
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`
                      group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
                      ${isActive
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900'
                      }
                    `}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
            <div className="flex-shrink-0 p-4 border-t border-secondary-200">
              <div className="flex items-center">
                <div className="ml-3">
                  <p className="text-sm font-medium text-secondary-700">{user?.name}</p>
                  <p className="text-xs text-secondary-500">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="mt-3 group flex items-center px-2 py-2 text-sm font-medium text-secondary-600 rounded-md hover:bg-secondary-50 hover:text-secondary-900 w-full"
              >
                <LogOut className="mr-3 h-5 w-5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile header */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between h-16 px-4 bg-white shadow">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-secondary-600 hover:text-secondary-900"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-secondary-900">LSLT Admin</h1>
          <div className="w-6" /> {/* Spacer */}
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        <Routes>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/users" element={<AdminUsers />} />
          <Route path="/settings" element={<AdminSettings />} />
          <Route path="/campaigns" element={<AdminCampaigns />} />
          <Route path="/audit" element={<AdminAudit />} />
          <Route path="/reports" element={<AdminReports />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    </div>
  )
}

export default Admin