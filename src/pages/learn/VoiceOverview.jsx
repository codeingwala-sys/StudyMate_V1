import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../app/store'
import { useTheme } from '../../app/useTheme'
import { generateVoiceOverview } from '../../services/ai.service'
import { getCachedOverview, backgroundGenerateForNote } from '../../services/aiCache.service'
import * as aiService from '../../services/ai.service'
import Header from '../../components/layout/Header'

const SPEEDS = [0.75, 1.0, 1.25, 1.5]

// Get best available female voice
function getFemaleVoice() {
  const voices = window.speechSynthesis.getVoices()
  const femaleKeywords = ['female','woman','girl','zira','victoria','samantha','karen','moira','fiona','veena','tessa','susan','catherine']
  // Try to find a high-quality female voice
  const female = voices.find(v =>
    femaleKeywords.some(kw => v.name.toLowerCase().includes(kw)) && v.lang.startsWith('en')
  ) || voices.find(v =>
    femaleKeywords.some(kw => v.name.toLowerCase().includes(kw))
  ) || voices.find(v => v.lang.startsWith('en')) || voices[0]
  return female || null
}

export default function VoiceOverview() {
  const { notes } = useAppStore()
  const { t, isDark } = useTheme()
  const [selectedNote, setSelectedNote] = useState(null)
  const [overview,     setOverview]     = useState('')
  const [loading,      setLoading]      = useState(false)
  const [playing,      setPlaying]      = useState(false)
  const [paused,       setPaused]       = useState(false)
  const [speed,        setSpeed]        = useState(1.0)
  const [charIndex,    setCharIndex]    = useState(0)  // track position for resume after speed change
  const [voices,       setVoices]       = useState([])
  const overviewRef = useRef('')
  const utterRef    = useRef(null)

  // Load voices (they load async on some browsers)
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices())
    load()
    window.speechSynthesis.onvoiceschanged = load
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  useEffect(() => {
    notes.forEach((note, i) => {
      setTimeout(() => backgroundGenerateForNote(note, aiService), i * 2000)
    })
  }, []) // eslint-disable-line

  const generate = async (note) => {
    setSelectedNote(note)
    setLoading(true)
    setOverview('')
    stopAll()

    // Check cache first
    const cached = getCachedOverview(note.id)
    if (cached) { setOverview(cached); overviewRef.current = cached; setLoading(false); return }

    const text = await generateVoiceOverview(note.content || note.title)
    setOverview(text)
    overviewRef.current = text
    setLoading(false)
  }

  const stopAll = () => {
    window.speechSynthesis.cancel()
    setPlaying(false); setPaused(false); setCharIndex(0)
  }

  const speakFrom = (text, fromChar, rate) => {
    window.speechSynthesis.cancel()
    const remaining = text.slice(fromChar)
    if (!remaining.trim()) { setPlaying(false); setPaused(false); return }

    const u = new SpeechSynthesisUtterance(remaining)
    u.rate = rate
    u.voice = getFemaleVoice()

    // Track character position for resume
    u.onboundary = (e) => {
      if (e.name === 'word') setCharIndex(fromChar + e.charIndex)
    }
    u.onend   = () => { setPlaying(false); setPaused(false); setCharIndex(0) }
    u.onerror = () => { setPlaying(false); setPaused(false) }

    utterRef.current = u
    window.speechSynthesis.speak(u)
    setPlaying(true); setPaused(false)
  }

  const handlePlay = () => {
    if (playing && !paused) {
      window.speechSynthesis.pause()
      setPaused(true)
      return
    }
    if (paused) {
      // Resume from where we paused — some browsers don't support resume(), so re-speak from char
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume()
        setPaused(false)
      } else {
        speakFrom(overviewRef.current, charIndex, speed)
      }
      return
    }
    setCharIndex(0)
    speakFrom(overviewRef.current, 0, speed)
  }

  const handleStop = () => stopAll()

  const changeSpeed = (s) => {
    setSpeed(s)
    if (playing && !paused) {
      // Capture current char position before cancel clears it
      const currentPos = charIndex
      window.speechSynthesis.cancel()
      // Small delay to let cancel complete, then resume from same spot
      setTimeout(() => speakFrom(overviewRef.current, currentPos, s), 80)
    }
    // If paused, just update speed — it will use new speed on resume
  }

  const inputStyle = { background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:14, padding:'10px 14px', color:t.text, fontSize:13, fontFamily:'Inter,sans-serif', outline:'none' }

  return (
    <div style={{ minHeight:'100vh', background:t.bg }}>
      <Header title="Voice Overview" subtitle="Listen to your notes" back />
      <div style={{ padding:'8px 16px 100px', display:'flex', flexDirection:'column', gap:18 }}>

        <p style={{ fontSize:11,color:t.textMuted,fontWeight:600,textTransform:'uppercase',letterSpacing:'1.2px',fontFamily:'Inter,sans-serif' }}>Select Note</p>
        <div style={{ display:'flex',gap:8,overflowX:'auto',paddingBottom:4 }}>
          {notes.length===0&&<p style={{ fontSize:13,color:t.textMuted,fontFamily:'Inter,sans-serif' }}>No notes yet</p>}
          {notes.map(note=>(
            <button key={note.id} onClick={()=>generate(note)} style={{
              padding:'8px 16px',borderRadius:20,flexShrink:0,fontFamily:'Inter,sans-serif',
              background:selectedNote?.id===note.id?t.text:t.inputBg,
              border:`1px solid ${selectedNote?.id===note.id?t.text:t.border}`,
              color:selectedNote?.id===note.id?t.bg:t.textSec,
              fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',
              position:'relative',
            }}>
              {note.title}
              {getCachedOverview(note.id)&&<span style={{ position:'absolute',top:4,right:4,width:5,height:5,borderRadius:'50%',background:t.teal,flexShrink:0 }} />}
            </button>
          ))}
        </div>

        {loading&&(
          <div style={{ textAlign:'center',padding:'40px 0' }}>
            <div style={{ fontSize:28,display:'inline-block',animation:'spin 1.5s linear infinite',marginBottom:10,color:t.text }}>◌</div>
            <p style={{ fontSize:13,color:t.textMuted,fontFamily:'Inter,sans-serif' }}>Generating overview...</p>
          </div>
        )}

        {overview&&!loading&&(
          <>
            <div style={{ background:t.card,border:`1px solid ${t.border}`,borderRadius:20,padding:'20px 18px',boxShadow:t.shadowSm }}>
              <p style={{ fontSize:11,color:t.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',marginBottom:12,fontFamily:'Inter,sans-serif' }}>AI Overview</p>
              <p style={{ fontSize:14,color:t.textSec,lineHeight:1.75,fontFamily:'Inter,sans-serif' }}>{overview}</p>
            </div>

            {/* Speed selector */}
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <span style={{ fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif',width:42,flexShrink:0 }}>Speed</span>
              {SPEEDS.map(s=>(
                <button key={s} onClick={()=>changeSpeed(s)} style={{ flex:1,padding:'8px 4px',borderRadius:10,fontFamily:'Inter,sans-serif',background:speed===s?t.text:t.inputBg,border:`1px solid ${speed===s?t.text:t.border}`,color:speed===s?t.bg:t.textSec,fontSize:11,fontWeight:600,cursor:'pointer',transition:'all 0.2s' }}>{s}x</button>
              ))}
            </div>

            {/* Playback controls */}
            <div style={{ display:'flex',gap:10 }}>
              {playing&&(
                <button onClick={handleStop} style={{ flex:1,padding:'14px',borderRadius:16,background:t.redBg,border:`1px solid ${t.red}30`,color:t.red,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif' }}>■ Stop</button>
              )}
              <button onClick={handlePlay} style={{
                flex:2,padding:'16px',borderRadius:16,fontFamily:'Inter,sans-serif',
                background:playing&&!paused
                  ?t.inputBg
                  :'linear-gradient(135deg,rgba(244,114,182,0.85),rgba(236,72,153,0.65))',
                border:playing&&!paused?`1px solid ${t.border}`:'none',
                color:playing&&!paused?t.textSec:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',transition:'all 0.2s',
              }}>
                {playing&&!paused?'⏸ Pause':paused?'▶ Resume':'▶ Play Overview'}
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}