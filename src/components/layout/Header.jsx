import { useNavigate } from 'react-router-dom'

export default function Header({ title, subtitle, back, right }) {
  const navigate = useNavigate()
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 16px 8px' }}>
      {back && (
        <button onClick={()=>navigate(-1)} className="pressable" style={{
          width:36, height:36, borderRadius:12,
          background:'var(--input-bg)', border:'1px solid var(--border)',
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', fontSize:20, color:'var(--text-secondary)', flexShrink:0,
        }}>‹</button>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        {subtitle && <p style={{ fontSize:11,color:'var(--text-muted)',fontWeight:600,marginBottom:1,textTransform:'uppercase',letterSpacing:'0.8px' }}>{subtitle}</p>}
        <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text)', lineHeight:1.2 }}>{title}</h1>
      </div>
      {right && <div style={{ flexShrink:0 }}>{right}</div>}
    </div>
  )
}