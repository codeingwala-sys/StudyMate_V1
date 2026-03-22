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

export default function NotesList() {
  const { isDark, t } = useTheme()
  const navigate = useNavigate()
  const { notes, deleteNote } = useAppStore()
  const [search, setSearch] = useState('')
  const [openCategories, setOpenCats] = useState(new Set(['Uncategorized']))
  const [hoveredCat, setHoveredCat] = useState(null)

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
      <Header title="Notes" back right={
        <button onClick={()=>navigate('/learn/notes/new')} className="pressable"
          style={{ width:34,height:34,borderRadius:10,background:'#fff',color:'#000',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:20,fontWeight:700,border:'none' }}>+</button>
      } />

      <div style={{ padding:'8px 16px 100px', display:'flex', flexDirection:'column', gap:12 }}>
        {/* Search */}
        <div style={{ display:'flex',alignItems:'center',gap:10,background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:14,padding:'10px 14px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
          <input placeholder="Search notes..." value={search} onChange={e=>setSearch(e.target.value)} style={{ flex:1,background:'none',border:'none',color:t.text,fontSize:14,fontFamily:'Inter,sans-serif',outline:'none' }} />
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