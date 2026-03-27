import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../app/useTheme'
import { useAppStore } from '../app/store'
import { haptic } from '../utils/haptics'

export default function GlobalSearch({ onClose }) {
  const { t } = useTheme()
  const { notes, testResults, tasks } = useAppStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const q = query.toLowerCase().trim()

  const results = q.length < 2 ? [] : [
    ...notes
      .filter(n => n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q))
      .slice(0,5)
      .map(n => ({
        type:'note', id:n.id, title:n.title||'Untitled',
        sub: n.tags?.[0] || 'Note',
        preview: n.content?.slice(0,80),
        icon:'📄', path:`/learn/notes/${n.id}`
      })),
    ...testResults
      .filter(r => r.subject?.toLowerCase().includes(q))
      .slice(0,3)
      .map(r => ({
        type:'test', title:r.subject,
        sub:`${r.score}% · ${r.mode}`,
        icon:'🎯', path:'/progress'
      })),
    ...tasks
      .filter(tk => tk.title?.toLowerCase().includes(q))
      .slice(0,3)
      .map(tk => ({
        type:'task', title:tk.title,
        sub: tk.done ? 'Done' : tk.time || 'Task',
        icon:'✓', path:'/focus/planner'
      })),
  ]

  const go = (path) => {
    haptic.select()
    onClose()
    navigate(path)
  }

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:200,
      background:'rgba(0,0,0,0.75)', backdropFilter:'blur(20px)',
      display:'flex', flexDirection:'column',
      padding:'60px 16px 20px',
      animation:'fadeIn 0.15s ease',
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ display:'flex', flexDirection:'column', gap:10, maxWidth:480, width:'100%', margin:'0 auto' }}>

        {/* Input */}
        <div style={{ display:'flex', alignItems:'center', gap:12, background:t.card, border:`1px solid ${t.border}`, borderRadius:16, padding:'12px 16px', boxShadow:'0 8px 40px rgba(0,0,0,0.5)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e=>setQuery(e.target.value)}
            placeholder="Search notes, tests, tasks..."
            style={{ flex:1, background:'none', border:'none', color:t.text, fontSize:16, fontFamily:'Inter,sans-serif', outline:'none' }}
          />
          {query && <button onClick={()=>setQuery('')} style={{ background:'none',border:'none',color:t.textMuted,cursor:'pointer',fontSize:18 }}>×</button>}
          <button onClick={onClose} style={{ background:'none',border:'none',color:t.textMuted,cursor:'pointer',fontSize:13,fontFamily:'Inter,sans-serif' }}>Esc</button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:16, overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,0.4)' }}>
            {results.map((r,i) => (
              <div key={i} onClick={()=>go(r.path)} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                borderBottom: i<results.length-1 ? `1px solid ${t.border}` : 'none',
                cursor:'pointer', transition:'background 0.1s',
              }}
                onMouseEnter={e=>e.currentTarget.style.background=t.inputBg}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
              >
                <span style={{ fontSize:18, flexShrink:0 }}>{r.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:14, fontWeight:600, color:t.text, fontFamily:'Inter,sans-serif', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</p>
                  <p style={{ fontSize:11, color:t.textMuted, fontFamily:'Inter,sans-serif', marginTop:2 }}>{r.sub}</p>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textFaint} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            ))}
          </div>
        )}

        {q.length >= 2 && results.length === 0 && (
          <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:16, padding:'24px', textAlign:'center' }}>
            <p style={{ fontSize:14, color:t.textMuted, fontFamily:'Inter,sans-serif' }}>No results for "{query}"</p>
          </div>
        )}

        {q.length < 2 && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {['Notes', 'Tests', 'Tasks'].map(hint => (
              <span key={hint} style={{ fontSize:12, color:t.textMuted, background:t.card, border:`1px solid ${t.border}`, borderRadius:8, padding:'5px 12px', fontFamily:'Inter,sans-serif' }}>{hint}</span>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  )
}