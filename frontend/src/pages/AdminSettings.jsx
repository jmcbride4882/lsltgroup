import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Settings, 
  Wifi, 
  Mail, 
  Palette, 
  Shield, 
  Network, 
  Award,
  Save,
  RotateCcw,
  TestTube,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader,
  Eye,
  EyeOff
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'
import LoadingSpinner from '../components/LoadingSpinner'

const AdminSettings = () => {
  const { t } = useLanguage()
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState({ email: false, unifi: false })
  const [activeTab, setActiveTab] = useState('system')
  const [modifiedSettings, setModifiedSettings] = useState({})
  const [showPasswords, setShowPasswords] = useState({})

  const categories = [
    { id: 'system', name: 'System', icon: Settings, color: 'blue' },
    { id: 'unifi', name: 'UniFi Controller', icon: Wifi, color: 'purple' },
    { id: 'email', name: 'Email Settings', icon: Mail, color: 'green' },
    { id: 'loyalty', name: 'Loyalty Program', icon: Award, color: 'yellow' },
    { id: 'branding', name: 'Branding', icon: Palette, color: 'pink' },
    { id: 'security', name: 'Security', icon: Shield, color: 'red' },
    { id: 'network', name: 'Network', icon: Network, color: 'indigo' }
  ]

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to load settings')
      
      const result = await response.json()
      setSettings(result.data)
    } catch (error) {
      toast.error('Failed to load settings')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const updateSetting = (category, key, value) => {
    const settingKey = `${category}.${key}`
    setModifiedSettings(prev => ({
      ...prev,
      [settingKey]: { category, key, value }
    }))
  }

  const saveSettings = async () => {
    if (Object.keys(modifiedSettings).length === 0) {
      toast.info('No changes to save')
      return
    }

    try {
      setSaving(true)
      const settingsArray = Object.values(modifiedSettings)
      
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ settings: settingsArray })
      })

      if (!response.ok) throw new Error('Failed to save settings')

      const result = await response.json()
      
      toast.success(result.message)
      setModifiedSettings({})
      await loadSettings()

      if (result.data.requiresRestart.length > 0) {
        toast.warning(
          `System restart required for: ${result.data.requiresRestart.join(', ')}`,
          { duration: 8000 }
        )
      }

    } catch (error) {
      toast.error('Failed to save settings')
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  const resetCategory = async (category) => {
    if (!confirm(`Reset all ${category} settings to defaults?`)) return

    try {
      const response = await fetch('/api/admin/settings/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ category })
      })

      if (!response.ok) throw new Error('Failed to reset settings')

      const result = await response.json()
      toast.success(result.message)
      await loadSettings()
      setModifiedSettings({})

    } catch (error) {
      toast.error('Failed to reset settings')
      console.error(error)
    }
  }

  const testEmailConfig = async () => {
    try {
      setTesting(prev => ({ ...prev, email: true }))
      
      const response = await fetch('/api/admin/settings/test-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!response.ok) throw new Error('Test failed')

      const result = await response.json()
      
      if (result.data.success) {
        toast.success('Email configuration is valid!')
      } else {
        toast.error(`Email test failed: ${result.data.message}`)
      }

    } catch (error) {
      toast.error('Email test failed')
      console.error(error)
    } finally {
      setTesting(prev => ({ ...prev, email: false }))
    }
  }

  const testUniFiConfig = async () => {
    try {
      setTesting(prev => ({ ...prev, unifi: true }))
      
      const response = await fetch('/api/admin/settings/test-unifi', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!response.ok) throw new Error('Test failed')

      const result = await response.json()
      
      if (result.data.success) {
        toast.success('UniFi connection successful!')
      } else {
        toast.error(`UniFi test failed: ${result.data.message}`)
      }

    } catch (error) {
      toast.error('UniFi test failed')
      console.error(error)
    } finally {
      setTesting(prev => ({ ...prev, unifi: false }))
    }
  }

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const renderSettingField = (category, key, setting) => {
    const settingKey = `${category}.${key}`
    const currentValue = modifiedSettings[settingKey]?.value ?? setting.value
    const isModified = settingKey in modifiedSettings

    const fieldProps = {
      className: `input ${isModified ? 'border-warning-300' : ''}`,
      value: currentValue,
      onChange: (e) => {
        const value = setting.dataType === 'boolean' ? e.target.checked : e.target.value
        updateSetting(category, key, value)
      },
      disabled: !setting.isEditable
    }

    switch (setting.dataType) {
      case 'boolean':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={currentValue}
              onChange={fieldProps.onChange}
              disabled={fieldProps.disabled}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <span className="ml-2 text-sm text-secondary-600">
              {currentValue ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        )

      case 'number':
        return (
          <input
            type="number"
            {...fieldProps}
            min="0"
          />
        )

      case 'password':
        return (
          <div className="relative">
            <input
              type={showPasswords[settingKey] ? 'text' : 'password'}
              {...fieldProps}
              className={`${fieldProps.className} pr-10`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => togglePasswordVisibility(settingKey)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPasswords[settingKey] ? (
                <EyeOff className="h-4 w-4 text-secondary-400" />
              ) : (
                <Eye className="h-4 w-4 text-secondary-400" />
              )}
            </button>
          </div>
        )

      default:
        return <input type="text" {...fieldProps} />
    }
  }

  const renderCategorySettings = (category) => {
    const categorySettings = settings[category] || {}
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-secondary-900">
            {categories.find(c => c.id === category)?.name} Settings
          </h3>
          <div className="flex gap-2">
            {category === 'email' && (
              <button
                onClick={testEmailConfig}
                disabled={testing.email}
                className="btn btn-outline btn-sm"
              >
                {testing.email ? (
                  <Loader className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <TestTube className="w-4 h-4 mr-2" />
                )}
                Test Email
              </button>
            )}
            {category === 'unifi' && (
              <button
                onClick={testUniFiConfig}
                disabled={testing.unifi}
                className="btn btn-outline btn-sm"
              >
                {testing.unifi ? (
                  <Loader className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <TestTube className="w-4 h-4 mr-2" />
                )}
                Test Connection
              </button>
            )}
            <button
              onClick={() => resetCategory(category)}
              className="btn btn-outline btn-sm text-warning-600 hover:text-warning-700"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </button>
          </div>
        </div>

        <div className="grid gap-6">
          {Object.entries(categorySettings).map(([key, setting]) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="label">
                  {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                  {setting.requiresRestart && (
                    <span className="ml-2 text-xs bg-warning-100 text-warning-800 px-2 py-1 rounded-full">
                      Requires Restart
                    </span>
                  )}
                </label>
                {`${category}.${key}` in modifiedSettings && (
                  <span className="text-xs text-warning-600 font-medium">
                    Modified
                  </span>
                )}
              </div>
              
              {renderSettingField(category, key, setting)}
              
              {setting.description && (
                <p className="text-sm text-secondary-500">
                  {setting.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="large">Loading settings...</LoadingSpinner>
      </div>
    )
  }

  const hasModifications = Object.keys(modifiedSettings).length > 0

  return (
    <div className="min-h-screen bg-secondary-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-secondary-900">
                System Settings
              </h1>
              <p className="text-secondary-600 mt-2">
                Configure all aspects of your LSLT portal
              </p>
            </div>
            
            <AnimatePresence>
              {hasModifications && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex items-center text-warning-600">
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    <span className="text-sm font-medium">
                      {Object.keys(modifiedSettings).length} unsaved changes
                    </span>
                  </div>
                  <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="btn btn-primary"
                  >
                    {saving ? (
                      <Loader className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Changes
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <nav className="space-y-2">
              {categories.map((category) => {
                const Icon = category.icon
                const isActive = activeTab === category.id
                const hasChanges = Object.keys(modifiedSettings).some(key => 
                  key.startsWith(`${category.id}.`)
                )

                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveTab(category.id)}
                    className={`
                      w-full flex items-center px-4 py-3 text-left rounded-lg transition-all
                      ${isActive 
                        ? `bg-${category.color}-100 text-${category.color}-700 border-${category.color}-200` 
                        : 'text-secondary-600 hover:bg-secondary-100'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    <span className="font-medium">{category.name}</span>
                    {hasChanges && (
                      <div className="ml-auto w-2 h-2 bg-warning-500 rounded-full" />
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="card"
            >
              <div className="card-body">
                {renderCategorySettings(activeTab)}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminSettings