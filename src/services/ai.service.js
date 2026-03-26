// FREE API — No credit card. Get key at: console.groq.com → API Keys
// Set your Groq API key here (free at console.groq.com)
export const API_KEY = (import.meta.env.VITE_GROQ_API_KEY || '').trim().replace(/^["']|["']$/g, '')

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

async function callGroq(systemPrompt, userMessage, maxTokens = 1024) {
  if (!API_KEY || API_KEY.length < 10) {
    throw new Error('Groq API Key is missing or too short. Please check your .env file.')
  }
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature: 0.4,
    }),
  })
  if (!response.ok) {
    console.error(`Groq API Error: ${response.status}`, {
      keyPrefix: API_KEY ? API_KEY.slice(0, 10) + '...' : 'MISSING',
      keySuffix: API_KEY ? '...' + API_KEY.slice(-4) : 'MISSING'
    })
    if (response.status === 401) {
      throw new Error(`Invalid Groq API Key. If you just updated .env, please RESTART YOUR DEV SERVER and verify the key at console.groq.com.`)
    }
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `Groq API error ${response.status}`)
  }
  const data = await response.json()
  return (data.choices?.[0]?.message?.content || '').replace(/```json\n?|```\n?/g, '').trim()
}

export async function generateQuestionsFromText(text, count, difficulty = 'medium') {
  // Adaptive count based on content length if not specified
  if (!count) {
    const words = text.trim().split(/\s+/).length
    count = words < 100 ? 5 : words < 300 ? 8 : words < 600 ? 12 : 15
  }
  // Random seed phrase makes Groq generate different questions each call
  const seed = Math.random().toString(36).slice(2, 8)
  const system = `You are a study assistant (session: ${seed}). Generate exactly ${count} DIFFERENT ${difficulty} MCQ questions from the provided notes.
Every call must produce UNIQUE questions — vary the focus, angle, and specific details tested each time.
Return ONLY a valid JSON array — no explanation, no markdown fences:
[{"q":"question","options":["A","B","C","D"],"answer":0,"explanation":"why correct"}]
answer = index 0-3 of correct option. Base questions strictly on the given text.`
  const raw = await callGroq(system, `Create ${count} unique MCQs (seed:${seed}) from:\n\n${text}`, 2000)
  try {
    const parsed = JSON.parse(raw)
    // Shuffle the array for extra variety
    return parsed.sort(() => Math.random() - 0.5)
  } catch { return [] }
}

export async function generateSmartTest(subject, topics, weakAreas, difficulty, customTopic = '') {
  const focus = customTopic || topics.join(', ')
  const seed = Math.random().toString(36).slice(2, 8)
  const system = `Generate MCQ questions on: ${focus}. Difficulty: ${difficulty}. Session: ${seed}.
Produce UNIQUE, VARIED questions each time — different aspects, angles, and subtopics.
Return ONLY valid JSON array:
[{"q":"question","options":["A","B","C","D"],"answer":0,"explanation":"why","topic":"${focus}","source":"Original"}]`
  const raw = await callGroq(system, `Generate varied test (seed:${seed}) on: ${focus}`, 3000)
  try { return JSON.parse(raw).sort(() => Math.random() - 0.5) } catch { return [] }
}

export async function generateVoiceOverview(text) {
  const system = `Summarize these notes in 3-5 crisp sentences only. Be direct and simple.
Focus only on the most important points. No filler, no repetition, no markdown.
Write as if texting a quick reminder to a student — short, clear, memorable.`
  return await callGroq(system, `Quick summary of:\n\n${text}`, 300)
}

export async function generateMindMap(text, title) {
  const system = `You are a study mind map generator. Analyse the provided text and create a structured mind map.
The subject could be anything: science, history, geography, economics, literature, arts, commerce, law, etc.
Identify the main themes and supporting details from the actual content.

Return ONLY this exact JSON structure — no markdown, no explanation, nothing else:
{"center":"${title}","branches":[{"label":"Main Theme 1","children":["key point","key point","key point"]},{"label":"Main Theme 2","children":["key point","key point"]},{"label":"Main Theme 3","children":["key point","key point","key point"]},{"label":"Main Theme 4","children":["key point","key point"]}]}

Rules:
- Use the actual content from the text to fill in branches and children
- Label branches with the real topics found in the text
- Keep children concise (3-6 words each)
- Always return exactly this JSON shape with at least 3 branches
- Never return empty children arrays`

  const raw = await callGroq(system, `Create mind map from this content:\n\n${text}`, 1200)
  try {
    // strip any accidental markdown
    const cleaned = raw.replace(/^[^{]*/, '').replace(/[^}]*$/, '')
    const parsed = JSON.parse(cleaned)
    if (!parsed.branches?.length) throw new Error('empty')
    // ensure all children are strings
    parsed.branches = parsed.branches.map(b => ({
      ...b,
      children: (Array.isArray(b.children) ? b.children : [b.children])
        .filter(Boolean)
        .map(c => String(c))
    }))
    return parsed
  } catch {
    return { center: title || 'Topic', branches: [{ label: 'Key Concepts', children: ['Could not parse — try regenerating'] }] }
  }
}

export async function generateFlashcards(text, count) {
  // Adaptive count based on content length if not specified
  if (!count) {
    const words = text.trim().split(/\s+/).length
    count = words < 100 ? 5 : words < 300 ? 8 : words < 600 ? 12 : 15
  }
  const system = `Create ${count} flashcards STRICTLY from the provided text only — no general knowledge.
Return ONLY valid JSON array:
[{"front":"key term or concept from the text","back":"definition or explanation from the text"}]`
  const raw = await callGroq(system, `Create flashcards from:\n\n${text}`, 1500)
  try { return JSON.parse(raw) } catch { return [] }
}

export async function searchWithAI(query) {
  const system = 'Answer in 3-4 clear sentences. Be accurate and helpful for a student.'
  return await callGroq(system, query, 400)
}