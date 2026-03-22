import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../../app/store'
import { useTheme } from '../../app/useTheme'
import { exportNoteToPdf } from '../../utils/exportPdf'
import { haptic } from '../../utils/haptics'
import { generateQuestionsFromText, generateFlashcards, generateVoiceOverview, searchWithAI } from '../../services/ai.service'
import * as aiService from '../../services/ai.service'
import { backgroundGenerateForNote, invalidateCache } from '../../services/aiCache.service'

const FONT_SIZES  = [12, 14, 16, 18, 20, 24, 28]
const TEXT_COLORS = ['#ffffff','#f87171','#fb923c','#facc15','#4ade80','#60a5fa','#c084fc','#f472b6']


// ── IMAGE SYSTEM — float-based, inside contenteditable ──────────────────────
//
//  FINAL APPROACH — the only way text wraps around images in HTML:
//
//  Images live INSIDE the contenteditable as <img> elements with float:left
//  or float:right. CSS float is the browser's only native text-wrap mechanism.
//  A floated element is taken OUT of normal flow — typing above/below it does
//  NOT push it. Text automatically wraps around it.
//
//  To keep images selectable and draggable after text is added, we:
//    1. Set contenteditable="false" on the image's wrapper span so the cursor
//       never enters the image.
//    2. Give the image a high z-index so it visually appears above text.
//    3. Attach pointerdown directly on the <img> to select it.
//    4. Use a React portal overlay for resize dots/toolbar — they render outside
//       the contenteditable so they never interfere with typing.
//
//  Move = change marginLeft/marginRight (float side) + re-insert img before a
//  different sibling to change vertical position.
//  Resize = change img width only, height stays 'auto' (aspect ratio preserved).
//  Wrap modes: float:left / float:right / float:none (block, full row).

// Inject CSS into the page once for image styling inside editors
const IMG_STYLE_ID = 'studymate-img-css'
if (!document.getElementById(IMG_STYLE_ID)) {
  const s = document.createElement('style')
  s.id = IMG_STYLE_ID
  s.textContent = `
    [contenteditable] img[data-sm-img] {
      cursor: pointer !important;
      border-radius: 10px;
      max-width: 100%;
      height: auto !important;
      display: block;
    }
    [contenteditable] img[data-sm-img].sm-selected {
      outline: 2.5px solid #60a5fa !important;
      outline-offset: 2px;
      box-shadow: 0 0 0 4px rgba(96,165,250,0.15);
    }
    [contenteditable] span[data-sm-wrap] {
      display: block;
      line-height: 0;
      font-size: 0;
      contenteditable: false;
    }
    [contenteditable] span[data-sm-wrap="left"]  { float: left;  margin-right: 12px; margin-bottom: 8px; }
    [contenteditable] span[data-sm-wrap="right"] { float: right; margin-left:  12px; margin-bottom: 8px; }
    [contenteditable] span[data-sm-wrap="none"]  { float: none;  display: block; margin: 10px 0; }
  `
  document.head.appendChild(s)
}

// ImageControls — rendered as a fixed overlay (outside contenteditable) when an image is selected
function ImageControls({ imgEl, editorEl, onClose, onDelete }) {
  const [rect, setRect]   = useState(null)
  const [wrap, setWrap]   = useState(() => imgEl.closest('[data-sm-wrap]')?.dataset.smWrap || 'none')
  const resizeRef = useRef(null)
  const moveRef   = useRef(null)
  const rafRef    = useRef(null)

  const measure = useCallback(() => {
    const r = imgEl.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [imgEl])

  useEffect(() => {
    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
      cancelAnimationFrame(rafRef.current)
    }
  }, [measure])

  const getWrapper = () => imgEl.closest('[data-sm-wrap]')

  // ── WRAP ────────────────────────────────────────────────────────────────
  const applyWrap = (mode) => {
    const wrapper = getWrapper()
    if (!wrapper) return
    wrapper.dataset.smWrap = mode
    setWrap(mode)
    if (mode === 'left') {
      wrapper.style.cssText = 'float:left; margin-right:14px; margin-bottom:8px; margin-left:0; margin-top:4px; display:block; line-height:0; font-size:0;'
    } else if (mode === 'right') {
      wrapper.style.cssText = 'float:right; margin-left:14px; margin-bottom:8px; margin-right:0; margin-top:4px; display:block; line-height:0; font-size:0;'
    } else {
      wrapper.style.cssText = 'float:none; display:block; margin:10px 0; line-height:0; font-size:0; clear:both;'
    }
    setTimeout(measure, 30)
  }

  // ── RESIZE — width only, aspect ratio auto ───────────────────────────────
  const onResizeDown = (e, corner) => {
    e.preventDefault(); e.stopPropagation()
    resizeRef.current = { corner, startX: e.clientX, startW: imgEl.offsetWidth }
    window.addEventListener('pointermove', onResizeMove, { passive: false })
    window.addEventListener('pointerup',   onResizeUp)
  }
  const onResizeMove = useCallback((e) => {
    e.preventDefault()
    const d = resizeRef.current; if (!d) return
    const dx    = e.clientX - d.startX
    const delta = (d.corner === 'nw' || d.corner === 'sw') ? -dx : dx
    const newW  = Math.max(60, Math.min(d.startW + delta, window.innerWidth - 40))
    imgEl.style.width  = newW + 'px'
    imgEl.style.height = 'auto'
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(measure)
  }, [measure])
  const onResizeUp = useCallback(() => {
    resizeRef.current = null
    window.removeEventListener('pointermove', onResizeMove)
    window.removeEventListener('pointerup',   onResizeUp)
  }, [onResizeMove])

  // ── MOVE ─────────────────────────────────────────────────────────────────
  //
  //  The core problem with contenteditable: text is stored as text nodes, not
  //  elements. editor.children misses them entirely. We must use childNodes.
  //  To get the Y position of a text node, we wrap it in a Range and call
  //  getBoundingClientRect() on that range.

  const getNodeRect = (node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      return node.getBoundingClientRect()
    }
    // Text node — use Range to get its bounding rect
    try {
      const r = document.createRange()
      r.selectNode(node)
      return r.getBoundingClientRect()
    } catch { return null }
  }

  const onMoveDown = (e) => {
    e.preventDefault(); e.stopPropagation()
    const wrapper = getWrapper()
    if (!wrapper) return
    if ((wrapper.dataset.smWrap || 'none') === 'none') applyWrap('left')
    moveRef.current = {
      startX:   e.clientX,
      baseML:   parseFloat(wrapper.style.marginLeft)  || 0,
      baseMR:   parseFloat(wrapper.style.marginRight) || 0,
      wrapMode: wrapper.dataset.smWrap || 'left',
      lastRef:  null,
    }
    window.addEventListener('pointermove', onMoveMove, { passive: false })
    window.addEventListener('pointerup',   onMoveUp)
  }

  const onMoveMove = useCallback((e) => {
    e.preventDefault()
    const d = moveRef.current; if (!d) return
    const wrapper = getWrapper()
    if (!wrapper) return
    // Use the passed editorEl directly — wrapper.closest('[contenteditable]') would
    // wrongly match the wrapper itself (it has contenteditable="false")
    const editor = editorEl
    if (!editor) return

    // ── Horizontal ──────────────────────────────────────────────────────────
    const dx = e.clientX - d.startX
    if (d.wrapMode === 'right') {
      wrapper.style.marginRight = Math.max(0, d.baseMR - dx) + 'px'
    } else {
      wrapper.style.marginLeft  = Math.max(0, d.baseML + dx) + 'px'
    }

    // ── Vertical — scan ALL childNodes including text nodes ──────────────────
    // Build list of {node, top, bottom} for every direct child of editor
    const nodes = Array.from(editor.childNodes).filter(n => n !== wrapper)
    if (nodes.length === 0) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(measure)
      return
    }

    // For each node get its Y range
    const nodeRects = nodes.map(n => {
      const r = getNodeRect(n)
      return { node: n, top: r ? r.top : 0, bottom: r ? r.bottom : 0, mid: r ? (r.top + r.bottom) / 2 : 0 }
    }).filter(nr => nr.bottom > nr.top) // skip zero-height nodes

    if (nodeRects.length === 0) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(measure)
      return
    }

    // Find where pointer Y sits among nodes:
    // → insert wrapper BEFORE the first node whose top is >= pointer Y
    // → if pointer is below all nodes, append to end
    let insertBefore = null
    for (const nr of nodeRects) {
      if (nr.mid > e.clientY) {
        insertBefore = nr.node
        break
      }
    }

    // Only re-insert if target changed
    const refId = insertBefore ? (insertBefore.nodeName + (insertBefore.textContent || '').slice(0, 15)) : '__end__'
    if (refId !== d.lastRef) {
      d.lastRef = refId
      if (insertBefore) {
        editor.insertBefore(wrapper, insertBefore)
      } else {
        editor.appendChild(wrapper)
      }
      // Keep marginTop clean after re-insert
      wrapper.style.marginTop = '4px'
    }

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(measure)
  }, [measure])

  const onMoveUp = useCallback(() => {
    moveRef.current = null
    window.removeEventListener('pointermove', onMoveMove)
    window.removeEventListener('pointerup',   onMoveUp)
  }, [onMoveMove])

  if (!rect) return null

  const DOT = 16, HALF = DOT / 2
  const corners = {
    nw: { top: rect.top - HALF,               left: rect.left - HALF,              cursor: 'nw-resize' },
    ne: { top: rect.top - HALF,               left: rect.left + rect.width - HALF, cursor: 'ne-resize' },
    sw: { top: rect.top + rect.height - HALF, left: rect.left - HALF,              cursor: 'sw-resize' },
    se: { top: rect.top + rect.height - HALF, left: rect.left + rect.width - HALF, cursor: 'se-resize' },
  }
  const wrapBtnStyle = (mode) => ({
    padding: '5px 8px', borderRadius: 7, border: 'none', cursor: 'pointer',
    background: wrap === mode ? '#60a5fa' : 'rgba(255,255,255,0.10)',
    color:      wrap === mode ? '#000'    : 'rgba(255,255,255,0.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s',
  })

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:498, background:'transparent' }} />

      {/* Blue border + move handle */}
      <div onPointerDown={onMoveDown} style={{ position:'fixed', top:rect.top-2, left:rect.left-2, width:rect.width+4, height:rect.height+4, border:'2px solid #60a5fa', borderRadius:10, cursor:'move', zIndex:500, touchAction:'none', boxShadow:'inset 0 0 0 1px rgba(96,165,250,0.15)' }} />

      {/* Resize dots */}
      {Object.entries(corners).map(([corner, pos]) => (
        <div key={corner} onPointerDown={e => onResizeDown(e, corner)}
          style={{ position:'fixed', top:pos.top, left:pos.left, width:DOT, height:DOT, borderRadius:'50%', background:'#fff', border:'2.5px solid #60a5fa', boxShadow:'0 2px 8px rgba(0,0,0,0.6)', cursor:pos.cursor, zIndex:502, touchAction:'none' }}
        />
      ))}

      {/* Delete */}
      <div onPointerDown={e => e.stopPropagation()} onClick={() => { const w = getWrapper(); w ? w.remove() : imgEl.remove(); onDelete() }}
        style={{ position:'fixed', top:rect.top-12, left:rect.left+rect.width-12, width:24, height:24, borderRadius:'50%', background:'#ef4444', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', zIndex:503, boxShadow:'0 2px 8px rgba(0,0,0,0.5)', fontSize:12, color:'#fff', fontWeight:800, lineHeight:1 }}>✕</div>

      {/* Wrap toolbar */}
      <div onPointerDown={e => e.stopPropagation()}
        style={{ position:'fixed', top:rect.top+rect.height+8, left:rect.left+rect.width/2, transform:'translateX(-50%)', zIndex:503, background:'#1c1c1c', border:'1px solid rgba(255,255,255,0.14)', borderRadius:12, padding:'5px 8px', display:'flex', alignItems:'center', gap:4, boxShadow:'0 4px 24px rgba(0,0,0,0.75)', whiteSpace:'nowrap' }}>
        <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)', fontFamily:'Inter,sans-serif', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', paddingRight:2 }}>Wrap</span>
        <button title="Block" style={wrapBtnStyle('none')} onClick={() => applyWrap('none')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="4" x2="21" y2="4"/><rect x="3" y="8" width="18" height="8" rx="1"/><line x1="3" y1="20" x2="21" y2="20"/></svg>
        </button>
        <button title="Wrap left" style={wrapBtnStyle('left')} onClick={() => applyWrap('left')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <rect x="2" y="4" width="9" height="10" rx="1" fill={wrap==='left'?'rgba(0,0,0,0.3)':'rgba(255,255,255,0.1)'} stroke="currentColor"/>
            <line x1="14" y1="6" x2="22" y2="6"/><line x1="14" y1="9" x2="22" y2="9"/><line x1="14" y1="12" x2="22" y2="12"/>
            <line x1="2" y1="18" x2="22" y2="18"/><line x1="2" y1="21" x2="22" y2="21"/>
          </svg>
        </button>
        <button title="Wrap right" style={wrapBtnStyle('right')} onClick={() => applyWrap('right')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <rect x="13" y="4" width="9" height="10" rx="1" fill={wrap==='right'?'rgba(0,0,0,0.3)':'rgba(255,255,255,0.1)'} stroke="currentColor"/>
            <line x1="2" y1="6" x2="10" y2="6"/><line x1="2" y1="9" x2="10" y2="9"/><line x1="2" y1="12" x2="10" y2="12"/>
            <line x1="2" y1="18" x2="22" y2="18"/><line x1="2" y1="21" x2="22" y2="21"/>
          </svg>
        </button>
        <div style={{ width:1, height:14, background:'rgba(255,255,255,0.1)', margin:'0 2px' }} />
        <span style={{ fontSize:9, color:'rgba(255,255,255,0.28)', fontFamily:'Inter,sans-serif' }}>{Math.round(rect.width)}w</span>
      </div>
    </>
  )
}

function InlineFlashcard({ card, onNext, onPrev, idx, total }) {
  const [flipped, setFlipped] = useState(false)
  useEffect(() => setFlipped(false), [idx])
  return (
    <div style={{ padding:'4px 0 8px' }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
        <span style={{ fontSize:11,color:'rgba(255,255,255,0.3)',fontFamily:'Inter,sans-serif' }}>{idx+1} / {total}</span>
        <div style={{ display:'flex',gap:4 }}>
          <button onClick={onPrev} disabled={idx===0} style={{ width:26,height:26,borderRadius:8,background:'rgba(255,255,255,0.07)',border:'none',color:'rgba(255,255,255,0.5)',cursor:idx===0?'default':'pointer',fontSize:14 }}>‹</button>
          <button onClick={onNext} disabled={idx===total-1} style={{ width:26,height:26,borderRadius:8,background:'rgba(255,255,255,0.07)',border:'none',color:'rgba(255,255,255,0.5)',cursor:idx===total-1?'default':'pointer',fontSize:14 }}>›</button>
        </div>
      </div>
      <div onClick={()=>setFlipped(f=>!f)} style={{ background:flipped?'rgba(255,255,255,0.07)':'#111',border:`1px solid ${flipped?'rgba(255,255,255,0.15)':'rgba(255,255,255,0.08)'}`,borderRadius:18,padding:'22px 20px',textAlign:'center',cursor:'pointer',minHeight:110,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10 }}>
        <p style={{ fontSize:10,color:'rgba(255,255,255,0.3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',fontFamily:'Inter,sans-serif' }}>{flipped?'Answer':'Question'}</p>
        <p style={{ fontSize:15,fontWeight:600,color:'#fff',lineHeight:1.5,fontFamily:'Inter,sans-serif' }}>{flipped?card.back:card.front}</p>
        <p style={{ fontSize:10,color:'rgba(255,255,255,0.2)',fontFamily:'Inter,sans-serif' }}>tap to flip</p>
      </div>
    </div>
  )
}

function QuestionCard({ q, num }) {
  const [selected, setSelected] = useState(null)
  const revealed = selected !== null
  return (
    <div style={{ background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:'13px 15px',marginBottom:10 }}>
      <p style={{ fontSize:14,fontWeight:600,color:'#fff',marginBottom:10,fontFamily:'Inter,sans-serif',lineHeight:1.5 }}>Q{num}. {q.q}</p>
      {q.options?.map((opt,j)=>{
        const isSelected=selected===j, isCorrect=j===q.answer
        let bg='rgba(255,255,255,0.04)', border='rgba(255,255,255,0.08)', color='rgba(255,255,255,0.75)'
        if(revealed){ if(isCorrect){bg='rgba(74,222,128,0.08)';border='rgba(74,222,128,0.3)';color='#4ade80'} else if(isSelected){bg='rgba(248,113,113,0.08)';border='rgba(248,113,113,0.3)';color='#f87171'} }
        else if(isSelected){bg='rgba(255,255,255,0.1)';border='rgba(255,255,255,0.25)';color='#fff'}
        return (
          <div key={j} onClick={()=>!revealed&&setSelected(j)} style={{ display:'flex',gap:10,padding:'8px 10px',borderRadius:10,background:bg,border:`1px solid ${border}`,marginBottom:4,cursor:revealed?'default':'pointer' }}>
            <span style={{ fontSize:11,fontWeight:700,color,width:18,fontFamily:'Inter,sans-serif',flexShrink:0 }}>{String.fromCharCode(65+j)}</span>
            <span style={{ fontSize:13,color,fontFamily:'Inter,sans-serif',lineHeight:1.45 }}>{opt}</span>
            {revealed&&isCorrect&&<span style={{ color:'#4ade80',fontWeight:700,marginLeft:'auto' }}>✓</span>}
            {revealed&&isSelected&&!isCorrect&&<span style={{ color:'#f87171',fontWeight:700,marginLeft:'auto' }}>✗</span>}
          </div>
        )
      })}
      {revealed&&q.explanation&&<p style={{ fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:8,fontFamily:'Inter,sans-serif',lineHeight:1.55,padding:'8px 10px',background:'rgba(255,255,255,0.03)',borderRadius:8 }}>💡 {q.explanation}</p>}
    </div>
  )
}

export default function NoteEditor() {
  const { isDark, t } = useTheme()
  const { id } = useParams()
  const navigate = useNavigate()
  const { notes, addNote, updateNote } = useAppStore()
  const existing = id ? notes.find(n => n.id === Number(id)) : null

  // ── REFS ──
  const editorRef      = useRef(null)
  const editorScrollRef= useRef(null)   // the scrollable wrapper around contenteditable
  const fileInputRef   = useRef(null)
  const autoSaveRef    = useRef(null)
  const noteIdRef      = useRef(existing?.id || null)
  const titleRef       = useRef(existing?.title || '')
  const categoryRef    = useRef(existing?.tags?.[0] || '')
  const checklistsRef  = useRef(existing?.checklists || [])
  const addNoteRef     = useRef(addNote)
  const updateNoteRef  = useRef(updateNote)
  const voiceUtterRef  = useRef(null)

  useEffect(() => { addNoteRef.current = addNote },    [addNote])
  useEffect(() => { updateNoteRef.current = updateNote }, [updateNote])

  // ── STATE ──
  const [title,           setTitle]          = useState(existing?.title || '')
  const [category,        setCategory]       = useState(existing?.tags?.[0] || '')
  const [checklists,      setChecklists]     = useState(existing?.checklists || [])
  const [showCatDropdown, setShowCatDropdown]= useState(false)
  const [customCatInput,  setCustomCatInput] = useState('')
  const [aiPanel,         setAiPanel]        = useState(null)
  const [aiResult,        setAiResult]       = useState(null)
  const [loading,         setLoading]        = useState(false)
  const [savedDisplay,    setSavedDisplay]   = useState('–')
  const [fontSize,        setFontSize]       = useState(15)
  const [textColor,       setTextColor]      = useState('#ffffff')
  const [showColorPicker, setShowColorPicker]= useState(false)
  const [pickerPos,       setPickerPos]      = useState({ x: null, y: null })
  const pickerDragRef = useRef({ dragging:false, startX:0, startY:0, origX:0, origY:0 })
  const [newCheckItem,    setNewCheckItem]   = useState('')
  const [showChecklist,   setShowChecklist]  = useState(false)
  const [searchQuery,     setSearchQuery]    = useState('')
  const [searchResults,   setSearchResults]  = useState(null)
  const [searchLoading,   setSearchLoading]  = useState(false)
  const [showSearch,      setShowSearch]     = useState(false)
  const [fcIdx,           setFcIdx]          = useState(0)
  const [voiceReading,    setVoiceReading]   = useState(false)
  const [voicePaused,     setVoicePaused]    = useState(false)

  // ── IMAGE STATE ──
  const [selectedImg, setSelectedImg] = useState(null)

  // Sync state → refs on every render
  titleRef.current      = title
  categoryRef.current   = category
  checklistsRef.current = checklists

  const allCategories = [...new Set(notes.filter(n=>n.tags?.[0]).map(n=>n.tags[0]))].filter(Boolean)

  // Load existing content on mount
  useEffect(() => {
    if (existing && editorRef.current) {
      const html = existing.html || existing.content?.replace(/\n/g,'<br>') || ''
      editorRef.current.innerHTML = html
      // Re-attach image listeners for existing images
      attachImageListeners()
    }
  }, []) // eslint-disable-line

  // ── ATTACH IMAGE LISTENERS ──
  // Images live inside the contenteditable wrapped in a span[data-sm-wrap].
  // We attach pointerdown to each image so tapping selects it.
  const attachImageListeners = useCallback(() => {
    const el = editorRef.current; if (!el) return
    el.querySelectorAll('img[data-sm-img]').forEach(img => {
      if (img.dataset.smBound) return
      img.dataset.smBound = '1'
      img.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation()
        setSelectedImg(img)
      })
    })
  }, [])

  // ── SAVE ──
  const saveNow = useCallback(() => {
    haptic.light()
    const t2 = titleRef.current?.trim()
    if (!t2) return
    const el = editorRef.current
    const html    = el ? (el.innerHTML  || '') : ''
    const content = el ? (el.textContent || '') : ''
    if (!noteIdRef.current && !html.trim()) return
    const noteData = {
      title: t2, content: content.trim(), html,
      tags: categoryRef.current ? [categoryRef.current] : [],
      checklists: checklistsRef.current,
    }
    if (noteIdRef.current) {
      updateNoteRef.current(noteIdRef.current, noteData)
    } else {
      const newId = Date.now()
      noteIdRef.current = newId
      addNoteRef.current({ ...noteData, id: newId, createdAt: new Date().toISOString() })
    }
    const now = new Date()
    setSavedDisplay(`Saved ${now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`)
    if (noteIdRef.current && content.trim().length > 30) {
      const noteForCache = { id: noteIdRef.current, title: t2, content: content.trim() }
      setTimeout(() => backgroundGenerateForNote(noteForCache, aiService), 500)
    }
  }, [])

  const scheduleSave = useCallback(() => {
    clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(saveNow, 2000)
  }, [saveNow])

  useEffect(() => {
    scheduleSave()
    return () => clearTimeout(autoSaveRef.current)
  }, [title, category, checklists]) // eslint-disable-line

  useEffect(() => {
    return () => { clearTimeout(autoSaveRef.current); saveNow() }
  }, [saveNow])

  // Deselect image when tapping outside the image
  useEffect(() => {
    const dismiss = (e) => {
      if (e.target.tagName !== 'IMG' || !e.target.dataset.smImg) {
        if (selectedImg) selectedImg.classList.remove('sm-selected')
        setSelectedImg(null)
      }
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [selectedImg])

  // Add selected class to image when selected
  useEffect(() => {
    if (selectedImg) selectedImg.classList.add('sm-selected')
  }, [selectedImg])

  // ── EDITOR HELPERS ──
  const exec = (cmd, val=null) => { document.execCommand(cmd, false, val); editorRef.current?.focus() }
  const applyColor = (col) => { setTextColor(col); exec('foreColor', col); setShowColorPicker(false) }

  // ── VOICE READ ──
  const startVoiceRead = () => {
    const el = editorRef.current
    if (!el) return
    let text = ''
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ALL)
    let node = walker.nextNode()
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent + ' '
      else if (node.nodeName === 'IMG') text += (node.alt ? `[Image: ${node.alt}] ` : '[Image] ')
      node = walker.nextNode()
    }
    text = text.trim()
    if (!text) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.0
    u.onend   = () => { setVoiceReading(false); setVoicePaused(false) }
    u.onerror = () => { setVoiceReading(false); setVoicePaused(false) }
    voiceUtterRef.current = u
    window.speechSynthesis.speak(u)
    setVoiceReading(true); setVoicePaused(false)
  }
  const pauseVoice  = () => { window.speechSynthesis.pause();  setVoicePaused(true) }
  const resumeVoice = () => { window.speechSynthesis.resume(); setVoicePaused(false) }
  const stopVoice   = () => { window.speechSynthesis.cancel(); setVoiceReading(false); setVoicePaused(false) }

  // ── INSERT IMAGE — wraps in a float span, inserts into contenteditable ──
  // The span[data-sm-wrap] is the float container. The <img> inside never
  // pushes text because it's inside a floated element (taken out of flow).
  const insertImage = (e) => {
    const file = e.target.files[0]; if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = ev => {
      const el = editorRef.current; if (!el) return
      el.focus()
      // Build wrapper span + img
      const wrapper = document.createElement('span')
      wrapper.dataset.smWrap = 'left'
      wrapper.contentEditable = 'false'
      wrapper.style.cssText = 'float:left; margin-right:14px; margin-bottom:8px; margin-top:4px; display:block; line-height:0; font-size:0;'
      const img = document.createElement('img')
      img.src = ev.target.result
      img.dataset.smImg = '1'
      img.style.cssText = 'width:220px; height:auto; border-radius:10px; display:block; cursor:pointer; max-width:100%;'
      wrapper.appendChild(img)
      // Insert at cursor, or append if no selection
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0)
        range.collapse(true)
        range.insertNode(wrapper)
        // Move cursor after the wrapper
        range.setStartAfter(wrapper)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      } else {
        el.appendChild(wrapper)
      }
      // Attach listener and select
      setTimeout(() => {
        img.dataset.smBound = '1'
        img.addEventListener('pointerdown', (ev2) => {
          ev2.preventDefault(); ev2.stopPropagation()
          setSelectedImg(img)
        })
        setSelectedImg(img)
        scheduleSave()
      }, 50)
    }
    reader.readAsDataURL(file)
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true); setSearchResults(null)
    try { setSearchResults(await searchWithAI(searchQuery)) }
    catch { setSearchResults('Check your Groq API key') }
    setSearchLoading(false)
  }

  const runAI = async (mode) => {
    const content = editorRef.current?.textContent || ''
    if (content.trim().length < 20) { setAiResult({ error: 'Write at least a few lines first' }); setAiPanel(mode); return }
    setLoading(true); setAiPanel(mode); setAiResult(null); setFcIdx(0)
    try {
      let result
      const nid = noteIdRef.current
      const { getCachedOverview, getCachedFlashcards, getCachedQuestions } = await import('../../services/aiCache.service')
      if (mode === 'questions') {
        const cached = nid ? getCachedQuestions(nid) : null
        result = cached || await generateQuestionsFromText(content)
        if (Array.isArray(result)) result = [...result].sort(() => Math.random() - 0.5)
      } else if (mode === 'flashcards') {
        const cached = nid ? getCachedFlashcards(nid) : null
        result = cached || await generateFlashcards(content)
      } else if (mode === 'voice') {
        const cached = nid ? getCachedOverview(nid) : null
        result = cached || await generateVoiceOverview(content)
      }
      setAiResult(result)
    } catch(e) { setAiResult({ error: e.message || 'AI unavailable — check API key' }) }
    setLoading(false)
  }

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return
    setChecklists(p => [...p, { id:Date.now(), text:newCheckItem, done:false }])
    setNewCheckItem('')
  }

  // Toolbar button
  const TB = ({ ch, onPress, active=false, tip='', sty={}, svg=null }) => (
    <button title={tip} onMouseDown={e=>{ e.preventDefault(); onPress() }} style={{
      width:32, height:32, borderRadius:9, flexShrink:0,
      background: active ? (isDark?'rgba(255,255,255,0.14)':'rgba(0,0,0,0.1)') : (isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.04)'),
      border:`1px solid ${active?(isDark?'rgba(255,255,255,0.22)':'rgba(0,0,0,0.2)'):t.border}`,
      color: active ? t.text : t.textSec, cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', ...sty
    }}>{svg || <span style={{ fontSize:13, fontFamily:'Inter,sans-serif' }}>{ch}</span>}</button>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100dvh', background:'#000', overflow:'hidden', position:'relative' }}>
      <div style={{ position:'absolute',bottom:-80,left:'50%',transform:'translateX(-50%)',width:500,height:350,background:'radial-gradient(ellipse,rgba(96,165,250,0.06) 0%,transparent 70%)',pointerEvents:'none',zIndex:0 }} />

      {/* ── TOP BAR ── */}
      <div style={{ display:'flex',alignItems:'center',gap:6,padding:'12px 12px 8px',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0,position:'relative',zIndex:3,background:'#000' }}>
        <button onClick={()=>{ saveNow(); navigate(-1) }} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:22,cursor:'pointer',padding:'0 2px',lineHeight:1,flexShrink:0 }}>‹</button>
        <input placeholder="Title..." value={title} onChange={e=>setTitle(e.target.value)}
          style={{ flex:1,background:'none',border:'none',color:'#fff',fontSize:17,fontWeight:700,fontFamily:'Inter,sans-serif',outline:'none',letterSpacing:'-0.3px',minWidth:0 }} />

        {/* Category dropdown */}
        <div style={{ position:'relative',flexShrink:0 }}>
          <button onClick={()=>setShowCatDropdown(s=>!s)} style={{ display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:20,fontFamily:'Inter,sans-serif',background:category?'rgba(255,255,255,0.1)':'rgba(255,255,255,0.05)',border:`1px solid ${category?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.08)'}`,color:category?'#fff':'rgba(255,255,255,0.4)',fontSize:11,fontWeight:600,cursor:'pointer',maxWidth:100 }}>
            <span style={{ overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{category||'Category'}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {showCatDropdown && (
            <div style={{ position:'absolute',top:36,right:0,background:'#111',border:'1px solid rgba(255,255,255,0.12)',borderRadius:14,padding:'8px',zIndex:200,minWidth:160,boxShadow:'0 8px 32px rgba(0,0,0,0.8)' }}>
              {allCategories.length > 0 && <>
                <p style={{ fontSize:9,color:'rgba(255,255,255,0.3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',padding:'2px 8px 6px',fontFamily:'Inter,sans-serif' }}>Existing</p>
                {allCategories.map(cat=>(
                  <div key={cat} onClick={()=>{setCategory(cat);setShowCatDropdown(false)}} style={{ padding:'8px 10px',borderRadius:10,cursor:'pointer',display:'flex',alignItems:'center',gap:8,background:category===cat?'rgba(255,255,255,0.08)':'transparent' }}>
                    <div style={{ width:6,height:6,borderRadius:'50%',background:'rgba(96,165,250,0.8)',flexShrink:0 }} />
                    <span style={{ fontSize:13,color:category===cat?'#fff':'rgba(255,255,255,0.7)',fontFamily:'Inter,sans-serif' }}>{cat}</span>
                  </div>
                ))}
                <div style={{ height:1,background:'rgba(255,255,255,0.06)',margin:'6px 0' }} />
              </>}
              <p style={{ fontSize:9,color:'rgba(255,255,255,0.3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',padding:'2px 8px 6px',fontFamily:'Inter,sans-serif' }}>New</p>
              <div style={{ display:'flex',gap:5,padding:'0 4px 4px' }}>
                <input placeholder="e.g. Physics" value={customCatInput} onChange={e=>setCustomCatInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&customCatInput.trim()){setCategory(customCatInput.trim());setShowCatDropdown(false);setCustomCatInput('')}}}
                  style={{ flex:1,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'6px 8px',color:'#fff',fontSize:12,fontFamily:'Inter,sans-serif',outline:'none' }} />
                <button onClick={()=>{if(customCatInput.trim()){setCategory(customCatInput.trim());setShowCatDropdown(false);setCustomCatInput('')}}} style={{ padding:'6px 10px',borderRadius:8,background:'rgba(255,255,255,0.9)',border:'none',color:'#000',fontSize:11,fontWeight:700,cursor:'pointer' }}>Add</button>
              </div>
              {category&&<div onClick={()=>{setCategory('');setShowCatDropdown(false)}} style={{ padding:'8px 10px',borderRadius:10,cursor:'pointer',marginTop:2 }}><span style={{ fontSize:12,color:'rgba(248,113,113,0.7)',fontFamily:'Inter,sans-serif' }}>✕ Remove</span></div>}
            </div>
          )}
        </div>

        {/* Search */}
        <button onClick={()=>setShowSearch(s=>!s)} style={{ width:30,height:30,borderRadius:9,cursor:'pointer',flexShrink:0,background:showSearch?'rgba(96,165,250,0.15)':'rgba(255,255,255,0.05)',border:`1px solid ${showSearch?'rgba(96,165,250,0.4)':'rgba(255,255,255,0.08)'}`,display:'flex',alignItems:'center',justifyContent:'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={showSearch?'#60a5fa':'rgba(255,255,255,0.45)'} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
        </button>

        <span style={{ fontSize:9,color:'rgba(255,255,255,0.25)',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap',flexShrink:0,minWidth:44,textAlign:'right' }}>{savedDisplay}</span>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div style={{ padding:'8px 12px',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'#000',position:'relative',zIndex:3 }}>
          <div style={{ display:'flex',gap:8 }}>
            <input placeholder="Ask AI anything..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSearch()}
              style={{ flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(96,165,250,0.2)',borderRadius:10,padding:'9px 12px',color:'#fff',fontSize:13,fontFamily:'Inter,sans-serif',outline:'none' }} />
            <button onClick={handleSearch} style={{ padding:'9px 14px',borderRadius:10,background:'rgba(96,165,250,0.8)',border:'none',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif' }}>{searchLoading?'◌':'Ask'}</button>
          </div>
          {searchResults&&!searchLoading&&<div style={{ marginTop:8,background:'rgba(96,165,250,0.06)',border:'1px solid rgba(96,165,250,0.15)',borderRadius:12,padding:'12px 14px' }}><p style={{ fontSize:13,color:'rgba(255,255,255,0.7)',lineHeight:1.6,fontFamily:'Inter,sans-serif' }}>{searchResults}</p></div>}
        </div>
      )}

      {/* ── TOOLBAR ── */}
      <div style={{ flexShrink:0,borderBottom:'1px solid rgba(255,255,255,0.06)',overflowX:'auto',background:'rgba(0,0,0,0.85)',position:'relative',zIndex:2 }}>
        <div style={{ display:'flex',alignItems:'center',gap:3,padding:'6px 10px',minWidth:'max-content' }}>
          <TB ch="B"  tip="Bold"          onPress={()=>exec('bold')}          sty={{fontWeight:900}} />
          <TB ch="I"  tip="Italic"        onPress={()=>exec('italic')}        sty={{fontStyle:'italic'}} />
          <TB ch="U"  tip="Underline"     onPress={()=>exec('underline')}     sty={{textDecoration:'underline'}} />
          <TB ch="S̶"  tip="Strikethrough" onPress={()=>exec('strikeThrough')} />
          <div style={{width:1,height:20,background:'rgba(255,255,255,0.08)',margin:'0 2px'}}/>
          <TB tip="Left"   onPress={()=>exec('justifyLeft')}   svg={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="12" x2="3" y2="12"/><line x1="17" y1="18" x2="3" y2="18"/></svg>} />
          <TB tip="Center" onPress={()=>exec('justifyCenter')} svg={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="18" y1="12" x2="6" y2="12"/><line x1="21" y1="18" x2="3" y2="18"/></svg>} />
          <div style={{width:1,height:20,background:'rgba(255,255,255,0.08)',margin:'0 2px'}}/>
          <TB tip="Bullets"  onPress={()=>exec('insertUnorderedList')} svg={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>} />
          <TB tip="Numbered" onPress={()=>exec('insertOrderedList')}   svg={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4M4 10h2" strokeWidth="1.8"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" strokeWidth="1.8"/></svg>} />
          <div style={{width:1,height:20,background:'rgba(255,255,255,0.08)',margin:'0 2px'}}/>
          <select value={fontSize} onChange={e=>{ setFontSize(Number(e.target.value)); if(editorRef.current) editorRef.current.style.fontSize=e.target.value+'px' }}
            style={{ background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,padding:'4px 6px',color:'rgba(255,255,255,0.7)',fontSize:11,fontFamily:'Inter,sans-serif',outline:'none',cursor:'pointer',appearance:'none',width:46 }}>
            {FONT_SIZES.map(s=><option key={s} value={s} style={{background:'#111'}}>{s}</option>)}
          </select>
          <button onMouseDown={e=>{ e.preventDefault(); setShowColorPicker(s=>!s) }} style={{ width:32,height:32,borderRadius:9,background:showColorPicker?'rgba(255,255,255,0.14)':'rgba(255,255,255,0.05)',border:`1px solid ${showColorPicker?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.08)'}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:1,flexShrink:0 }}>
            <span style={{fontSize:13,color:'#fff',fontWeight:800,lineHeight:1}}>A</span>
            <div style={{width:16,height:2.5,borderRadius:1.5,background:textColor}}/>
          </button>
          <TB tip="Highlight" onPress={()=>exec('backColor','rgba(255,255,100,0.35)')} svg={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" fill="rgba(255,255,100,0.3)"/></svg>} />
          <div style={{width:1,height:20,background:'rgba(255,255,255,0.08)',margin:'0 2px'}}/>
          <TB tip="Image"     onPress={()=>fileInputRef.current?.click()} svg={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>} />
          <input ref={fileInputRef} type="file" accept="image/*" onChange={insertImage} style={{display:'none'}}/>
          <TB tip="Checklist" active={showChecklist} onPress={()=>setShowChecklist(s=>!s)} svg={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>} />
        </div>
      </div>

      {/* Checklist */}
      {showChecklist && (
        <div style={{ padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.05)',background:'rgba(0,0,0,0.5)',flexShrink:0,position:'relative',zIndex:2 }}>
          {checklists.map(item=>(
            <div key={item.id} style={{ display:'flex',alignItems:'center',gap:10,marginBottom:7 }}>
              <div onClick={()=>setChecklists(p=>p.map(c=>c.id===item.id?{...c,done:!c.done}:c))} style={{ width:18,height:18,borderRadius:5,border:item.done?'none':'1.5px solid rgba(255,255,255,0.18)',background:item.done?'#fff':'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0 }}>
                {item.done&&<span style={{fontSize:10,color:'#000',fontWeight:700}}>✓</span>}
              </div>
              <span style={{ flex:1,fontSize:13,color:item.done?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.78)',textDecoration:item.done?'line-through':'none',fontFamily:'Inter,sans-serif' }}>{item.text}</span>
              <button onClick={()=>setChecklists(p=>p.filter(c=>c.id!==item.id))} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.2)',cursor:'pointer',fontSize:14 }}>✕</button>
            </div>
          ))}
          <div style={{ display:'flex',gap:7 }}>
            <input placeholder="Add item..." value={newCheckItem} onChange={e=>setNewCheckItem(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCheckItem()} style={{ flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,padding:'7px 10px',color:'#fff',fontSize:12,fontFamily:'Inter,sans-serif',outline:'none' }} />
            <button onClick={addCheckItem} style={{ padding:'7px 12px',borderRadius:8,background:'rgba(255,255,255,0.9)',border:'none',color:'#000',fontSize:13,fontWeight:700,cursor:'pointer' }}>+</button>
          </div>
        </div>
      )}

      {/* ── EDITOR ── */}
      <div ref={editorScrollRef} style={{ flex:1, overflowY:'auto', position:'relative', zIndex:1 }}>
        <div ref={editorRef} contentEditable suppressContentEditableWarning
          onInput={scheduleSave}
          data-placeholder="Start writing..."
          style={{ padding:'16px 16px 120px', color:'rgba(255,255,255,0.88)', fontSize:fontSize+'px', lineHeight:1.75, fontFamily:'Inter,sans-serif', outline:'none', minHeight:'100%' }}
        />
      </div>

      {/* Image controls overlay — rendered outside editor, tracks selected image via getBoundingClientRect */}
      {selectedImg && (
        <ImageControls
          imgEl={selectedImg}
          editorEl={editorRef.current}
          onClose={() => { if (selectedImg) selectedImg.classList.remove('sm-selected'); setSelectedImg(null) }}
          onDelete={() => { setSelectedImg(null); scheduleSave() }}
        />
      )}

      {/* ── VOICE CONTROL BAR ── */}
      {voiceReading && (
        <div style={{ borderTop:'1px solid rgba(248,113,113,0.15)',padding:'8px 14px',flexShrink:0,background:'rgba(0,0,0,0.95)',position:'relative',zIndex:4,display:'flex',alignItems:'center',gap:8 }}>
          <div style={{ flex:1,display:'flex',gap:2,height:20,alignItems:'center' }}>
            {Array.from({length:16},(_,i)=>(
              <div key={i} style={{ flex:1,background:'#60a5fa',borderRadius:2,height:`${30+Math.sin(i*0.7)*50}%`,animation:`voiceBar 0.9s ${(i*0.06).toFixed(2)}s ease-in-out infinite alternate` }} />
            ))}
          </div>
          <button onMouseDown={e=>{e.preventDefault();voicePaused?resumeVoice():pauseVoice()}}
            style={{ padding:'6px 14px',borderRadius:20,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',gap:5,flexShrink:0 }}>
            {voicePaused
              ? <><svg width="10" height="10" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>Resume</>
              : <><svg width="10" height="10" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Pause</>
            }
          </button>
          <button onMouseDown={e=>{e.preventDefault();stopVoice()}}
            style={{ padding:'6px 12px',borderRadius:20,background:'rgba(248,113,113,0.15)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',flexShrink:0 }}>■</button>
        </div>
      )}

      {/* ── AI BAR ── */}
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)',padding:'10px 12px',flexShrink:0,background:'#000',position:'relative',zIndex:3 }}>
        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
          <button onClick={voiceReading?stopVoice:startVoiceRead}
            style={{ padding:'7px 12px',borderRadius:20,cursor:'pointer',fontFamily:'Inter,sans-serif',
              background:voiceReading?'linear-gradient(135deg,rgba(248,113,113,0.8),rgba(239,68,68,0.55))':'rgba(255,255,255,0.07)',
              border:'none',color:voiceReading?'#fff':'rgba(255,255,255,0.45)',
              fontSize:11,fontWeight:600,display:'flex',alignItems:'center',gap:5,flexShrink:0,transition:'all 0.2s' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
            </svg>
            {voiceReading ? 'Stop' : 'Read'}
          </button>
          <div style={{flex:1}}/>
          {[
            {mode:'voice',      label:'Overview',   grad:'linear-gradient(135deg,rgba(244,114,182,0.8),rgba(236,72,153,0.55))'},
            {mode:'questions',  label:'Questions',  grad:'linear-gradient(135deg,rgba(167,139,250,0.8),rgba(139,92,246,0.55))'},
            {mode:'flashcards', label:'Flashcards', grad:'linear-gradient(135deg,rgba(96,165,250,0.8),rgba(59,130,246,0.55))'},
          ].map(({mode,label,grad})=>(
            <button key={mode} onClick={()=>runAI(mode)} style={{ padding:'7px 12px',borderRadius:20,cursor:'pointer',fontFamily:'Inter,sans-serif',background:aiPanel===mode?grad:'rgba(255,255,255,0.07)',border:'none',color:aiPanel===mode?'#fff':'rgba(255,255,255,0.45)',fontSize:11,fontWeight:600 }}>{label}</button>
          ))}
        </div>
      </div>

      {/* ── AI PANEL ── */}
      {aiPanel && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(16px)',zIndex:60,display:'flex',flexDirection:'column',justifyContent:'flex-end' }} onClick={e=>e.target===e.currentTarget&&setAiPanel(null)}>
          <div style={{ background:'#0a0a0a',borderTop:'1px solid rgba(255,255,255,0.08)',borderRadius:'24px 24px 0 0',maxHeight:'80vh',display:'flex',flexDirection:'column',animation:'slideUp 0.3s ease' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px 12px',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0 }}>
              <h3 style={{ fontSize:16,fontWeight:700,color:'#fff',fontFamily:'Inter,sans-serif' }}>
                {aiPanel==='questions'?'✦ Questions':aiPanel==='flashcards'?'⊞ Flashcards':'◎ Overview'}
              </h3>
              <button onClick={()=>setAiPanel(null)} style={{ background:'rgba(255,255,255,0.08)',border:'none',color:'#fff',width:28,height:28,borderRadius:8,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
            </div>
            <div style={{ overflow:'auto',padding:'14px 18px',flex:1 }}>
              {loading&&<div style={{textAlign:'center',padding:'36px 0'}}><div style={{fontSize:26,display:'inline-block',animation:'spin 1.5s linear infinite',color:'#fff'}}>◌</div><p style={{fontSize:14,color:'rgba(255,255,255,0.4)',fontFamily:'Inter,sans-serif',marginTop:10}}>Generating...</p></div>}
              {!loading&&aiResult?.error&&<div style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:12,padding:14,color:'#f87171',fontSize:13,fontFamily:'Inter,sans-serif'}}>{aiResult.error}</div>}
              {!loading&&typeof aiResult==='string'&&aiPanel==='voice'&&(
                <div>
                  <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:'16px',marginBottom:12}}>
                    <p style={{fontSize:14,lineHeight:1.7,color:'rgba(255,255,255,0.75)',fontFamily:'Inter,sans-serif'}}>{aiResult}</p>
                  </div>
                  <button onClick={()=>{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(aiResult);u.rate=1.0;window.speechSynthesis.speak(u)}} style={{width:'100%',padding:'13px',borderRadius:14,background:'linear-gradient(135deg,rgba(244,114,182,0.8),rgba(236,72,153,0.55))',border:'none',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>▶ Read Aloud</button>
                </div>
              )}
              {!loading&&Array.isArray(aiResult)&&aiPanel==='questions'&&aiResult.map((q,i)=><QuestionCard key={i} q={q} num={i+1}/>)}
              {!loading&&Array.isArray(aiResult)&&aiPanel==='flashcards'&&aiResult.length>0&&(
                <InlineFlashcard card={aiResult[fcIdx]} idx={fcIdx} total={aiResult.length} onNext={()=>setFcIdx(i=>Math.min(i+1,aiResult.length-1))} onPrev={()=>setFcIdx(i=>Math.max(i-1,0))}/>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── COLOR PICKER ── */}
      {showColorPicker && (
        <div style={{ position:'fixed', inset:0, zIndex:300, pointerEvents:'none' }}>
          <div
            onMouseDown={e=>e.stopPropagation()}
            onPointerDown={e=>{
              if (e.target.dataset.handle !== 'true') return
              e.currentTarget.setPointerCapture(e.pointerId)
              const el = e.currentTarget
              const rect = el.getBoundingClientRect()
              pickerDragRef.current = { dragging:true, startX:e.clientX, startY:e.clientY, origX:rect.left, origY:rect.top }
            }}
            onPointerMove={e=>{
              if (!pickerDragRef.current.dragging) return
              const dx = e.clientX - pickerDragRef.current.startX
              const dy = e.clientY - pickerDragRef.current.startY
              const newX = Math.max(8, Math.min(window.innerWidth-228, pickerDragRef.current.origX + dx))
              const newY = Math.max(8, Math.min(window.innerHeight-260, pickerDragRef.current.origY + dy))
              setPickerPos({ x: newX, y: newY })
            }}
            onPointerUp={()=>{ pickerDragRef.current.dragging = false }}
            style={{
              position:'fixed',
              left:  pickerPos.x !== null ? pickerPos.x : '50%',
              top:   pickerPos.y !== null ? pickerPos.y : 'auto',
              bottom:pickerPos.y !== null ? 'auto'       : 110,
              transform: pickerPos.x === null ? 'translateX(-50%)' : 'none',
              background:'#1c1c1c', border:'1px solid rgba(255,255,255,0.16)',
              borderRadius:18, zIndex:301, boxShadow:'0 8px 40px rgba(0,0,0,0.85)',
              width:224, pointerEvents:'all', userSelect:'none',
            }}>
            <div data-handle="true" style={{ padding:'10px 16px 6px',cursor:'grab',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
              <span data-handle="true" style={{ fontSize:10,color:'rgba(255,255,255,0.35)',fontFamily:'Inter,sans-serif',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',pointerEvents:'none' }}>Text Colour</span>
              <div data-handle="true" style={{ display:'flex',gap:2,pointerEvents:'none' }}>
                {[0,1,2].map(i=><div key={i} style={{ width:18,height:2,borderRadius:1,background:'rgba(255,255,255,0.2)' }} />)}
              </div>
              <button onPointerDown={e=>e.stopPropagation()} onMouseDown={e=>{e.preventDefault();setShowColorPicker(false);setPickerPos({x:null,y:null})}}
                style={{ background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:16,cursor:'pointer',lineHeight:1,padding:'0 2px' }}>×</button>
            </div>
            <div style={{ padding:'12px 14px' }}>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center'}}>
                {TEXT_COLORS.map(col=>(
                  <button key={col} onMouseDown={e=>{ e.preventDefault(); applyColor(col) }}
                    style={{ width:34,height:34,borderRadius:10,background:col,border:textColor===col?'2.5px solid #fff':'1.5px solid rgba(255,255,255,0.12)',cursor:'pointer',transition:'transform 0.12s',transform:textColor===col?'scale(1.2)':'scale(1)',flexShrink:0 }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        [contenteditable]:empty:before{content:attr(data-placeholder);color:rgba(255,255,255,0.2);pointer-events:none}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes voiceBar{0%{transform:scaleY(0.4);opacity:0.4}100%{transform:scaleY(1);opacity:1}}
      `}</style>
    </div>
  )
}
