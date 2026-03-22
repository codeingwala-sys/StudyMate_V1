import { useEffect, useState } from 'react'

export default function Splash({ onDone }) {
  const [phase, setPhase] = useState(0) // 0=show, 1=fade out

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1400)
    const t2 = setTimeout(() => onDone(), 1900)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999,
      background:'#000',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      opacity: phase === 1 ? 0 : 1,
      transition: 'opacity 0.5s ease',
      pointerEvents:'none',
    }}>
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center', gap:16,
        animation: 'splashPop 0.6s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        {/* Logo mark */}
        <div style={{
          width:80, height:80, borderRadius:24,
          background:'linear-gradient(135deg,rgba(96,165,250,0.2),rgba(167,139,250,0.15))',
          border:'1px solid rgba(96,165,250,0.25)',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 0 60px rgba(96,165,250,0.15)',
        }}>
          <span style={{ fontSize:36, lineHeight:1 }}>✦</span>
        </div>
        <div style={{ textAlign:'center' }}>
          <p style={{ fontSize:28, fontWeight:900, color:'#fff', letterSpacing:'-1px', fontFamily:'Inter,sans-serif', lineHeight:1 }}>StudyMate</p>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.3)', fontFamily:'Inter,sans-serif', marginTop:6 }}>AI Study Companion</p>
        </div>
      </div>
      <style>{`
        @keyframes splashPop {
          from { opacity:0; transform:scale(0.85) }
          to   { opacity:1; transform:scale(1) }
        }
      `}</style>
    </div>
  )
}