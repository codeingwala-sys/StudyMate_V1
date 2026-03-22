// Sound service — all sounds generated with Web Audio API (no files needed)
// Works offline, no external dependencies

let _ctx = null
const getCtx = () => {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)()
  return _ctx
}

// Resume context if suspended (browsers require user gesture first)
const resume = async (ctx) => {
  if (ctx.state === 'suspended') await ctx.resume()
}

// ── SOUND PRIMITIVES ──

function playTone(freq, type, gain, startTime, duration, ctx, fadeOut = true) {
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.connect(amp); amp.connect(ctx.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freq, startTime)
  amp.gain.setValueAtTime(gain, startTime)
  if (fadeOut) amp.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.01)
}

// ── EXPORTED SOUNDS ──

// 1. Timer START — soft rising chime (encouraging, warm)
export async function playTimerStart() {
  try {
    const ctx = getCtx(); await resume(ctx)
    const now = ctx.currentTime
    // Soft ding-ding-ding ascending
    const notes = [523.25, 659.25, 783.99]  // C5, E5, G5
    notes.forEach((freq, i) => {
      playTone(freq, 'sine', 0.18, now + i * 0.12, 0.5, ctx)
      // Soft harmonic
      playTone(freq * 2, 'sine', 0.04, now + i * 0.12, 0.4, ctx)
    })
  } catch {}
}

// 2. 90% WARNING — gentle pulse (heads up, not jarring)
export async function playWarning90() {
  try {
    const ctx = getCtx(); await resume(ctx)
    const now = ctx.currentTime
    // Two medium pings — noticeable but not harsh
    const freq = 880  // A5
    for (let i = 0; i < 3; i++) {
      playTone(freq, 'sine', 0.22, now + i * 0.22, 0.18, ctx)
      playTone(freq * 0.5, 'sine', 0.08, now + i * 0.22, 0.18, ctx)
    }
  } catch {}
}

// 3. Timer DONE — celebratory chime sequence
export async function playTimerDone() {
  try {
    const ctx = getCtx(); await resume(ctx)
    const now = ctx.currentTime
    // C major arpeggio up then chord
    const melody = [523.25, 659.25, 783.99, 1046.50]  // C5 E5 G5 C6
    melody.forEach((freq, i) => {
      playTone(freq, 'sine', 0.20, now + i * 0.10, 0.6, ctx)
    })
    // Final chord hit
    ;[523.25, 659.25, 783.99].forEach(freq => {
      playTone(freq, 'sine', 0.12, now + 0.45, 1.0, ctx)
    })
  } catch {}
}

// 4. Break START — calm gentle tone
export async function playBreakStart() {
  try {
    const ctx = getCtx(); await resume(ctx)
    const now = ctx.currentTime
    // Soft descending (relax)
    const notes = [659.25, 587.33, 523.25]  // E5, D5, C5
    notes.forEach((freq, i) => {
      playTone(freq, 'sine', 0.14, now + i * 0.15, 0.55, ctx)
    })
  } catch {}
}