import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus,
  Search,
  Filter,
  Calendar,
  Target,
  TrendingUp,
  Gift,
  Mail,
  Wifi,
  Edit3,
  Trash2,
  Play,
  Pause,
  BarChart3,
  Users,
  Eye,
  Copy,
  Download
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'
import LoadingSpinner from '../components/LoadingSpinner'

const AdminCampaigns = () => {
  const { t } = useLanguage()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    search: ''
  })

  const campaignTypes = [
    { id: 'welcome', name: 'Welcome Bonus', icon: Gift, color: 'blue' },
    { id: 'loyalty', name: 'Loyalty Reward', icon: TrendingUp, color: 'green' },
    { id: 'email', name: 'Email Campaign', icon: Mail, color: 'purple' },
    { id: 'wifi', name: 'WiFi Promotion', icon: Wifi, color: 'indigo' },
    { id: 'seasonal', name: 'Seasonal Offer', icon: Calendar, color: 'orange' },
    { id: 'referral', name: 'Referral Program', icon: Users, color: 'pink' }
  ]

  useEffect(() => {
    loadCampaigns()
  }, [])

  const loadCampaigns = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/campaigns', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to load campaigns')
      
      const result = await response.json()
      setCampaigns(result.data || [])
    } catch (error) {
      toast.error('Failed to load campaigns')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const createCampaign = async (campaignData) => {
    try {
      const response = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(campaignData)
      })

      if (!response.ok) throw new Error('Failed to create campaign')

      const result = await response.json()
      toast.success('Campaign created successfully')
      setShowCreateModal(false)
      await loadCampaigns()
      
    } catch (error) {
      toast.error('Failed to create campaign')
      console.error(error)
    }
  }

  const updateCampaignStatus = async (id, status) => {
    try {
      const response = await fetch(`/api/admin/campaigns/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status })
      })

      if (!response.ok) throw new Error('Failed to update campaign')

      toast.success(`Campaign ${status === 'active' ? 'activated' : 'paused'}`)
      await loadCampaigns()
      
    } catch (error) {
      toast.error('Failed to update campaign')
      console.error(error)
    }
  }

  const deleteCampaign = async (id) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return

    try {
      const response = await fetch(`/api/admin/campaigns/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!response.ok) throw new Error('Failed to delete campaign')

      toast.success('Campaign deleted successfully')
      await loadCampaigns()
      
    } catch (error) {
      toast.error('Failed to delete campaign')
      console.error(error)
    }
  }

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesStatus = filters.status === 'all' || campaign.status === filters.status
    const matchesType = filters.type === 'all' || campaign.type === filters.type
    const matchesSearch = !filters.search || 
      campaign.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      campaign.description.toLowerCase().includes(filters.search.toLowerCase())
    
    return matchesStatus && matchesType && matchesSearch
  })

  const CampaignCard = ({ campaign }) => {
    const typeConfig = campaignTypes.find(t => t.id === campaign.type) || campaignTypes[0]
    const Icon = typeConfig.icon

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="card hover:shadow-lg transition-all duration-200"
      >
        <div className="card-body">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg bg-${typeConfig.color}-100`}>
                <Icon className={`w-5 h-5 text-${typeConfig.color}-600`} />
              </div>
              <div>
                <h3 className="font-semibold text-secondary-900">{campaign.name}</h3>
                <p className="text-sm text-secondary-600">{typeConfig.name}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className={`badge ${
                campaign.status === 'active' ? 'badge-success' : 
                campaign.status === 'paused' ? 'badge-warning' : 
                'badge-secondary'
              }`}>
                {campaign.status}
              </span>
              
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setSelectedCampaign(campaign)}
                  className="p-1 text-secondary-400 hover:text-secondary-600"
                  title="View Details"
                >
                  <Eye className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => updateCampaignStatus(
                    campaign.id, 
                    campaign.status === 'active' ? 'paused' : 'active'
                  )}
                  className="p-1 text-secondary-400 hover:text-secondary-600"
                  title={campaign.status === 'active' ? 'Pause' : 'Activate'}
                >
                  {campaign.status === 'active' ? 
                    <Pause className="w-4 h-4" /> : 
                    <Play className="w-4 h-4" />
                  }
                </button>
                
                <button
                  onClick={() => deleteCampaign(campaign.id)}
                  className="p-1 text-secondary-400 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <p className="text-secondary-600 text-sm mt-2 line-clamp-2">
            {campaign.description}
          </p>

          <div className="flex items-center justify-between mt-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-secondary-500">Impressions</p>
                <p className="font-semibold text-secondary-900">{campaign.stats?.impressions || 0}</p>
              </div>
              <div>
                <p className="text-xs text-secondary-500">Conversions</p>
                <p className="font-semibold text-secondary-900">{campaign.stats?.conversions || 0}</p>
              </div>
              <div>
                <p className="text-xs text-secondary-500">Success Rate</p>
                <p className="font-semibold text-secondary-900">
                  {campaign.stats?.successRate ? `${campaign.stats.successRate.toFixed(1)}%` : '0%'}
                </p>
              </div>
            </div>
          </div>

          {campaign.endDate && (
            <div className="mt-3 p-2 bg-secondary-50 rounded-lg">
              <p className="text-xs text-secondary-600">
                Ends: {new Date(campaign.endDate).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  const CreateCampaignModal = () => {
    const [formData, setFormData] = useState({
      name: '',
      description: '',
      type: 'welcome',
      startDate: '',
      endDate: '',
      targetAudience: 'all',
      settings: {}
    })

    const handleSubmit = (e) => {
      e.preventDefault()
      createCampaign(formData)
    }

    if (!showCreateModal) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="p-6">
            <h2 className="text-xl font-bold text-secondary-900 mb-4">
              Create New Campaign
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Campaign Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                  className="input h-20"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Campaign Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({...prev, type: e.target.value}))}
                    className="input"
                  >
                    {campaignTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Target Audience</label>
                  <select
                    value={formData.targetAudience}
                    onChange={(e) => setFormData(prev => ({...prev, targetAudience: e.target.value}))}
                    className="input"
                  >
                    <option value="all">All Users</option>
                    <option value="new">New Users</option>
                    <option value="returning">Returning Users</option>
                    <option value="bronze">Bronze Tier</option>
                    <option value="silver">Silver Tier</option>
                    <option value="gold">Gold Tier</option>
                    <option value="platinum">Platinum Tier</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Date</label>
                  <input
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({...prev, startDate: e.target.value}))}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">End Date (Optional)</label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({...prev, endDate: e.target.value}))}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Campaign
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="large">Loading campaigns...</LoadingSpinner>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-secondary-900">
                Marketing Campaigns
              </h1>
              <p className="text-secondary-600 mt-2">
                Create and manage promotional campaigns and marketing initiatives
              </p>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="card-body">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search campaigns..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({...prev, search: e.target.value}))}
                    className="input pl-10"
                  />
                </div>
              </div>
              
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({...prev, status: e.target.value}))}
                className="input w-auto"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>

              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({...prev, type: e.target.value}))}
                className="input w-auto"
              >
                <option value="all">All Types</option>
                {campaignTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Campaign Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Target className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-secondary-900">
                    {campaigns.filter(c => c.status === 'active').length}
                  </p>
                  <p className="text-secondary-600 text-sm">Active Campaigns</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-secondary-900">
                    {campaigns.reduce((sum, c) => sum + (c.stats?.conversions || 0), 0)}
                  </p>
                  <p className="text-secondary-600 text-sm">Total Conversions</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-secondary-900">
                    {campaigns.reduce((sum, c) => sum + (c.stats?.impressions || 0), 0)}
                  </p>
                  <p className="text-secondary-600 text-sm">Total Impressions</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Users className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-secondary-900">
                    {Math.round(campaigns.reduce((sum, c) => sum + (c.stats?.successRate || 0), 0) / Math.max(campaigns.length, 1))}%
                  </p>
                  <p className="text-secondary-600 text-sm">Avg Success Rate</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Campaigns Grid */}
        {filteredCampaigns.length === 0 ? (
          <div className="card">
            <div className="card-body text-center py-12">
              <Target className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-secondary-900 mb-2">
                No campaigns found
              </h3>
              <p className="text-secondary-600 mb-6">
                {filters.search || filters.status !== 'all' || filters.type !== 'all'
                  ? 'Try adjusting your filters or search terms.'
                  : 'Create your first marketing campaign to start engaging users.'
                }
              </p>
              {!filters.search && filters.status === 'all' && filters.type === 'all' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn btn-primary"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Campaign
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredCampaigns.map(campaign => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Create Campaign Modal */}
        <CreateCampaignModal />
      </div>
    </div>
  )
}

export default AdminCampaigns