let synth = window.speechSynthesis

export function speak(text, options = {}) {
  if (!synth) return
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = options.rate || 0.9
  u.pitch = options.pitch || 1
  u.volume = options.volume || 1
  const voices = synth.getVoices()
  const preferred = voices.find(v => v.lang === 'en-IN') || voices.find(v => v.lang.startsWith('en'))
  if (preferred) u.voice = preferred
  if (options.onStart) u.onstart = options.onStart
  if (options.onEnd) u.onend = options.onEnd
  synth.speak(u)
}

export function pause() { synth?.pause() }
export function resume() { synth?.resume() }
export function stop() { synth?.cancel() }