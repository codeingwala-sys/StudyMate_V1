import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const today     = () => new Date().toISOString().slice(0, 10)
const yesterday = () => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10) }

function calcStreakAndToday(sessions = []) {
  const todayStr     = today()
  const todayStudied = sessions.filter(s => s.date?.slice(0,10) === todayStr).reduce((sum,s) => sum+(s.duration||0), 0)
  const studyDays    = new Set(sessions.filter(s => (s.duration||0)>=1).map(s => s.date?.slice(0,10)).filter(Boolean))
  let streak = 0
  const startDay = studyDays.has(todayStr) ? todayStr : yesterday()
  if (!studyDays.has(startDay)) return { streak: 0, todayStudied }
  let cursor = new Date(startDay)
  while (true) {
    const dayStr = cursor.toISOString().slice(0,10)
    if (!studyDays.has(dayStr)) break
    streak++
    cursor.setDate(cursor.getDate()-1)
    if (streak > 3650) break
  }
  return { streak, todayStudied }
}

// Compute personal bests from sessions + testResults
function calcPersonalBests(sessions, testResults) {
  // Best single-day focus
  const byDay = {}
  sessions.forEach(s => {
    const d = s.date?.slice(0,10)
    if (d) byDay[d] = (byDay[d]||0) + (s.duration||0)
  })
  const bestDayMins = Math.max(0, ...Object.values(byDay))
  // Best test score
  const bestScore = testResults.length ? Math.max(...testResults.map(r => r.score||0)) : 0
  // Longest streak (computed once for display)
  return { bestDayMins, bestScore }
}

export const useAppStore = create(
  persist(
    (set, get) => ({
      streak:       0,
      todayStudied: 0,
      lastStreakDate: null,

      // Study goals
      goals: {
        dailyMins:  60,   // daily focus goal in minutes
        weeklyTests: 3,   // weekly test goal
        streakTarget: 30, // streak goal
      },
      updateGoals: (data) => set(s => ({ goals: { ...s.goals, ...data } })),

      // Personal bests
      personalBests: { bestDayMins: 0, bestScore: 0 },

      user: { name: 'Student' },
      setUser: (user) => set({ user }),

      notes: [],
      addNote: (note) => set(s => ({
        notes: [ { createdAt: new Date().toISOString(), ...note }, ...s.notes.filter(n => n.id !== note.id) ]
      })),
      updateNote: (id, data) => set(s => ({
        notes: s.notes.map(n => {
          if (n.id !== id) return n
          const safe = { ...data }
          if (!safe.content?.trim() && n.content?.trim()) delete safe.content
          if (!safe.html?.trim()    && n.html?.trim())    delete safe.html
          if (!safe.title?.trim()   && n.title?.trim())   delete safe.title
          return { ...n, ...safe }
        })
      })),
      deleteNote: (id) => set(s => ({ notes: s.notes.filter(n => n.id !== id) })),

      tasks: [],
      addTask:    (task) => set(s => ({ tasks: [...s.tasks, { ...task, id: Date.now(), done: false }] })),
      toggleTask: (id)   => set(s => ({ tasks: s.tasks.map(t => t.id===id ? { ...t, done:!t.done } : t) })),
      deleteTask: (id)   => set(s => ({ tasks: s.tasks.filter(t => t.id !== id) })),

      timerSessions: [],
      addSession: (session) => set(s => {
        const newSessions = [session, ...s.timerSessions]
        const { streak, todayStudied } = calcStreakAndToday(newSessions)
        const personalBests = calcPersonalBests(newSessions, s.testResults)
        return { timerSessions: newSessions, streak, todayStudied, lastStreakDate: today(), personalBests }
      }),

      refreshStreak: () => set(s => {
        const { streak, todayStudied } = calcStreakAndToday(s.timerSessions)
        const personalBests = calcPersonalBests(s.timerSessions, s.testResults)
        return { streak, todayStudied, lastStreakDate: today(), personalBests }
      }),

      learningData: {},
      updateLearning: (subject, topic, score) => set(s => ({
        learningData: {
          ...s.learningData,
          [subject]: { ...(s.learningData[subject]||{}), [topic]: { score, updatedAt: new Date().toISOString() } }
        }
      })),

      testResults: [],
      addTestResult: (result) => set(s => {
        const newResults = [result, ...s.testResults]
        const personalBests = calcPersonalBests(s.timerSessions, newResults)
        return { testResults: newResults, personalBests }
      }),

      settings: { pomoDuration: 25, shortBreak: 5, longBreak: 15 },
      updateSettings: (data) => set(s => ({ settings: { ...s.settings, ...data } })),
    }),
    { name: 'studymate-store' }
  )
)