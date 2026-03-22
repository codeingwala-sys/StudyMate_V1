export function getWeakTopics(learningData = {}, subject) {
  const d = learningData[subject] || {}
  return Object.entries(d).filter(([, v]) => v.score < 60).sort((a, b) => a[1].score - b[1].score).map(([t]) => t)
}

export function getNextDifficulty(scores = []) {
  if (!scores.length) return 'medium'
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return avg >= 80 ? 'hard' : avg >= 50 ? 'medium' : 'easy'
}