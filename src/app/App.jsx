import { useEffect, useState } from 'react'
import ErrorBoundary from '../components/ErrorBoundary'
import Splash from '../pages/Splash'
import { BrowserRouter } from 'react-router-dom'
import Router from './Router'
import { useAppStore } from './store'
import { isLoggedIn, refreshSession } from '../services/supabase'

export default function App() {
  const [splashDone,   setSplashDone]   = useState(false)
  const refreshStreak   = useAppStore(s => s.refreshStreak)
  const syncFromCloud   = useAppStore(s => s.syncFromCloud)
  const syncing         = useAppStore(s => s.syncing)
  const lastSyncedAt    = useAppStore(s => s.lastSyncedAt)

  // Recalculate streak every time the app loads / becomes visible
  useEffect(() => {
    refreshStreak()
    // Sync from cloud on app start if user is logged in
    // Refresh session token if needed, then sync
    const doSync = async () => {
      try {
        if (isLoggedIn()) {
          syncFromCloud().catch(() => {})
        } else {
          const u = await refreshSession()
          if (u) syncFromCloud().catch(() => {})
        }
      } catch(e) {}
    }
    doSync()

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshStreak()
        // Re-sync when app comes back to foreground
        if (isLoggedIn()) syncFromCloud().catch(() => {})
        
        // AUTO-CHECK for PWA updates whenever app is opened/resumed
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => reg.update()).catch(() => {})
        }
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // ── SERVICE WORKER AUTO-UPDATE ──────────────────────────────────────────
  // Listen for the new service worker taking control and reload the page
  // automatically. This ensures the user always has the latest version.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const onControllerChange = () => {
      // Reload the page when the new service worker takes over
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    // Periodically check for updates
    const interval = setInterval(() => {
      navigator.serviceWorker.ready
        .then(reg => reg.update())
        .catch(() => {})
    }, 60 * 60 * 1000) // Check every hour instead of every minute for auto-updates

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      clearInterval(interval)
    }
  }, [])


  return (
    <ErrorBoundary>
      {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
      <BrowserRouter>
        <Router />
      </BrowserRouter>


      {/* Sync indicator — subtle, bottom right */}
      {syncing && (
        <div style={{ position:'fixed', bottom:16, right:16, zIndex:9998, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)', borderRadius:20, padding:'7px 14px', display:'flex', alignItems:'center', gap:7, pointerEvents:'none' }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:'#60a5fa', animation:'syncPulse 1s ease-in-out infinite' }} />
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.7)', fontFamily:'Inter,sans-serif' }}>Syncing...</span>
        </div>
      )}

      <style>{`
        @keyframes syncPulse { 0%,100%{opacity:0.4;transform:scale(0.9)} 50%{opacity:1;transform:scale(1.1)} }
        @keyframes slideUpBanner {
          from { opacity:0; transform:translateX(-50%) translateY(20px) }
          to   { opacity:1; transform:translateX(-50%) translateY(0) }
        }
      `}</style>
    </ErrorBoundary>
  )
}