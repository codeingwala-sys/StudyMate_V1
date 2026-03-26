import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { upsertNote, deleteNoteRemote, upsertTask, deleteTaskRemote, upsertSession, pullFromCloud, pushAllToCloud } from '../services/supabase'

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

function calcPersonalBests(sessions, testResults) {
  const byDay = {}
  sessions.forEach(s => {
    const d = s.date?.slice(0,10)
    if (d) byDay[d] = (byDay[d]||0) + (s.duration||0)
  })
  const bestDayMins = Math.max(0, ...Object.values(byDay))
  const bestScore   = testResults.length ? Math.max(...testResults.map(r => r.score||0)) : 0
  return { bestDayMins, bestScore }
}

export const useAppStore = create(
  persist(
    (set, get) => ({
      streak:        0,
      todayStudied:  0,
      lastStreakDate:null,
      syncing:       false,
      lastSyncedAt:  null,

      goals: { dailyMins: 60, weeklyTests: 3, streakTarget: 30 },
      updateGoals: (data) => set(s => ({ goals: { ...s.goals, ...data } })),
      personalBests: { bestDayMins: 0, bestScore: 0 },

      user: { name: 'Student' },
      setUser: (user) => set({ user }),

      // ── NOTES ──────────────────────────────────────────────────────────────
      notes: [],

      addNote: (note) => {
        const n = { createdAt: new Date().toISOString(), ...note }
        set(s => ({ notes: [n, ...s.notes.filter(x => x.id !== note.id)] }))
        upsertNote(n).catch(() => {})
      },

      updateNote: (id, data) => {
        set(s => ({
          notes: s.notes.map(n => {
            if (n.id !== id) return n
            const safe = { ...data }
            if (!safe.content?.trim() && n.content?.trim()) delete safe.content
            if (!safe.html?.trim()    && n.html?.trim())    delete safe.html
            if (!safe.title?.trim()   && n.title?.trim())   delete safe.title
            return { ...n, ...safe }
          })
        }))
        const updated = get().notes.find(n => n.id === id)
        if (updated) upsertNote(updated).catch(() => {})
      },

      deleteNote: (id) => {
        set(s => ({ notes: s.notes.filter(n => n.id !== id) }))
        deleteNoteRemote(id).catch(() => {})
      },

      // ── TASKS ───────────────────────────────────────────────────────────────
      tasks: [],

      addTask: (task) => {
        const t = { ...task, id: String(Date.now()), done: false }
        set(s => ({ tasks: [...s.tasks, t] }))
        upsertTask(t).catch(() => {})
      },

      toggleTask: (id) => {
        set(s => ({ tasks: s.tasks.map(t => t.id===id ? { ...t, done:!t.done } : t) }))
        const t = get().tasks.find(t => t.id === id)
        if (t) upsertTask(t).catch(() => {})
      },

      deleteTask: (id) => {
        set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }))
        deleteTaskRemote(id).catch(() => {})
      },

      // ── SESSIONS ────────────────────────────────────────────────────────────
      timerSessions: [],

      addSession: (session) => {
        const withId = { ...session, id: String(session.id || Date.now()) }
        set(s => {
          const newSessions = [withId, ...s.timerSessions]
          const { streak, todayStudied } = calcStreakAndToday(newSessions)
          const personalBests = calcPersonalBests(newSessions, s.testResults)
          return { timerSessions: newSessions, streak, todayStudied, lastStreakDate: today(), personalBests }
        })
        upsertSession(withId).catch(() => {})
      },

      refreshStreak: () => set(s => {
        const { streak, todayStudied } = calcStreakAndToday(s.timerSessions)
        const personalBests = calcPersonalBests(s.timerSessions, s.testResults)
        return { streak, todayStudied, lastStreakDate: today(), personalBests }
      }),

      // ── CLOUD SYNC ──────────────────────────────────────────────────────────
      syncFromCloud: async () => {
        set({ syncing: true })
        try {
          const cloud = await pullFromCloud()
          if (!cloud) { set({ syncing: false }); return }

          set(s => {
            // Merge: cloud wins for same ID, keep local-only items
            const merge = (cloud, local, key = 'id') => {
              const map = {}
              ;(local || []).forEach(x => { map[x[key]] = x })
              ;(cloud  || []).forEach(x => { map[x[key]] = x }) // cloud overwrites
              return Object.values(map)
            }

            const mergedNotes = merge(cloud.notes, s.notes)
            const mergedTasks = merge(cloud.tasks, s.tasks)
            const mergedSess  = merge(cloud.sessions, s.timerSessions)
            const { streak, todayStudied } = calcStreakAndToday(mergedSess)
            const personalBests = calcPersonalBests(mergedSess, s.testResults)

            return {
              notes:         mergedNotes,
              tasks:         mergedTasks,
              timerSessions: mergedSess,
              streak, todayStudied, personalBests,
              lastSyncedAt:  new Date().toISOString(),
              syncing:       false,
            }
          })

          // Push any local-only items back up
          const store = get()
          await pushAllToCloud(store).catch(() => {})
        } catch (e) {
          console.error('Sync error:', e)
          set({ syncing: false })
        }
      },

      // ── MISC ────────────────────────────────────────────────────────────────
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