import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import LoadingSpinner from './components/LoadingSpinner'
import { AuthProvider } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'

// Lazy load components for better performance
const Portal = lazy(() => import('./pages/Portal'))
const Staff = lazy(() => import('./pages/Staff'))
const Admin = lazy(() => import('./pages/Admin'))
const Success = lazy(() => import('./pages/Success'))
const NotFound = lazy(() => import('./pages/NotFound'))

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="text-center"
    >
      <LoadingSpinner size="large" />
      <p className="mt-4 text-secondary-600">Loading LSLT Portal...</p>
    </motion.div>
  </div>
)

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Main captive portal route */}
              <Route path="/portal" element={<Portal />} />
              
              {/* Success page after signup/login */}
              <Route path="/success" element={<Success />} />
              
              {/* Staff portal */}
              <Route path="/staff" element={<Staff />} />
              
              {/* Admin dashboard */}
              <Route path="/admin" element={<Admin />} />
              
              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/portal" replace />} />
              
              {/* 404 page */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
      </AuthProvider>
    </LanguageProvider>
  )
}

export default App