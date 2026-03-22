// Background AI cache — pre-generates overview, flashcards, mindmap for notes
// Stored in localStorage so they load instantly

const PREFIX = 'studymate_ai_cache_'
const CACHE_TTL = 1000 * 60 * 60 * 24 * 7  // 7 days

function cacheKey(noteId, type) {
  return `${PREFIX}${noteId}_${type}`
}

function setCache(noteId, type, data) {
  try {
    localStorage.setItem(cacheKey(noteId, type), JSON.stringify({
      data,
      ts: Date.now(),
      noteId,
      type,
    }))
  } catch (e) {
    // localStorage full — clear old caches
    clearOldCaches()
  }
}

function getCache(noteId, type) {
  try {
    const raw = localStorage.getItem(cacheKey(noteId, type))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Date.now() - parsed.ts > CACHE_TTL) {
      localStorage.removeItem(cacheKey(noteId, type))
      return null
    }
    return parsed.data
  } catch { return null }
}

function clearOldCaches() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX))
  // Sort by timestamp, remove oldest half
  const entries = keys.map(k => {
    try { return { k, ts: JSON.parse(localStorage.getItem(k))?.ts || 0 } } catch { return { k, ts: 0 } }
  }).sort((a, b) => a.ts - b.ts)
  entries.slice(0, Math.ceil(entries.length / 2)).forEach(e => localStorage.removeItem(e.k))
}

export function getCachedOverview(noteId) { return getCache(noteId, 'overview') }
export function getCachedFlashcards(noteId) { return getCache(noteId, 'flashcards') }
export function getCachedMindMap(noteId) { return getCache(noteId, 'mindmap') }
export function getCachedQuestions(noteId) { return getCache(noteId, 'questions') }

export function invalidateCache(noteId) {
  ['overview','flashcards','mindmap','questions'].forEach(type => {
    localStorage.removeItem(cacheKey(noteId, type))
  })
}

// Background generation — called after a note is saved
// Uses a short delay so it doesn't block the UI
export async function backgroundGenerateForNote(note, aiService) {
  if (!note?.id || !note?.content || note.content.trim().length < 30) return

  const noteId = note.id
  const content = note.content
  const title = note.title || 'Note'

  // Stagger the requests to not hammer the API
  const generate = async (type, fn, delay) => {
    await new Promise(r => setTimeout(r, delay))
    const existing = getCache(noteId, type)
    if (existing) return  // already cached and fresh
    try {
      const result = await fn()
      if (result) setCache(noteId, type, result)
    } catch (e) {
      // silent fail — cache generation is best-effort
    }
  }

  // Run in background — don't await
  generate('overview',   () => aiService.generateVoiceOverview(content), 500)
  generate('flashcards', () => aiService.generateFlashcards(content), 3000)
  generate('mindmap',    () => aiService.generateMindMap(content, title), 6000)
  generate('questions',  () => aiService.generateQuestionsFromText(content), 9000)
}