import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../app/store'

// ── PASTE YOUR GOOGLE CLIENT ID HERE ──
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE'

export default function SignIn() {
  const navigate   = useNavigate()
  const { setUser }= useAppStore()
  const [mode,     setMode]   = useState('signin')
  const [name,     setName]   = useState('')
  const [email,    setEmail]  = useState('')
  const [pass,     setPass]   = useState('')
  const [error,    setError]  = useState('')
  const [gLoading, setGLoading] = useState(false)

  // Check if already signed in
  useEffect(() => {
    const saved = localStorage.getItem('studymate_user')
    if (saved) { try { const u = JSON.parse(saved); if (u.email) navigate('/') } catch {} }
  }, [])

  // Load Google Identity Services script
  useEffect(() => {
    if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') return
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: false,
      })
    }
    document.head.appendChild(script)
    return () => { try { document.head.removeChild(script) } catch {} }
  }, [])

  const handleGoogleResponse = (response) => {
    setGLoading(true)
    try {
      // Decode JWT payload (no library needed — just base64)
      const payload = JSON.parse(atob(response.credential.split('.')[1]))
      const userData = {
        name:    payload.name || payload.email.split('@')[0],
        email:   payload.email,
        picture: payload.picture || null,
        googleId:payload.sub,
      }
      localStorage.setItem('studymate_user', JSON.stringify(userData))
      setUser(userData)
      navigate('/')
    } catch (e) {
      setError('Google sign-in failed. Try again.')
      setGLoading(false)
    }
  }

  const triggerGoogleSignIn = () => {
    if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
      setError('Google Client ID not set. Add it to SignIn.jsx line 6.')
      return
    }
    if (window.google?.accounts.id) {
      window.google.accounts.id.prompt()
    } else {
      setError('Google sign-in not loaded. Check your internet connection.')
    }
  }

  const handle = () => {
    if (!email.trim() || !pass.trim()) { setError('Please fill all fields'); return }
    if (mode === 'signup' && !name.trim()) { setError('Enter your name'); return }
    setError('')
    const displayName = mode === 'signup' ? name : email.split('@')[0]
    const userData = { name: displayName, email }
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
      {/* Glows */}
      <div style={{ position:'absolute',bottom:-120,left:'50%',transform:'translateX(-50%)',width:500,height:400,background:'radial-gradient(ellipse,rgba(96,165,250,0.10) 0%,transparent 70%)',pointerEvents:'none',animation:'glowPulse 8s ease-in-out infinite' }} />
      <div style={{ position:'absolute',top:-100,right:-80,width:300,height:300,background:'radial-gradient(ellipse,rgba(167,139,250,0.07) 0%,transparent 70%)',pointerEvents:'none' }} />

      <div style={{ width:'100%', maxWidth:360, position:'relative', zIndex:1 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ width:64,height:64,borderRadius:20,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',fontSize:28 }}>✦</div>
          <h1 style={{ fontSize:28,fontWeight:900,color:'#fff',letterSpacing:'-0.8px',fontFamily:'Inter,sans-serif',marginBottom:4 }}>StudyMate</h1>
          <p style={{ fontSize:14,color:'rgba(255,255,255,0.38)',fontFamily:'Inter,sans-serif' }}>Your AI study companion</p>
        </div>

        {/* ── GOOGLE SIGN IN ── */}
        <button onClick={triggerGoogleSignIn} disabled={gLoading} style={{
          width:'100%', padding:'14px 16px', borderRadius:14, marginBottom:16,
          background:'#fff', border:'none', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:10,
          fontSize:14, fontWeight:600, color:'#111', fontFamily:'Inter,sans-serif',
          boxShadow:'0 2px 16px rgba(255,255,255,0.08)',
          opacity: gLoading ? 0.7 : 1,
        }}>
          {/* Google logo */}
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {gLoading ? 'Signing in...' : 'Continue with Google'}
        </button>

        {/* Divider */}
        <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:16 }}>
          <div style={{ flex:1,height:1,background:'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize:12,color:'rgba(255,255,255,0.28)',fontFamily:'Inter,sans-serif' }}>or</span>
          <div style={{ flex:1,height:1,background:'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Mode toggle */}
        <div style={{ display:'flex',background:'rgba(255,255,255,0.05)',borderRadius:12,padding:4,marginBottom:20 }}>
          {['signin','signup'].map(m=>(
            <button key={m} onClick={()=>{setMode(m);setError('')}} style={{ flex:1,padding:'9px',borderRadius:9,fontFamily:'Inter,sans-serif',background:mode===m?'rgba(255,255,255,0.12)':'transparent',border:'none',color:mode===m?'#fff':'rgba(255,255,255,0.4)',fontSize:13,fontWeight:mode===m?700:500,cursor:'pointer',transition:'all 0.2s' }}>{m==='signin'?'Sign In':'Sign Up'}</button>
          ))}
        </div>

        {/* Email form */}
        <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
          {mode==='signup'&&<input placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} style={inp} />}
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={inp} />
          <input type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handle()} style={inp} />
          {error&&<p style={{ fontSize:12,color:'#f87171',fontFamily:'Inter,sans-serif',textAlign:'center' }}>{error}</p>}
          <button onClick={handle} style={{ padding:'15px',borderRadius:14,fontFamily:'Inter,sans-serif',background:'linear-gradient(135deg,rgba(96,165,250,0.9),rgba(59,130,246,0.75))',border:'none',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',marginTop:2 }}>
            {mode==='signin'?'Sign In →':'Create Account →'}
          </button>
        </div>

        <button onClick={()=>navigate('/')} style={{ width:'100%',marginTop:14,padding:'13px',borderRadius:14,fontFamily:'Inter,sans-serif',background:'transparent',border:'1px solid rgba(255,255,255,0.07)',color:'rgba(255,255,255,0.35)',fontSize:13,cursor:'pointer' }}>
          Continue without account
        </button>
      </div>
      <style>{`@keyframes glowPulse{0%,100%{opacity:1}50%{opacity:0.6}}`}</style>
    </div>
  )
}