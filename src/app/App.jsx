import { useEffect, useState } from 'react'
import ErrorBoundary from '../components/ErrorBoundary'
import Splash from '../pages/Splash'
import { BrowserRouter } from 'react-router-dom'
import Router from './Router'
import { useAppStore } from './store'

export default function App() {
  const [splashDone,   setSplashDone]   = useState(false)
  const [updateReady,  setUpdateReady]  = useState(false)
  const refreshStreak = useAppStore(s => s.refreshStreak)

  // Recalculate streak every time the app loads / becomes visible
  useEffect(() => {
    refreshStreak()
    const onVisible = () => { if (document.visibilityState === 'visible') refreshStreak() }
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

      <style>{`
        @keyframes slideUpBanner {
          from { opacity:0; transform:translateX(-50%) translateY(20px) }
          to   { opacity:1; transform:translateX(-50%) translateY(0) }
        }
      `}</style>
    </ErrorBoundary>
  )
}
