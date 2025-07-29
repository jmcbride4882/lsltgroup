import React from 'react'
import { clsx } from 'clsx'

const LoadingSpinner = ({ 
  size = 'medium', 
  color = 'primary',
  className = '',
  children 
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12',
    xl: 'w-16 h-16'
  }

  const colorClasses = {
    primary: 'border-primary-600',
    secondary: 'border-secondary-600',
    white: 'border-white',
    success: 'border-success-600',
    warning: 'border-warning-600',
    error: 'border-error-600'
  }

  return (
    <div className={clsx('flex flex-col items-center gap-3', className)}>
      <div 
        className={clsx(
          'spinner',
          sizeClasses[size],
          colorClasses[color]
        )}
        role="status"
        aria-label="Loading"
      />
      {children && (
        <div className="text-sm text-secondary-600 text-center">
          {children}
        </div>
      )}
    </div>
  )
}

export default LoadingSpinner