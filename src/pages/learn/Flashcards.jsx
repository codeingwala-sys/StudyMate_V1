import { useState, useEffect } from 'react'
import { useTheme } from '../../app/useTheme'
import { useAppStore } from '../../app/store'
import { generateFlashcards } from '../../services/ai.service'
import { getCachedFlashcards, backgroundGenerateForNote } from '../../services/aiCache.service'
import * as aiService from '../../services/ai.service'
import Header from '../../components/layout/Header'

export default function Flashcards() {
  const { isDark, t } = useTheme()
  const { notes } = useAppStore()
  const [cards, setCards]       = useState([])
  const [idx, setIdx]           = useState(0)
  const [flipped, setFlipped]   = useState(false)
  const [known, setKnown]       = useState([])
  const [unknown, setUnknown]   = useState([])
  const [done, setDone]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [selectedNote, setSelected] = useState(null)
  const [error, setError]       = useState('')

  const { notes: allNotes } = useAppStore()
  useEffect(() => {
    allNotes.forEach((n, i) => setTimeout(() => backgroundGenerateForNote(n, aiService), i * 2000))
  }, []) // eslint-disable-line

  const generate = async (note) => {
    if (!note.content || note.content.trim().length < 20) {
      setError('This note has no content yet. Open and write some notes first.'); return
    }
    setLoading(true); setSelected(note); setError('')
    const fc = getCachedFlashcards(note.id) || await generateFlashcards(note.content, 8)
    if (!fc.length) { setError('Could not generate flashcards. Try adding more content.'); setLoading(false); return }
    setCards(fc); setIdx(0); setFlipped(false); setKnown([]); setUnknown([]); setDone(false)
    setLoading(false)
  }

  const answer = (knows) => {
    if (knows) setKnown(k => [...k, idx]); else setUnknown(u => [...u, idx])
    if (idx + 1 >= cards.length) setDone(true)
    else { setIdx(i => i + 1); setFlipped(false) }
  }

  if (done) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '0 28px', gap: 24, textAlign: 'center' }}>
      <p style={{ fontSize: 56, lineHeight: 1 }}>{known.length >= cards.length * 0.8 ? '🎉' : '📚'}</p>
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: '-0.5px', marginBottom: 16, fontFamily: 'Inter,sans-serif' }}>Session Complete</h2>
        <div style={{ display: 'flex', gap: 40, justifyContent: 'center' }}>
          <div><p style={{ fontSize: 36, fontWeight: 800, color: '#4ade80', letterSpacing: '-0.5px', fontFamily: 'Inter,sans-serif' }}>{known.length}</p><p style={{ fontSize: 12, color: t.textMuted, marginTop: 4, fontFamily: 'Inter,sans-serif' }}>Knew it</p></div>
          <div style={{ width: 1, background: t.border }} />
          <div><p style={{ fontSize: 36, fontWeight: 800, color: '#f87171', letterSpacing: '-0.5px', fontFamily: 'Inter,sans-serif' }}>{unknown.length}</p><p style={{ fontSize: 12, color: t.textMuted, marginTop: 4, fontFamily: 'Inter,sans-serif' }}>Review</p></div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 8 }}>
        <button onClick={() => { setIdx(0); setFlipped(false); setKnown([]); setUnknown([]); setDone(false) }} style={{ flex: 1, padding: '14px', borderRadius: 14, background: t.inputBg, border: 'none', color: t.text, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Retry</button>
        <button onClick={() => { setCards([]); setSelected(null) }} style={{ flex: 1, padding: '14px', borderRadius: 14, background: '#fff', border: 'none', color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>New Deck</button>
      </div>
    </div>
  )

  if (!cards.length || !selectedNote) return (
    <div style={{ minHeight: '100vh' }}>
      <Header title="Flashcards" subtitle="From your notes" back />
      <div style={{ padding: '8px 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {error && <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 12, padding: '12px 14px', color: '#f87171', fontSize: 13, fontFamily: 'Inter,sans-serif' }}>{error}</div>}
        {loading && <div style={{ textAlign: 'center', padding: '60px 20px' }}><div style={{ fontSize: 32, display: 'inline-block', animation: 'spin 1.5s linear infinite', marginBottom: 12, color: t.text }}>◌</div><p style={{ fontSize: 14, color: t.textMuted, fontFamily: 'Inter,sans-serif' }}>Generating flashcards...</p></div>}
        {!loading && (
          <>
            <p style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 4, fontFamily: 'Inter,sans-serif' }}>Choose a note</p>
            {notes.length === 0
              ? <p style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', padding: '32px 0', fontFamily: 'Inter,sans-serif' }}>Add notes first</p>
              : notes.map(note => (
                <div key={note.id} className="pressable" onClick={() => generate(note)} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: '16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 3, fontFamily: 'Inter,sans-serif' }}>{note.title}</p>
                    <p style={{ fontSize: 11, color: t.textMuted, fontFamily: 'Inter,sans-serif' }}>{note.content?.split(' ').length || 0} words · {note.tags?.join(', ') || 'No tags'}</p>
                  </div>
                  <span style={{ color: t.textMuted, fontSize: 18 }}>›</span>
                </div>
              ))
            }
          </>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const card = cards[idx]
  return (
    <div style={{ minHeight: '100vh' }}>
      <Header title="Flashcards" subtitle={selectedNote.title} back />
      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', gap: 3, width: '100%' }}>
          {cards.map((_, i) => <div key={i} style={{ flex: 1, height: 2, borderRadius: 1, background: i < idx ? t.text : i === idx ? t.borderStrong : t.inputBg, transition: 'all 0.3s' }} />)}
        </div>
        <p style={{ fontSize: 12, color: t.textMuted, fontWeight: 500, fontFamily: 'Inter,sans-serif' }}>{idx + 1} / {cards.length}</p>
        <div onClick={() => setFlipped(f => !f)} className="pressable" style={{ width: '100%', minHeight: 240, borderRadius: 24, padding: '32px 24px', background: flipped ? t.inputBgF : t.card, border: `1px solid ${flipped ? t.borderMed : t.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: 'pointer', position: 'relative' }}>
          <p style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16, fontFamily: 'Inter,sans-serif' }}>{flipped ? 'Answer' : 'Question'}</p>
          <p style={{ fontSize: 17, fontWeight: 600, color: t.text, lineHeight: 1.5, letterSpacing: '-0.2px', fontFamily: 'Inter,sans-serif' }}>{flipped ? card.back : card.front}</p>
          <p style={{ position: 'absolute', bottom: 14, fontSize: 11, color: t.textFaint, fontFamily: 'Inter,sans-serif' }}>tap to flip</p>
        </div>
        {flipped ? (
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button onClick={() => answer(false)} style={{ flex: 1, padding: '14px', borderRadius: 14, background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>✗ Don't know</button>
            <button onClick={() => answer(true)} style={{ flex: 1, padding: '14px', borderRadius: 14, background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>✓ Got it!</button>
          </div>
        ) : <p style={{ fontSize: 13, color: t.textMuted, fontFamily: 'Inter,sans-serif' }}>Tap to reveal the answer</p>}
      </div>
    </div>
  )
}