import { haptic } from '../../utils/haptics'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../app/store'
import { useTheme } from '../../app/useTheme'
import { generateQuestionsFromText } from '../../services/ai.service'
import Header from '../../components/layout/Header'

const DIFFICULTY = ['Easy', 'Medium', 'Hard']
const COUNTS     = [5, 10, 15, 30, 60]
const CAT_COLORS = ['#60a5fa','#a78bfa','#34d399','#fbbf24','#f87171','#f472b6']

export default function ModeOne() {
  const navigate = useNavigate()
  const { t } = useTheme()
  const { notes, addTestResult } = useAppStore()

  // ── SELECTION STATE ──
  const [selectedCat,   setSelectedCat]   = useState(null)   // chosen category string
  const [catOpen,       setCatOpen]       = useState(false)   // dropdown 1 open
  const [notesOpen,     setNotesOpen]     = useState(false)   // dropdown 2 open
  const [selectedNotes, setSelectedNotes] = useState([])      // multi-select note ids

  // ── TEST STATE ──
  const [step,      setStep]      = useState('setup')
  const [difficulty,setDifficulty]= useState('Medium')
  const [count,     setCount]     = useState(10)
  const [questions, setQuestions] = useState([])
  const [currentQ,  setCurrentQ]  = useState(0)
  const [answers,   setAnswers]   = useState([])
  const [selected,  setSelected]  = useState(null)
  const [revealed,  setRevealed]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [timerOn,   setTimerOn]   = useState(false)
  const [timeLeft,  setTimeLeft]  = useState(null)
  const [timerRef,  setTimerRef]  = useState(null)

  // Group notes by category
  const groups = notes.reduce((acc, note) => {
    const cat = note.tags?.[0] || 'Uncategorized'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(note)
    return acc
  }, {})
  const categories = Object.keys(groups)
  const catIdx     = categories.indexOf(selectedCat)
  const catColor   = catIdx >= 0 ? CAT_COLORS[catIdx % CAT_COLORS.length] : t.blue
  const notesInCat = selectedCat ? (groups[selectedCat] || []) : []

  const toggleNote = (note) => {
    setSelectedNotes(prev =>
      prev.find(n => n.id === note.id)
        ? prev.filter(n => n.id !== note.id)
        : [...prev, note]
    )
  }

  const selectAllInCat = () => {
    const all = notesInCat
    const allSelected = all.every(n => selectedNotes.find(s => s.id === n.id))
    if (allSelected) setSelectedNotes(prev => prev.filter(s => !all.find(n => n.id === s.id)))
    else setSelectedNotes(prev => { const ids = new Set(prev.map(n=>n.id)); return [...prev, ...all.filter(n=>!ids.has(n.id))] })
  }

  const selectedInCat = notesInCat.filter(n => selectedNotes.find(s => s.id === n.id))

  const startTest = async () => {
    if (!selectedNotes.length) { setError('Select at least one note'); return }
    const combined = selectedNotes.map(n =>
      `[${n.title}]\n${n.content || n.html?.replace(/<[^>]*>/g,'') || ''}`
    ).join('\n\n---\n\n')
    if (combined.trim().length < 20) { setError('Selected notes have no content'); return }
    setLoading(true); setError('')
    const qs = await generateQuestionsFromText(combined, count, difficulty.toLowerCase())
    setLoading(false)
    if (!qs.length) { setError('Could not generate questions. Make sure notes have content.'); return }
    setQuestions(qs); setStep('quiz'); setCurrentQ(0); setAnswers([])
    setSelected(null); setRevealed(false)
    if (timerOn) startQuestionTimer(30)
  }

  const startQuestionTimer = (sec) => {
    setTimeLeft(sec)
    if (timerRef) clearInterval(timerRef)
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(id); setRevealed(true); setSelected(-1); return 0 }
        return prev - 1
      })
    }, 1000)
    setTimerRef(id)
  }

  const nextQuestion = () => {
    if (timerRef) clearInterval(timerRef)
    const newAnswers = [...answers, { selected, correct: questions[currentQ].answer }]
    setAnswers(newAnswers)
    if (currentQ + 1 >= questions.length) {
      const score = Math.round((newAnswers.filter(a => a.selected === a.correct).length / questions.length) * 100)
      addTestResult({ subject: selectedNotes.map(n => n.title).join(', '), mode: 'Practice from Notes', score, date: new Date().toISOString() })
      setStep('done')
    } else {
      setCurrentQ(q => q + 1); setSelected(null); setRevealed(false)
      if (timerOn) startQuestionTimer(30)
    }
  }

  const correct    = answers.filter(a => a.selected === a.correct).length
  const finalScore = Math.round((correct / (questions.length || 1)) * 100)

  const pill = (key, active, label, onClick) => (
    <button key={key} onClick={onClick} style={{ flex:1, padding:'10px', borderRadius:12, fontFamily:'Inter,sans-serif', background:active?t.text:'transparent', border:`1px solid ${active?t.borderStrong:t.border}`, color:active?t.bg:t.textMuted, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}>{label}</button>
  )

  // ── DONE ──
  if (step === 'done') return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',padding:'0 24px',gap:20,textAlign:'center',background:t.bg }}>
      <div style={{ fontSize:64,lineHeight:1 }}>{finalScore>=80?'🏆':finalScore>=60?'🌟':'💪'}</div>
      <h2 style={{ fontSize:52,fontWeight:900,color:t.text,letterSpacing:'-2px',fontFamily:'Inter,sans-serif' }}>{finalScore}<span style={{ fontSize:24,color:t.textMuted,fontWeight:400 }}>%</span></h2>
      <p style={{ fontSize:15,color:t.textMuted,fontFamily:'Inter,sans-serif' }}>{correct} of {questions.length} correct</p>
      <div style={{ display:'flex',gap:10,width:'100%' }}>
        <button onClick={()=>setStep('setup')} style={{ flex:1,padding:'14px',borderRadius:14,background:t.inputBg,border:`1px solid ${t.border}`,color:t.text,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif' }}>Try Again</button>
        <button onClick={()=>navigate('/practice')} style={{ flex:1,padding:'14px',borderRadius:14,background:t.text,border:'none',color:t.bg,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif' }}>Done</button>
      </div>
    </div>
  )

  // ── QUIZ ──
  if (step === 'quiz') {
    const q = questions[currentQ]
    return (
      <div style={{ minHeight:'100vh',display:'flex',flexDirection:'column',background:t.bg }}>
        <div style={{ display:'flex',alignItems:'center',gap:14,padding:'16px 16px 14px' }}>
          <button onClick={()=>setStep('setup')} style={{ background:'none',border:'none',color:t.textMuted,fontSize:22,cursor:'pointer' }}>‹</button>
          <div style={{ flex:1,height:4,background:t.border,borderRadius:2,overflow:'hidden' }}>
            <div style={{ height:'100%',background:t.text,borderRadius:2,width:`${(currentQ/questions.length)*100}%`,transition:'width 0.3s ease' }} />
          </div>
          <span style={{ fontSize:12,color:t.textMuted,fontFamily:'DM Mono,monospace' }}>{currentQ+1}/{questions.length}</span>
        </div>
        {timerOn&&timeLeft!=null&&(
          <div style={{ display:'flex',alignItems:'center',gap:10,padding:'0 16px 10px' }}>
            <div style={{ flex:1,height:3,background:t.border,borderRadius:2,overflow:'hidden' }}>
              <div style={{ height:'100%',background:timeLeft>10?t.green:t.red,width:`${(timeLeft/30)*100}%`,transition:'width 1s linear' }} />
            </div>
            <span style={{ fontSize:13,fontWeight:700,color:timeLeft>10?t.green:t.red,fontFamily:'DM Mono,monospace',minWidth:28 }}>{timeLeft}s</span>
          </div>
        )}
        <div style={{ padding:'0 16px 24px',display:'flex',flexDirection:'column',gap:14,flex:1 }}>
          <div style={{ background:t.card,border:`1px solid ${t.border}`,borderRadius:22,padding:'24px 20px',minHeight:120,boxShadow:t.shadowSm }}>
            <p style={{ fontSize:11,color:t.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',marginBottom:12,fontFamily:'Inter,sans-serif' }}>Question {currentQ+1}</p>
            <p style={{ fontSize:16,fontWeight:600,color:t.text,lineHeight:1.55,fontFamily:'Inter,sans-serif' }}>{q.q}</p>
          </div>
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {q.options?.map((opt,i)=>{
              const isSel=selected===i, isCorrect=i===q.answer
              let bg=t.inputBg, border=t.border, color=t.textSec
              if(revealed){if(isCorrect){bg=t.greenBg;border=t.green;color=t.green}else if(isSel){bg=t.redBg;border=t.red;color=t.red}}
              else if(isSel){bg=t.inputBgF;border=t.borderStrong;color=t.text}
              return (
                <div key={i} onClick={()=>{if(!revealed){setSelected(i);setRevealed(true);if(timerRef)clearInterval(timerRef)}}}
                  style={{ background:bg,border:`1px solid ${border}`,borderRadius:14,padding:'14px 16px',display:'flex',alignItems:'center',gap:14,cursor:revealed?'default':'pointer',transition:'all 0.15s' }}>
                  <span style={{ width:26,height:26,borderRadius:7,background:t.inputBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color,flexShrink:0 }}>{String.fromCharCode(65+i)}</span>
                  <span style={{ fontSize:14,color,flex:1,lineHeight:1.4,fontFamily:'Inter,sans-serif' }}>{opt}</span>
                  {revealed&&isCorrect&&<span style={{ color:t.green,fontWeight:700 }}>✓</span>}
                  {revealed&&isSel&&!isCorrect&&<span style={{ color:t.red,fontWeight:700 }}>✗</span>}
                </div>
              )
            })}
          </div>
          {revealed&&q.explanation&&(
            <div style={{ background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:14,padding:'14px 16px' }}>
              <p style={{ fontSize:11,color:t.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:6,fontFamily:'Inter,sans-serif' }}>Explanation</p>
              <p style={{ fontSize:13,color:t.textSec,lineHeight:1.6,fontFamily:'Inter,sans-serif' }}>{q.explanation}</p>
            </div>
          )}
          {revealed&&<button onClick={nextQuestion} style={{ padding:'15px',borderRadius:14,background:t.text,border:'none',color:t.bg,fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',marginTop:'auto' }}>{currentQ+1===questions.length?'See Results':'Next →'}</button>}
        </div>
      </div>
    )
  }

  // ── SETUP ──
  return (
    <div style={{ minHeight:'100vh', background:t.bg }}>
      <Header title="Practice from Notes" subtitle="AI questions from your notes" back />
      <div style={{ padding:'8px 16px 100px', display:'flex', flexDirection:'column', gap:20 }}>

        {error&&<div style={{ background:t.redBg,border:`1px solid ${t.red}30`,borderRadius:12,padding:'12px 14px',color:t.red,fontSize:13,fontFamily:'Inter,sans-serif' }}>{error}</div>}

        {/* ── STEP 1: Category dropdown ── */}
        <div>
          <p style={{ fontSize:11,color:t.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.2px',marginBottom:10,fontFamily:'Inter,sans-serif' }}>Step 1 — Choose Category</p>

          {notes.length === 0
            ? <div style={{ background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:'20px',textAlign:'center' }}>
                <p style={{ fontSize:13,color:t.textMuted,fontFamily:'Inter,sans-serif' }}>No notes yet — create notes in Learn first</p>
              </div>
            : <div style={{ position:'relative' }}>
                {/* Trigger button */}
                <button onClick={()=>{ setCatOpen(o=>!o); setNotesOpen(false) }}
                  style={{ width:'100%',display:'flex',alignItems:'center',gap:12,padding:'14px 16px',background:t.card,border:`1px solid ${selectedCat?catColor+'44':t.border}`,borderRadius:catOpen?'14px 14px 0 0':14,cursor:'pointer',transition:'all 0.2s',boxShadow:t.shadowSm }}>
                  {selectedCat && <div style={{ width:10,height:10,borderRadius:'50%',background:catColor,flexShrink:0 }} />}
                  <span style={{ flex:1,fontSize:14,fontWeight:600,color:selectedCat?t.text:t.textMuted,fontFamily:'Inter,sans-serif',textAlign:'left' }}>
                    {selectedCat || 'Select a category...'}
                  </span>
                  {selectedCat && <span style={{ fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif' }}>{notesInCat.length} note{notesInCat.length!==1?'s':''}</span>}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.5" strokeLinecap="round" style={{ transform:catOpen?'rotate(180deg)':'none',transition:'transform 0.2s',flexShrink:0 }}><polyline points="6 9 12 15 18 9"/></svg>
                </button>

                {/* Category list */}
                {catOpen && (
                  <div style={{ border:`1px solid ${t.border}`,borderTop:'none',borderRadius:'0 0 14px 14px',overflow:'hidden',boxShadow:t.shadow }}>
                    {categories.map((cat, ci) => {
                      const color  = CAT_COLORS[ci % CAT_COLORS.length]
                      const nCount = groups[cat]?.length || 0
                      const isActive = selectedCat === cat
                      return (
                        <div key={cat} onClick={()=>{ setSelectedCat(cat); setCatOpen(false); setNotesOpen(true); setSelectedNotes([]) }}
                          style={{ display:'flex',alignItems:'center',gap:12,padding:'13px 16px',background:isActive?`${color}14`:t.card,borderBottom:`1px solid ${t.border}`,cursor:'pointer',transition:'background 0.15s' }}>
                          <div style={{ width:10,height:10,borderRadius:'50%',background:color,flexShrink:0 }} />
                          <span style={{ flex:1,fontSize:14,fontWeight:isActive?700:500,color:t.text,fontFamily:'Inter,sans-serif' }}>{cat}</span>
                          <span style={{ fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif' }}>{nCount} note{nCount!==1?'s':''}</span>
                          {isActive && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
          }
        </div>

        {/* ── STEP 2: Notes dropdown (only if category selected) ── */}
        {selectedCat && (
          <div>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
              <p style={{ fontSize:11,color:t.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.2px',fontFamily:'Inter,sans-serif' }}>Step 2 — Select Notes</p>
              {selectedNotes.length>0&&<span style={{ fontSize:11,color:t.blue,fontFamily:'Inter,sans-serif',fontWeight:600 }}>{selectedNotes.length} selected</span>}
            </div>

            {/* Trigger button */}
            <button onClick={()=>setNotesOpen(o=>!o)}
              style={{ width:'100%',display:'flex',alignItems:'center',gap:12,padding:'14px 16px',background:t.card,border:`1px solid ${selectedNotes.length?catColor+'44':t.border}`,borderRadius:notesOpen?'14px 14px 0 0':14,cursor:'pointer',boxShadow:t.shadowSm }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={selectedNotes.length?catColor:t.textMuted} strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span style={{ flex:1,fontSize:14,fontWeight:500,color:selectedNotes.length?t.text:t.textMuted,fontFamily:'Inter,sans-serif',textAlign:'left' }}>
                {selectedNotes.length===0
                  ? `Choose from ${notesInCat.length} note${notesInCat.length!==1?'s':''}...`
                  : selectedNotes.map(n=>n.title).join(', ')
                }
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.5" strokeLinecap="round" style={{ transform:notesOpen?'rotate(180deg)':'none',transition:'transform 0.2s',flexShrink:0 }}><polyline points="6 9 12 15 18 9"/></svg>
            </button>

            {/* Notes list */}
            {notesOpen && (
              <div style={{ border:`1px solid ${t.border}`,borderTop:'none',borderRadius:'0 0 14px 14px',overflow:'hidden',boxShadow:t.shadow }}>
                {/* Select all row */}
                <div onClick={selectAllInCat} style={{ display:'flex',alignItems:'center',gap:12,padding:'11px 16px',background:t.inputBg,borderBottom:`1px solid ${t.border}`,cursor:'pointer' }}>
                  <div style={{ width:18,height:18,borderRadius:5,border:`1.5px solid ${selectedInCat.length===notesInCat.length&&notesInCat.length>0?'transparent':t.borderMed}`,background:selectedInCat.length===notesInCat.length&&notesInCat.length>0?catColor:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                    {selectedInCat.length===notesInCat.length&&notesInCat.length>0&&<svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1 4 3 6.5 9 1" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>}
                  </div>
                  <span style={{ fontSize:12,fontWeight:700,color:t.textSec,fontFamily:'Inter,sans-serif' }}>Select all ({notesInCat.length})</span>
                </div>

                {notesInCat.map((note,ni) => {
                  const isSel = !!selectedNotes.find(n=>n.id===note.id)
                  return (
                    <div key={note.id} onClick={()=>toggleNote(note)}
                      style={{ display:'flex',alignItems:'center',gap:12,padding:'13px 16px',background:isSel?`${catColor}12`:t.card,borderBottom:ni<notesInCat.length-1?`1px solid ${t.border}`:'none',cursor:'pointer',transition:'background 0.15s' }}>
                      <div style={{ width:18,height:18,borderRadius:5,border:`1.5px solid ${isSel?'transparent':t.borderMed}`,background:isSel?catColor:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.15s' }}>
                        {isSel&&<svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1 4 3 6.5 9 1" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>}
                      </div>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:14,fontWeight:isSel?700:500,color:t.text,fontFamily:'Inter,sans-serif' }}>{note.title}</p>
                        <p style={{ fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif',marginTop:2 }}>{note.content?.split(' ').length||0} words</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── OPTIONS ── */}
        <div>
          <p style={{ fontSize:11,color:t.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.2px',marginBottom:10,fontFamily:'Inter,sans-serif' }}>Difficulty</p>
          <div style={{ display:'flex',gap:8 }}>{DIFFICULTY.map(d=>pill(d, difficulty===d, d, ()=>setDifficulty(d)))}</div>
        </div>

        <div>
          <p style={{ fontSize:11,color:t.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.2px',marginBottom:10,fontFamily:'Inter,sans-serif' }}>Questions</p>
          <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>{COUNTS.map(n=>pill(n, count===n, `${n} Qs`, ()=>setCount(n)))}</div>
        </div>

        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',background:t.card,border:`1px solid ${t.border}`,borderRadius:14,boxShadow:t.shadowSm }}>
          <div>
            <p style={{ fontSize:14,fontWeight:600,color:t.text,fontFamily:'Inter,sans-serif' }}>Question Timer</p>
            <p style={{ fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif',marginTop:2 }}>30 seconds per question</p>
          </div>
          <div onClick={()=>setTimerOn(p=>!p)} style={{ width:44,height:26,borderRadius:13,background:timerOn?t.blue:'rgba(128,128,128,0.25)',cursor:'pointer',position:'relative',transition:'background 0.25s' }}>
            <div style={{ position:'absolute',top:3,left:timerOn?21:3,width:20,height:20,borderRadius:'50%',background:'#fff',transition:'left 0.25s',boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
          </div>
        </div>

        <button onClick={startTest} disabled={!selectedNotes.length||loading}
          style={{ padding:'15px',borderRadius:14,background:!selectedNotes.length||loading?t.inputBg:t.text,border:`1px solid ${!selectedNotes.length||loading?t.border:'transparent'}`,color:!selectedNotes.length||loading?t.textMuted:t.bg,fontSize:15,fontWeight:700,cursor:!selectedNotes.length||loading?'not-allowed':'pointer',fontFamily:'Inter,sans-serif' }}>
          {loading?'◌ Generating...':'Generate & Start Test'}
        </button>
      </div>
    </div>
  )
}