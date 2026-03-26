import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../app/store'
import { useTheme } from '../../app/useTheme'
import { generateMindMap } from '../../services/ai.service'
import { getCachedMindMap, backgroundGenerateForNote } from '../../services/aiCache.service'
import * as aiService from '../../services/ai.service'
import Header from '../../components/layout/Header'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const API_KEY_VAL = import.meta.env.VITE_GROQ_API_KEY || ''

async function quickExplain(term, topic, noteContent, apiKey) {
  // First: try to find relevant text in the note
  const lower = (noteContent || '').toLowerCase()
  const termLower = term.toLowerCase()
  const idx = lower.indexOf(termLower)
  let fromNote = ''
  if (idx !== -1) {
    const start = Math.max(0, idx - 100)
    const end   = Math.min(noteContent.length, idx + term.length + 200)
    fromNote = noteContent.slice(start, end).trim()
  }

  // If we have good note context, use it directly without API call
  if (fromNote.length > 60) {
    return { source: 'note', text: fromNote }
  }

  // Fall back to Groq for explanation
  try {
    const { API_KEY } = await import('../../services/ai.service.js')
    const key = API_KEY
    if (!key || key === 'YOUR_GROQ_API_KEY_HERE') return { source: 'groq', text: `${term}: a key concept in ${topic}.` }

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 120,
        temperature: 0.3,
        messages: [
          { role:'system', content:`Explain "${term}" in the context of ${topic} in 2-3 sentences. Be concise and student-friendly.` },
          { role:'user', content: fromNote ? `Context from notes: ${fromNote}\n\nExplain "${term}".` : `Explain "${term}" related to ${topic}.` }
        ]
      })
    })
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content?.trim() || `${term}: see your notes for details.`
    return { source: fromNote ? 'both' : 'groq', text }
  } catch {
    return { source: 'note', text: fromNote || `${term}: a key concept in ${topic}.` }
  }
}

const COLORS = [
  { line:'rgba(96,165,250,0.9)',  bg:'rgba(96,165,250,0.08)',  border:'rgba(96,165,250,0.2)'  },
  { line:'rgba(167,139,250,0.9)', bg:'rgba(167,139,250,0.08)', border:'rgba(167,139,250,0.2)' },
  { line:'rgba(244,114,182,0.9)', bg:'rgba(244,114,182,0.08)', border:'rgba(244,114,182,0.2)' },
  { line:'rgba(52,211,153,0.9)',  bg:'rgba(52,211,153,0.08)',  border:'rgba(52,211,153,0.2)'  },
  { line:'rgba(251,191,36,0.9)',  bg:'rgba(251,191,36,0.08)',  border:'rgba(251,191,36,0.2)'  },
  { line:'rgba(248,113,113,0.9)', bg:'rgba(248,113,113,0.08)', border:'rgba(248,113,113,0.2)' },
]

export default function MindMap() {
  const navigate   = useNavigate()
  const { notes }  = useAppStore()
  const { t, isDark } = useTheme()

  const [mapData,     setMapData]    = useState(null)
  const [loading,     setLoading]    = useState(false)
  const [error,       setError]      = useState('')
  const [sourceNote,  setSourceNote] = useState(null)
  const [activeChild, setActiveChild]= useState(null)  // { branchIdx, childIdx, term }
  const [tooltip,     setTooltip]    = useState(null)  // { text, source, loading }

  // Pre-generate cache for ALL notes in background on mount
  useEffect(() => {
    notes.forEach((note, i) => {
      // Stagger to avoid hammering the API
      setTimeout(() => backgroundGenerateForNote(note, aiService), i * 2000)
    })
  }, []) // eslint-disable-line

  const generate = async (note) => {
    setLoading(true); setError(''); setMapData(null); setSourceNote(note)
    setActiveChild(null); setTooltip(null)

    // Try cache first
    const cached = getCachedMindMap(note.id)
    if (cached) { setMapData(cached); setLoading(false); return }

    try {
      const data = await generateMindMap(note.content || note.title, note.title)
      if (data?.branches?.length > 0) setMapData(data)
      else setError('Could not generate mind map. Try adding more content.')
    } catch(e) { setError(e.message || 'Failed. Check API key.') }
    setLoading(false)
  }

  const handleChildClick = async (term, branchIdx, childIdx) => {
    const key = `${branchIdx}_${childIdx}`
    if (activeChild === key) { setActiveChild(null); setTooltip(null); return }
    setActiveChild(key)
    setTooltip({ loading: true, text: '', source: '' })
    const result = await quickExplain(term, sourceNote?.title || mapData?.center || 'this topic', sourceNote?.content || '', '')
    setTooltip({ loading: false, text: result.text, source: result.source })
  }

  return (
    <div style={{ minHeight:'100vh', background:t.bg }}>
      <Header title="Mind Map" subtitle="Visualise Concepts" back />
      <div style={{ padding:'8px 16px 80px', display:'flex', flexDirection:'column', gap:12 }}>

        {/* Note selector */}
        {!mapData && !loading && (
          <>
            <p style={{ fontSize:11,color:t.textMuted,fontWeight:600,textTransform:'uppercase',letterSpacing:'1.2px',marginBottom:4,fontFamily:'Inter,sans-serif' }}>Choose a note</p>
            {notes.length === 0
              ? <p style={{ fontSize:13,color:t.textMuted,textAlign:'center',padding:'32px 0',fontFamily:'Inter,sans-serif' }}>Add notes first</p>
              : notes.map(note=>(
                <div key={note.id} className="pressable" onClick={()=>generate(note)}
                  style={{ background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:'16px',display:'flex',alignItems:'center',gap:14,cursor:'pointer',boxShadow:t.shadowSm }}>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:15,fontWeight:600,color:t.text,marginBottom:3,fontFamily:'Inter,sans-serif' }}>{note.title}</p>
                    <p style={{ fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',gap:5 }}>
                      {note.content?.split(' ').length||0} words{note.tags?.[0]&&` · ${note.tags[0]}`}
                      {getCachedMindMap(note.id)&&<span style={{ width:5,height:5,borderRadius:'50%',background:t.teal,display:'inline-block',flexShrink:0 }} />}
                    </p>
                  </div>
                  <span style={{ color:t.textMuted,fontSize:18 }}>›</span>
                </div>
              ))
            }
          </>
        )}

        {loading && (
          <div style={{ textAlign:'center',padding:'60px 0' }}>
            <div style={{ fontSize:32,display:'inline-block',animation:'spin 1.5s linear infinite',marginBottom:12,color:t.text }}>◌</div>
            <p style={{ fontSize:14,color:t.textMuted,fontFamily:'Inter,sans-serif' }}>Building mind map...</p>
          </div>
        )}

        {error && <p style={{ fontSize:13,color:t.red,textAlign:'center',padding:'20px 0',fontFamily:'Inter,sans-serif' }}>{error}</p>}

        {mapData && !loading && (
          <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
            {/* Header row */}
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <button onClick={()=>{setMapData(null);setSourceNote(null);setActiveChild(null);setTooltip(null)}} style={{ background:'none',border:'none',color:t.textMuted,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'Inter,sans-serif' }}>← Back</button>
              {sourceNote&&<button onClick={()=>navigate(`/learn/notes/${sourceNote.id}`)} style={{ padding:'7px 14px',borderRadius:20,background:t.blueBg,border:`1px solid ${t.blue}30`,color:t.blue,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif' }}>Open Note</button>}
            </div>

            {/* Centre node — shows exact topic title */}
            <div style={{ display:'flex',justifyContent:'center' }}>
              <div style={{ background:t.text,borderRadius:20,padding:'14px 30px',boxShadow:t.shadow,maxWidth:'85%',textAlign:'center' }}>
                <p style={{ fontSize:17,fontWeight:800,color:t.bg,letterSpacing:'-0.3px',fontFamily:'Inter,sans-serif',lineHeight:1.3 }}>
                  {sourceNote?.title || mapData.center}
                </p>
                {sourceNote?.tags?.[0] && <p style={{ fontSize:10,color:isDark?'rgba(0,0,0,0.4)':'rgba(255,255,255,0.5)',fontFamily:'Inter,sans-serif',marginTop:4,textTransform:'uppercase',letterSpacing:'0.8px' }}>{sourceNote.tags[0]}</p>}
              </div>
            </div>

            {/* Connector */}
            <div style={{ display:'flex',justifyContent:'center' }}><div style={{ width:1,height:20,background:t.borderMed }} /></div>

            {/* Branches */}
            {mapData.branches?.map((branch, bi) => {
              const col = COLORS[bi % COLORS.length]
              const children = (Array.isArray(branch.children) ? branch.children : branch.children ? [branch.children] : []).filter(Boolean).map(String)
              return (
                <div key={bi} style={{ background:t.card,border:`1px solid ${col.border}`,borderRadius:18,padding:'16px 18px',borderLeft:`3px solid ${col.line}`,boxShadow:`0 2px 16px ${col.bg}` }}>
                  <p style={{ fontSize:14,fontWeight:700,color:t.text,marginBottom:10,fontFamily:'Inter,sans-serif' }}>{branch.label}</p>
                  <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
                    {children.map((child,ci)=>{
                      const key = `${bi}_${ci}`
                      const isActive = activeChild === key
                      return (
                        <span key={ci} onClick={()=>handleChildClick(child,bi,ci)}
                          style={{ fontSize:12,color:isActive?t.bg:t.textSec,background:isActive?col.line:t.inputBg,border:`1px solid ${isActive?col.line:t.border}`,padding:'6px 14px',borderRadius:20,fontFamily:'Inter,sans-serif',cursor:'pointer',transition:'all 0.15s',userSelect:'none',fontWeight:isActive?600:400 }}>
                          {child}
                        </span>
                      )
                    })}
                  </div>

                  {/* Tooltip for active child */}
                  {children.some((_,ci)=>activeChild===`${bi}_${ci}`)&&tooltip&&(
                    <div style={{ marginTop:12,background:isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)',border:`1px solid ${col.border}`,borderRadius:12,padding:'12px 14px',animation:'fadeIn 0.2s ease' }}>
                      {tooltip.loading
                        ? <div style={{ display:'flex',alignItems:'center',gap:8 }}><div style={{ width:12,height:12,borderRadius:'50%',border:`2px solid ${col.line}`,borderTopColor:'transparent',animation:'spin 0.8s linear infinite' }}/><span style={{ fontSize:12,color:t.textMuted,fontFamily:'Inter,sans-serif' }}>Looking up...</span></div>
                        : <>
                          <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:6 }}>
                            <span style={{ fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.8px',color:col.line,fontFamily:'Inter,sans-serif' }}>
                              {tooltip.source==='note'?'From your note':tooltip.source==='both'?'Note + AI':'AI explanation'}
                            </span>
                          </div>
                          <p style={{ fontSize:13,color:t.textSec,lineHeight:1.6,fontFamily:'Inter,sans-serif' }}>{tooltip.text}</p>
                        </>
                      }
                    </div>
                  )}
                </div>
              )
            })}

            <button onClick={()=>sourceNote&&generate(sourceNote)} style={{ padding:'13px',borderRadius:14,background:t.inputBg,border:`1px solid ${t.border}`,color:t.textSec,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',marginTop:4 }}>↻ Regenerate</button>
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  )
}