import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../../app/useTheme'
import { useAppStore } from '../../app/store'
import { supabaseConfigured } from '../../services/supabase'
import { exportNoteToPdf } from '../../utils/exportPdf'
import { generateQuestionsFromText, generateFlashcards, generateVoiceOverview, searchWithAI } from '../../services/ai.service'
import * as aiService from '../../services/ai.service'
import { backgroundGenerateForNote, invalidateCache, getCachedFlashcards, getCachedQuestions, getCachedOverview } from '../../services/aiCache.service'

// ── Constants ─────────────────────────────────────────────────────────────────
const FONT_SIZES  = [12, 14, 15, 16, 18, 20, 24, 28]
const PEN_COLORS  = ['#60a5fa','#f87171','#4ade80','#facc15','#c084fc','#fb923c','#ffffff','#000000']
const PEN_WIDTHS  = [2, 4, 8, 16]
const TEXT_COLORS = ['#ffffff','#f87171','#fb923c','#facc15','#4ade80','#60a5fa','#c084fc','#f472b6']
const A = '#6366f1', A2 = '#8b5cf6'
const gr = (a, b) => `linear-gradient(135deg,${a},${b})`

// ── Image CSS injected once ───────────────────────────────────────────────────
const IMG_STYLE_ID = 'studymate-img-css'
if (!document.getElementById(IMG_STYLE_ID)) {
  const s = document.createElement('style')
  s.id = IMG_STYLE_ID
  s.textContent = `
    [contenteditable] img[data-sm-img] { cursor:pointer!important; border-radius:10px; max-width:100%; height:auto!important; display:block; }
    [contenteditable] img[data-sm-img].sm-selected { outline:2.5px solid #60a5fa!important; outline-offset:2px; box-shadow:0 0 0 4px rgba(96,165,250,0.15); }
    [contenteditable] span[data-sm-wrap] { display:block; line-height:0; font-size:0; }
    [contenteditable] span[data-sm-wrap="left"]  { float:left;  margin-right:14px; margin-bottom:8px; }
    [contenteditable] span[data-sm-wrap="right"] { float:right; margin-left:14px;  margin-bottom:8px; }
    [contenteditable] span[data-sm-wrap="none"]  { float:none;  display:block; margin:10px 0; }
  `
  document.head.appendChild(s)
}

// ── Shared UI components ──────────────────────────────────────────────────────
const PBtn = ({ children, onClick, style = {}, secondary = false, disabled = false }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: secondary ? 'transparent' : gr('rgba(96,165,250,0.9)', 'rgba(167,139,250,0.8)'),
    border: secondary ? '1px solid rgba(96,165,250,0.5)' : 'none',
    color: secondary ? '#60a5fa' : '#fff',
    padding: '9px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif',
    display: 'flex', alignItems: 'center', gap: 6, opacity: disabled ? 0.5 : 1,
    boxShadow: secondary ? 'none' : '0 4px 16px rgba(96,165,250,0.25)',
    transition: 'opacity 0.15s', ...style,
  }}
    onMouseEnter={e => !disabled && (e.currentTarget.style.opacity = '0.85')}
    onMouseLeave={e => !disabled && (e.currentTarget.style.opacity = '1')}
  >{children}</button>
)

// Card uses t (theme object) from parent — no dk needed independently
const Card = ({ children, onClick, t, style = {}, onMouseEnter, onMouseLeave }) => (
  <div
    onClick={onClick}
    style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 18, padding: 20, cursor: onClick ? 'pointer' : 'default', transition: 'all 0.14s', ...style }}
    onMouseEnter={onMouseEnter || (onClick ? e => { e.currentTarget.style.background = t.hover; e.currentTarget.style.borderColor = `${A}35` } : undefined)}
    onMouseLeave={onMouseLeave || (onClick ? e => { e.currentTarget.style.background = t.card; e.currentTarget.style.borderColor = t.border } : undefined)}
  >{children}</div>
)

const SLabel = ({ children, action, t }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: t.textFaint, fontFamily: 'Inter,sans-serif', margin: 0 }}>{children}</p>
    {action}
  </div>
)

// ── ImageControls (ported from mobile NoteEditor) ─────────────────────────────
function ImageControls({ imgEl, editorEl, onClose, onDelete }) {
  const [rect, setRect] = useState(null)
  const [wrap, setWrap] = useState(() => imgEl.closest('[data-sm-wrap]')?.dataset.smWrap || 'none')
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
    return () => { window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure); cancelAnimationFrame(rafRef.current) }
  }, [measure])

  const getWrapper = () => imgEl.closest('[data-sm-wrap]')

  const applyWrap = (mode) => {
    const wrapper = getWrapper(); if (!wrapper) return
    wrapper.dataset.smWrap = mode
    setWrap(mode)
    if (mode === 'left')       wrapper.style.cssText = 'float:left; margin-right:14px; margin-bottom:8px; margin-left:0; margin-top:4px; display:block; line-height:0; font-size:0;'
    else if (mode === 'right') wrapper.style.cssText = 'float:right; margin-left:14px; margin-bottom:8px; margin-right:0; margin-top:4px; display:block; line-height:0; font-size:0;'
    else                       wrapper.style.cssText = 'float:none; display:block; margin:10px 0; line-height:0; font-size:0; clear:both;'
    setTimeout(measure, 30)
  }

  const onResizeDown = (e, corner) => { e.preventDefault(); e.stopPropagation(); resizeRef.current = { corner, startX: e.clientX, startW: imgEl.offsetWidth }; window.addEventListener('pointermove', onResizeMove, { passive: false }); window.addEventListener('pointerup', onResizeUp) }
  const onResizeMove = useCallback((e) => { e.preventDefault(); const d = resizeRef.current; if (!d) return; const dx = e.clientX - d.startX; const delta = (d.corner === 'nw' || d.corner === 'sw') ? -dx : dx; const newW = Math.max(60, Math.min(d.startW + delta, window.innerWidth - 40)); imgEl.style.width = newW + 'px'; imgEl.style.height = 'auto'; cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(measure) }, [measure])
  const onResizeUp = useCallback(() => { resizeRef.current = null; window.removeEventListener('pointermove', onResizeMove); window.removeEventListener('pointerup', onResizeUp) }, [onResizeMove])

  const getNodeRect = (node) => { if (node.nodeType === Node.ELEMENT_NODE) return node.getBoundingClientRect(); try { const r = document.createRange(); r.selectNode(node); return r.getBoundingClientRect() } catch { return null } }

  const onMoveDown = (e) => { e.preventDefault(); e.stopPropagation(); const wrapper = getWrapper(); if (!wrapper) return; if ((wrapper.dataset.smWrap || 'none') === 'none') applyWrap('left'); moveRef.current = { startX: e.clientX, baseML: parseFloat(wrapper.style.marginLeft) || 0, baseMR: parseFloat(wrapper.style.marginRight) || 0, wrapMode: wrapper.dataset.smWrap || 'left', lastRef: null }; window.addEventListener('pointermove', onMoveMove, { passive: false }); window.addEventListener('pointerup', onMoveUp) }
  const onMoveMove = useCallback((e) => { e.preventDefault(); const d = moveRef.current; if (!d) return; const wrapper = getWrapper(); if (!wrapper) return; const editor = editorEl; if (!editor) return; const dx = e.clientX - d.startX; if (d.wrapMode === 'right') wrapper.style.marginRight = Math.max(0, d.baseMR - dx) + 'px'; else wrapper.style.marginLeft = Math.max(0, d.baseML + dx) + 'px'; const nodes = Array.from(editor.childNodes).filter(n => n !== wrapper); if (!nodes.length) { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(measure); return } const nodeRects = nodes.map(n => { const r = getNodeRect(n); return { node: n, top: r ? r.top : 0, bottom: r ? r.bottom : 0, mid: r ? (r.top + r.bottom) / 2 : 0 } }).filter(nr => nr.bottom > nr.top); if (!nodeRects.length) { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(measure); return } let insertBefore = null; for (const nr of nodeRects) { if (nr.mid > e.clientY) { insertBefore = nr.node; break } } const refId = insertBefore ? (insertBefore.nodeName + (insertBefore.textContent || '').slice(0, 15)) : '__end__'; if (refId !== d.lastRef) { d.lastRef = refId; if (insertBefore) editor.insertBefore(wrapper, insertBefore); else editor.appendChild(wrapper); wrapper.style.marginTop = '4px' } cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(measure) }, [measure])
  const onMoveUp = useCallback(() => { moveRef.current = null; window.removeEventListener('pointermove', onMoveMove); window.removeEventListener('pointerup', onMoveUp) }, [onMoveMove])

  if (!rect) return null
  const DOT = 16, HALF = DOT / 2
  const corners = { nw: { top: rect.top - HALF, left: rect.left - HALF, cursor: 'nw-resize' }, ne: { top: rect.top - HALF, left: rect.left + rect.width - HALF, cursor: 'ne-resize' }, sw: { top: rect.top + rect.height - HALF, left: rect.left - HALF, cursor: 'sw-resize' }, se: { top: rect.top + rect.height - HALF, left: rect.left + rect.width - HALF, cursor: 'se-resize' } }
  const wBtnS = (mode) => ({ padding: '5px 8px', borderRadius: 7, border: 'none', cursor: 'pointer', background: wrap === mode ? '#60a5fa' : 'rgba(255,255,255,0.10)', color: wrap === mode ? '#000' : 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' })

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 498, background: 'transparent' }} />
      <div onPointerDown={onMoveDown} style={{ position: 'fixed', top: rect.top - 2, left: rect.left - 2, width: rect.width + 4, height: rect.height + 4, border: '2px solid #60a5fa', borderRadius: 10, cursor: 'move', zIndex: 500, touchAction: 'none' }} />
      {Object.entries(corners).map(([corner, pos]) => (<div key={corner} onPointerDown={e => onResizeDown(e, corner)} style={{ position: 'fixed', top: pos.top, left: pos.left, width: DOT, height: DOT, borderRadius: '50%', background: '#fff', border: '2.5px solid #60a5fa', boxShadow: '0 2px 8px rgba(0,0,0,0.6)', cursor: pos.cursor, zIndex: 502, touchAction: 'none' }} />))}
      <div onPointerDown={e => e.stopPropagation()} onClick={() => { const w = getWrapper(); w ? w.remove() : imgEl.remove(); onDelete() }} style={{ position: 'fixed', top: rect.top - 12, left: rect.left + rect.width - 12, width: 24, height: 24, borderRadius: '50%', background: '#ef4444', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 503, fontSize: 12, color: '#fff', fontWeight: 800 }}>✕</div>
      <div onPointerDown={e => e.stopPropagation()} style={{ position: 'fixed', top: rect.top + rect.height + 8, left: rect.left + rect.width / 2, transform: 'translateX(-50%)', zIndex: 503, background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 4px 24px rgba(0,0,0,0.75)', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', paddingRight: 2 }}>Wrap</span>
        <button title="Block" style={wBtnS('none')} onClick={() => applyWrap('none')}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="4" x2="21" y2="4"/><rect x="3" y="8" width="18" height="8" rx="1"/><line x1="3" y1="20" x2="21" y2="20"/></svg></button>
        <button title="Wrap left" style={wBtnS('left')} onClick={() => applyWrap('left')}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="2" y="4" width="9" height="10" rx="1" fill={wrap==='left'?'rgba(0,0,0,0.3)':'rgba(255,255,255,0.1)'} stroke="currentColor"/><line x1="14" y1="6" x2="22" y2="6"/><line x1="14" y1="9" x2="22" y2="9"/><line x1="14" y1="12" x2="22" y2="12"/></svg></button>
        <button title="Wrap right" style={wBtnS('right')} onClick={() => applyWrap('right')}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="13" y="4" width="9" height="10" rx="1" fill={wrap==='right'?'rgba(0,0,0,0.3)':'rgba(255,255,255,0.1)'} stroke="currentColor"/><line x1="2" y1="6" x2="10" y2="6"/><line x1="2" y1="9" x2="10" y2="9"/><line x1="2" y1="12" x2="10" y2="12"/></svg></button>
        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', fontFamily: 'Inter,sans-serif' }}>{Math.round(rect.width)}w</span>
      </div>
    </>
  )
}

// ── Inline Flashcard (for AI panel) ──────────────────────────────────────────
function InlineFlashcard({ card, onNext, onPrev, idx, total, t }) {
  const [flipped, setFlipped] = useState(false)
  useEffect(() => setFlipped(false), [idx])
  return (
    <div style={{ padding: '4px 0 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: t.textFaint, fontFamily: 'Inter,sans-serif' }}>{idx + 1} / {total}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onPrev} disabled={idx === 0} style={{ width: 26, height: 26, borderRadius: 8, background: t.inputBg, border: 'none', color: t.textSec, cursor: idx === 0 ? 'default' : 'pointer', fontSize: 14 }}>‹</button>
          <button onClick={onNext} disabled={idx === total - 1} style={{ width: 26, height: 26, borderRadius: 8, background: t.inputBg, border: 'none', color: t.textSec, cursor: idx === total - 1 ? 'default' : 'pointer', fontSize: 14 }}>›</button>
        </div>
      </div>
      <div onClick={() => setFlipped(f => !f)} style={{ background: flipped ? t.inputBgF : t.card, border: `1px solid ${flipped ? t.borderMed : t.border}`, borderRadius: 18, padding: '22px 20px', textAlign: 'center', cursor: 'pointer', minHeight: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <p style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'Inter,sans-serif' }}>{flipped ? 'Answer' : 'Question'}</p>
        <p style={{ fontSize: 15, fontWeight: 600, color: t.text, lineHeight: 1.5, fontFamily: 'Inter,sans-serif' }}>{flipped ? card.back : card.front}</p>
        <p style={{ fontSize: 10, color: t.textFaint, fontFamily: 'Inter,sans-serif' }}>click to flip</p>
      </div>
    </div>
  )
}

// ── QuestionCard (for AI panel) ───────────────────────────────────────────────
function QuestionCard({ q, num, t }) {
  const [selected, setSelected] = useState(null)
  const revealed = selected !== null
  return (
    <div style={{ background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 14, padding: '13px 15px', marginBottom: 10 }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 10, fontFamily: 'Inter,sans-serif', lineHeight: 1.5 }}>Q{num}. {q.q}</p>
      {q.options?.map((opt, j) => {
        const isSelected = selected === j, isCorrect = j === q.answer
        let bg = t.inputBg, border = t.border, color = t.textSec
        if (revealed) { if (isCorrect) { bg = 'rgba(74,222,128,0.08)'; border = 'rgba(74,222,128,0.3)'; color = '#4ade80' } else if (isSelected) { bg = 'rgba(248,113,113,0.08)'; border = 'rgba(248,113,113,0.3)'; color = '#f87171' } }
        else if (isSelected) { bg = t.inputBgF; border = t.borderMed; color = t.text }
        return (
          <div key={j} onClick={() => !revealed && setSelected(j)} style={{ display: 'flex', gap: 10, padding: '8px 10px', borderRadius: 10, background: bg, border: `1px solid ${border}`, marginBottom: 4, cursor: revealed ? 'default' : 'pointer' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color, width: 18, fontFamily: 'Inter,sans-serif', flexShrink: 0 }}>{String.fromCharCode(65 + j)}</span>
            <span style={{ fontSize: 13, color, fontFamily: 'Inter,sans-serif', lineHeight: 1.45 }}>{opt}</span>
            {revealed && isCorrect && <span style={{ color: '#4ade80', fontWeight: 700, marginLeft: 'auto' }}>✓</span>}
            {revealed && isSelected && !isCorrect && <span style={{ color: '#f87171', fontWeight: 700, marginLeft: 'auto' }}>✗</span>}
          </div>
        )
      })}
      {revealed && q.explanation && <p style={{ fontSize: 12, color: t.textMuted, marginTop: 8, fontFamily: 'Inter,sans-serif', lineHeight: 1.55, padding: '8px 10px', background: t.inputBg, borderRadius: 8 }}>💡 {q.explanation}</p>}
    </div>
  )
}

// ── Desktop Home ──────────────────────────────────────────────────────────────
function DesktopHome({ t, isDark }) {
  const nav = useNavigate()
  const { streak, todayStudied, notes, tasks, timerSessions, goals, toggleTask, syncing, lastSyncedAt } = useAppStore()
  const saved = (() => { try { return JSON.parse(localStorage.getItem('studymate_user') || '{}') } catch { return {} } })()
  const name = saved.name || 'Student'
  const h = new Date().getHours()
  const greet = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Late night'
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayTasks = (tasks || []).filter(tk => new Date(tk.date || Date.now()).toISOString().slice(0, 10) === todayStr)
  const done = todayTasks.filter(tk => tk.done).length
  const goalPct = Math.min(((todayStudied || 0) / (goals?.dailyMins || 60)) * 100, 100)
  const totalMins = (timerSessions || []).reduce((s, x) => s + (x.duration || 0), 0)
  const streakPct = Math.min((streak || 0) / 30, 1)
  const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e']

  const QUICK = [
    { label: 'Focus Timer', sub: 'Pomodoro',    path: '/focus/timer',      color: t.teal,   emoji: '⏱' },
    { label: 'Practice',    sub: 'Test self',   path: '/practice',         color: t.purple, emoji: '✎' },
    { label: 'Flashcards',  sub: 'AI cards',    path: '/learn/flashcards', color: t.amber,  emoji: '🃏' },
    { label: 'Mind Map',    sub: 'Visual',      path: '/learn/mindmap',    color: t.green,  emoji: '🗺' },
    { label: 'Voice Read',  sub: 'Listen',      path: '/learn/voice',      color: t.red,    emoji: '🎧' },
    { label: 'Progress',    sub: 'Analytics',   path: '/progress',         color: t.blue,   emoji: '📊' },
  ]

  return (
    <div style={{ padding: '36px 44px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <p style={{ fontSize: 13, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: '0 0 5px' }}>{greet} 👋</p>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: t.text, letterSpacing: '-2px', fontFamily: 'Inter,sans-serif', margin: 0, lineHeight: 1 }}>{name}</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {supabaseConfigured && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: t.card, border: `1px solid ${t.border}` }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: syncing ? t.amber : t.green, animation: syncing ? 'smPulse 1s infinite' : 'none' }} />
              <span style={{ fontSize: 11, color: t.textMuted, fontFamily: 'Inter,sans-serif' }}>{syncing ? 'Syncing...' : lastSyncedAt ? 'Synced' : 'Cloud sync on'}</span>
            </div>
          )}
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 24, padding: '9px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 72, height: 4, borderRadius: 2, background: t.border, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${goalPct}%`, background: goalPct >= 100 ? gr(t.green, t.teal) : gr(A, A2), borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: goalPct >= 100 ? t.green : t.textMuted, fontFamily: 'Inter,sans-serif' }}>{Math.round(goalPct)}% goal</span>
          </div>
          <PBtn onClick={() => nav('/learn/notes/new')}>+ New Note</PBtn>
        </div>
      </div>

      {/* Top 3-col */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr 1fr', gap: 18, marginBottom: 26 }}>
        {/* Streak — always dark internal palette */}
        <div onClick={() => nav('/progress')} style={{ background: 'linear-gradient(135deg,#130e00,#100f0f)', border: '1px solid rgba(255,130,0,0.2)', borderRadius: 22, padding: '26px 28px', cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'transform 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse ${streakPct * 160 + 30}% 100% at ${streakPct * 60}% 50%, rgba(255,100,0,${0.1 + streakPct * 0.14}) 0%, transparent 70%)`, pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontSize: 10, color: 'rgba(255,140,0,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', fontFamily: 'Inter,sans-serif', margin: '0 0 12px' }}>🔥 Study Streak</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 60, fontWeight: 900, color: '#fff', letterSpacing: '-3px', fontFamily: 'Inter,sans-serif', lineHeight: 1 }}>{streak || 0}</span>
              <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter,sans-serif' }}>days</span>
            </div>
            <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
              {Array.from({ length: 30 }, (_, i) => (<div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < (streak || 0) ? `rgba(255,${120 + Math.round((i / 30) * 80)},0,0.8)` : 'rgba(255,255,255,0.07)' }} />))}
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', fontFamily: 'Inter,sans-serif', margin: 0 }}>{todayStudied || 0}m today · {Math.round(streakPct * 100)}% to 30-day goal</p>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Total Focus', value: `${Math.round(totalMins / 60 * 10) / 10}h`, color: t.purple },
            { label: 'Sessions',    value: timerSessions?.length || 0,                  color: t.blue },
            { label: 'Notes',       value: notes?.length || 0,                           color: t.green },
          ].map(({ label, value, color }) => (
            <Card key={label} onClick={() => nav('/progress')} t={t} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
              <div style={{ width: 4, height: 34, borderRadius: 2, background: color, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 26, fontWeight: 900, color: t.text, fontFamily: 'Inter,sans-serif', lineHeight: 1, margin: 0, letterSpacing: '-1px' }}>{value}</p>
                <p style={{ fontSize: 11, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: '2px 0 0' }}>{label}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Tasks */}
        <Card t={t} style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'default', maxHeight: 290 }}>
          <div style={{ padding: '14px 18px 10px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text, fontFamily: 'Inter,sans-serif' }}>Today's Tasks</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {todayTasks.length > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: t.green, fontFamily: 'Inter,sans-serif' }}>{done}/{todayTasks.length}</span>}
              <button onClick={() => nav('/focus/planner')} style={{ fontSize: 11, color: A, background: `${A}18`, border: 'none', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>+ Add</button>
            </div>
          </div>
          {todayTasks.length > 0 && <div style={{ height: 3, background: t.border, overflow: 'hidden', flexShrink: 0 }}><div style={{ height: '100%', width: `${(done / todayTasks.length) * 100}%`, background: gr(t.green, t.teal) }} /></div>}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {todayTasks.length === 0 ? (
              <div onClick={() => nav('/focus/planner')} style={{ padding: '24px 18px', textAlign: 'center', cursor: 'pointer' }}>
                <p style={{ fontSize: 26, margin: '0 0 6px' }}>📋</p>
                <p style={{ fontSize: 13, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: 0 }}>No tasks — click to plan</p>
              </div>
            ) : todayTasks.slice(0, 8).map(task => (
              <div key={task.id} onClick={() => toggleTask(task.id)} style={{ padding: '9px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = t.hover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, background: task.done ? t.green : 'transparent', border: task.done ? 'none' : `2px solid ${t.borderMed}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {task.done && <svg width="8" height="7" viewBox="0 0 8 7"><polyline points="1 3.5 3 5.5 7 1" stroke={isDark ? '#000' : '#fff'} strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>}
                </div>
                <span style={{ flex: 1, fontSize: 13, color: task.done ? t.textFaint : t.text, textDecoration: task.done ? 'line-through' : 'none', fontFamily: 'Inter,sans-serif' }}>{task.title}</span>
                {task.time && <span style={{ fontSize: 11, color: t.textFaint, fontFamily: 'DM Mono,monospace' }}>{task.time}</span>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick Access */}
      <SLabel t={t}>Quick Access</SLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 28 }}>
        {QUICK.map(({ label, sub, path, color, emoji }) => (
          <Card key={path} onClick={() => nav(path)} t={t} style={{ padding: '18px 14px' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}55`; e.currentTarget.style.background = isDark ? `${color}12` : `${color}09` }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.card }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>{emoji}</div>
            <p style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: 'Inter,sans-serif', margin: '0 0 2px' }}>{label}</p>
            <p style={{ fontSize: 11, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: 0 }}>{sub}</p>
          </Card>
        ))}
      </div>

      {/* Recent Notes */}
      {(notes?.length || 0) > 0 && (
        <>
          <SLabel t={t} action={<button onClick={() => nav('/learn/notes')} style={{ fontSize: 12, color: t.blue, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>View all →</button>}>Recent Notes</SLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {(notes || []).slice(0, 4).map((note, i) => (
              <Card key={note.id} onClick={() => nav(`/learn/notes/${note.id}`)} t={t} style={{ borderLeft: `3px solid ${COLORS[i % COLORS.length]}`, padding: '14px 16px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: 'Inter,sans-serif', margin: '0 0 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title || 'Untitled'}</p>
                <p style={{ fontSize: 11, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: '0 0 8px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{note.content?.slice(0, 90) || 'Empty note'}</p>
                <p style={{ fontSize: 10, color: t.textFaint, fontFamily: 'Inter,sans-serif', margin: 0 }}>{new Date(note.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Desktop Notes List ────────────────────────────────────────────────────────
function DesktopNotesList({ t, isDark }) {
  const nav = useNavigate()
  const { notes, deleteNote } = useAppStore()
  const [search, setSearch] = useState('')
  const [hovered, setHovered] = useState(null)
  const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e']
  const filtered = (notes || []).filter(n => n.title?.toLowerCase().includes(search.toLowerCase()) || n.content?.toLowerCase().includes(search.toLowerCase()))
  const groups = filtered.reduce((acc, note) => { const cat = note.tags?.[0] || note.category || 'Uncategorized'; if (!acc[cat]) acc[cat] = []; acc[cat].push(note); return acc }, {})

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 290, flexShrink: 0, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', height: '100%', background: t.sidebar || t.bg2 }}>
        <div style={{ padding: '18px 14px 12px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: t.text, fontFamily: 'Inter,sans-serif', margin: 0 }}>Notes</h2>
            <button onClick={() => nav('/learn/notes/new')} style={{ width: 28, height: 28, borderRadius: 8, background: gr('#60a5fa', '#a78bfa'), border: 'none', color: '#fff', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>+</button>
          </div>
          <input placeholder="Search notes..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 10, padding: '8px 12px', color: t.text, fontSize: 12, fontFamily: 'Inter,sans-serif', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '36px 14px', textAlign: 'center' }}>
              <p style={{ fontSize: 30, margin: '0 0 8px' }}>📝</p>
              <p style={{ fontSize: 13, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: '0 0 12px' }}>{search ? 'No results' : 'No notes yet'}</p>
              <PBtn onClick={() => nav('/learn/notes/new')} style={{ margin: '0 auto', fontSize: 12 }}>Create Note</PBtn>
            </div>
          ) : Object.entries(groups).map(([cat, catNotes], gi) => (
            <div key={cat}>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.3px', color: t.textFaint, fontFamily: 'Inter,sans-serif', padding: '10px 14px 4px', margin: 0 }}>{cat}</p>
              {catNotes.map((note, ni) => (
                <div key={note.id} onMouseEnter={() => setHovered(note.id)} onMouseLeave={() => setHovered(null)}
                  style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}`, cursor: 'pointer', background: hovered === note.id ? t.hover : 'transparent', borderLeft: `3px solid ${COLORS[(gi + ni) % COLORS.length]}`, transition: 'background 0.12s' }}>
                  <div onClick={() => nav(`/learn/notes/${note.id}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: 'Inter,sans-serif', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title || 'Untitled'}</p>
                      <p style={{ fontSize: 11, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.content?.slice(0, 55) || 'Empty'}</p>
                      <p style={{ fontSize: 10, color: t.textFaint, fontFamily: 'Inter,sans-serif', margin: 0 }}>{new Date(note.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                    </div>
                    {hovered === note.id && <button onClick={e => { e.stopPropagation(); deleteNote(note.id) }} style={{ background: 'none', border: 'none', color: t.red, cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ padding: '8px 14px', borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: t.textFaint, fontFamily: 'Inter,sans-serif', margin: 0 }}>{notes?.length || 0} notes</p>
        </div>
      </div>
      {/* Empty state */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, background: t.panel || t.bg }}>
        <div style={{ width: 76, height: 76, borderRadius: 22, background: gr(`${A}20`, `${A2}20`), border: `1px solid ${A}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>📝</div>
        <p style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: 'Inter,sans-serif', margin: 0 }}>Select a note to edit</p>
        <p style={{ fontSize: 13, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: 0 }}>Or create a new one</p>
        <PBtn onClick={() => nav('/learn/notes/new')}>+ New Note</PBtn>
      </div>
    </div>
  )
}

// ── Desktop Note Editor — FULL FEATURE PARITY with mobile ────────────────────
function DesktopNoteEditor({ t, isDark, noteId }) {
  const nav = useNavigate()
  const { notes, addNote, updateNote, deleteNote } = useAppStore()
  const isNew    = noteId === 'new' || !noteId
  const existing = notes.find(n => String(n.id) === String(noteId))

  // Refs
  const editorRef     = useRef(null)
  const editorScrollRef = useRef(null)
  const fileInputRef  = useRef(null)
  const autoSaveRef   = useRef(null)
  const noteIdRef     = useRef(isNew ? null : String(noteId))
  const titleRef      = useRef(existing?.title || '')
  const categoryRef   = useRef(existing?.tags?.[0] || '')
  const checklistsRef = useRef(existing?.checklists || [])
  const addNoteRef    = useRef(addNote)
  const updateNoteRef = useRef(updateNote)
  const voiceUtterRef = useRef(null)
  // Pen refs
  const canvasRef     = useRef(null)
  const ctxRef        = useRef(null)
  const penDrawing    = useRef(false)
  const penLast       = useRef(null)
  const penDirty      = useRef(false)

  useEffect(() => { addNoteRef.current = addNote }, [addNote])
  useEffect(() => { updateNoteRef.current = updateNote }, [updateNote])

  // State
  const [title, setTitle]                   = useState(existing?.title || '')
  const [category, setCategory]             = useState(existing?.tags?.[0] || '')
  const [checklists, setChecklists]         = useState(existing?.checklists || [])
  const [savedDisplay, setSavedDisplay]     = useState('–')
  const [fontSize, setFontSize]             = useState(15)
  const [textColor, setTextColor]           = useState(isDark ? '#ffffff' : '#0a0a0a')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [pickerPos, setPickerPos]           = useState({ x: null, y: null })
  const pickerDragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 })
  const [showChecklist, setShowChecklist]   = useState(false)
  const [newCheckItem, setNewCheckItem]     = useState('')
  const [showSearch, setShowSearch]         = useState(false)
  const [searchQuery, setSearchQuery]       = useState('')
  const [searchResults, setSearchResults]   = useState(null)
  const [searchLoading, setSearchLoading]   = useState(false)
  const [showCatDropdown, setShowCatDropdown] = useState(false)
  const [customCatInput, setCustomCatInput] = useState('')
  const [aiPanel, setAiPanel]               = useState(null)
  const [aiResult, setAiResult]             = useState(null)
  const [aiLoading, setAiLoading]           = useState(false)
  const [fcIdx, setFcIdx]                   = useState(0)
  const [voiceReading, setVoiceReading]     = useState(false)
  const [voicePaused, setVoicePaused]       = useState(false)
  const [selectedImg,  setSelectedImg]       = useState(null)
  const [selectionState, setSelectionState]   = useState({
    bold: false, italic: false, underline: false, strike: false, highlight: false,
    listUnordered: false, listOrdered: false, alignLeft: true, alignCenter: false, alignRight: false
  })
  // Pen state
  const [penMode,  setPenMode]  = useState(false)
  const [penColor, setPenColor] = useState('#60a5fa')
  const [penWidth, setPenWidth] = useState(3)
  const [penTool,  setPenTool]  = useState('pen')

  // Keep refs in sync
  titleRef.current      = title
  categoryRef.current   = category
  checklistsRef.current = checklists

  const allCategories = [...new Set((notes || []).filter(n => n.tags?.[0]).map(n => n.tags[0]))].filter(Boolean)
  const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e']
  const otherNotes = (notes || []).filter(n => String(n.id) !== String(noteIdRef.current)).slice(0, 12)

  // Sync selection state for toolbar
  useEffect(() => {
    const handler = () => {
      const isBold = document.queryCommandState('bold')
      const isItalic = document.queryCommandState('italic')
      const isUnder = document.queryCommandState('underline')
      const isStrike = document.queryCommandState('strikeThrough')
      const isUL = document.queryCommandState('insertUnorderedList')
      const isOL = document.queryCommandState('insertOrderedList')
      const isLeft = document.queryCommandState('justifyLeft')
      const isCenter = document.queryCommandState('justifyCenter')
      const isRight = document.queryCommandState('justifyRight')
      const bg = document.queryCommandValue('backColor')
      const isHigh = bg && !['rgba(0, 0, 0, 0)', 'transparent', 'initial', 'rgb(0, 0, 0)', '#000000', 'rgb(255, 255, 255)', '#ffffff'].includes(bg.toLowerCase().trim())
      setSelectionState({
        bold:isBold, italic:isItalic, underline:isUnder, strike:isStrike, highlight:!!isHigh,
        listUnordered:isUL, listOrdered:isOL, alignLeft:isLeft, alignCenter:isCenter, alignRight:isRight
      })
    }
    document.addEventListener('selectionchange', handler)
    document.addEventListener('mouseup', handler); document.addEventListener('keyup', handler); document.addEventListener('click', handler)
    return () => {
      document.removeEventListener('selectionchange', handler)
      document.removeEventListener('mouseup', handler); document.removeEventListener('keyup', handler); document.removeEventListener('click', handler)
    }
  }, [])

  // Load existing content
  useEffect(() => {
    if (existing && editorRef.current) {
      editorRef.current.innerHTML = existing.html || existing.content?.replace(/\n/g, '<br>') || ''
      attachImageListeners()
    }
  }, []) // eslint-disable-line

  const attachImageListeners = useCallback(() => {
    const el = editorRef.current; if (!el) return
    el.querySelectorAll('img[data-sm-img]').forEach(img => {
      if (img.dataset.smBound) return
      img.dataset.smBound = '1'
      img.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); setSelectedImg(img) })
    })
  }, [])


  // ── Pen canvas — init/resize when penMode turns on ────────────────────────
  useEffect(() => {
    if (!penMode) return
    const scrollEl = editorScrollRef.current
    const editorEl = editorRef.current
    const canvas   = canvasRef.current
    if (!scrollEl || !editorEl || !canvas) return
    const dpr = window.devicePixelRatio || 1
    const syncSize = () => {
      const w = editorEl.scrollWidth, h = editorEl.scrollHeight
      const alreadyScaled = canvas.dataset.smScaled === '1'
      if (canvas.width === w * dpr && canvas.height === h * dpr && alreadyScaled) return
      const prev = canvas.toDataURL()
      canvas.width = w * dpr; canvas.height = h * dpr
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px'
      canvas.dataset.smScaled = '1'
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctxRef.current = ctx
      if (penDirty.current) {
        const img = new Image()
        img.onload = () => {
          const currentOp = ctx.globalCompositeOperation
          ctx.globalCompositeOperation = 'source-over'
          ctx.drawImage(img, 0, 0, w, h)
          ctx.globalCompositeOperation = currentOp
        }
        img.src = prev
      }
    }
    syncSize()
    const ro = new ResizeObserver(syncSize)
    ro.observe(editorEl)
    return () => ro.disconnect()
  }, [penMode, penColor, penWidth, penTool])

  const applyPenStyle = useCallback((ctx) => {
    if (!ctx) return
    if (penTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.lineWidth = Math.min(60, penWidth * 2.5 + 4)
    } else {
      ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = penColor; ctx.lineWidth = penWidth
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  }, [penColor, penWidth, penTool])

  useEffect(() => {
    if (!penMode) return
    const canvas = canvasRef.current; if (!canvas) return
    applyPenStyle(canvas.getContext('2d'))
  }, [penMode, applyPenStyle])

  useEffect(() => {
    applyPenStyle(ctxRef.current)
  }, [applyPenStyle])

  // ── Save (defined first — needed by insertDrawingDataUrl below) ──────────────
  const saveNow = useCallback(() => {
    const titleVal = titleRef.current?.trim(); if (!titleVal) return
    const el = editorRef.current
    const html    = el ? (el.innerHTML  || '') : ''
    const content = el ? (el.textContent || '') : ''
    if (!noteIdRef.current && !html.trim()) return
    const noteData = { title: titleVal, content: content.trim(), html, tags: categoryRef.current ? [categoryRef.current] : [], checklists: checklistsRef.current }
    if (noteIdRef.current) {
      updateNoteRef.current(noteIdRef.current, noteData)
    } else {
      const newId = String(Date.now())
      noteIdRef.current = newId
      addNoteRef.current({ ...noteData, id: newId, createdAt: new Date().toISOString() })
    }
    setSavedDisplay(`Saved ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`)
    if (noteIdRef.current && content.trim().length > 30) {
      const noteForCache = { id: noteIdRef.current, title: titleVal, content: content.trim() }
      setTimeout(() => backgroundGenerateForNote(noteForCache, aiService), 500)
    }
  }, [])

  const scheduleSave = useCallback(() => { clearTimeout(autoSaveRef.current); autoSaveRef.current = setTimeout(saveNow, 1800) }, [saveNow])

  // ── Pen drawing helpers ───────────────────────────────────────────────────
  // insertDrawingDataUrl defined before commitDrawing so commitDrawing's closure is never stale
  const insertDrawingDataUrl = useCallback((dataUrl) => {
    const el = editorRef.current; if (!el) return; el.focus()
    const wrapper = document.createElement('span'); wrapper.dataset.smWrap = 'none'; wrapper.contentEditable = 'false'
    wrapper.style.cssText = 'float:none;display:block;margin:10px 0;line-height:0;font-size:0;clear:both;'
    const img = document.createElement('img'); img.src = dataUrl; img.dataset.smImg = '1'
    img.style.cssText = 'max-width:100%;height:auto;border-radius:10px;display:block;cursor:pointer;'
    wrapper.appendChild(img); el.appendChild(wrapper)
    img.dataset.smBound = '1'
    img.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); setSelectedImg(img) })
    scheduleSave()
  }, [scheduleSave])

  const commitDrawing = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !penDirty.current) { setPenMode(false); return }
    const ctx = ctxRef.current, dpr = window.devicePixelRatio || 1
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (pixels[(y * canvas.width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y
      }
    }
    if (maxX <= minX || maxY <= minY) { setPenMode(false); penDirty.current = false; return }
    const pad = 8 * dpr
    minX = Math.max(0, minX-pad); minY = Math.max(0, minY-pad); maxX = Math.min(canvas.width, maxX+pad); maxY = Math.min(canvas.height, maxY+pad)
    const off = document.createElement('canvas'); off.width = maxX-minX; off.height = maxY-minY
    const offCtx = off.getContext('2d'); offCtx.drawImage(canvas, minX, minY, off.width, off.height, 0, 0, off.width, off.height)
    insertDrawingDataUrl(off.toDataURL('image/png'))
    ctx.clearRect(0, 0, canvas.width, canvas.height); penDirty.current = false; setPenMode(false)
  }, [insertDrawingDataUrl])

  const discardDrawing = useCallback(() => {
    const canvas = canvasRef.current; const ctx = ctxRef.current
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    penDirty.current = false; setPenMode(false)
  }, [])

  const penPos = (e) => {
    const canvas = canvasRef.current; if (!canvas) return { x:0, y:0 }
    const r = canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const penStart = useCallback((e) => {
    if (!penMode) return; e.preventDefault()
    penDrawing.current = true; penDirty.current = true
    const pos = penPos(e); penLast.current = pos
    const ctx = ctxRef.current; if (!ctx) return

    // Ensure style is applied for this session
    applyPenStyle(ctx)

    ctx.beginPath()
    const radius = (penTool === 'eraser' ? (Math.min(60, penWidth * 2.5 + 4) / 2) : penWidth / 2)
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
    ctx.fill()
  }, [penMode, penColor, penWidth, penTool, applyPenStyle])
  
  const penMove = useCallback((e) => {
    if (!penMode || !penDrawing.current) return; e.preventDefault()
    const ctx = ctxRef.current; if (!ctx) return
    const pos = penPos(e)
    
    // Ensure style is applied for this move
    applyPenStyle(ctx)
    
    ctx.beginPath(); ctx.moveTo(penLast.current.x, penLast.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke()
    penLast.current = pos
  }, [penMode, applyPenStyle])
  const penEnd = useCallback(() => { penDrawing.current = false }, [])

  useEffect(() => { scheduleSave(); return () => clearTimeout(autoSaveRef.current) }, [title, category, checklists]) // eslint-disable-line
  useEffect(() => () => { clearTimeout(autoSaveRef.current); saveNow() }, [saveNow])

  // Deselect image
  useEffect(() => {
    const dismiss = e => { if (e.target.tagName !== 'IMG' || !e.target.dataset.smImg) { if (selectedImg) selectedImg.classList.remove('sm-selected'); setSelectedImg(null) } }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [selectedImg])
  useEffect(() => { if (selectedImg) selectedImg.classList.add('sm-selected') }, [selectedImg])

  const exec = (cmd, val = null) => {
    if (cmd === 'backColor' && selectionState.highlight) {
      document.execCommand('backColor', false, 'transparent')
      document.execCommand('hiliteColor', false, 'transparent')
    } else {
      document.execCommand(cmd, false, val)
    }
    editorRef.current?.focus()
  }
  const applyColor = col => { setTextColor(col); exec('foreColor', col); setShowColorPicker(false) }

  // Voice
  const startVoiceRead = () => {
    const el = editorRef.current; if (!el) return
    let text = ''
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ALL)
    let node = walker.nextNode()
    while (node) { if (node.nodeType === Node.TEXT_NODE) text += node.textContent + ' '; else if (node.nodeName === 'IMG') text += '[Image] '; node = walker.nextNode() }
    text = text.trim(); if (!text) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.0
    u.onend   = () => { setVoiceReading(false); setVoicePaused(false) }
    u.onerror = () => { setVoiceReading(false); setVoicePaused(false) }
    voiceUtterRef.current = u
    window.speechSynthesis.speak(u)
    setVoiceReading(true); setVoicePaused(false)
  }
  const stopVoice   = () => { window.speechSynthesis.cancel(); setVoiceReading(false); setVoicePaused(false) }
  const pauseVoice  = () => { window.speechSynthesis.pause();  setVoicePaused(true) }
  const resumeVoice = () => { window.speechSynthesis.resume(); setVoicePaused(false) }

  // Insert image
  const insertImage = e => {
    const file = e.target.files[0]; if (!file) return; e.target.value = ''
    const reader = new FileReader()
    reader.onload = ev => {
      const el = editorRef.current; if (!el) return; el.focus()
      const wrapper = document.createElement('span'); wrapper.dataset.smWrap = 'left'; wrapper.contentEditable = 'false'; wrapper.style.cssText = 'float:left; margin-right:14px; margin-bottom:8px; margin-top:4px; display:block; line-height:0; font-size:0;'
      const img = document.createElement('img'); img.src = ev.target.result; img.dataset.smImg = '1'; img.style.cssText = 'width:260px; height:auto; border-radius:10px; display:block; cursor:pointer; max-width:100%;'; wrapper.appendChild(img)
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) { const range = sel.getRangeAt(0); range.collapse(true); range.insertNode(wrapper); range.setStartAfter(wrapper); range.collapse(true); sel.removeAllRanges(); sel.addRange(range) } else { el.appendChild(wrapper) }
      setTimeout(() => { img.dataset.smBound = '1'; img.addEventListener('pointerdown', ev2 => { ev2.preventDefault(); ev2.stopPropagation(); setSelectedImg(img) }); setSelectedImg(img); scheduleSave() }, 50)
    }
    reader.readAsDataURL(file)
  }

  // AI
  const runAI = async (mode) => {
    const content = editorRef.current?.textContent || ''
    if (content.trim().length < 20) { setAiResult({ error: 'Write at least a few lines first' }); setAiPanel(mode); return }
    setAiLoading(true); setAiPanel(mode); setAiResult(null); setFcIdx(0)
    try {
      let result
      const nid = noteIdRef.current
      if (mode === 'questions')  { const cached = nid ? getCachedQuestions(nid)   : null; result = cached || await generateQuestionsFromText(content); if (Array.isArray(result)) result = [...result].sort(() => Math.random() - 0.5) }
      if (mode === 'flashcards') { const cached = nid ? getCachedFlashcards(nid)  : null; result = cached || await generateFlashcards(content) }
      if (mode === 'voice')      { const cached = nid ? getCachedOverview(nid)    : null; result = cached || await generateVoiceOverview(content) }
      setAiResult(result)
    } catch(e) { setAiResult({ error: e.message || 'AI unavailable — check API key' }) }
    setAiLoading(false)
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true); setSearchResults(null)
    try { setSearchResults(await searchWithAI(searchQuery)) } catch { setSearchResults('Check your Groq API key') }
    setSearchLoading(false)
  }

  const handleExport = () => {
    saveNow()
    exportNoteToPdf({ id: noteIdRef.current, title, content: editorRef.current?.innerText || '', html: editorRef.current?.innerHTML || '', category, tags: category ? [category] : [] })
  }

  // Toolbar button
  const TB = ({ ch, onPress, active = false, tip = '', sty = {}, svg = null }) => (
    <button title={tip} onMouseDown={e => { e.preventDefault(); onPress() }} style={{
      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
      background: active ? (isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)') : t.inputBg,
      border: `1px solid ${active ? t.borderStrong || t.borderMed : t.border}`,
      color: active ? t.text : t.textSec, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', ...sty,
    }}>{svg || <span style={{ fontSize: 12, fontFamily: 'Inter,sans-serif' }}>{ch}</span>}</button>
  )

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left panel — note list */}
      <div style={{ width: 240, flexShrink: 0, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', background: t.sidebar || t.bg2 }}>
        <div style={{ padding: '14px 12px 10px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <button onClick={() => { saveNow(); nav('/learn/notes') }} style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: 3 }}>← Notes</button>
          <button onClick={() => nav('/learn/notes/new')} style={{ width: 24, height: 24, borderRadius: 7, background: gr('#60a5fa', '#a78bfa'), border: 'none', color: '#fff', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Current note */}
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}`, background: `${A}15`, borderLeft: `3px solid ${A}` }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: t.text, fontFamily: 'Inter,sans-serif', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title || 'Untitled'}</p>
            <p style={{ fontSize: 10, color: A, fontFamily: 'Inter,sans-serif', margin: 0 }}>Editing now</p>
          </div>
          {otherNotes.map((note, i) => (
            <div key={note.id} onClick={() => { saveNow(); nav(`/learn/notes/${note.id}`) }}
              style={{ padding: '9px 12px', borderBottom: `1px solid ${t.border}`, cursor: 'pointer', borderLeft: `3px solid ${COLORS[i % COLORS.length]}`, transition: 'background 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.background = t.hover}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <p style={{ fontSize: 12, fontWeight: 600, color: t.text, fontFamily: 'Inter,sans-serif', margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title || 'Untitled'}</p>
              <p style={{ fontSize: 10, color: t.textFaint, fontFamily: 'Inter,sans-serif', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.content?.slice(0, 38) || 'Empty'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right — full editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: t.editor || t.bg }}>

        {/* Top bar */}
        <div style={{ padding: '10px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: t.panel || t.bg }}>
          <input value={title} onChange={e => { setTitle(e.target.value); scheduleSave() }} placeholder="Note title..."
            style={{ flex: 1, background: 'none', border: 'none', fontSize: 19, fontWeight: 700, color: t.text, fontFamily: 'Inter,sans-serif', outline: 'none', letterSpacing: '-0.3px' }} />

          {/* Category dropdown */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setShowCatDropdown(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, fontFamily: 'Inter,sans-serif', background: category ? t.inputBgF || t.inputBg : t.inputBg, border: `1px solid ${category ? t.borderMed : t.border}`, color: category ? t.text : t.textMuted, fontSize: 11, fontWeight: 600, cursor: 'pointer', maxWidth: 110 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{category || 'Category'}</span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showCatDropdown && (
              <div style={{ position: 'absolute', top: 34, right: 0, background: t.card, border: `1px solid ${t.borderMed}`, borderRadius: 14, padding: '8px', zIndex: 200, minWidth: 160, boxShadow: t.shadow }}>
                {allCategories.length > 0 && <>{<p style={{ fontSize: 9, color: t.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', padding: '2px 8px 6px', fontFamily: 'Inter,sans-serif' }}>Existing</p>}
                  {allCategories.map(cat => (<div key={cat} onClick={() => { setCategory(cat); setShowCatDropdown(false) }} style={{ padding: '7px 10px', borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, background: category === cat ? t.inputBg : 'transparent' }}><div style={{ width: 5, height: 5, borderRadius: '50%', background: t.blue, flexShrink: 0 }} /><span style={{ fontSize: 13, color: category === cat ? t.text : t.textSec, fontFamily: 'Inter,sans-serif' }}>{cat}</span></div>))}
                  <div style={{ height: 1, background: t.border, margin: '5px 0' }} /></>}
                <p style={{ fontSize: 9, color: t.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', padding: '2px 8px 5px', fontFamily: 'Inter,sans-serif' }}>New</p>
                <div style={{ display: 'flex', gap: 5, padding: '0 4px 4px' }}>
                  <input placeholder="e.g. Physics" value={customCatInput} onChange={e => setCustomCatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && customCatInput.trim()) { setCategory(customCatInput.trim()); setShowCatDropdown(false); setCustomCatInput('') } }} style={{ flex: 1, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '6px 8px', color: t.text, fontSize: 12, fontFamily: 'Inter,sans-serif', outline: 'none' }} />
                  <button onClick={() => { if (customCatInput.trim()) { setCategory(customCatInput.trim()); setShowCatDropdown(false); setCustomCatInput('') } }} style={{ padding: '6px 10px', borderRadius: 8, background: t.text, border: 'none', color: t.bg, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Add</button>
                </div>
                {category && <div onClick={() => { setCategory(''); setShowCatDropdown(false) }} style={{ padding: '6px 10px', borderRadius: 9, cursor: 'pointer' }}><span style={{ fontSize: 12, color: t.red, fontFamily: 'Inter,sans-serif' }}>✕ Remove</span></div>}
              </div>
            )}
          </div>

          {/* Search button */}
          <button onClick={() => setShowSearch(s => !s)} title="AI Search" style={{ width: 30, height: 30, borderRadius: 8, cursor: 'pointer', flexShrink: 0, background: showSearch ? t.blueBg : t.inputBg, border: `1px solid ${showSearch ? t.blue + '60' : t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, position: 'relative' }}>
            {/* Distinct AI-search icon: magnifying glass with sparkle inside */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="7" stroke={showSearch ? t.blue : t.textMuted} strokeWidth="2.2"/>
              <line x1="15.5" y1="15.5" x2="21" y2="21" stroke={showSearch ? t.blue : t.textMuted} strokeWidth="2.2"/>
              <path d="M10 7v6M7 10h6" stroke={showSearch ? t.blue : t.textMuted} strokeWidth="1.8"/>
            </svg>
          </button>

          <span style={{ fontSize: 9, color: t.textFaint, fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>{savedDisplay}</span>

          <button onClick={handleExport} title="Export PDF" style={{ width: 30, height: 30, borderRadius: 8, background: t.inputBg, border: `1px solid ${t.border}`, color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>⬇</button>
          <button onClick={() => { if (window.confirm('Delete this note?')) { deleteNote(noteIdRef.current); nav('/learn/notes') } }} style={{ width: 30, height: 30, borderRadius: 8, background: t.redBg, border: `1px solid ${t.red}30`, color: t.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🗑</button>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div style={{ padding: '8px 20px', borderBottom: `1px solid ${t.border}`, background: t.panel || t.bg, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="Ask AI anything..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
                style={{ flex: 1, background: t.inputBg, border: `1px solid ${t.blue}30`, borderRadius: 10, padding: '8px 12px', color: t.text, fontSize: 13, fontFamily: 'Inter,sans-serif', outline: 'none' }} />
              <button onClick={handleSearch} style={{ padding: '8px 14px', borderRadius: 10, background: t.blue, border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>{searchLoading ? '◌' : 'Ask'}</button>
            </div>
            {searchResults && !searchLoading && <div style={{ marginTop: 8, background: t.blueBg, border: `1px solid ${t.blue}25`, borderRadius: 12, padding: '10px 14px' }}><p style={{ fontSize: 13, color: t.textSec, lineHeight: 1.6, fontFamily: 'Inter,sans-serif' }}>{searchResults}</p></div>}
          </div>
        )}

        {/* Toolbar — full feature parity with mobile */}
        <div style={{ flexShrink: 0, borderBottom: `1px solid ${t.border}`, overflowX: 'auto', background: t.sidebar || t.bg2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '6px 16px', minWidth: 'max-content' }}>
            <TB ch="B"  tip="Bold"          active={selectionState.bold} onPress={() => exec('bold')}          sty={{ fontWeight: 900 }} />
            <TB ch="I"  tip="Italic"        active={selectionState.italic} onPress={() => exec('italic')}        sty={{ fontStyle: 'italic' }} />
            <TB ch="U"  tip="Underline"     active={selectionState.underline} onPress={() => exec('underline')}     sty={{ textDecoration: 'underline' }} />
            <TB ch="S̶"  tip="Strikethrough" active={selectionState.strike} onPress={() => exec('strikeThrough')} />
            <div style={{ width: 1, height: 18, background: t.border, margin: '0 2px' }} />
            <TB tip="Align left"   active={selectionState.alignLeft} onPress={() => exec('justifyLeft')}   svg={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="12" x2="3" y2="12"/><line x1="17" y1="18" x2="3" y2="18"/></svg>} />
            <TB tip="Align center" active={selectionState.alignCenter} onPress={() => exec('justifyCenter')} svg={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="18" y1="12" x2="6" y2="12"/><line x1="21" y1="18" x2="3" y2="18"/></svg>} />
            <TB tip="Align right"  active={selectionState.alignRight} onPress={() => exec('justifyRight')}  svg={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="12" x2="9" y2="12"/><line x1="21" y1="18" x2="3" y2="18"/></svg>} />
            <div style={{ width: 1, height: 18, background: t.border, margin: '0 2px' }} />
            <TB tip="Bullets"  active={selectionState.listUnordered} onPress={() => exec('insertUnorderedList')} svg={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>} />
            <TB tip="Numbered" active={selectionState.listOrdered} onPress={() => exec('insertOrderedList')}   svg={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4M4 10h2" strokeWidth="1.8"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" strokeWidth="1.8"/></svg>} />
            <TB tip="Heading H2" onPress={() => exec('formatBlock', 'H2')} ch="H2" />
            <TB tip="Heading H3" onPress={() => exec('formatBlock', 'H3')} ch="H3" />
            <div style={{ width: 1, height: 18, background: t.border, margin: '0 2px' }} />
            {/* Font size */}
            <select value={fontSize} onChange={e => { setFontSize(Number(e.target.value)); if (editorRef.current) editorRef.current.style.fontSize = e.target.value + 'px' }}
              style={{ background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '4px 6px', color: t.textSec, fontSize: 11, fontFamily: 'Inter,sans-serif', outline: 'none', cursor: 'pointer', appearance: 'none', width: 46 }}>
              {FONT_SIZES.map(s => <option key={s} value={s} style={{ background: t.card }}>{s}</option>)}
            </select>
            {/* Text color */}
            <button onMouseDown={e => { e.preventDefault(); setShowColorPicker(s => !s) }} style={{ width: 30, height: 30, borderRadius: 8, background: showColorPicker ? (isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)') : t.inputBg, border: `1px solid ${showColorPicker ? t.borderMed : t.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: t.text, fontWeight: 800, lineHeight: 1 }}>A</span>
              <div style={{ width: 14, height: 2.5, borderRadius: 1.5, background: textColor }} />
            </button>
            {/* Highlight */}
            <TB tip="Highlight" active={selectionState.highlight} onPress={() => {
              if (selectionState.highlight) {
                exec('hiliteColor', 'transparent')
                exec('backColor', 'transparent')
              } else {
                exec('backColor', 'rgba(255,255,100,0.35)')
              }
            }} svg={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" fill={selectionState.highlight ? "rgba(255,255,100,0.6)" : "rgba(255,255,100,0.3)"}/></svg>} />
            <div style={{ width: 1, height: 18, background: t.border, margin: '0 2px' }} />
            {/* Image */}
            <TB tip="Insert Image" onPress={() => fileInputRef.current?.click()} svg={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>} />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={insertImage} style={{ display: 'none' }} />
            {/* Checklist */}
            <TB tip="Checklist" active={showChecklist} onPress={() => setShowChecklist(s => !s)} svg={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>} />
            {/* Draw */}
            <TB tip="Draw" active={penMode} onPress={() => { setPenMode(p => !p); setSelectedImg(null) }}
              svg={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                <path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>
              </svg>}
            />
            <div style={{ width: 1, height: 18, background: t.border, margin: '0 2px' }} />
            {/* Save button */}
            <button onMouseDown={e => { e.preventDefault(); saveNow() }} style={{ padding: '0 12px', height: 30, borderRadius: 8, background: gr('rgba(96,165,250,0.9)', 'rgba(167,139,250,0.8)'), border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'Inter,sans-serif', flexShrink: 0 }}>Save</button>
          </div>
        </div>

        {/* Checklist panel */}
        {showChecklist && (
          <div style={{ padding: '10px 20px', borderBottom: `1px solid ${t.border}`, background: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.03)', flexShrink: 0 }}>
            {checklists.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div onClick={() => setChecklists(p => p.map(c => c.id === item.id ? { ...c, done: !c.done } : c))}
                  style={{ width: 17, height: 17, borderRadius: 5, border: item.done ? 'none' : `1.5px solid ${t.borderMed}`, background: item.done ? t.text : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  {item.done && <span style={{ fontSize: 10, color: t.bg, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ flex: 1, fontSize: 13, color: item.done ? t.textFaint : t.textSec, textDecoration: item.done ? 'line-through' : 'none', fontFamily: 'Inter,sans-serif' }}>{item.text}</span>
                <button onClick={() => setChecklists(p => p.filter(c => c.id !== item.id))} style={{ background: 'none', border: 'none', color: t.textFaint, cursor: 'pointer', fontSize: 14 }}>✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6 }}>
              <input placeholder="Add item..." value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newCheckItem.trim()) { setChecklists(p => [...p, { id: Date.now(), text: newCheckItem, done: false }]); setNewCheckItem('') } }}
                style={{ flex: 1, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '6px 10px', color: t.text, fontSize: 12, fontFamily: 'Inter,sans-serif', outline: 'none' }} />
              <button onClick={() => { if (newCheckItem.trim()) { setChecklists(p => [...p, { id: Date.now(), text: newCheckItem, done: false }]); setNewCheckItem('') } }} style={{ padding: '6px 12px', borderRadius: 8, background: t.text, border: 'none', color: t.bg, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+</button>
            </div>
          </div>
        )}

        {/* Editor area */}
        <div ref={editorScrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <div ref={editorRef} contentEditable={!penMode} suppressContentEditableWarning
            onInput={scheduleSave}
            data-placeholder="Start writing..."
            style={{ padding: '24px 32px 120px', color: t.text, fontSize: fontSize + 'px', lineHeight: 1.8, fontFamily: 'Inter,sans-serif', outline: 'none', minHeight: '100%', userSelect: penMode ? 'none' : 'auto', WebkitUserSelect: penMode ? 'none' : 'auto' }}
          />
          {penMode && (
            <canvas ref={canvasRef}
              onPointerDown={penStart} onPointerMove={penMove}
              onPointerUp={penEnd} onPointerLeave={penEnd} onPointerCancel={penEnd}
              style={{ position: 'absolute', top: 0, left: 0, zIndex: 10, cursor: penTool === 'eraser' ? 'cell' : 'crosshair', touchAction: 'none' }}
            />
          )}
        </div>

        {/* Pen controls bar */}
        {penMode && (
          <div style={{ flexShrink: 0, background: isDark ? '#0d0d0d' : '#f5f5f5', borderTop: `1px solid ${t.border}`, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 10, zIndex: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                {[{ id: 'pen', label: '✏️' }, { id: 'eraser', label: '⬜' }].map(({ id, label }) => (
                  <button key={id} onMouseDown={e => { e.preventDefault(); setPenTool(id) }} title={id === 'pen' ? 'Pen' : 'Eraser'}
                    style={{ width: 32, height: 32, borderRadius: 9, border: 'none', cursor: 'pointer', background: penTool === id ? t.inputBgF || t.inputBg : t.inputBg, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', outline: penTool === id ? `1.5px solid ${t.borderMed}` : 'none' }}
                  >{label}</button>
                ))}
              </div>
              <div style={{ width: 1, height: 20, background: t.border, flexShrink: 0 }} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto' }}>
                {PEN_COLORS.map(c => (
                  <div key={c} onMouseDown={e => { e.preventDefault(); setPenColor(c); setPenTool('pen') }}
                    style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, background: c, border: penColor === c && penTool === 'pen' ? `2.5px solid ${t.text}` : `1.5px solid ${t.border}`, cursor: 'pointer', transform: penColor === c && penTool === 'pen' ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.1s' }}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {PEN_WIDTHS.map(w => (
                  <button key={w} onMouseDown={e => { e.preventDefault(); setPenWidth(w) }}
                    style={{ width: 32, height: 32, borderRadius: 9, border: 'none', cursor: 'pointer', background: penWidth === w ? t.inputBgF || t.inputBg : t.inputBg, outline: penWidth === w ? `1.5px solid ${t.borderMed}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <div style={{ width: Math.min(w * 2.5, 20), height: Math.min(w * 2.5, 20), borderRadius: '50%', background: penWidth === w ? t.text : t.textMuted }} />
                  </button>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              <button onMouseDown={e => { e.preventDefault(); discardDrawing() }} style={{ padding: '6px 14px', borderRadius: 9, cursor: 'pointer', background: t.redBg, border: `1px solid ${t.red}30`, color: t.red, fontSize: 12, fontWeight: 700, fontFamily: 'Inter,sans-serif' }}>Discard</button>
              <button onMouseDown={e => { e.preventDefault(); commitDrawing() }} style={{ padding: '6px 16px', borderRadius: 9, cursor: 'pointer', background: 'linear-gradient(135deg,rgba(96,165,250,0.9),rgba(59,130,246,0.7))', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'Inter,sans-serif' }}>Insert ↑</button>
            </div>
          </div>
        )}

        {/* Image controls */}
        {selectedImg && (
          <ImageControls imgEl={selectedImg} editorEl={editorRef.current}
            onClose={() => { if (selectedImg) selectedImg.classList.remove('sm-selected'); setSelectedImg(null) }}
            onDelete={() => { setSelectedImg(null); scheduleSave() }}
          />
        )}

        {/* Voice bar */}
        {voiceReading && (
          <div style={{ borderTop: `1px solid ${t.red}25`, padding: '7px 20px', flexShrink: 0, background: t.panel || t.bg, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, display: 'flex', gap: 2, height: 18, alignItems: 'center' }}>
              {Array.from({ length: 14 }, (_, i) => (<div key={i} style={{ flex: 1, background: t.blue, borderRadius: 2, height: `${30 + Math.sin(i * 0.7) * 50}%`, animation: `voiceBar 0.9s ${(i * 0.06).toFixed(2)}s ease-in-out infinite alternate` }} />))}
            </div>
            <button onMouseDown={e => { e.preventDefault(); voicePaused ? resumeVoice() : pauseVoice() }} style={{ padding: '5px 12px', borderRadius: 20, background: t.inputBg, border: `1px solid ${t.border}`, color: t.text, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
              {voicePaused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button onMouseDown={e => { e.preventDefault(); stopVoice() }} style={{ padding: '5px 10px', borderRadius: 20, background: t.redBg, border: `1px solid ${t.red}30`, color: t.red, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>■</button>
          </div>
        )}

        {/* AI bar */}
        <div style={{ borderTop: `1px solid ${t.border}`, padding: '8px 16px', flexShrink: 0, background: t.panel || t.bg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={voiceReading ? stopVoice : startVoiceRead} style={{ padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: 'Inter,sans-serif', background: voiceReading ? gr('rgba(248,113,113,0.8)', 'rgba(239,68,68,0.55)') : t.inputBg, border: 'none', color: voiceReading ? '#fff' : t.textMuted, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
              {voiceReading ? 'Stop' : 'Read'}
            </button>
            <div style={{ flex: 1 }} />
            {[
              { mode: 'voice',      label: '◎ Overview',   grad: gr('rgba(244,114,182,0.8)', 'rgba(236,72,153,0.55)') },
              { mode: 'questions',  label: '✦ Questions',  grad: gr('rgba(167,139,250,0.8)', 'rgba(139,92,246,0.55)') },
              { mode: 'flashcards', label: '⊞ Flashcards', grad: gr('rgba(96,165,250,0.8)',  'rgba(59,130,246,0.55)') },
            ].map(({ mode, label, grad }) => (
              <button key={mode} onClick={() => runAI(mode)} style={{ padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: 'Inter,sans-serif', background: aiPanel === mode ? grad : t.inputBg, border: 'none', color: aiPanel === mode ? '#fff' : t.textMuted, fontSize: 11, fontWeight: 600 }}>{label}</button>
            ))}
          </div>
        </div>

        {/* AI Panel */}
        {aiPanel && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(16px)', zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={e => e.target === e.currentTarget && setAiPanel(null)}>
            <div style={{ background: t.card, borderTop: `1px solid ${t.borderMed}`, borderRadius: '22px 22px 0 0', maxHeight: '78vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px 10px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: 'Inter,sans-serif', margin: 0 }}>
                  {aiPanel === 'questions' ? '✦ Questions' : aiPanel === 'flashcards' ? '⊞ Flashcards' : '◎ Overview'}
                </h3>
                <button onClick={() => setAiPanel(null)} style={{ background: t.inputBg, border: 'none', color: t.text, width: 27, height: 27, borderRadius: 8, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
              <div style={{ overflow: 'auto', padding: '14px 20px', flex: 1 }}>
                {aiLoading && <div style={{ textAlign: 'center', padding: '32px 0' }}><div style={{ fontSize: 24, display: 'inline-block', animation: 'spin 1.5s linear infinite', color: t.text }}>◌</div><p style={{ fontSize: 13, color: t.textMuted, fontFamily: 'Inter,sans-serif', marginTop: 10 }}>Generating...</p></div>}
                {!aiLoading && aiResult?.error && <div style={{ background: t.redBg, border: `1px solid ${t.red}30`, borderRadius: 12, padding: 14, color: t.red, fontSize: 13, fontFamily: 'Inter,sans-serif' }}>{aiResult.error}</div>}
                {!aiLoading && typeof aiResult === 'string' && aiPanel === 'voice' && (
                  <div>
                    <div style={{ background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 14, padding: 16, marginBottom: 12 }}><p style={{ fontSize: 14, lineHeight: 1.7, color: t.textSec, fontFamily: 'Inter,sans-serif' }}>{aiResult}</p></div>
                    <button onClick={() => { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(aiResult); u.rate = 1.0; window.speechSynthesis.speak(u) }} style={{ width: '100%', padding: '12px', borderRadius: 14, background: gr('rgba(244,114,182,0.8)', 'rgba(236,72,153,0.55)'), border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>▶ Read Aloud</button>
                  </div>
                )}
                {!aiLoading && Array.isArray(aiResult) && aiPanel === 'questions' && aiResult.map((q, i) => <QuestionCard key={i} q={q} num={i + 1} t={t} />)}
                {!aiLoading && Array.isArray(aiResult) && aiPanel === 'flashcards' && aiResult.length > 0 && (
                  <InlineFlashcard card={aiResult[fcIdx]} idx={fcIdx} total={aiResult.length} t={t} onNext={() => setFcIdx(i => Math.min(i + 1, aiResult.length - 1))} onPrev={() => setFcIdx(i => Math.max(i - 1, 0))} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Color Picker */}
        {showColorPicker && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, pointerEvents: 'none' }}>
            <div
              onMouseDown={e => e.stopPropagation()}
              onPointerDown={e => { if (e.target.dataset.handle !== 'true') return; e.currentTarget.setPointerCapture(e.pointerId); const el = e.currentTarget; const rect = el.getBoundingClientRect(); pickerDragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top } }}
              onPointerMove={e => { if (!pickerDragRef.current.dragging) return; const dx = e.clientX - pickerDragRef.current.startX; const dy = e.clientY - pickerDragRef.current.startY; const newX = Math.max(8, Math.min(window.innerWidth - 228, pickerDragRef.current.origX + dx)); const newY = Math.max(8, Math.min(window.innerHeight - 260, pickerDragRef.current.origY + dy)); setPickerPos({ x: newX, y: newY }) }}
              onPointerUp={() => { pickerDragRef.current.dragging = false }}
              style={{ position: 'fixed', left: pickerPos.x !== null ? pickerPos.x : '50%', top: pickerPos.y !== null ? pickerPos.y : 'auto', bottom: pickerPos.y !== null ? 'auto' : 130, transform: pickerPos.x === null ? 'translateX(-50%)' : 'none', background: t.card, border: `1px solid ${t.borderMed}`, borderRadius: 18, zIndex: 301, boxShadow: t.shadow, width: 224, pointerEvents: 'all', userSelect: 'none' }}>
              <div data-handle="true" style={{ padding: '9px 14px 6px', cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${t.border}` }}>
                <span data-handle="true" style={{ fontSize: 10, color: t.textFaint, fontFamily: 'Inter,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', pointerEvents: 'none' }}>Text Colour</span>
                <button onPointerDown={e => e.stopPropagation()} onMouseDown={e => { e.preventDefault(); setShowColorPicker(false); setPickerPos({ x: null, y: null }) }} style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: 15, cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {TEXT_COLORS.map(col => (
                    <button key={col} onMouseDown={e => { e.preventDefault(); applyColor(col) }} style={{ width: 32, height: 32, borderRadius: 9, background: col, border: textColor === col ? '2.5px solid #fff' : `1.5px solid ${t.border}`, cursor: 'pointer', transition: 'transform 0.12s', transform: textColor === col ? 'scale(1.2)' : 'scale(1)', flexShrink: 0 }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        [data-placeholder]:empty::before { content: attr(data-placeholder); color: ${t.textFaint}; pointer-events: none; }
        [contenteditable] ul { padding-left: 22px; margin: 8px 0 }
        [contenteditable] ol { padding-left: 22px; margin: 8px 0 }
        [contenteditable] h2 { font-size: 22px; font-weight: 700; margin: 20px 0 8px }
        [contenteditable] h3 { font-size: 17px; font-weight: 700; margin: 16px 0 6px }
        [contenteditable] img { max-width: 100%; border-radius: 8px; margin: 8px 0 }
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes voiceBar{ 0%{transform:scaleY(0.4);opacity:0.4} 100%{transform:scaleY(1);opacity:1} }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
      `}</style>
    </div>
  )
}

// ── Desktop Learn Hub ─────────────────────────────────────────────────────────
function DesktopLearn({ t, isDark }) {
  const nav = useNavigate()
  const { notes } = useAppStore()
  const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e']
  const TOOLS = [
    { emoji: '📝', label: 'Notes',          sub: 'Write & organise',   path: '/learn/notes',      color: t.blue },
    { emoji: '🃏', label: 'Flashcards',     sub: 'AI-generated cards', path: '/learn/flashcards', color: t.purple },
    { emoji: '🎧', label: 'Voice Overview', sub: 'Listen to notes',    path: '/learn/voice',      color: '#f472b6' },
    { emoji: '🗺️', label: 'Mind Map',       sub: 'Visualise concepts', path: '/learn/mindmap',    color: t.teal },
  ]
  return (
    <div style={{ padding: '36px 44px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: t.text, letterSpacing: '-1.2px', fontFamily: 'Inter,sans-serif', margin: '0 0 6px' }}>Learn</h1>
      <p style={{ fontSize: 14, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: '0 0 28px' }}>Study smarter with AI-powered tools</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 36 }}>
        {TOOLS.map(({ emoji, label, sub, path, color }) => (
          <Card key={path} onClick={() => nav(path)} t={t} style={{ textAlign: 'center', padding: '28px 18px' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}55`; e.currentTarget.style.background = isDark ? `${color}10` : `${color}08` }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.card }}
          >
            <div style={{ width: 52, height: 52, borderRadius: 15, background: `${color}15`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 14px' }}>{emoji}</div>
            <p style={{ fontSize: 14, fontWeight: 700, color: t.text, fontFamily: 'Inter,sans-serif', margin: '0 0 4px' }}>{label}</p>
            <p style={{ fontSize: 11, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: 0 }}>{sub}</p>
          </Card>
        ))}
      </div>
      <SLabel t={t} action={<button onClick={() => nav('/learn/notes')} style={{ fontSize: 12, color: t.blue, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>All →</button>}>Recent Notes</SLabel>
      {(notes || []).length === 0 ? (
        <Card t={t} onClick={() => nav('/learn/notes/new')} style={{ textAlign: 'center', padding: 36 }}>
          <p style={{ fontSize: 30, margin: '0 0 8px' }}>📝</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: t.blue, fontFamily: 'Inter,sans-serif', margin: 0 }}>Create your first note</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {(notes || []).slice(0, 6).map((note, i) => (
            <Card key={note.id} onClick={() => nav(`/learn/notes/${note.id}`)} t={t} style={{ borderLeft: `3px solid ${COLORS[i % 6]}`, padding: '13px 15px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: 'Inter,sans-serif', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title || 'Untitled'}</p>
              <p style={{ fontSize: 11, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.content?.slice(0, 60) || 'Empty'}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Desktop Practice ──────────────────────────────────────────────────────────
function DesktopPractice({ t, isDark }) {
  const nav = useNavigate()
  const { testResults } = useAppStore()
  const avgScore = testResults?.length ? Math.round(testResults.reduce((s, r) => s + (r.score || 0), 0) / testResults.length) : 0
  const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e']
  return (
    <div style={{ padding: '36px 44px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: t.text, letterSpacing: '-1.2px', fontFamily: 'Inter,sans-serif', margin: '0 0 5px' }}>Practice</h1>
          <p style={{ fontSize: 14, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: 0 }}>Test your knowledge with AI-generated questions</p>
        </div>
        <PBtn onClick={() => nav('/practice/mode1')}>Start Practice →</PBtn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 28 }}>
        <Card onClick={() => nav('/practice/mode1')} t={t} style={{ padding: '28px', background: isDark ? 'linear-gradient(135deg,rgba(167,139,250,0.12),rgba(139,92,246,0.06))' : 'linear-gradient(135deg,rgba(124,58,237,0.06),rgba(109,40,217,0.03))', border: `1px solid ${t.purple}30`, borderRadius: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: t.purpleBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>◈</div>
          <p style={{ fontSize: 19, fontWeight: 800, color: t.text, fontFamily: 'Inter,sans-serif', margin: '0 0 8px', letterSpacing: '-0.5px' }}>Practice from Notes</p>
          <p style={{ fontSize: 13, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: '0 0 16px', lineHeight: 1.6 }}>AI reads your notes and generates MCQs, fill-in-the-blank, and true/false questions instantly.</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['MCQs', 'Fill-in', 'True/False'].map(tag => <span key={tag} style={{ fontSize: 11, color: t.purple, background: t.purpleBg, padding: '3px 10px', borderRadius: 20, fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>{tag}</span>)}
          </div>
        </Card>
        <Card onClick={() => nav('/practice/mode2')} t={t} style={{ padding: '28px', background: isDark ? 'linear-gradient(135deg,rgba(74,222,128,0.08),rgba(34,197,94,0.04))' : 'linear-gradient(135deg,rgba(22,163,74,0.06),rgba(16,122,56,0.03))', border: `1px solid ${t.green}25`, borderRadius: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: t.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>◎</div>
          <p style={{ fontSize: 19, fontWeight: 800, color: t.text, fontFamily: 'Inter,sans-serif', margin: '0 0 8px', letterSpacing: '-0.5px' }}>Custom Topic Quiz</p>
          <p style={{ fontSize: 13, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: '0 0 16px', lineHeight: 1.6 }}>Enter any topic and difficulty — AI generates a full quiz on the spot.</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Any Topic', 'Custom Difficulty', 'Instant'].map(tag => <span key={tag} style={{ fontSize: 11, color: t.green, background: t.greenBg, padding: '3px 10px', borderRadius: 20, fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>{tag}</span>)}
          </div>
        </Card>
      </div>
      {testResults?.length > 0 && (
        <>
          <SLabel t={t}>Results Summary</SLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Tests Taken', value: testResults.length,  color: t.purple },
              { label: 'Avg Score',   value: `${avgScore}%`,       color: t.green },
              { label: 'Best Score',  value: `${Math.max(...testResults.map(r => r.score || 0))}%`, color: t.amber },
              { label: 'This Week',   value: testResults.filter(r => new Date(r.date || Date.now()) > new Date(Date.now() - 7 * 86400000)).length, color: t.blue },
            ].map(({ label, value, color }) => (
              <Card key={label} t={t} style={{ textAlign: 'center', padding: '18px' }}>
                <p style={{ fontSize: 28, fontWeight: 900, color, fontFamily: 'Inter,sans-serif', margin: '0 0 3px', letterSpacing: '-1px' }}>{value}</p>
                <p style={{ fontSize: 11, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: 0 }}>{label}</p>
              </Card>
            ))}
          </div>
          <SLabel t={t}>Recent Tests</SLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {testResults.slice(0, 6).map((r, i) => (
              <Card key={i} t={t} style={{ borderLeft: `3px solid ${COLORS[i % 6]}`, padding: '13px 16px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: 'Inter,sans-serif', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subject || 'Practice Test'}</p>
                <p style={{ fontSize: 26, fontWeight: 900, color: COLORS[i % 6], fontFamily: 'Inter,sans-serif', margin: '0 0 2px', letterSpacing: '-1px' }}>{r.score || 0}%</p>
                <p style={{ fontSize: 10, color: t.textFaint, fontFamily: 'Inter,sans-serif', margin: 0 }}>{new Date(r.date || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Desktop Focus ─────────────────────────────────────────────────────────────
function DesktopFocus({ t, isDark }) {
  const nav = useNavigate()
  const { tasks, toggleTask } = useAppStore()
  const todayStr   = new Date().toISOString().slice(0, 10)
  const todayTasks = (tasks || []).filter(tk => new Date(tk.date || Date.now()).toISOString().slice(0, 10) === todayStr)
  const done       = todayTasks.filter(tk => tk.done).length
  return (
    <div style={{ padding: '36px 44px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: t.text, letterSpacing: '-1.2px', fontFamily: 'Inter,sans-serif', margin: '0 0 6px' }}>Focus</h1>
      <p style={{ fontSize: 14, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: '0 0 28px' }}>Deep work tools to maximise your productivity</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 28 }}>
        <Card onClick={() => nav('/focus/timer')} t={t} style={{ padding: '28px', background: isDark ? 'linear-gradient(135deg,rgba(0,200,180,0.10),rgba(0,160,150,0.05))' : 'linear-gradient(135deg,rgba(0,200,180,0.07),rgba(0,160,150,0.03))', border: `1px solid ${t.teal}25`, borderRadius: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: t.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 16 }}>◷</div>
          <p style={{ fontSize: 19, fontWeight: 800, color: t.text, fontFamily: 'Inter,sans-serif', margin: '0 0 8px' }}>Focus Timer</p>
          <p style={{ fontSize: 13, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: '0 0 18px', lineHeight: 1.6 }}>Pomodoro-style timer with beautiful universe animation. Short & long breaks included.</p>
          <PBtn onClick={e => { e.stopPropagation(); nav('/focus/timer') }} style={{ background: gr('rgba(0,200,180,0.9)', 'rgba(0,160,150,0.8)'), boxShadow: '0 2px 12px rgba(0,200,180,0.3)' }}>▶ Start Session</PBtn>
        </Card>
        <Card onClick={() => nav('/focus/planner')} t={t} style={{ padding: '28px', borderRadius: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: t.inputBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 16 }}>◈</div>
          <p style={{ fontSize: 19, fontWeight: 800, color: t.text, fontFamily: 'Inter,sans-serif', margin: '0 0 8px' }}>Daily Planner</p>
          <p style={{ fontSize: 13, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: '0 0 16px', lineHeight: 1.6 }}>Schedule your study sessions and track today's tasks.</p>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.green, fontFamily: 'Inter,sans-serif' }}>{done}/{todayTasks.length} tasks done today</span>
        </Card>
      </div>
      {todayTasks.length > 0 && (
        <>
          <SLabel t={t} action={<button onClick={() => nav('/focus/planner')} style={{ fontSize: 12, color: t.blue, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Manage →</button>}>Today's Tasks</SLabel>
          <Card t={t} style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ height: 3, background: t.border, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${todayTasks.length ? (done / todayTasks.length) * 100 : 0}%`, background: gr(t.green, t.teal) }} />
            </div>
            {todayTasks.slice(0, 8).map((task, i) => (
              <div key={task.id} onClick={() => toggleTask(task.id)} style={{ padding: '11px 18px', borderBottom: i < Math.min(todayTasks.length, 8) - 1 ? `1px solid ${t.border}` : 'none', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = t.hover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, background: task.done ? t.green : 'transparent', border: task.done ? 'none' : `2px solid ${t.borderMed}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {task.done && <svg width="8" height="7" viewBox="0 0 8 7"><polyline points="1 3.5 3 5.5 7 1" stroke={isDark ? '#000' : '#fff'} strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>}
                </div>
                <span style={{ flex: 1, fontSize: 13, color: task.done ? t.textFaint : t.text, textDecoration: task.done ? 'line-through' : 'none', fontFamily: 'Inter,sans-serif' }}>{task.title}</span>
                {task.time && <span style={{ fontSize: 11, color: t.textFaint, fontFamily: 'DM Mono,monospace' }}>{task.time}</span>}
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  )
}

// ── Desktop Progress ──────────────────────────────────────────────────────────
function DesktopProgress({ t, isDark }) {
  const { streak, todayStudied, timerSessions, testResults, notes, goals } = useAppStore()
  const totalMins = (timerSessions || []).reduce((s, x) => s + (x.duration || 0), 0)
  const avgScore  = testResults?.length ? Math.round(testResults.reduce((s, r) => s + (r.score || 0), 0) / testResults.length) : 0
  const goalPct   = Math.min(((todayStudied || 0) / (goals?.dailyMins || 60)) * 100, 100)
  const COLORS    = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e']

  const minutesByDay = {}
  ;(timerSessions || []).forEach(s => { const k = new Date(s.date).toISOString?.()?.slice(0, 10) || s.date?.slice(0, 10); if (k) minutesByDay[k] = (minutesByDay[k] || 0) + (s.duration || 0) })
  const weeks = []
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (let w = 51; w >= 0; w--) { const week = []; for (let d = 0; d < 7; d++) { const date = new Date(today); date.setDate(today.getDate() - (w * 7) + (d - 6)); const k = date.toISOString().slice(0, 10); week.push({ date, mins: minutesByDay[k] || 0, future: date > today }) } weeks.push(week) }
  const heat = m => { if (m === 0) return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'; if (m < 20) return t.purple + '60'; if (m < 45) return t.purple; if (m < 90) return A; return A2 }
  const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div style={{ padding: '36px 44px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: t.text, letterSpacing: '-1.2px', fontFamily: 'Inter,sans-serif', margin: '0 0 6px' }}>Progress</h1>
      <p style={{ fontSize: 14, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: '0 0 28px' }}>Track your study habits and achievements</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Streak',      value: `${streak || 0}d`,                       color: t.amber,  emoji: '🔥' },
          { label: 'Today',       value: `${todayStudied || 0}m`,                 color: t.green,  emoji: '📅' },
          { label: 'Total Focus', value: `${Math.round(totalMins / 60 * 10) / 10}h`, color: t.purple, emoji: '⏱' },
          { label: 'Avg Score',   value: `${avgScore}%`,                          color: t.blue,   emoji: '🎯' },
          { label: 'Notes',       value: notes?.length || 0,                       color: t.teal,   emoji: '📝' },
        ].map(({ label, value, color, emoji }) => (
          <Card key={label} t={t} style={{ textAlign: 'center', padding: '18px 14px' }}>
            <div style={{ fontSize: 20, marginBottom: 7 }}>{emoji}</div>
            <p style={{ fontSize: 24, fontWeight: 900, color, fontFamily: 'Inter,sans-serif', margin: '0 0 3px', letterSpacing: '-1px' }}>{value}</p>
            <p style={{ fontSize: 11, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: 0 }}>{label}</p>
          </Card>
        ))}
      </div>

      <Card t={t} style={{ padding: '22px', marginBottom: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: 'Inter,sans-serif', margin: 0 }}>Daily Goal</p>
          <span style={{ fontSize: 13, fontWeight: 700, color: goalPct >= 100 ? t.green : t.blue, fontFamily: 'Inter,sans-serif' }}>{Math.round(goalPct)}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: t.border, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ height: '100%', width: `${goalPct}%`, background: goalPct >= 100 ? gr(t.green, t.teal) : gr(A, A2), borderRadius: 4, transition: 'width 0.6s' }} />
        </div>
        <p style={{ fontSize: 11, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: 0 }}>{todayStudied || 0}m of {goals?.dailyMins || 60}m · {goalPct >= 100 ? '🎉 Goal reached!' : 'Keep going!'}</p>
      </Card>

      <SLabel t={t}>Activity — Last 52 Weeks</SLabel>
      <Card t={t} style={{ padding: '22px', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 4, flexShrink: 0 }}>
            {DAYS.map((d, i) => <div key={i} style={{ height: 14, fontSize: 9, color: t.textFaint, fontFamily: 'Inter,sans-serif', lineHeight: '14px', width: 10 }}>{d}</div>)}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
              {week.map((day, di) => (
                <div key={di} title={`${day.date.toLocaleDateString()} — ${day.mins}m`}
                  style={{ width: 14, height: 14, borderRadius: 3, background: day.future ? 'transparent' : heat(day.mins), cursor: 'default', transition: 'transform 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.4)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                />
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <span style={{ fontSize: 10, color: t.textFaint, fontFamily: 'Inter,sans-serif' }}>Less</span>
          {[0, 15, 45, 90, 120].map(m => <div key={m} style={{ width: 12, height: 12, borderRadius: 2, background: heat(m) }} />)}
          <span style={{ fontSize: 10, color: t.textFaint, fontFamily: 'Inter,sans-serif' }}>More</span>
        </div>
      </Card>

      {/* Subject Performance */}
      {Object.keys(minutesByDay).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SLabel t={t}>Subject Performance</SLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(() => {
                const subjectScores = {}
                testResults?.forEach(r => { if (!subjectScores[r.subject]) subjectScores[r.subject] = []; subjectScores[r.subject].push(r.score) })
                return Object.entries(subjectScores)
                  .map(([s, scores]) => ({ subject: s, avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), count: scores.length }))
                  .sort((a, b) => b.avg - a.avg)
                  .slice(0, 4)
                  .map(({ subject, avg, count }) => {
                    const col = avg >= 80 ? t.green : avg >= 50 ? t.amber : t.red
                    return (
                      <Card key={subject} t={t} style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: 'Inter,sans-serif' }}>{subject}</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: col, fontFamily: 'DM Mono,monospace' }}>{avg}%</span>
                        </div>
                        <div style={{ height: 4, background: t.border, borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${avg}%`, background: col, borderRadius: 2, transition: 'width 0.6s' }} />
                        </div>
                      </Card>
                    )
                  })
              })()}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SLabel t={t}>Personal Bests</SLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Card t={t} style={{ textAlign: 'center', padding: '20px 10px' }}>
                <p style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>Best Day</p>
                <p style={{ fontSize: 24, fontWeight: 900, color: t.blue, fontFamily: 'DM Mono,monospace' }}>{Math.max(0, ...(timerSessions || []).map(s => s.duration || 0))}m</p>
              </Card>
              <Card t={t} style={{ textAlign: 'center', padding: '20px 10px' }}>
                <p style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>Highest Score</p>
                <p style={{ fontSize: 24, fontWeight: 900, color: t.green, fontFamily: 'DM Mono,monospace' }}>{Math.max(0, ...(testResults || []).map(r => r.score || 0))}%</p>
              </Card>
            </div>
            <SLabel t={t}>Recent Sessions</SLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(timerSessions || []).slice(0, 3).map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 12 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.teal }} />
                  <p style={{ flex: 1, fontSize: 12, color: t.textSec, fontFamily: 'Inter,sans-serif', margin: 0 }}>{s.duration}m focus session</p>
                  <p style={{ fontSize: 10, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: 0 }}>{new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {testResults?.length > 0 && (
        <>
          <SLabel t={t}>Recent Test Results</SLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {testResults.slice(0, 6).map((r, i) => (
              <Card key={i} t={t} style={{ borderLeft: `3px solid ${COLORS[i % 6]}`, padding: '13px 16px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: 'Inter,sans-serif', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subject || 'Practice Test'}</p>
                <p style={{ fontSize: 24, fontWeight: 900, color: COLORS[i % 6], fontFamily: 'Inter,sans-serif', margin: '0 0 2px', letterSpacing: '-1px' }}>{r.score || 0}%</p>
                <p style={{ fontSize: 10, color: t.textFaint, fontFamily: 'Inter,sans-serif', margin: 0 }}>{new Date(r.date || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Nav config ────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'home',     label: 'Home',     path: '/',            emoji: '⌂' },
  { id: 'notes',    label: 'Notes',    path: '/learn/notes', emoji: '📝' },
  { id: 'learn',    label: 'Learn',    path: '/learn',       emoji: '📖' },
  { id: 'practice', label: 'Practice', path: '/practice',    emoji: '✎' },
  { id: 'focus',    label: 'Focus',    path: '/focus',       emoji: '⏱' },
  { id: 'progress', label: 'Progress', path: '/progress',    emoji: '📊' },
]

// ── Main export ───────────────────────────────────────────────────────────────
export default function DesktopLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isDark, t } = useTheme()   // ← use the SAME t object as all mobile pages
  const store    = useAppStore()
  const path     = location.pathname

  // Extend t with desktop-only tokens that aren't in useTheme
  // These derive from existing mobile tokens so colors stay consistent
  t.hover   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
  t.sidebar = isDark ? (t.bg2 || t.bg)  : '#f7f7f7'   // sidebar bg  → mobile bg2
  t.panel   = isDark ? (t.surface || t.bg2 || t.bg) : '#fff'  // content area → mobile surface
  t.editor  = isDark ? '#000'   : '#fff'      // note editor bg → pure black/white

  const saved = (() => { try { return JSON.parse(localStorage.getItem('studymate_user') || '{}') } catch { return {} } })()
  const name  = saved.name || store.user?.name || 'Student'

  const activeId = path === '/' ? 'home'
    : path.startsWith('/learn/notes') ? 'notes'
    : path.startsWith('/learn')       ? 'learn'
    : path.startsWith('/practice')    ? 'practice'
    : path.startsWith('/focus')       ? 'focus'
    : path.startsWith('/progress')    ? 'progress'
    : 'home'

  const noteMatch = path.match(/^\/learn\/notes\/(.+)$/)
  const noteId    = noteMatch ? noteMatch[1] : null

  const getPage = () => {
    if (path === '/')                return <DesktopHome     t={t} isDark={isDark} />
    if (path === '/learn/notes')     return <DesktopNotesList t={t} isDark={isDark} />
    if (path === '/learn/notes/new') return <DesktopNoteEditor t={t} isDark={isDark} noteId="new" />
    if (noteId)                      return <DesktopNoteEditor t={t} isDark={isDark} noteId={noteId} />
    if (path === '/learn')           return <DesktopLearn    t={t} isDark={isDark} />
    if (path === '/practice')        return <DesktopPractice t={t} isDark={isDark} />
    if (path === '/focus')           return <DesktopFocus    t={t} isDark={isDark} />
    if (path === '/progress')        return <DesktopProgress t={t} isDark={isDark} />
    return null
  }
  const desktopPage = getPage()

  return (
    <>
      <style>{`
        .__mob { display: block !important }
        .__dsk { display: none !important }
        @media (min-width: 768px) {
          .__mob { display: none !important }
          .__dsk { display: flex !important }
          html, body, #root { height: 100%; overflow: hidden; margin: 0 }
          ::-webkit-scrollbar { width: 5px }
          ::-webkit-scrollbar-track { background: transparent }
          ::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.14); border-radius: 3px }
          ::-webkit-scrollbar-thumb:hover { background: rgba(128,128,128,0.26) }
        }
        @keyframes smPulse { 0%,100%{opacity:0.5;transform:scale(0.9)} 50%{opacity:1;transform:scale(1.15)} }
      `}</style>

      {/* MOBILE */}
      <div className="__mob">{children}</div>

      {/* DESKTOP */}
      <div className="__dsk" style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: 'transparent', flexDirection: 'row' }}>

        {/* SIDEBAR */}
        <aside style={{ width: 210, flexShrink: 0, height: '100%', background: t.sidebar || t.bg2, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Logo */}
          <div style={{ padding: '18px 14px 14px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: gr('#60a5fa', '#a78bfa'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 14, boxShadow: '0 4px 16px rgba(96,165,250,0.25)' }}>✦</div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: t.text, fontFamily: 'Inter,sans-serif', letterSpacing: '-0.4px', lineHeight: 1.1, margin: 0 }}>StudyMate</p>
                <p style={{ fontSize: 9, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: 0 }}>AI Study Companion</p>
              </div>
            </div>
          </div>

          {/* User */}
          <div onClick={() => navigate('/settings')} style={{ margin: '10px 8px 5px', padding: '8px 10px', borderRadius: 11, background: t.card, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = t.hover; e.currentTarget.style.borderColor = `${t.blue}40` }}
            onMouseLeave={e => { e.currentTarget.style.background = t.card;  e.currentTarget.style.borderColor = t.border }}
          >
            <div style={{ width: 26, height: 26, borderRadius: 8, background: gr('#60a5fa', '#a78bfa'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 800, flexShrink: 0 }}>{name.charAt(0).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: t.text, fontFamily: 'Inter,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{name}</p>
              <p style={{ fontSize: 9, color: t.textMuted, fontFamily: 'Inter,sans-serif', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{saved.email || 'Guest'}</p>
            </div>
            {supabaseConfigured && <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.green, flexShrink: 0 }} title="Cloud sync" />}
          </div>

          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: t.textFaint, fontFamily: 'Inter,sans-serif', padding: '9px 14px 3px', margin: 0, flexShrink: 0 }}>Navigation</p>

          {/* Nav items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV.map(({ id, label, path: np, emoji }) => {
              const active = activeId === id
              return (
                <button key={id} onClick={() => navigate(np)} style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 10, width: '100%',
                  background: active ? gr('rgba(96,165,250,0.85)', 'rgba(167,139,250,0.75)') : 'transparent',
                  border: 'none', cursor: 'pointer', color: active ? '#fff' : t.textMuted,
                  fontSize: 13, fontWeight: active ? 700 : 500, fontFamily: 'Inter,sans-serif', textAlign: 'left',
                  boxShadow: active ? '0 4px 16px rgba(96,165,250,0.22)' : 'none', transition: 'all 0.12s',
                }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = t.hover; e.currentTarget.style.color = t.text } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textMuted } }}
                >
                  <span style={{ fontSize: 14, opacity: active ? 1 : 0.65 }}>{emoji}</span>
                  {label}
                  {active && <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.6)' }} />}
                </button>
              )
            })}
          </div>

          {/* Settings */}
          <div style={{ borderTop: `1px solid ${t.border}`, padding: '8px 6px', flexShrink: 0 }}>
            <button onClick={() => navigate('/settings')} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 10, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 12, fontFamily: 'Inter,sans-serif', textAlign: 'left', transition: 'all 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = t.hover; e.currentTarget.style.color = t.text }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textMuted }}
            >
              <span style={{ fontSize: 13, opacity: 0.6 }}>⚙</span> Settings
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, height: '100%', minWidth: 0, overflow: 'hidden', background: 'transparent', display: 'flex', flexDirection: 'column' }}>
          {desktopPage
            ? desktopPage
            : <div style={{ flex: 1, height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>{children}</div>
          }
        </main>
      </div>
    </>
  )
}