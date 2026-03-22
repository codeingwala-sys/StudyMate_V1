import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './styles/globals.css'

// Apply saved theme before first render — prevents flash
const savedTheme = localStorage.getItem('studymate_theme') || 'dark'
document.documentElement.setAttribute('data-theme', savedTheme === 'light' ? 'light' : '')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Register service worker for PWA (vite-plugin-pwa handles this automatically,
// but this is a manual fallback in case autoUpdate doesn't fire)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      if (registrations.length === 0) {
        navigator.serviceWorker.register('/sw.js').catch(() => {
          // sw.js is generated at build time — safe to ignore in dev
        })
      }
    })
  })
}
