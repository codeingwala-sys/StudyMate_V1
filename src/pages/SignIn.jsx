import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../app/store'
import { signIn, signUp, getCurrentUser, isLoggedIn, supabaseConfigured } from '../services/supabase'

export default function SignIn() {
  const navigate         = useNavigate()
  const { setUser, syncFromCloud } = useAppStore()
  const [mode,    setMode]   = useState('signin')
  const [name,    setName]   = useState('')
  const [email,   setEmail]  = useState('')
  const [pass,    setPass]   = useState('')
  const [confirm, setConfirm]= useState('')
  const [error,   setError]  = useState('')
  const [loading, setLoading]= useState(false)
  const [msg,     setMsg]    = useState('')

  // Already logged in → redirect
  useEffect(() => {
    if (isLoggedIn()) navigate('/')
  }, [])

  const afterLogin = async (user) => {
    const userData = {
      name:  user.user_metadata?.name || user.email.split('@')[0],
      email: user.email,
      id:    user.id,
    }
    localStorage.setItem('studymate_user', JSON.stringify(userData))
    setUser(userData)
    // Sync cloud data after login
    await syncFromCloud().catch(() => {})
    navigate('/')
  }

  const handle = async () => {
    setError(''); setMsg('')
    if (!email.trim())        { setError('Enter your email'); return }
    if (!pass.trim())         { setError('Enter your password'); return }
    if (pass.length < 6)      { setError('Password must be at least 6 characters'); return }
    if (mode === 'signup') {
      if (!name.trim())       { setError('Enter your name'); return }
      if (pass !== confirm)   { setError('Passwords do not match'); return }
    }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const { user, error: err, needsConfirmation } = await signUp(email.trim(), pass, name.trim())
        if (err) { setError(err); return }
        if (needsConfirmation) {
          setMsg('Check your email for a confirmation link, then sign in.')
          setMode('signin')
          return
        }
        if (user) await afterLogin(user)
      } else {
        const { user, error: err } = await signIn(email.trim(), pass)
        if (err) { setError(err === 'Invalid login credentials' ? 'Wrong email or password' : err); return }
        if (user) await afterLogin(user)
      }
    } catch (e) {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  // Offline / no Supabase — local mode
  const continueLocal = () => {
    const userData = { name: 'Student', email: '' }
    localStorage.setItem('studymate_user', JSON.stringify(userData))
    setUser(userData)
    navigate('/')
  }

  const inp = {
    background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
    borderRadius:14, padding:'14px 16px', color:'#fff', fontSize:14,
    fontFamily:'Inter,sans-serif', outline:'none', width:'100%', boxSizing:'border-box',
    transition:'border 0.2s',
  }

  return (
    <div style={{ minHeight:'100dvh', background:'#000', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', position:'relative', overflow:'hidden' }}>
      {/* Background glows */}
      <div style={{ position:'absolute', bottom:-120, left:'50%', transform:'translateX(-50%)', width:600, height:500, background:'radial-gradient(ellipse,rgba(99,102,241,0.12) 0%,transparent 70%)', pointerEvents:'none', animation:'glowPulse 8s ease-in-out infinite' }} />
      <div style={{ position:'absolute', top:-100, right:-80, width:300, height:300, background:'radial-gradient(ellipse,rgba(139,92,246,0.07) 0%,transparent 70%)', pointerEvents:'none' }} />

      <div style={{ width:'100%', maxWidth:380, position:'relative', zIndex:1 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.15))', border:'1px solid rgba(99,102,241,0.3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:28 }}>✦</div>
          <h1 style={{ fontSize:28, fontWeight:900, color:'#fff', letterSpacing:'-0.8px', fontFamily:'Inter,sans-serif', marginBottom:4 }}>StudyMate</h1>
          <p style={{ fontSize:14, color:'rgba(255,255,255,0.38)', fontFamily:'Inter,sans-serif' }}>
            {supabaseConfigured ? 'Sign in to sync across all your devices' : 'Your AI study companion'}
          </p>
        </div>

        {/* Cloud sync badge */}
        {supabaseConfigured && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:12, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.25)', marginBottom:20 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'#4ade80', flexShrink:0 }} />
            <span style={{ fontSize:12, color:'rgba(255,255,255,0.6)', fontFamily:'Inter,sans-serif' }}>
              Cloud sync enabled — notes sync across all devices
            </span>
          </div>
        )}

        {/* Mode toggle */}
        <div style={{ display:'flex', background:'rgba(255,255,255,0.05)', borderRadius:12, padding:4, marginBottom:20 }}>
          {['signin','signup'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setMsg('') }} style={{
              flex:1, padding:'9px', borderRadius:9, fontFamily:'Inter,sans-serif',
              background: mode===m ? 'rgba(255,255,255,0.12)' : 'transparent',
              border:'none', color: mode===m ? '#fff' : 'rgba(255,255,255,0.4)',
              fontSize:13, fontWeight: mode===m ? 700 : 500, cursor:'pointer', transition:'all 0.2s',
            }}>{m==='signin' ? 'Sign In' : 'Sign Up'}</button>
          ))}
        </div>

        {/* Form */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {mode === 'signup' && (
            <input placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} style={inp} />
          )}
          <input type="email" placeholder="Email address" value={email}
            onChange={e=>setEmail(e.target.value)} style={inp}
            onKeyDown={e=>e.key==='Enter'&&handle()} autoComplete="email" />
          <input type="password" placeholder="Password (min. 6 characters)" value={pass}
            onChange={e=>setPass(e.target.value)} style={inp}
            onKeyDown={e=>e.key==='Enter'&&(mode==='signin'?handle():null)} autoComplete={mode==='signup'?'new-password':'current-password'} />
          {mode === 'signup' && (
            <input type="password" placeholder="Confirm password" value={confirm}
              onChange={e=>setConfirm(e.target.value)} style={inp}
              onKeyDown={e=>e.key==='Enter'&&handle()} autoComplete="new-password" />
          )}

          {error && (
            <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.25)' }}>
              <p style={{ fontSize:13, color:'#f87171', fontFamily:'Inter,sans-serif', margin:0 }}>⚠ {error}</p>
            </div>
          )}
          {msg && (
            <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.25)' }}>
              <p style={{ fontSize:13, color:'#4ade80', fontFamily:'Inter,sans-serif', margin:0 }}>✓ {msg}</p>
            </div>
          )}

          <button onClick={handle} disabled={loading} style={{
            padding:'15px', borderRadius:14, fontFamily:'Inter,sans-serif',
            background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            border:'none', color:'#fff', fontSize:15, fontWeight:700,
            cursor: loading ? 'default' : 'pointer', marginTop:2,
            boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
            transition:'all 0.2s',
          }}>
            {loading ? '...' : mode==='signin' ? 'Sign In →' : 'Create Account →'}
          </button>
        </div>

        {/* Divider */}
        <div style={{ display:'flex', alignItems:'center', gap:12, margin:'16px 0' }}>
          <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.07)' }} />
          <span style={{ fontSize:12, color:'rgba(255,255,255,0.25)', fontFamily:'Inter,sans-serif' }}>or</span>
          <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.07)' }} />
        </div>

        <button onClick={continueLocal} style={{
          width:'100%', padding:'13px', borderRadius:14, fontFamily:'Inter,sans-serif',
          background:'transparent', border:'1px solid rgba(255,255,255,0.09)',
          color:'rgba(255,255,255,0.35)', fontSize:13, cursor:'pointer',
        }}>
          Continue without account
        </button>

        {mode === 'signin' && (
          <p style={{ textAlign:'center', fontSize:12, color:'rgba(255,255,255,0.2)', fontFamily:'Inter,sans-serif', marginTop:16 }}>
            Don't have an account?{' '}
            <span onClick={() => setMode('signup')} style={{ color:'#818cf8', cursor:'pointer', fontWeight:600 }}>Sign up free</span>
          </p>
        )}
      </div>

      <style>{`@keyframes glowPulse{0%,100%{opacity:1}50%{opacity:0.6}}`}</style>
    </div>
  )
}