// ── StudyMate Notification Service ───────────────────────────────────────
//
//  WHY THE OLD VERSION DIDN'T WORK:
//    • new Notification() only works while the browser tab is open & focused
//    • setTimeout gets killed when Android closes the app/tab
//
//  HOW THIS VERSION WORKS:
//    • All notifications go through registration.showNotification() via the
//      Service Worker — this works even when the app is fully closed
//    • Scheduling sends a SCHEDULE_NOTIFICATION message to the SW, which
//      stores the alarm in IndexedDB and re-arms it on every SW restart

// ── PERMISSION ───────────────────────────────────────────────────────────

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied')  return 'denied'
  return await Notification.requestPermission()
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

// ── CORE: show a notification NOW via the Service Worker ─────────────────
export async function showNotification(title, body, options = {}) {
  if (Notification.permission !== 'granted') return

  const payload = {
    body,
    icon:     '/icons/icon-192x192.png',
    badge:    '/icons/icon-72x72.png',
    vibrate:  [200, 100, 200],
    tag:      options.tag      || 'studymate',
    renotify: options.renotify !== undefined ? options.renotify : false,
    data:     { url: '/' },
  }

  const reg = await getRegistration()
  if (reg) {
    return reg.showNotification(title, payload)
  }
  // Fallback for desktop browsers without SW
  const n = new Notification(title, { body: payload.body, icon: payload.icon, tag: payload.tag })
  n.onclick = () => { window.focus(); n.close() }
}

// ── CORE: schedule a future notification via the SW ───────────────────────
async function scheduleViaWorker({ id, title, body, tag, fireAt }) {
  const reg = await getRegistration()
  if (!reg?.active) return false
  reg.active.postMessage({ type: 'SCHEDULE_NOTIFICATION', id, title, body, tag, fireAt })
  return true
}

async function cancelViaWorker(id) {
  const reg = await getRegistration()
  reg?.active?.postMessage({ type: 'CANCEL_NOTIFICATION', id })
}

async function getRegistration() {
  if (!('serviceWorker' in navigator)) return null
  try { return await navigator.serviceWorker.ready } catch { return null }
}

// ── Schedule at a Date — uses SW + localStorage fallback ─────────────────
async function scheduleAt({ id, title, body, tag, targetDate }) {
  const fireAt = targetDate.getTime()
  if (fireAt <= Date.now()) return

  // SW path — survives app close
  await scheduleViaWorker({ id, title, body, tag, fireAt })

  // Also set a local setTimeout as fallback (fires if app is open)
  const key = `sm_notif_${id}`
  const existing = localStorage.getItem(key)
  if (existing) clearTimeout(Number(existing))
  const delay = fireAt - Date.now()
  const tid = setTimeout(() => {
    showNotification(title, body, { tag, renotify: true })
    localStorage.removeItem(key)
  }, delay)
  localStorage.setItem(key, String(tid))
}

function cancelScheduled(id) {
  cancelViaWorker(id)
  const key = `sm_notif_${id}`
  const tid = localStorage.getItem(key)
  if (tid) { clearTimeout(Number(tid)); localStorage.removeItem(key) }
}

// ─────────────────────────────────────────────────────────────────────────
// 1. STREAK REMINDER — daily at 8 pm
// ─────────────────────────────────────────────────────────────────────────
export async function scheduleStreakReminder(streak = 0) {
  if (Notification.permission !== 'granted') return
  cancelScheduled('streak-daily')

  const target = new Date()
  target.setHours(20, 0, 0, 0)
  if (target <= new Date()) target.setDate(target.getDate() + 1)

  await scheduleAt({
    id:    'streak-daily',
    title: streak > 0 ? `🔥 Keep your ${streak}-day streak!` : '📚 Time to study!',
    body:  streak > 0
      ? `You've studied ${streak} days in a row. Don't break the chain!`
      : "You haven't studied today. Even 10 minutes makes a difference!",
    tag:        'streak-reminder',
    targetDate: target,
  })
}

export function cancelStreakReminder() { cancelScheduled('streak-daily') }

// ─────────────────────────────────────────────────────────────────────────
// 2. TIMER DONE — called when Pomodoro ends
// ─────────────────────────────────────────────────────────────────────────
export function notifyTimerDone(mode, minutes) {
  const msgs = {
    timer: { title: '✦ Focus session complete!', body: `${minutes} min of deep focus. Take a break!` },
    short: { title: '☕ Short break over!',       body: 'Time to get back to studying.' },
    long:  { title: '🌿 Long break over!',        body: 'Refreshed? Time to focus again.' },
  }
  const m = msgs[mode] || msgs.timer
  showNotification(m.title, m.body, { tag: 'timer-done', renotify: true })
}

// ─────────────────────────────────────────────────────────────────────────
// 3. TASK REMINDER — X minutes before a task's time
// ─────────────────────────────────────────────────────────────────────────
export async function scheduleTaskReminder(task, minutesBefore = 10) {
  if (Notification.permission !== 'granted' || !task?.time || !task?.date) return
  const [h, m] = task.time.split(':').map(Number)
  const taskDate = new Date(task.date)
  taskDate.setHours(h, m, 0, 0)
  const fireDate = new Date(taskDate.getTime() - minutesBefore * 60 * 1000)
  if (fireDate <= new Date()) return
  await scheduleAt({
    id:         `task-${task.id}`,
    title:      `📋 Task in ${minutesBefore} min`,
    body:       `"${task.title}" starts at ${task.time}`,
    tag:        `task-${task.id}`,
    targetDate: fireDate,
  })
}

export function cancelTaskReminder(taskId) { cancelScheduled(`task-${taskId}`) }

// ─────────────────────────────────────────────────────────────────────────
// 4. DAILY GOAL REMINDER
// ─────────────────────────────────────────────────────────────────────────
export async function scheduleDailyGoalReminder(goalMins = 60, studiedMins = 0, hour = 19) {
  if (Notification.permission !== 'granted' || studiedMins >= goalMins) return
  cancelScheduled('daily-goal')
  const target = new Date()
  target.setHours(hour, 0, 0, 0)
  if (target <= new Date()) target.setDate(target.getDate() + 1)
  await scheduleAt({
    id: 'daily-goal',
    title: '🎯 Daily goal check-in',
    body: `${goalMins - studiedMins} more minutes to hit your ${goalMins}-min goal today!`,
    tag: 'daily-goal',
    targetDate: target,
  })
}

export function cancelDailyGoalReminder() { cancelScheduled('daily-goal') }

// ─────────────────────────────────────────────────────────────────────────
// 5. BREAK REMINDER
// ─────────────────────────────────────────────────────────────────────────
export async function startBreakReminder(afterMinutes = 45) {
  if (Notification.permission !== 'granted') return
  cancelScheduled('break-reminder')
  await scheduleAt({
    id: 'break-reminder',
    title: '😌 Take a break!',
    body: `You've been studying for ${afterMinutes} minutes. Rest your eyes for 5 min.`,
    tag: 'break-reminder',
    targetDate: new Date(Date.now() + afterMinutes * 60 * 1000),
  })
}

export function cancelBreakReminder() { cancelScheduled('break-reminder') }

// ─────────────────────────────────────────────────────────────────────────
// 6. MILESTONE
// ─────────────────────────────────────────────────────────────────────────
export function notifyMilestone(type, value) {
  const map = {
    streak_7:   { title: '🔥 7-Day Streak!',    body: 'A whole week of consistent studying!' },
    streak_30:  { title: '🏆 30-Day Streak!',   body: 'One month of daily study. Incredible!' },
    streak_100: { title: '💎 100-Day Streak!',  body: "You're in the top 1% of learners!" },
    test_100:   { title: '🎯 Perfect Score!',   body: 'You scored 100%! Absolutely flawless.' },
    focus_60:   { title: '⏱ 1 Hour of Focus!', body: `${value || 60} minutes of deep work today!` },
  }
  const m = map[type]
  if (m) showNotification(m.title, m.body, { tag: `milestone-${type}` })
}

// ─────────────────────────────────────────────────────────────────────────
// CANCEL ALL
// ─────────────────────────────────────────────────────────────────────────
export function cancelAllNotifications() {
  ['streak-daily', 'daily-goal', 'break-reminder'].forEach(cancelScheduled)
  Object.keys(localStorage)
    .filter(k => k.startsWith('sm_notif_task-'))
    .forEach(k => {
      clearTimeout(Number(localStorage.getItem(k)))
      localStorage.removeItem(k)
      cancelViaWorker(k.replace('sm_notif_', ''))
    })
}