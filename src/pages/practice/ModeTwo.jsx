import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../app/store'
import { useTheme } from '../../app/useTheme'
import { generateQuestionsFromText, generateSmartTest } from '../../services/ai.service'
import Header from '../../components/layout/Header'

const COUNTS    = [5, 10, 15, 30, 60]
const DIFF      = ['Easy', 'Medium', 'Hard']
const QTYPES    = ['MCQ', 'True/False', 'Mixed']
const CAT_COLORS= ['#60a5fa','#a78bfa','#34d399','#fbbf24','#f87171','#f472b6']

// Generates real exam-level questions from note content (not topic-wise)
async function generateExamQuestions(note, count, difficulty, qtype) {
  const content = note.content || note.html?.replace(/<[^>]*>/g,'') || ''
  const seed    = Math.random().toString(36).slice(2,8)
  const typeStr = qtype==='True/False'?'true/false':qtype==='Mixed'?'mix of MCQ and true/false':'MCQ'

  const { API_KEY } = await import('../../services/ai.service.js')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${API_KEY}`},
    body: JSON.stringify({
      model:'llama-3.3-70b-versatile',
      max_tokens:3000,
      temperature:0.7,
      messages:[{
        role:'system',
        content:`You are an expert exam question setter (session:${seed}). 
Generate exactly ${count} ${difficulty.toLowerCase()} ${typeStr} questions based on the provided notes.

RULES:
- Questions must be at REAL EXAM LEVEL — the kind asked in board exams, competitive exams, or university papers
- Cover ALL topics and concepts from the notes, not just the first few
- Each question should test deep understanding, not just surface recall
- Vary the question types: definitions, applications, comparisons, cause-effect, exceptions
- Options should be plausible and well-crafted — no obviously wrong distractors
- Do NOT mention "according to the notes" or "as mentioned" — write as standalone exam questions

Return ONLY a valid JSON array, no markdown:
[{"q":"question text","options":["A","B","C","D"],"answer":0,"explanation":"concise explanation of why correct"}]
answer = 0-3 index of correct option.`
      },{
        role:'user',
        content:`Generate ${count} exam-level questions from these notes:\n\n${content}`
      }]
    })
  })
  const data = await res.json()
  const raw  = data.choices?.[0]?.message?.content?.trim() || '[]'
  try {
    const parsed = JSON.parse(raw)
    return parsed.sort(() => Math.random() - 0.5)
  } catch { return [] }
}

export default function ModeTwo() {
  const navigate = useNavigate()
  const { t }    = useTheme()
  const { notes, addTestResult } = useAppStore()

  // ── SOURCE ──
  const [source,       setSource]      = useState('custom')  // 'custom' | 'note'
  const [customTopic,  setCustomTopic] = useState('')

  // Note selection
  const [selectedCat,  setSelectedCat] = useState(null)
  const [catOpen,      setCatOpen]     = useState(false)
  const [selectedNote, setSelectedNote]= useState(null)
  const [noteOpen,     setNoteOpen]    = useState(false)

  // ── TEST ──
  const [questions, setQuestions] = useState([])
  const [currentQ,  setCurrentQ]  = useState(0)
  const [answers,   setAnswers]   = useState([])
  const [selected,  setSelected]  = useState(null)
  const [revealed,  setRevealed]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [step,      setStep]      = useState('setup')
  const [difficulty,setDifficulty]= useState('Medium')
  const [count,     setCount]     = useState(10)
  const [qtype,     setQtype]     = useState('MCQ')
  const [timerOn,   setTimerOn]   = useState(false)
  const [timeLeft,  setTimeLeft]  = useState(null)
  const [timerRef,  setTimerRef]  = useState(null)

  const groups      = notes.reduce((acc,note)=>{ const c=note.tags?.[0]||'Uncategorized'; if(!acc[c])acc[c]=[]; acc[c].push(note); return acc },{})
  const categories  = Object.keys(groups)
  const catIdx      = categories.indexOf(selectedCat)
  const catColor    = catIdx>=0 ? CAT_COLORS[catIdx%CAT_COLORS.length] : t.blue
  const notesInCat  = selectedCat ? (groups[selectedCat]||[]) : []

  const canStart = source==='custom' ? customTopic.trim().length>0 : !!selectedNote

  const startTest = async () => {
    if (!canStart) return
    setLoading(true)
    let qs = []

    if (source==='note') {
      qs = await generateExamQuestions(selectedNote, count, difficulty, qtype)
    } else {
      const typeStr = qtype==='True/False'?'true/false':qtype==='Mixed'?'mix of MCQ and true/false':'MCQ'
      qs = await generateSmartTest('General',[customTopic],[],difficulty.toLowerCase(),
        `${customTopic} — ${count} real exam-level ${typeStr} questions`)
      qs = qs.slice(0, count)
    }

    setLoading(false)
    if (!qs.length) { setLoading(false); return }
    setQuestions(qs); setStep('quiz'); setCurrentQ(0); setAnswers([])
    setSelected(null); setRevealed(false)
    if (timerOn) startQTimer(30)
  }

  const startQTimer = (sec) => {
    setTimeLeft(sec)
    if (timerRef) clearInterval(timerRef)
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev<=1){clearInterval(id);setRevealed(true);setSelected(-1);return 0}
        return prev-1
      })
    },1000)
    setTimerRef(id)
  }

  const nextQuestion = () => {
    if (timerRef) clearInterval(timerRef)
    const na=[...answers,{selected,correct:questions[currentQ].answer}]
    setAnswers(na)
    if(currentQ+1>=questions.length){
      const score=Math.round((na.filter(a=>a.selected===a.correct).length/questions.length)*100)
      const label = source==='note' ? selectedNote.title : customTopic
      addTestResult({subject:label,mode:'Smart Exam',score,date:new Date().toISOString()})
      setStep('done')
    } else {
      setCurrentQ(q=>q+1); setSelected(null); setRevealed(false)
      if(timerOn) startQTimer(30)
    }
  }

  const correct    = answers.filter(a=>a.selected===a.correct).length
  const finalScore = Math.round((correct/(questions.length||1))*100)
  const subjectLabel = source==='note' ? selectedNote?.title : customTopic

  const pill = (key,active,label,onClick) => (
    <button key={key} onClick={onClick} style={{ flex:1,padding:'10px',borderRadius:12,fontFamily:'Inter,sans-serif',background:active?t.text:'transparent',border:`1px solid ${active?t.borderStrong:t.border}`,color:active?t.bg:t.textMuted,fontSize:12,fontWeight:600,cursor:'pointer',transition:'all 0.15s',whiteSpace:'nowrap' }}>{label}</button>
  )

  // ── DONE ──
  if(step==='done') return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',padding:'0 24px',gap:20,textAlign:'center',background:t.bg}}>
      <div style={{fontSize:64,lineHeight:1}}>{finalScore>=80?'🏆':finalScore>=60?'🌟':'💡'}</div>
      <h2 style={{fontSize:52,fontWeight:900,color:t.text,letterSpacing:'-2px',fontFamily:'Inter,sans-serif'}}>{finalScore}<span style={{fontSize:24,color:t.textMuted,fontWeight:400}}>%</span></h2>
      <p style={{fontSize:14,color:t.textMuted,fontFamily:'Inter,sans-serif'}}>{correct} of {questions.length} correct · {subjectLabel}</p>
      <div style={{display:'flex',gap:10,width:'100%'}}>
        <button onClick={()=>setStep('setup')} style={{flex:1,padding:'14px',borderRadius:14,background:t.inputBg,border:`1px solid ${t.border}`,color:t.text,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>New Test</button>
        <button onClick={()=>navigate('/practice')} style={{flex:1,padding:'14px',borderRadius:14,background:t.text,border:'none',color:t.bg,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Done</button>
      </div>
    </div>
  )

  // ── QUIZ ──
  if(step==='quiz'){
    const q=questions[currentQ]
    return (
      <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:t.bg}}>
        <div style={{display:'flex',alignItems:'center',gap:14,padding:'16px 16px 10px'}}>
          <button onClick={()=>setStep('setup')} style={{background:'none',border:'none',color:t.textMuted,fontSize:22,cursor:'pointer'}}>‹</button>
          <div style={{flex:1,height:4,background:t.border,borderRadius:2,overflow:'hidden'}}>
            <div style={{height:'100%',background:t.green,borderRadius:2,width:`${(currentQ/questions.length)*100}%`,transition:'width 0.3s'}}/>
          </div>
          <span style={{fontSize:12,color:t.textMuted,fontFamily:'DM Mono,monospace'}}>{currentQ+1}/{questions.length}</span>
        </div>
        {timerOn&&timeLeft!=null&&(
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'0 16px 8px'}}>
            <div style={{flex:1,height:3,background:t.border,borderRadius:2,overflow:'hidden'}}>
              <div style={{height:'100%',background:timeLeft>10?t.green:t.red,width:`${(timeLeft/30)*100}%`,transition:'width 1s linear'}}/>
            </div>
            <span style={{fontSize:13,fontWeight:700,color:timeLeft>10?t.green:t.red,fontFamily:'DM Mono,monospace',minWidth:28}}>{timeLeft}s</span>
          </div>
        )}
        <div style={{padding:'0 16px 24px',display:'flex',flexDirection:'column',gap:14,flex:1}}>
          <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:22,padding:'24px 20px',minHeight:120,boxShadow:t.shadowSm}}>
            <p style={{fontSize:11,color:t.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',marginBottom:12,fontFamily:'Inter,sans-serif'}}>Question {currentQ+1}</p>
            <p style={{fontSize:16,fontWeight:600,color:t.text,lineHeight:1.55,fontFamily:'Inter,sans-serif'}}>{q.q}</p>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {q.options?.map((opt,i)=>{
              const isSel=selected===i,isCorrect=i===q.answer
              let bg=t.inputBg,border=t.border,color=t.textSec
              if(revealed){if(isCorrect){bg=t.greenBg;border=t.green;color=t.green}else if(isSel){bg=t.redBg;border=t.red;color=t.red}}
              else if(isSel){bg=t.inputBgF;border=t.borderStrong;color=t.text}
              return <div key={i} onClick={()=>{if(!revealed){setSelected(i);setRevealed(true);if(timerRef)clearInterval(timerRef)}}} style={{background:bg,border:`1px solid ${border}`,borderRadius:14,padding:'14px 16px',display:'flex',alignItems:'center',gap:14,cursor:revealed?'default':'pointer',transition:'all 0.15s'}}>
                <span style={{width:26,height:26,borderRadius:7,background:t.inputBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color,flexShrink:0}}>{String.fromCharCode(65+i)}</span>
                <span style={{fontSize:14,color,flex:1,lineHeight:1.4,fontFamily:'Inter,sans-serif'}}>{opt}</span>
                {revealed&&isCorrect&&<span style={{color:t.green,fontWeight:700}}>✓</span>}
                {revealed&&isSel&&!isCorrect&&<span style={{color:t.red,fontWeight:700}}>✗</span>}
              </div>
            })}
          </div>
          {revealed&&q.explanation&&<div style={{background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:14,padding:'14px 16px'}}><p style={{fontSize:11,color:t.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:6,fontFamily:'Inter,sans-serif'}}>Explanation</p><p style={{fontSize:13,color:t.textSec,lineHeight:1.6,fontFamily:'Inter,sans-serif'}}>{q.explanation}</p></div>}
          {revealed&&<button onClick={nextQuestion} style={{padding:'15px',borderRadius:14,background:t.text,border:'none',color:t.bg,fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',marginTop:'auto'}}>{currentQ+1===questions.length?'See Results':'Next →'}</button>}
        </div>
      </div>
    )
  }

  // ── SETUP ──
  return (
    <div style={{minHeight:'100vh',background:t.bg}}>
      <Header title="Smart Exam" subtitle="Real exam-level questions" back />
      <div style={{padding:'8px 16px 100px',display:'flex',flexDirection:'column',gap:20}}>

        {/* ── SOURCE TOGGLE ── */}
        <div>
          <p style={{fontSize:11,color:t.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.2px',marginBottom:10,fontFamily:'Inter,sans-serif'}}>Question Source</p>
          <div style={{display:'flex',gap:0,background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:14,padding:4}}>
            {[{id:'custom',label:'Custom Topic'},{id:'note',label:'From My Notes'}].map(({id,label})=>(
              <button key={id} onClick={()=>{setSource(id);setSelectedCat(null);setSelectedNote(null)}}
                style={{flex:1,padding:'10px',borderRadius:10,fontFamily:'Inter,sans-serif',background:source===id?t.card:'transparent',border:'none',color:source===id?t.text:t.textMuted,fontSize:13,fontWeight:source===id?700:500,cursor:'pointer',transition:'all 0.2s',boxShadow:source===id?t.shadowSm:'none'}}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── CUSTOM TOPIC ── */}
        {source==='custom' && (
          <div>
            <p style={{fontSize:11,color:t.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.2px',marginBottom:10,fontFamily:'Inter,sans-serif'}}>Topic</p>
            <input placeholder="e.g. Photosynthesis, World War II, Calculus, Indian Economy..."
              value={customTopic} onChange={e=>setCustomTopic(e.target.value)} onKeyDown={e=>e.key==='Enter'&&startTest()}
              style={{width:'100%',background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:'14px 16px',color:t.text,fontSize:14,fontFamily:'Inter,sans-serif',outline:'none',boxSizing:'border-box',boxShadow:t.shadowSm}}/>
            <p style={{fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif',marginTop:8,paddingLeft:4}}>AI will generate real exam-level questions on this topic</p>
          </div>
        )}

        {/* ── FROM NOTES ── */}
        {source==='note' && (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>

            {/* Info banner */}
            <div style={{background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:12,padding:'12px 14px',display:'flex',gap:10,alignItems:'flex-start'}}>
              <span style={{fontSize:16,flexShrink:0}}>📖</span>
              <p style={{fontSize:12,color:t.textSec,fontFamily:'Inter,sans-serif',lineHeight:1.6}}>
                The selected note will be scanned entirely. AI generates <strong style={{color:t.text}}>real exam-level questions</strong> covering all its topics — not heading-by-heading, but the kind of questions that actually appear in board & competitive exams.
              </p>
            </div>

            {/* Step 1: Category */}
            <div>
              <p style={{fontSize:11,color:t.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.2px',marginBottom:10,fontFamily:'Inter,sans-serif'}}>Step 1 — Category</p>
              {notes.length===0
                ? <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:'20px',textAlign:'center'}}><p style={{fontSize:13,color:t.textMuted,fontFamily:'Inter,sans-serif'}}>No notes yet — create notes in Learn first</p></div>
                : <>
                  {/* Trigger */}
                  <button onClick={()=>{setCatOpen(o=>!o);setNoteOpen(false)}}
                    style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'14px 16px',background:t.card,border:`1px solid ${selectedCat?catColor+'55':t.border}`,borderRadius:catOpen?'14px 14px 0 0':14,cursor:'pointer',boxShadow:t.shadowSm,transition:'all 0.2s'}}>
                    {selectedCat
                      ? <div style={{width:10,height:10,borderRadius:'50%',background:catColor,flexShrink:0}}/>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="9" r="4"/><line x1="9" y1="13" x2="9" y2="21"/></svg>
                    }
                    <span style={{flex:1,fontSize:14,fontWeight:selectedCat?600:400,color:selectedCat?t.text:t.textMuted,fontFamily:'Inter,sans-serif',textAlign:'left'}}>{selectedCat||'Select a category...'}</span>
                    {selectedCat&&<span style={{fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif'}}>{notesInCat.length} notes</span>}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.5" strokeLinecap="round" style={{transform:catOpen?'rotate(180deg)':'none',transition:'transform 0.2s',flexShrink:0}}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {/* Category list */}
                  {catOpen&&(
                    <div style={{border:`1px solid ${t.border}`,borderTop:'none',borderRadius:'0 0 14px 14px',overflow:'hidden',boxShadow:t.shadow}}>
                      {categories.map((cat,ci)=>{
                        const col=CAT_COLORS[ci%CAT_COLORS.length]
                        return (
                          <div key={cat} onClick={()=>{setSelectedCat(cat);setCatOpen(false);setSelectedNote(null);setNoteOpen(true)}}
                            style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',background:selectedCat===cat?`${col}14`:t.card,borderBottom:`1px solid ${t.border}`,cursor:'pointer',transition:'background 0.15s'}}>
                            <div style={{width:10,height:10,borderRadius:'50%',background:col,flexShrink:0}}/>
                            <span style={{flex:1,fontSize:14,fontWeight:500,color:t.text,fontFamily:'Inter,sans-serif'}}>{cat}</span>
                            <span style={{fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif'}}>{groups[cat]?.length||0} notes</span>
                            {selectedCat===cat&&<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              }
            </div>

            {/* Step 2: Note */}
            {selectedCat && (
              <div>
                <p style={{fontSize:11,color:t.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.2px',marginBottom:10,fontFamily:'Inter,sans-serif'}}>Step 2 — Select Note</p>
                <button onClick={()=>{setNoteOpen(o=>!o);setCatOpen(false)}}
                  style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'14px 16px',background:t.card,border:`1px solid ${selectedNote?catColor+'55':t.border}`,borderRadius:noteOpen?'14px 14px 0 0':14,cursor:'pointer',boxShadow:t.shadowSm,transition:'all 0.2s'}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={selectedNote?catColor:t.textMuted} strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <div style={{flex:1,textAlign:'left'}}>
                    <p style={{fontSize:14,fontWeight:selectedNote?600:400,color:selectedNote?t.text:t.textMuted,fontFamily:'Inter,sans-serif'}}>{selectedNote?.title||'Select a note...'}</p>
                    {selectedNote&&<p style={{fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif',marginTop:2}}>{selectedNote.content?.split(' ').length||0} words · full note will be scanned</p>}
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.5" strokeLinecap="round" style={{transform:noteOpen?'rotate(180deg)':'none',transition:'transform 0.2s',flexShrink:0}}><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {noteOpen&&(
                  <div style={{border:`1px solid ${t.border}`,borderTop:'none',borderRadius:'0 0 14px 14px',overflow:'hidden',boxShadow:t.shadow}}>
                    {notesInCat.map((note,ni)=>(
                      <div key={note.id} onClick={()=>{setSelectedNote(note);setNoteOpen(false)}}
                        style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',background:selectedNote?.id===note.id?`${catColor}14`:t.card,borderBottom:ni<notesInCat.length-1?`1px solid ${t.border}`:'none',cursor:'pointer',transition:'background 0.15s'}}>
                        <div style={{flex:1}}>
                          <p style={{fontSize:14,fontWeight:500,color:t.text,fontFamily:'Inter,sans-serif'}}>{note.title}</p>
                          <p style={{fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif',marginTop:2}}>{note.content?.split(' ').length||0} words</p>
                        </div>
                        {selectedNote?.id===note.id&&<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={catColor} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── OPTIONS ── */}
        <div>
          <p style={{fontSize:11,color:t.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.2px',marginBottom:10,fontFamily:'Inter,sans-serif'}}>Difficulty</p>
          <div style={{display:'flex',gap:8}}>{DIFF.map(d=>pill(d,difficulty===d,d,()=>setDifficulty(d)))}</div>
        </div>

        <div>
          <p style={{fontSize:11,color:t.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.2px',marginBottom:10,fontFamily:'Inter,sans-serif'}}>Questions</p>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{COUNTS.map(n=>pill(n,count===n,`${n} Qs`,()=>setCount(n)))}</div>
        </div>

        <div>
          <p style={{fontSize:11,color:t.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.2px',marginBottom:10,fontFamily:'Inter,sans-serif'}}>Question Type</p>
          <div style={{display:'flex',gap:8}}>{QTYPES.map(q=>pill(q,qtype===q,q,()=>setQtype(q)))}</div>
        </div>

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',background:t.card,border:`1px solid ${t.border}`,borderRadius:14,boxShadow:t.shadowSm}}>
          <div>
            <p style={{fontSize:14,fontWeight:600,color:t.text,fontFamily:'Inter,sans-serif'}}>Question Timer</p>
            <p style={{fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif',marginTop:2}}>30 seconds per question</p>
          </div>
          <div onClick={()=>setTimerOn(p=>!p)} style={{width:44,height:26,borderRadius:13,background:timerOn?t.blue:'rgba(128,128,128,0.25)',cursor:'pointer',position:'relative',transition:'background 0.25s'}}>
            <div style={{position:'absolute',top:3,left:timerOn?21:3,width:20,height:20,borderRadius:'50%',background:'#fff',transition:'left 0.25s',boxShadow:'0 1px 4px rgba(0,0,0,0.2)'}}/>
          </div>
        </div>

        <button onClick={startTest} disabled={!canStart||loading}
          style={{padding:'15px',borderRadius:14,background:!canStart||loading?t.inputBg:`linear-gradient(135deg,${t.green||'#22c55e'},${t.teal||'#0d9488'})`,border:`1px solid ${!canStart||loading?t.border:'transparent'}`,color:!canStart||loading?t.textMuted:'#000',fontSize:15,fontWeight:700,cursor:!canStart||loading?'not-allowed':'pointer',fontFamily:'Inter,sans-serif'}}>
          {loading?'◌ Building exam paper...':'Start Smart Exam →'}
        </button>
      </div>
    </div>
  )
}