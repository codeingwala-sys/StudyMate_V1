// ── StudyMate Service Worker ──────────────────────────────────────────────
// Uses vite-plugin-pwa injectManifest strategy.
// self.__WB_MANIFEST is replaced at build time with the precache list.

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

// Claim clients immediately on activation
clientsClaim()

// Automatically skip waiting when a new SW is installed
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

// Precache all app assets
precacheAndRoute(self.__WB_MANIFEST || [])
cleanupOutdatedCaches()

// ── SKIP WAITING + notification scheduling messages ───────────────────────
self.addEventListener('message', (event) => {
  if (!event.data) return

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }

  if (event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { id, title, body, tag, fireAt } = event.data
    scheduleAlarm({ id, title, body, tag, fireAt })
    return
  }

  if (event.data.type === 'CANCEL_NOTIFICATION') {
    cancelAlarm(event.data.id)
    return
  }
})

// ── NOTIFICATION CLICK — open/focus the app ──────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow('/')
    })
  )
})

// ── ALARM SYSTEM — IndexedDB persistence + in-memory timers ──────────────
const DB_NAME    = 'studymate-alarms'
const DB_VERSION = 1
const STORE      = 'alarms'
const activeTimers = {}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess       = e => resolve(e.target.result)
    req.onerror         = e => reject(e.target.error)
  })
}

async function scheduleAlarm({ id, title, body, tag, fireAt }) {
  try {
    const db = await openDB()
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ id, title, body, tag, fireAt })
      tx.oncomplete = res
      tx.onerror    = rej
    })
  } catch (e) { /* storage error — still arm the timer */ }
  armTimer({ id, title, body, tag, fireAt })
}

async function cancelAlarm(id) {
  if (activeTimers[id]) { clearTimeout(activeTimers[id]); delete activeTimers[id] }
  try {
    const db = await openDB()
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = res
      tx.onerror    = rej
    })
  } catch (e) { /* silent */ }
}

function armTimer({ id, title, body, tag, fireAt }) {
  const delay = fireAt - Date.now()
  if (activeTimers[id]) clearTimeout(activeTimers[id])
  if (delay <= 0) {
    fireNotification({ title, body, tag })
    cancelAlarm(id)
    return
  }
  activeTimers[id] = setTimeout(() => {
    fireNotification({ title, body, tag })
    cancelAlarm(id)
  }, delay)
}

function fireNotification({ title, body, tag }) {
  self.registration.showNotification(title, {
    body,
    tag,
    icon:     '/icons/icon-192x192.png',
    badge:    '/icons/icon-72x72.png',
    vibrate:  [300, 100, 300],
    renotify: true,
    requireInteraction: true,
    data: { url: '/' },
  })
}

// On SW activate — re-arm all stored alarms (survives SW restart / phone reboot)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    openDB()
      .then(db => new Promise((res, rej) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
        req.onsuccess = e => { (e.target.result || []).forEach(armTimer); res() }
        req.onerror   = rej
      }))
      .then(() => self.clients.claim())
      .catch(() => self.clients.claim())
  )
})