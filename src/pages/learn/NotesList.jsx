import { useState, useRef } from 'react'
import { haptic } from '../../utils/haptics'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../app/useTheme'
import { useAppStore } from '../../app/store'
import Header from '../../components/layout/Header'

const NOTE_COVER_BG = {
  aurora: 'linear-gradient(160deg,rgba(0,200,180,0.18),rgba(100,0,200,0.14),rgba(0,80,200,0.12))',
  sunset: 'linear-gradient(160deg,rgba(255,100,0,0.16),rgba(220,50,100,0.14),rgba(180,0,150,0.1))',
  ocean:  'linear-gradient(160deg,rgba(0,80,200,0.17),rgba(0,180,200,0.12),rgba(0,120,180,0.1))',
  forest: 'linear-gradient(160deg,rgba(20,160,80,0.16),rgba(0,120,60,0.12),rgba(80,200,100,0.08))',
  cosmic: 'linear-gradient(160deg,rgba(120,0,200,0.17),rgba(200,0,100,0.1),rgba(80,0,180,0.14))',
  rose:   'linear-gradient(160deg,rgba(255,100,150,0.16),rgba(200,50,100,0.12),rgba(255,150,200,0.08))',
}
const CAT_COLORS = ['rgba(96,165,250,0.9)','rgba(167,139,250,0.9)','rgba(52,211,153,0.9)','rgba(251,191,36,0.9)','rgba(248,113,113,0.9)','rgba(244,114,182,0.9)']

/* 3D stacked card preview shown when category is collapsed */
function StackPreview({ notes, color, onClick, t }) {
  const count = Math.min(notes.length, 3)
  return (
    <div onClick={onClick} style={{ position:'relative', width:56, height:44, cursor:'pointer', flexShrink:0 }}>
      {Array.from({length:count}).map((_,i) => {
        const idx = count - 1 - i  // back to front
        const offset = idx * 5
        const rot = (idx - 1) * 4
        const scale = 1 - idx * 0.05
        return (
          <div key={i} style={{
            position:'absolute', bottom:0, left: offset,
            width:42, height:36, borderRadius:8,
            background: i === 0 ? `${color.replace('0.9','0.15')}` : i === 1 ? t.inputBg : t.inputBg,
            border:`1px solid ${i===0 ? color.replace('0.9','0.3') : t.border}`,
            transform:`rotate(${rot}deg) scale(${scale})`,
            transformOrigin:'bottom left',
            boxShadow: i===0 ? `0 4px 16px ${color.replace('0.9','0.15')}` : 'none',
            transition:'all 0.2s',
          }}>
            {i === 0 && (
              <div style={{ padding:'6px 8px' }}>
                <div style={{ width:'70%', height:2, borderRadius:1, background:color.replace('0.9','0.5'), marginBottom:3 }} />
                <div style={{ width:'50%', height:2, borderRadius:1, background:t.borderMed }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}


/* Swipe left to reveal delete */
function SwipeRow({ children, onDelete, t }) {
  const [offset, setOffset] = useState(0)
  const startX = useRef(null)
  const revealed = offset < -60

  const onTouchStart = e => { startX.current = e.touches[0].clientX }
  const onTouchMove  = e => {
    if (startX.current === null) return
    const dx = e.touches[0].clientX - startX.current
    if (dx > 0) { setOffset(0); return }
    setOffset(Math.max(dx, -80))
  }
  const onTouchEnd = () => {
    if (offset < -60) setOffset(-72)
    else { setOffset(0); startX.current = null }
  }
  const handleDelete = () => { haptic.medium(); onDelete(); setOffset(0) }

  return (
    <div style={{ position:'relative', overflow:'hidden' }}>
      {/* Delete button revealed behind */}
      <div style={{ position:'absolute', right:0, top:0, bottom:0, width:72, background:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }} onClick={handleDelete}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </div>
      {/* Sliding content */}
      <div
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{ transform:`translateX(${offset}px)`, transition: startX.current === null ? 'transform 0.25s ease' : 'none', background:'inherit' }}
      >
        {children}
      </div>
    </div>
  )
}


// ── SECRET: only visible to these two emails ─────────────────────────────
const SECRET_EMAILS   = ['ashpitaghosh@gmail.com', 'worldshein@gmail.com']
const SECRET_PASSCODE = 'iloveyou'  // type this in search to open the letter

// Pre-generated static stars — never changes, no random on render
const STARS = [
  {id:0,x:8,y:12,s:1.2,d:0.3,dur:2.8},{id:1,x:15,y:35,s:0.8,d:1.1,dur:3.2},
  {id:2,x:22,y:8,s:1.8,d:0.7,dur:2.5},{id:3,x:31,y:55,s:0.6,d:2.1,dur:3.8},
  {id:4,x:38,y:22,s:1.4,d:0.4,dur:2.2},{id:5,x:45,y:72,s:0.9,d:1.8,dur:3.5},
  {id:6,x:52,y:18,s:1.1,d:0.9,dur:2.9},{id:7,x:58,y:42,s:1.6,d:0.2,dur:2.4},
  {id:8,x:65,y:88,s:0.7,d:2.5,dur:3.1},{id:9,x:72,y:30,s:1.3,d:1.4,dur:2.7},
  {id:10,x:79,y:65,s:0.5,d:0.6,dur:3.9},{id:11,x:86,y:15,s:1.9,d:1.9,dur:2.3},
  {id:12,x:92,y:50,s:1.0,d:0.8,dur:3.4},{id:13,x:5,y:78,s:0.8,d:3.1,dur:2.6},
  {id:14,x:18,y:92,s:1.5,d:1.5,dur:3.7},{id:15,x:28,y:68,s:0.6,d:2.8,dur:2.1},
  {id:16,x:42,y:85,s:1.2,d:0.1,dur:3.3},{id:17,x:55,y:95,s:0.9,d:3.5,dur:2.8},
  {id:18,x:68,y:5,s:1.7,d:1.2,dur:3.6},{id:19,x:82,y:82,s:0.7,d:2.3,dur:2.4},
  {id:20,x:95,y:28,s:1.1,d:0.5,dur:3.0},{id:21,x:12,y:48,s:1.4,d:1.7,dur:2.7},
  {id:22,x:35,y:15,s:0.8,d:3.8,dur:3.2},{id:23,x:48,y:60,s:1.6,d:0.3,dur:2.5},
  {id:24,x:62,y:75,s:0.5,d:2.0,dur:3.8},{id:25,x:75,y:45,s:1.3,d:1.0,dur:2.2},
  {id:26,x:88,y:90,s:1.0,d:0.7,dur:3.5},{id:27,x:3,y:25,s:0.7,d:3.2,dur:2.9},
  {id:28,x:25,y:38,s:1.8,d:1.6,dur:3.1},{id:29,x:50,y:10,s:0.6,d:2.7,dur:2.6},
]

function StarField() {
  return (
    <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', overflow:'hidden' }}>
      {STARS.map(s => (
        <circle key={s.id} cx={`${s.x}%`} cy={`${s.y}%`} r={s.s}
          fill="white"
          style={{ animation: `starTwinkle ${s.dur}s ${s.d}s ease-in-out infinite alternate` }}
        />
      ))}
    </svg>
  )
}


function LoveLetterModal({ onClose }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(5,0,20,0.9)', backdropFilter:'blur(14px)', display:'flex', alignItems:'flex-end', justifyContent:'center', animation:'llFadeIn 0.3s ease' }}>

      <div style={{ width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto', borderRadius:'28px 28px 0 0', background:'linear-gradient(170deg,#0d0020 0%,#1a0035 45%,#080018 100%)', border:'1px solid rgba(160,80,255,0.2)', position:'relative', animation:'llSlideUp 0.4s cubic-bezier(0.16,1,0.3,1)', boxShadow:'0 -24px 80px rgba(120,40,255,0.35)' }}>

        <StarField />

        {/* Purple glow top-left */}
        <div style={{ position:'absolute', top:-80, left:'5%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle,rgba(140,40,255,0.2) 0%,transparent 70%)', pointerEvents:'none', zIndex:0 }} />
        {/* Pink glow bottom-right */}
        <div style={{ position:'absolute', bottom:20, right:'5%', width:220, height:220, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,60,160,0.14) 0%,transparent 70%)', pointerEvents:'none', zIndex:0 }} />

        {/* Handle */}
        <div style={{ display:'flex', justifyContent:'center', paddingTop:14, position:'relative', zIndex:2 }}>
          <div style={{ width:40, height:4, borderRadius:2, background:'rgba(255,255,255,0.18)' }} />
        </div>

        {/* Close button */}
        <button onClick={onClose} style={{ position:'absolute', top:12, right:16, zIndex:10, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'50%', width:30, height:30, cursor:'pointer', color:'rgba(255,255,255,0.5)', fontSize:17, lineHeight:'30px', textAlign:'center', padding:0 }}>×</button>

        {/* Body */}
        <div style={{ padding:'12px 26px 48px', position:'relative', zIndex:2 }}>

          {/* Heart + name */}
          <div style={{ textAlign:'center', marginBottom:24 }}>
            <div style={{ fontSize:40, marginBottom:10, display:'inline-block', animation:'llHeart 2s ease-in-out infinite', filter:'drop-shadow(0 0 18px rgba(255,80,180,0.9))' }}>💜</div>
            <p style={{ fontSize:10, letterSpacing:'4px', textTransform:'uppercase', color:'rgba(190,130,255,0.65)', fontFamily:'Georgia,serif', marginBottom:6, margin:'0 0 6px' }}>A letter for</p>
            <h2 style={{ fontSize:28, fontWeight:400, fontStyle:'italic', fontFamily:'Georgia,serif', background:'linear-gradient(135deg,#dda0ff,#ff79c6,#b070ff)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', letterSpacing:'-0.3px', margin:0 }}>My puchku baby</h2>
          </div>

          {/* Divider */}
          <div style={{ display:'flex', alignItems:'center', gap:10, margin:'0 0 22px' }}>
            <div style={{ flex:1, height:1, background:'linear-gradient(90deg,transparent,rgba(160,80,255,0.35))' }} />
            <span style={{ color:'rgba(180,110,255,0.6)', fontSize:13 }}>✦</span>
            <div style={{ flex:1, height:1, background:'linear-gradient(90deg,rgba(160,80,255,0.35),transparent)' }} />
          </div>

          {/* Paragraphs */}
          {[
            "In the quiet hours when the world slows down and the stars come out to keep watch — I think of you. Not in a fleeting way, but in the way that stays, the way that feels like the warmest thing I know.",
            "You study so hard. You carry so much. And yet somehow, you still make room for laughter, for kindness, for me. I don't know how you do it — but watching you makes me believe that people can be genuinely, unexpectedly wonderful.",
            "I built this little corner of the universe for you. Hidden between the notes and the timers and the flashcards — because that's where you live, isn't it? In the in-between spaces. In the margins of the page.",
            "I want you to know, in case no one said it clearly enough today: you are enough. More than enough. You are the reason some days feel lighter than they should.",
            "Keep going, Ashpita. The stars are watching. And so am I — always.",
          ].map((para, i) => (
            <p key={i} style={{ fontSize:14, lineHeight:1.9, fontFamily:'Georgia,serif', color: i===4 ? 'rgba(210,160,255,0.95)' : 'rgba(190,150,255,0.78)', fontStyle: i===4 ? 'italic' : 'normal', fontWeight: i===4 ? 500 : 400, margin: i===4 ? '0' : '0 0 16px' }}>{para}</p>
          ))}

          {/* Signature */}
          <div style={{ marginTop:26, textAlign:'right' }}>
            <div style={{ height:1, background:'linear-gradient(90deg,transparent,rgba(160,80,255,0.25))', marginBottom:14 }} />
            <p style={{ fontSize:12, color:'rgba(160,100,255,0.55)', fontFamily:'Georgia,serif', fontStyle:'italic', margin:0 }}>Written in starlight, with love 💜</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes llFadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes llSlideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes starTwinkle { from{opacity:0.04} to{opacity:0.88} }
        @keyframes llHeart   { 0%,100%{transform:scale(1)} 14%{transform:scale(1.18)} 28%{transform:scale(1)} 42%{transform:scale(1.09)} 56%{transform:scale(1)} }
      `}</style>
    </div>
  )
}


export default function NotesList() {
  const { isDark, t } = useTheme()
  const navigate = useNavigate()
  const { notes, deleteNote } = useAppStore()
  const [search, setSearch]     = useState('')
  const [openCategories, setOpenCats] = useState(new Set(['Uncategorized']))
  const [hoveredCat, setHoveredCat]   = useState(null)
  const [showLetter, setShowLetter]   = useState(false)

  // Check if signed-in user is Ashpita
  const savedUser = (() => { try { return JSON.parse(localStorage.getItem('studymate_user') || '{}') } catch { return {} } })()
  const isAshpita = SECRET_EMAILS.includes(savedUser.email)

  const filtered = notes.filter(n =>
    n.title?.toLowerCase().includes(search.toLowerCase()) ||
    n.content?.toLowerCase().includes(search.toLowerCase()) ||
    n.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  const groups = filtered.reduce((acc, note) => {
    const cat = note.tags?.[0] || 'Uncategorized'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(note)
    return acc
  }, {})

  const toggleCat = (cat) => {
    setOpenCats(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  return (
    <div style={{ minHeight:'100vh' }}>
      {showLetter && <LoveLetterModal onClose={() => setShowLetter(false)} />}
      <Header title="Notes" back right={
        <button onClick={()=>navigate('/learn/notes/new')} className="pressable"
          style={{ width:34,height:34,borderRadius:10,background:'#fff',color:'#000',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:20,fontWeight:700,border:'none' }}>+</button>
      } />

      <div style={{ padding:'8px 16px 100px', display:'flex', flexDirection:'column', gap:12 }}>
        {/* Search */}
        <div style={{ display:'flex',alignItems:'center',gap:10,background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:14,padding:'10px 14px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
          <input placeholder="Search notes..." value={search} onChange={e=>{
            const val = e.target.value
            setSearch(val)
            if (isAshpita && val.toLowerCase() === SECRET_PASSCODE) {
              setSearch('')
              setShowLetter(true)
            }
          }} style={{ flex:1,background:'none',border:'none',color:t.text,fontSize:14,fontFamily:'Inter,sans-serif',outline:'none' }} />
          {search && <button onClick={()=>setSearch('')} style={{ background:'none',border:'none',color:t.textMuted,cursor:'pointer',fontSize:16,padding:2 }}>×</button>}
        </div>

        {Object.keys(groups).length === 0 && (
          <div style={{ textAlign:'center',padding:'56px 20px' }}>
            <p style={{ fontSize:14,fontWeight:600,color:t.textMuted,fontFamily:'Inter,sans-serif',marginBottom:4 }}>{search?'No results':'No notes yet'}</p>
            <p style={{ fontSize:12,color:t.textFaint,fontFamily:'Inter,sans-serif' }}>Tap + to create your first note</p>
          </div>
        )}

        {Object.entries(groups).map(([cat, catNotes], catIdx) => {
          const isOpen = openCategories.has(cat)
          const color  = CAT_COLORS[catIdx % CAT_COLORS.length]
          const isHov  = hoveredCat === cat

          return (
            <div key={cat} style={{ perspective:'800px' }}>
              {/* ── CATEGORY HEADER ── */}
              <div
                className="pressable"
                onClick={()=>toggleCat(cat)}
                onMouseEnter={()=>setHoveredCat(cat)}
                onMouseLeave={()=>setHoveredCat(null)}
                style={{
                  display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                  background: isHov ? t.inputBg : t.inputBg,
                  border:`1px solid ${isOpen ? color.replace('0.9','0.2') : t.border}`,
                  borderRadius: isOpen ? '18px 18px 0 0' : 18,
                  cursor:'pointer',
                  transition:'all 0.25s',
                  boxShadow: isOpen ? `0 2px 20px ${color.replace('0.9','0.08')}` : 'none',
                }}>

                {/* Color dot */}
                <div style={{ width:10,height:10,borderRadius:'50%',background:color,flexShrink:0,boxShadow:`0 0 8px ${color}` }} />

                {/* Category name */}
                <span style={{ flex:1,fontSize:14,fontWeight:700,color:t.text,fontFamily:'Inter,sans-serif' }}>{cat}</span>

                {/* Note count */}
                <span style={{ fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif' }}>{catNotes.length} note{catNotes.length!==1?'s':''}</span>

                {/* 3D stack preview when closed */}
                {!isOpen && catNotes.length > 0 && (
                  <StackPreview notes={catNotes} color={color} onClick={()=>toggleCat(cat)} t={t} />
                )}

                {/* Chevron */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.5" strokeLinecap="round"
                  style={{ transform:isOpen?'rotate(180deg)':'none', transition:'transform 0.25s', flexShrink:0 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>

              {/* ── NOTES LIST (expanded) ── */}
              {isOpen && (
                <div style={{
                  border:`1px solid ${color.replace('0.9','0.12')}`,
                  borderTop:'none',
                  borderRadius:'0 0 18px 18px',
                  overflow:'hidden',
                  boxShadow:`0 8px 24px ${color.replace('0.9','0.06')}`,
                }}>
                  {catNotes.map((note, ni) => {
                    const bg = note.cover && note.cover!=='none' ? NOTE_COVER_BG[note.cover] : '#0e0e0e'
                    const previewText = note.content?.trim() ||
                      (note.html ? note.html.replace(/<[^>]*>/g,'').trim() : '') ||
                      'Tap to write...'
                    return (
                      <SwipeRow key={note.id} onDelete={()=>deleteNote(note.id)} t={t}>
                      <div
                        className="pressable"
                        onClick={()=>{ haptic.select(); navigate(`/learn/notes/${note.id}`) }}
                        style={{
                          padding:'14px 16px',
                          background: bg,
                          borderBottom: ni < catNotes.length-1 ? `1px solid ${t.border}` : 'none',
                          position:'relative', cursor:'pointer',
                          transition:'background 0.15s',
                        }}>
                        {note.cover && note.cover!=='none' && (
                          <div style={{ position:'absolute',inset:0,background:NOTE_COVER_BG[note.cover],pointerEvents:'none' }} />
                        )}
                        <div style={{ position:'relative',zIndex:1,display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8 }}>
                          <div style={{ flex:1 }}>
                            <p style={{ fontSize:14,fontWeight:700,color:t.text,marginBottom:4,letterSpacing:'-0.2px',fontFamily:'Inter,sans-serif' }}>{note.title}</p>
                            <p style={{ fontSize:12,color:t.textMuted,lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',fontFamily:'Inter,sans-serif' }}>
                              {previewText}
                            </p>
                            <p style={{ fontSize:10,color:t.textFaint,marginTop:6,fontFamily:'Inter,sans-serif' }}>
                              {new Date(note.createdAt||Date.now()).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})}
                            </p>
                          </div>
                          <button onClick={e=>{e.stopPropagation();deleteNote(note.id)}}
                            style={{ background:t.inputBg,border:'none',cursor:'pointer',color:t.textMuted,fontSize:12,padding:'4px 8px',borderRadius:8,flexShrink:0 }}>✕</button>
                        </div>
                      </div>
                      </SwipeRow>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes stackPop { from{transform:translateY(8px) scale(0.97);opacity:0} to{transform:translateY(0) scale(1);opacity:1} }
      `}</style>
    </div>
  )
}