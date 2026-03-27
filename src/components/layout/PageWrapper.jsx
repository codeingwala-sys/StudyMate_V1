import { useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'

export default function PageWrapper({ children }) {
  const { pathname } = useLocation()

  const hideNav = [
    '/focus/timer',
    '/learn/notes/new',
    '/practice/mode1',
    '/practice/mode2',
  ].some(p => pathname.startsWith(p))
    || /^\/learn\/notes\/\d+$/.test(pathname)

  return (
    <div className="page-wrapper" style={{
      position:'relative', display:'flex', flexDirection:'column',
      height:'100dvh', margin:'0 auto', overflow:'hidden',
    }}>
      {/* page-scroll must have transparent bg so the ::before glow shows through */}
      <div className="page-scroll" style={{ paddingBottom: hideNav ? 0 : 80, background:'transparent' }}>
        {children}
      </div>
      {!hideNav && <BottomNav />}
    </div>
  )
}