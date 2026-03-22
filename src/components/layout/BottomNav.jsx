import { useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../../app/useTheme'

const TABS = [
  { label:'Notes',    path:'/learn/notes',  icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
  { label:'Practice', path:'/practice',     icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  { label:'Home',     path:'/',             icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { label:'Focus',    path:'/focus',        icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { label:'Progress', path:'/progress',     icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
]

export default function BottomNav() {
  const { isDark, t } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isActive = (p) => p === '/' ? pathname === '/' : pathname.startsWith(p)

  return (
    <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:50 }}>
      <div style={{ height:40, background:`linear-gradient(to top, ${isDark?'rgba(0,0,0,0.92)':'rgba(240,240,240,0.92)'} 0%, transparent 100%)`, pointerEvents:'none' }} />
      <div style={{ background: isDark?'rgba(0,0,0,0.75)':'rgba(240,240,240,0.82)', backdropFilter:'blur(28px) saturate(180%)', WebkitBackdropFilter:'blur(28px) saturate(180%)', borderTop:`1px solid ${t.border}`, padding:'8px 4px 20px', display:'flex', alignItems:'center', justifyContent:'space-around' }}>
        {TABS.map(({ label, path, icon }) => {
          const active = isActive(path)
          return (
            <button key={path} onClick={()=>navigate(path)} className="pressable"
              style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'8px 12px',borderRadius:16,border:'none',background:'transparent',cursor:'pointer',minWidth:52,position:'relative' }}>
              <span style={{ color: active ? 'var(--text)' : 'var(--text-muted)', transition:'color 0.2s', lineHeight:1 }}>{icon}</span>
              <span style={{ fontSize:9,fontWeight:active?700:400,color:active?'var(--text)':'var(--text-muted)',fontFamily:'Inter,sans-serif',letterSpacing:'0.3px',transition:'all 0.2s' }}>{label}</span>
              {active && <div style={{ position:'absolute',bottom:2,left:'50%',transform:'translateX(-50%)',width:16,height:2,borderRadius:1,background:'var(--text)' }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}