// Push notification service for StudyMate
// Handles permission, scheduling, and streak reminders

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  return result
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export function showNotification(title, body, options = {}) {
  if (Notification.permission !== 'granted') return
  const n = new Notification(title, {
    body,
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-72x72.svg',
    vibrate: [200, 100, 200],
    tag: options.tag || 'studymate',
    renotify: options.renotify || false,
    ...options,
  })
  n.onclick = () => { window.focus(); n.close() }
  return n
}

// Schedule a daily streak reminder using setTimeout
// (For real daily scheduling, we'd need a service worker — this fires after X ms)
export function scheduleStreakReminder(streak) {
  if (Notification.permission !== 'granted') return
  // Clear any existing reminder
  const existingId = localStorage.getItem('studymate_notif_timeout')
  if (existingId) clearTimeout(Number(existingId))

  // Schedule for 8pm today if not yet studied, otherwise skip
  const now = new Date()
  const target = new Date()
  target.setHours(20, 0, 0, 0)  // 8pm
  if (target <= now) target.setDate(target.getDate() + 1)  // tomorrow 8pm

  const delay = target.getTime() - now.getTime()
  const id = setTimeout(() => {
    showNotification(
      streak > 0 ? `🔥 Keep your ${streak}-day streak!` : '📚 Time to study!',
      streak > 0
        ? `You're on a ${streak}-day streak. Open StudyMate and keep it going!`
        : "You haven't studied today. Even 10 minutes makes a difference!",
      { tag: 'streak-reminder', renotify: true }
    )
  }, delay)

  localStorage.setItem('studymate_notif_timeout', String(id))
}

export function cancelStreakReminder() {
  const id = localStorage.getItem('studymate_notif_timeout')
  if (id) { clearTimeout(Number(id)); localStorage.removeItem('studymate_notif_timeout') }
}

// Timer completion notification
export function notifyTimerDone(mode, minutes) {
  const msgs = {
    timer: { title:'✦ Focus session complete!', body:`${minutes} minutes of deep focus. Take a break!` },
    short: { title:'☕ Short break over!', body:'Time to get back to studying.' },
    long:  { title:'🌿 Long break over!', body:'Refreshed? Time to focus again.' },
  }
  const m = msgs[mode] || msgs.timer
  showNotification(m.title, m.body, { tag:'timer-done', renotify:true })
}