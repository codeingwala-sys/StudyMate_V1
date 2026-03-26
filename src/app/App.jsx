import { useEffect, useState } from 'react'
import ErrorBoundary from '../components/ErrorBoundary'
import Splash from '../pages/Splash'
import { BrowserRouter } from 'react-router-dom'
import Router from './Router'
import { useAppStore } from './store'
import { isLoggedIn, refreshSession } from '../services/supabase'

export default function App() {
  const [splashDone,   setSplashDone]   = useState(false)
  const [updateReady,  setUpdateReady]  = useState(false)
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
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // ── SERVICE WORKER UPDATE DETECTION ──────────────────────────────────────
  // When you push a new version to Vercel, the browser downloads the new
  // service worker in the background. We listen for when it's ready and show
  // a tap-to-refresh banner. User data (localStorage) is NEVER touched by
  // service worker updates — it is always safe.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.ready.then(reg => {
      // Check if there's already a waiting worker (e.g. tab was open a long time)
      if (reg.waiting) {
        setUpdateReady(true)
        return
      }

      // Listen for a new worker being installed
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          // 'installed' + controller exists means a new version is waiting
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateReady(true)
          }
        })
      })
    }).catch(() => {})

    // Also poll every 60 seconds to check for updates (catches cases where
    // the updatefound event was missed)
    const interval = setInterval(() => {
      navigator.serviceWorker.ready
        .then(reg => reg.update())
        .catch(() => {})
    }, 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  const handleUpdate = () => {
    // Tell the waiting service worker to take over immediately
    navigator.serviceWorker.ready.then(reg => {
      reg.waiting?.postMessage({ type: 'SKIP_WAITING' })
    }).catch(() => {})
    // Reload to activate new version
    window.location.reload()
  }

  return (
    <ErrorBoundary>
      {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
      <BrowserRouter>
        <Router />
      </BrowserRouter>

      {/* ── UPDATE BANNER ─────────────────────────────────────────────────
          Shows when a new version of StudyMate is ready.
          Tapping it reloads the app — all data is preserved.
      ──────────────────────────────────────────────────────────────────── */}
      {updateReady && (
        <div
          onClick={handleUpdate}
          style={{
            position:   'fixed',
            bottom:     90,
            left:       '50%',
            transform:  'translateX(-50%)',
            zIndex:     9999,
            background: 'linear-gradient(135deg,#60a5fa,#3b82f6)',
            color:      '#fff',
            borderRadius: 28,
            padding:    '12px 24px',
            fontSize:   13,
            fontWeight: 700,
            fontFamily: 'Inter,sans-serif',
            cursor:     'pointer',
            boxShadow:  '0 4px 24px rgba(59,130,246,0.5)',
            display:    'flex',
            alignItems: 'center',
            gap:        8,
            whiteSpace: 'nowrap',
            animation:  'slideUpBanner 0.4s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <span style={{ fontSize: 16 }}>✦</span>
          New update available — tap to refresh
          <span style={{
            background: 'rgba(255,255,255,0.25)',
            borderRadius: 20,
            padding: '2px 10px',
            fontSize: 11,
          }}>Update</span>
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