// ── supabase.js ──────────────────────────────────────────────────────────────
// Real Supabase Auth (email/password) + data sync for notes, tasks, sessions
//
// ── ONE-TIME SQL SETUP (paste in Supabase → SQL Editor → Run) ────────────────
//
// -- Enable UUID extension
// create extension if not exists "uuid-ossp";
//
// -- Notes
// create table notes (
//   id text primary key,
//   user_id uuid references auth.users not null,
//   title text default '', content text default '',
//   html text default '', tags jsonb default '[]',
//   checklists jsonb default '[]', category text default '',
//   created_at timestamptz default now(), updated_at timestamptz default now()
// );
// alter table notes enable row level security;
// create policy "own notes" on notes using (auth.uid() = user_id) with check (auth.uid() = user_id);
//
// -- Tasks
// create table tasks (
//   id text primary key, user_id uuid references auth.users not null,
//   title text default '', date text, time text, done boolean default false,
//   created_at timestamptz default now()
// );
// alter table tasks enable row level security;
// create policy "own tasks" on tasks using (auth.uid() = user_id) with check (auth.uid() = user_id);
//
// -- Sessions
// create table sessions (
//   id text primary key, user_id uuid references auth.users not null,
//   duration integer default 0, type text default 'focus',
//   date text, created_at timestamptz default now()
// );
// alter table sessions enable row level security;
// create policy "own sessions" on sessions using (auth.uid() = user_id) with check (auth.uid() = user_id);
//
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || ''

export const supabaseConfigured = !!SUPABASE_URL && SUPABASE_URL !== 'YOUR_SUPABASE_URL'

// ── Auth token management ─────────────────────────────────────────────────────
function getSession() {
  try { return JSON.parse(localStorage.getItem('sb_session') || 'null') } catch { return null }
}
function setSession(s) {
  if (s) localStorage.setItem('sb_session', JSON.stringify(s))
  else localStorage.removeItem('sb_session')
}
function getToken() { return getSession()?.access_token || null }
function getUserId() { return getSession()?.user?.id || null }

// ── Core fetch helper ─────────────────────────────────────────────────────────
async function api(path, method = 'GET', body = null, isAuth = false) {
  if (!supabaseConfigured) return { data: null, error: 'Not configured' }
  const base = isAuth ? `${SUPABASE_URL}/auth/v1` : `${SUPABASE_URL}/rest/v1`
  const token = getToken()
  const headers = {
    'apikey': SUPABASE_ANON,
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : { 'Authorization': `Bearer ${SUPABASE_ANON}` }),
    ...(method === 'POST' && !isAuth ? { 'Prefer': 'resolution=merge-duplicates,return=minimal' } : {}),
  }
  try {
    const res = await fetch(`${base}${path}`, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.status === 204 || res.status === 201) return { data: true, error: null }
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error_description || json.message || json.msg || 'Error' }
    return { data: json, error: null }
  } catch (e) {
    return { data: null, error: e.message }
  }
}

// ── AUTH ──────────────────────────────────────────────────────────────────────

export async function signUp(email, password, name, metadata = {}) {
  const { data, error } = await api('/signup', 'POST', {
    email, password,
    data: { name, ...metadata },
  }, true)
  if (error) return { user: null, error }
  if (data?.access_token) {
    setSession(data)
    return { user: data.user, error: null }
  }
  // Email confirmation required
  return { user: data?.user || null, error: null, needsConfirmation: true }
}

export async function signIn(email, password) {
  const { data, error } = await api('/token?grant_type=password', 'POST', {
    email, password,
  }, true)
  if (error) return { user: null, error }
  setSession(data)
  return { user: data.user, error: null }
}

export async function signOut() {
  if (getToken()) {
    await api('/logout', 'POST', {}, true).catch(() => {})
  }
  setSession(null)
  localStorage.removeItem('studymate_user')
}

export async function refreshSession() {
  const session = getSession()
  if (!session?.refresh_token) return null
  const { data, error } = await api('/token?grant_type=refresh_token', 'POST', {
    refresh_token: session.refresh_token,
  }, true)
  if (error || !data?.access_token) { setSession(null); return null }
  setSession(data)
  return data.user
}

export function getCurrentUser() {
  const s = getSession()
  if (!s?.user) return null
  return s.user
}

export function isLoggedIn() {
  const s = getSession()
  if (!s?.access_token) return false
  // Check token not expired (exp is in seconds)
  try {
    const payload = JSON.parse(atob(s.access_token.split('.')[1]))
    return payload.exp * 1000 > Date.now()
  } catch { return false }
}

// ── DATA SYNC ─────────────────────────────────────────────────────────────────

export async function fetchNotes() {
  const uid = getUserId(); if (!uid) return null
  const { data } = await api(`/notes?user_id=eq.${uid}&order=updated_at.desc`)
  return data ? data.map(n => ({
    ...n,
    tags:       typeof n.tags === 'string' ? JSON.parse(n.tags) : (n.tags || []),
    checklists: typeof n.checklists === 'string' ? JSON.parse(n.checklists) : (n.checklists || []),
    createdAt:  n.created_at,
  })) : null
}

export async function upsertNote(note) {
  const uid = getUserId(); if (!uid) return null
  return await api('/notes', 'POST', {
    id:         String(note.id),
    user_id:    uid,
    title:      note.title || '',
    content:    note.content || '',
    html:       note.html || '',
    tags:       JSON.stringify(note.tags || []),
    checklists: JSON.stringify(note.checklists || []),
    category:   note.category || '',
    updated_at: new Date().toISOString(),
  })
}

export async function deleteNoteRemote(id) {
  const uid = getUserId(); if (!uid) return null
  return await api(`/notes?id=eq.${encodeURIComponent(String(id))}&user_id=eq.${uid}`, 'DELETE')
}

export async function fetchTasks() {
  const uid = getUserId(); if (!uid) return null
  const { data } = await api(`/tasks?user_id=eq.${uid}&order=created_at.desc`)
  return data
}

export async function upsertTask(task) {
  const uid = getUserId(); if (!uid) return null
  return await api('/tasks', 'POST', {
    id:      String(task.id),
    user_id: uid,
    title:   task.title || '',
    date:    task.date || null,
    time:    task.time || null,
    done:    task.done || false,
  })
}

export async function deleteTaskRemote(id) {
  const uid = getUserId(); if (!uid) return null
  return await api(`/tasks?id=eq.${encodeURIComponent(String(id))}&user_id=eq.${uid}`, 'DELETE')
}

export async function fetchSessions() {
  const uid = getUserId(); if (!uid) return null
  const { data } = await api(`/sessions?user_id=eq.${uid}&order=created_at.desc&limit=500`)
  return data
}

export async function upsertSession(session) {
  const uid = getUserId(); if (!uid) return null
  return await api('/sessions', 'POST', {
    id:       String(session.id || Date.now()),
    user_id:  uid,
    duration: session.duration || 0,
    type:     session.type || 'focus',
    date:     session.date || new Date().toISOString().slice(0, 10),
  })
}

// ── Full sync ─────────────────────────────────────────────────────────────────
export async function pullFromCloud() {
  if (!supabaseConfigured || !getUserId()) return null
  const [notes, tasks, sessions] = await Promise.all([fetchNotes(), fetchTasks(), fetchSessions()])
  return { notes, tasks, sessions }
}

export async function pushAllToCloud(storeData) {
  if (!supabaseConfigured || !getUserId()) return
  const { notes = [], tasks = [], timerSessions = [] } = storeData
  await Promise.all([
    ...notes.map(n => upsertNote(n).catch(() => {})),
    ...tasks.map(t => upsertTask(t).catch(() => {})),
    ...timerSessions.slice(0, 200).map(s => upsertSession({ ...s, id: s.id || Date.now() }).catch(() => {})),
  ])
}