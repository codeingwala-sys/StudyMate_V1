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
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const onControllerChange = () => {
      // Reload the page when the new service worker takes over
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    // Check for updates periodically
    const checkUpdate = () => {
      navigator.serviceWorker.ready
        .then(reg => {
          reg.update().then(() => {
            if (reg.waiting) setUpdateAvailable(true)
          })
        })
        .catch(() => {})
    }

    const interval = setInterval(checkUpdate, 30 * 60 * 1000) // Check every 30 mins
    checkUpdate() // Also check on mount

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

      {/* Update Available Banner — sticky bottom */}
      {updateAvailable && (
        <div style={{
          position:'fixed', bottom:64, left:'50%', transform:'translateX(-50%)',
          width:'90%', maxWidth:400, zIndex:9999,
          background:'#3b82f6', color:'#fff', padding:'12px 16px', borderRadius:16,
          boxShadow:'0 4px 20px rgba(0,0,0,0.3)', display:'flex', alignItems:'center', gap:10,
          animation:'slideUpBanner 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:14, fontWeight:700, margin:0 }}>New version available!</p>
            <p style={{ fontSize:12, opacity:0.9, margin:0 }}>Tap to update and refresh.</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background:'#fff', border:'none', color:'#3b82f6',
              padding:'8px 16px', borderRadius:10, fontSize:13, fontWeight:800,
              cursor:'pointer'
            }}
          >
            Update
          </button>
        </div>
      )}


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