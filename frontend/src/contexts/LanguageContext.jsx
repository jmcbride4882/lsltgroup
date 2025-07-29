import React, { createContext, useContext, useState, useEffect } from 'react'

const LanguageContext = createContext()

// Translation object
const translations = {
  en: {
    // Common
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    continue: 'Continue',
    back: 'Back',
    cancel: 'Cancel',
    submit: 'Submit',
    close: 'Close',
    save: 'Save',
    
    // Portal
    welcome: 'Welcome to LSLT WiFi',
    welcomeMessage: 'Connect to our guest WiFi and earn loyalty rewards with every visit!',
    signUp: 'Sign Up',
    login: 'Login',
    alreadyMember: 'Already a member?',
    newHere: 'New here?',
    
    // Sign Up Form
    signUpTitle: 'Create Your Account',
    signUpSubtitle: 'Join our loyalty program and start earning rewards today!',
    fullName: 'Full Name',
    fullNamePlaceholder: 'Enter your full name',
    email: 'Email Address',
    emailPlaceholder: 'Enter your email address',
    dateOfBirth: 'Date of Birth',
    marketingConsent: 'I would like to receive promotional offers and updates',
    termsAndConditions: 'I agree to the Terms and Conditions',
    privacyPolicy: 'Privacy Policy',
    createAccount: 'Create Account',
    
    // Login Form
    loginTitle: 'Welcome Back!',
    loginSubtitle: 'Sign in to access your account and continue earning rewards.',
    loginButton: 'Sign In',
    
    // Loyalty
    loyaltyProgram: 'Loyalty Program',
    currentTier: 'Current Tier',
    visitCount: 'Visits',
    nextReward: 'Next Reward',
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
    
    // Success
    accountCreated: 'Account Created Successfully!',
    welcomeBack: 'Welcome Back!',
    wifiConnected: 'WiFi Connected',
    enjoyBrowsing: 'Enjoy browsing!',
    
    // Vouchers
    yourVouchers: 'Your Vouchers',
    showQR: 'Show QR Code',
    expiresOn: 'Expires on',
    
    // Errors
    requiredField: 'This field is required',
    invalidEmail: 'Please enter a valid email address',
    ageRequirement: 'You must be at least 13 years old',
    termsRequired: 'You must accept the terms and conditions',
    deviceLimit: 'Device limit reached',
    accountBlocked: 'Account blocked',
    
    // Staff
    staffPortal: 'Staff Portal',
    scanVoucher: 'Scan Voucher',
    redeemVoucher: 'Redeem Voucher',
    issueWiFiVoucher: 'Issue WiFi Voucher',
    
    // Language
    language: 'Language',
    english: 'English',
    spanish: 'Español'
  },
  es: {
    // Common
    loading: 'Cargando...',
    error: 'Error',
    success: 'Éxito',
    continue: 'Continuar',
    back: 'Atrás',
    cancel: 'Cancelar',
    submit: 'Enviar',
    close: 'Cerrar',
    save: 'Guardar',
    
    // Portal
    welcome: 'Bienvenido a LSLT WiFi',
    welcomeMessage: '¡Conéctate a nuestro WiFi de invitados y gana recompensas de lealtad con cada visita!',
    signUp: 'Registrarse',
    login: 'Iniciar Sesión',
    alreadyMember: '¿Ya eres miembro?',
    newHere: '¿Nuevo aquí?',
    
    // Sign Up Form
    signUpTitle: 'Crea Tu Cuenta',
    signUpSubtitle: '¡Únete a nuestro programa de lealtad y comienza a ganar recompensas hoy!',
    fullName: 'Nombre Completo',
    fullNamePlaceholder: 'Ingresa tu nombre completo',
    email: 'Correo Electrónico',
    emailPlaceholder: 'Ingresa tu correo electrónico',
    dateOfBirth: 'Fecha de Nacimiento',
    marketingConsent: 'Me gustaría recibir ofertas promocionales y actualizaciones',
    termsAndConditions: 'Acepto los Términos y Condiciones',
    privacyPolicy: 'Política de Privacidad',
    createAccount: 'Crear Cuenta',
    
    // Login Form
    loginTitle: '¡Bienvenido de Nuevo!',
    loginSubtitle: 'Inicia sesión para acceder a tu cuenta y continuar ganando recompensas.',
    loginButton: 'Iniciar Sesión',
    
    // Loyalty
    loyaltyProgram: 'Programa de Lealtad',
    currentTier: 'Nivel Actual',
    visitCount: 'Visitas',
    nextReward: 'Próxima Recompensa',
    bronze: 'Bronce',
    silver: 'Plata',
    gold: 'Oro',
    platinum: 'Platino',
    
    // Success
    accountCreated: '¡Cuenta Creada Exitosamente!',
    welcomeBack: '¡Bienvenido de Nuevo!',
    wifiConnected: 'WiFi Conectado',
    enjoyBrowsing: '¡Disfruta navegando!',
    
    // Vouchers
    yourVouchers: 'Tus Vouchers',
    showQR: 'Mostrar Código QR',
    expiresOn: 'Expira el',
    
    // Errors
    requiredField: 'Este campo es requerido',
    invalidEmail: 'Por favor ingresa un correo electrónico válido',
    ageRequirement: 'Debes tener al menos 13 años',
    termsRequired: 'Debes aceptar los términos y condiciones',
    deviceLimit: 'Límite de dispositivos alcanzado',
    accountBlocked: 'Cuenta bloqueada',
    
    // Staff
    staffPortal: 'Portal de Personal',
    scanVoucher: 'Escanear Voucher',
    redeemVoucher: 'Canjear Voucher',
    issueWiFiVoucher: 'Emitir Voucher WiFi',
    
    // Language
    language: 'Idioma',
    english: 'English',
    spanish: 'Español'
  }
}

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Get language from localStorage or detect browser language
    const saved = localStorage.getItem('lslt-language')
    if (saved) return saved
    
    const browserLang = navigator.language.toLowerCase()
    return browserLang.startsWith('es') ? 'es' : 'en'
  })

  useEffect(() => {
    localStorage.setItem('lslt-language', language)
    document.documentElement.lang = language
  }, [language])

  const t = (key) => {
    return translations[language]?.[key] || translations.en[key] || key
  }

  const changeLanguage = (newLanguage) => {
    if (translations[newLanguage]) {
      setLanguage(newLanguage)
    }
  }

  const value = {
    language,
    changeLanguage,
    t,
    availableLanguages: Object.keys(translations)
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

export default LanguageContext