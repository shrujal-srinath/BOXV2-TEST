import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// PWA registration with proper error handling
if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      onNeedRefresh() {
        if (confirm('New version available! Reload to update?')) {
          updateSW(true)
        }
      },
      onOfflineReady() {
        console.log('App ready to work offline')
      },
      onRegisterError(error) {
        console.error('SW registration error', error)
      }
    })
  }).catch((error) => {
    console.log('PWA not available:', error)
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)