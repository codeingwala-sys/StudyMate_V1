import { useRef } from 'react'
import { useTheme } from '../../app/useTheme'

export default function ShareCard({ result, onClose }) {
  const { t } = useTheme()
  const cardRef = useRef(null)

  const col = result.score >= 80 ? '#4ade80' : result.score >= 50 ? '#fbbf24' : '#f87171'
  const emoji = result.score >= 80 ? '🏆' : result.score >= 60 ? '🌟' : result.score >= 40 ? '💪' : '📚'

  const shareText = `${emoji} Just scored ${result.score}% on ${result.subject} with StudyMate AI!\n\n📚 Subject: ${result.subject}\n🎯 Score: ${result.score}%\n📝 Mode: ${result.mode}\n\nStudy smarter with AI ✦`

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'StudyMate Result', text: shareText }) } catch {}
    } else {
      await navigator.clipboard.writeText(shareText)
      alert('Copied to clipboard!')
    }
  }

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.85)',
      backdropFilter:'blur(20px)', display:'flex', alignItems:'center',
      justifyContent:'center', padding:20, animation:'fadeIn 0.2s ease',
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:340, display:'flex', flexDirection:'column', gap:12 }}>

        {/* Card */}
        <div ref={cardRef} style={{
          background:'linear-gradient(135deg,#0a0a0a,#111)',
          border:`1px solid ${col}30`,
          borderRadius:24, padding:'32px 28px',
          boxShadow:`0 0 60px ${col}20`,
          textAlign:'center',
        }}>
          {/* Glow */}
          <div style={{ position:'absolute', inset:0, borderRadius:24, background:`radial-gradient(ellipse 80% 60% at 50% 0%, ${col}12, transparent)`, pointerEvents:'none' }} />

          <div style={{ position:'relative' }}>
            <div style={{ fontSize:52, marginBottom:12 }}>{emoji}</div>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)', fontFamily:'Inter,sans-serif', marginBottom:4, textTransform:'uppercase', letterSpacing:'1.2px' }}>Score</p>
            <p style={{ fontSize:64, fontWeight:900, color:col, fontFamily:'Inter,sans-serif', letterSpacing:'-3px', lineHeight:1 }}>{result.score}<span style={{ fontSize:28, fontWeight:400, color:'rgba(255,255,255,0.3)' }}>%</span></p>
            <p style={{ fontSize:18, fontWeight:700, color:'#fff', fontFamily:'Inter,sans-serif', marginTop:12, letterSpacing:'-0.3px' }}>{result.subject}</p>
            <p style={{ fontSize:12, color:'rgba(255,255,255,0.35)', fontFamily:'Inter,sans-serif', marginTop:4 }}>{result.mode} · {new Date(result.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</p>

            <div style={{ marginTop:24, paddingTop:20, borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <span style={{ fontSize:14, color:'rgba(255,255,255,0.25)', fontFamily:'Inter,sans-serif' }}>✦ StudyMate AI</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <button onClick={handleShare} style={{
          padding:'15px', borderRadius:16, border:'none', cursor:'pointer',
          background:`linear-gradient(135deg,${col}dd,${col}99)`,
          color:'#000', fontSize:15, fontWeight:700, fontFamily:'Inter,sans-serif',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          Share Result
        </button>
        <button onClick={onClose} style={{ padding:'13px', borderRadius:16, border:`1px solid ${t.border}`, cursor:'pointer', background:t.card, color:t.textSec, fontSize:14, fontWeight:600, fontFamily:'Inter,sans-serif' }}>
          Close
        </button>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  )
}