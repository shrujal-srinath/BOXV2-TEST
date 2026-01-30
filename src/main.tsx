import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// Explicitly import the SW register to force it
import { registerSW } from 'virtual:pwa-register'

// Auto-update SW logic
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New system update available. Reload?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('✅ BOX-V2: System Ready for Offline Mode');
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)