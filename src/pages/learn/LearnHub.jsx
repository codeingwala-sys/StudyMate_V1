import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../app/store'
import Header from '../../components/layout/Header'

const TOOLS = [
  { icon: '📝', label: 'Notes',          sub: 'Write & organise',     path: '/learn/notes',      color: '#7eb8ff' },
  { icon: '🃏', label: 'Flashcards',     sub: 'AI-generated cards',   path: '/learn/flashcards', color: '#b07eff' },
  { icon: '🎧', label: 'Voice Overview', sub: 'Listen to notes',      path: '/learn/voice',      color: '#ff7eb3' },
  { icon: '🗺️', label: 'Mind Map',       sub: 'Visualise concepts',   path: '/learn/mindmap',    color: '#7effd4' },
]
const COLORS = ['#7eb8ff','#b07eff','#7effd4','#ffd97e']

export default function LearnHub() {
  const navigate = useNavigate()
  const { notes } = useAppStore()

  return (
    <div className="page-pad">
      <Header title="Learn" subtitle="Study smarter" />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }} className="anim-up-1">
        {TOOLS.map(({ icon, label, sub, path, color }) => (
          <div key={path} className="pressable" onClick={() => navigate(path)} style={{ background:`${color}08`, border:`1px solid ${color}18`, borderRadius:20, padding:'18px 14px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ width:44, height:44, borderRadius:13, background:`${color}12`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>{icon}</div>
            </div>
            <p style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:3 }}>{label}</p>
            <p style={{ fontSize:11, color:'var(--muted)' }}>{sub}</p>
          </div>
        ))}
      </div>

      <div className="anim-up-2">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <p className="section-label">Recent Notes</p>
          <button onClick={() => navigate('/learn/notes')} style={{ fontSize:12, color:'var(--accent)', fontWeight:600, background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font)' }}>See all →</button>
        </div>
        {notes.length === 0 ? (
          <div className="pressable" onClick={() => navigate('/learn/notes/new')} style={{ background:'rgba(126,184,255,0.04)', border:'1px dashed rgba(126,184,255,0.2)', borderRadius:18, padding:'28px 16px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>📝</div>
            <p style={{ fontSize:14, fontWeight:600, color:'var(--accent)' }}>Create your first note</p>
            <p style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>AI will generate questions from it</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {notes.slice(0, 3).map((note, i) => (
              <div key={note.id} className="pressable" onClick={() => navigate(`/learn/notes/${note.id}`)} style={{ background:'rgba(20,27,48,0.8)', border:'1px solid var(--border)', borderLeft:`3px solid ${COLORS[i % COLORS.length]}`, borderRadius:16, padding:'12px 14px', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:14, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{note.title}</p>
                  <p style={{ fontSize:11, color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{note.content?.slice(0, 60) || 'No content'}</p>
                </div>
                {note.tags?.[0] && <span style={{ fontSize:10, fontWeight:700, color:COLORS[i % COLORS.length], background:`${COLORS[i % COLORS.length]}15`, padding:'2px 8px', borderRadius:8, flexShrink:0 }}>{note.tags[0]}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}