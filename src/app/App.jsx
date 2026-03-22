import { useEffect } from 'react'
import { useState } from 'react'
import ErrorBoundary from '../components/ErrorBoundary'
import Splash from '../pages/Splash'
import { BrowserRouter } from 'react-router-dom'
import Router from './Router'
import { useAppStore } from './store'

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const refreshStreak = useAppStore(s => s.refreshStreak)

  // Recalculate streak every time the app loads / becomes visible
  useEffect(() => {
    refreshStreak()
    const onVisible = () => { if (document.visibilityState === 'visible') refreshStreak() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return (
    <ErrorBoundary>
      {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
      <BrowserRouter>
        <Router />
      </BrowserRouter>
    </ErrorBoundary>
  )
}