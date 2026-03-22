import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GlobalSearch from './GlobalSearch'
import { haptic } from '../utils/haptics'
import { useAppStore } from '../app/store'
import { useTheme } from '../app/useTheme'

export default function Home() {
  const navigate = useNavigate()
  const [showSearch, setShowSearch] = useState(false)
  const { isDark, t } = useTheme()
  const { streak, todayStudied, tasks, notes, toggleTask } = useAppStore()
  const saved     = JSON.parse(localStorage.getItem('studymate_user') || '{}')
  const name      = saved.name || 'Student'
  const today     = new Date().toDateString()
  const todayTasks= tasks.filter(t2 => new Date(t2.date || Date.now()).toDateString() === today)
  const doneTasks = todayTasks.filter(t2 => t2.done).length
  const h         = new Date().getHours()
  const greeting  = h<5?'Late night grind':h<12?'Good morning':h<17?'Good afternoon':h<21?'Good evening':'Late night session'
  const streakPct = Math.min(streak / 30, 1)

  const QUICK = [
    { label:'Focus Timer', sub:'Start a session',  path:'/focus/timer',       color:t.teal,   colorBg:t.greenBg,  icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { label:'Practice',    sub:'Test yourself',    path:'/practice',          color:t.purple, colorBg:t.purpleBg, icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
    { label:'Flashcards',  sub:'Quick review',     path:'/learn/flashcards',  color:t.amber,  colorBg:t.amberBg,  icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
    { label:'Progress',    sub:'See analytics',    path:'/progress',          color:t.red,    colorBg:t.redBg,    icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  ]

  const card  = { background:t.card,  border:`1px solid ${t.border}`,  borderRadius:20, boxShadow:t.shadowSm }
  const label = { fontSize:11, color:t.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'1.4px', fontFamily:'Inter,sans-serif' }

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%', background:t.bg, transition:'background 0.3s' }}>

      {/* HEADER */}
      <div style={{ padding:'40px 20px 0', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <p style={{ fontSize:13, color:t.textMuted, fontWeight:400, marginBottom:3, fontFamily:'Inter,sans-serif' }}>{greeting}</p>
          <h1 style={{ fontSize:30, fontWeight:900, color:t.text, letterSpacing:'-1.2px', lineHeight:1, fontFamily:'Inter,sans-serif' }}>{name}</h1>
        </div>
        <div style={{ display:'flex', gap:8, paddingTop:6 }}>
          {!saved.email && (
            <button onClick={()=>navigate('/signin')} className="pressable" style={{ padding:'8px 16px', borderRadius:20, fontFamily:'Inter,sans-serif', background:t.text, border:'none', color:t.bg, fontSize:12, fontWeight:700, cursor:'pointer' }}>Sign In</button>
          )}
          <button onClick={()=>{ haptic.light(); setShowSearch(true) }} className="pressable" style={{ width:36, height:36, borderRadius:12, background:t.inputBg, border:`1px solid ${t.border}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:t.textSec, marginRight:4 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
          </button>
          <button onClick={()=>navigate('/settings')} className="pressable" style={{ width:36, height:36, borderRadius:12, background:t.inputBg, border:`1px solid ${t.border}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:t.textSec }}>
            {saved.email
              ? <span style={{ fontSize:14, fontWeight:800, color:t.text, fontFamily:'Inter,sans-serif' }}>{name.charAt(0).toUpperCase()}</span>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            }
          </button>
        </div>
      </div>

      {/* STREAK — always dark card, it has its own internal palette */}
      <div style={{ padding:'18px 20px 0' }}>
        <div className="pressable" onClick={()=>navigate('/progress')} style={{ borderRadius:24, padding:'18px 20px 16px', position:'relative', overflow:'hidden', background:'linear-gradient(135deg,#130e00 0%,#0f0f0f 100%)', border:'1px solid rgba(255,130,0,0.14)', boxShadow:'0 4px 20px rgba(255,100,0,0.08)' }}>
          <div style={{ position:'absolute',inset:0,background:`radial-gradient(ellipse ${streakPct*130+20}% 100% at ${streakPct*60}% 50%, rgba(255,100,0,${0.08+streakPct*0.08}) 0%, transparent 70%)`,pointerEvents:'none' }} />
          <div style={{ position:'relative',zIndex:1,display:'flex',alignItems:'center',gap:14,marginBottom:14 }}>
            <div style={{ width:46,height:46,borderRadius:15,background:'rgba(255,100,0,0.14)',border:'1px solid rgba(255,120,0,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2C10 5 6 9 6 13a6 6 0 0012 0c0-4-4-8-6-11z" fill="rgba(255,130,0,0.95)"/><path d="M12 9c0 0-2.5 2.5-2.5 4a2.5 2.5 0 005 0c0-1.5-2.5-4-2.5-4z" fill="rgba(255,230,80,0.9)"/></svg>
            </div>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:10,color:'rgba(255,140,0,0.6)',fontWeight:700,marginBottom:4,fontFamily:'Inter,sans-serif',textTransform:'uppercase',letterSpacing:'1.2px' }}>Study Streak</p>
              <div style={{ display:'flex',alignItems:'baseline',gap:6 }}>
                <span style={{ fontSize:34,fontWeight:900,color:'#fff',letterSpacing:'-1.5px',fontFamily:'Inter,sans-serif',lineHeight:1 }}>{streak}</span>
                <span style={{ fontSize:14,color:'rgba(255,255,255,0.3)',fontFamily:'Inter,sans-serif' }}>days</span>
              </div>
              <p style={{ fontSize:10,color:streak>0?'rgba(255,160,0,0.55)':'rgba(255,255,255,0.18)',fontFamily:'Inter,sans-serif',marginTop:3 }}>
                {streak===0?'Start your streak today!':streak===1?'First day — keep going!':streak<7?`${7-streak} days to a week streak`:streak<30?'On fire 🔥 keep it up':'30-day champion! 🏆'}
              </p>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:10,color:'rgba(255,255,255,0.2)',fontFamily:'Inter,sans-serif',marginBottom:3 }}>30-day goal</div>
              <div style={{ fontSize:24,fontWeight:900,color:`rgba(255,${140+Math.round(streakPct*60)},0,${0.7+streakPct*0.25})`,letterSpacing:'-0.5px',fontFamily:'Inter,sans-serif',lineHeight:1 }}>{Math.round(streakPct*100)}<span style={{ fontSize:13,fontWeight:400,color:'rgba(255,255,255,0.2)' }}>%</span></div>
            </div>
          </div>
          <div style={{ position:'relative',zIndex:1,display:'flex',gap:2 }}>
            {Array.from({length:30},(_,i)=>(
              <div key={i} style={{ flex:1,height:3,borderRadius:2,background:i<streak?`rgba(255,${120+Math.round((i/30)*80)},0,${0.5+(i/30)*0.4})`:'rgba(255,255,255,0.07)' }} />
            ))}
          </div>
          <p style={{ position:'relative',zIndex:1,fontSize:11,color:'rgba(255,255,255,0.2)',fontFamily:'Inter,sans-serif',marginTop:8 }}>{todayStudied>=60?`${Math.floor(todayStudied/60)}h ${todayStudied%60}m`:`${todayStudied}m`} studied today · tap for history</p>
        </div>
      </div>

      {/* NEW NOTE CTA */}
      <div style={{ padding:'12px 20px 0' }}>
        <div className="pressable" onClick={()=>navigate('/learn/notes/new')} style={{ borderRadius:20, padding:'16px 18px', background:t.blueBg, border:`1px solid ${isDark?'rgba(96,165,250,0.18)':'rgba(37,99,235,0.16)'}`, display:'flex', alignItems:'center', gap:14, boxShadow:t.shadowSm }}>
          <div style={{ width:42,height:42,borderRadius:13,background:isDark?'rgba(96,165,250,0.15)':'rgba(37,99,235,0.12)',border:`1px solid ${isDark?'rgba(96,165,250,0.25)':'rgba(37,99,235,0.2)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:t.blue }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:16,fontWeight:700,color:t.text,fontFamily:'Inter,sans-serif',letterSpacing:'-0.2px',marginBottom:2 }}>New Note</p>
            <p style={{ fontSize:12,color:t.textMuted,fontFamily:'Inter,sans-serif' }}>{notes.length} saved · tap to start writing</p>
          </div>
          <span style={{ fontSize:18,color:t.blue,opacity:0.5 }}>›</span>
        </div>
      </div>

      {/* QUICK ACCESS */}
      <div style={{ padding:'14px 20px 0' }}>
        <p style={{ ...label, marginBottom:10 }}>Quick Access</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {QUICK.map(({label:lbl,sub,path,color,colorBg,icon})=>(
            <div key={path} className="pressable" onClick={()=>navigate(path)} style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:20, padding:'16px', boxShadow:t.shadowSm, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute',top:-20,right:-20,width:80,height:80,background:`radial-gradient(circle,${color}18 0%,transparent 70%)`,borderRadius:'50%',pointerEvents:'none' }} />
              <div style={{ width:38,height:38,borderRadius:12,background:colorBg,border:`1px solid ${color}28`,display:'flex',alignItems:'center',justifyContent:'center',color,marginBottom:12 }}>{icon}</div>
              <p style={{ fontSize:14,fontWeight:700,color:t.text,marginBottom:3,letterSpacing:'-0.2px',fontFamily:'Inter,sans-serif' }}>{lbl}</p>
              <p style={{ fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif' }}>{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* TODAY'S PLAN */}
      <div style={{ padding:'14px 20px 0' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            <p style={label}>Today's Plan</p>
            {todayTasks.length>0&&<span style={{ fontSize:10,fontWeight:700,color:t.teal,background:t.greenBg,padding:'2px 8px',borderRadius:10,fontFamily:'Inter,sans-serif' }}>{doneTasks}/{todayTasks.length}</span>}
          </div>
          <button onClick={()=>navigate('/focus/planner')} style={{ fontSize:12,color:t.textMuted,background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif' }}>Manage →</button>
        </div>
        <div className="pressable" onClick={()=>navigate('/focus/planner')} style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:20, overflow:'hidden', boxShadow:t.shadowSm }}>
          {todayTasks.length===0 ? (
            <div style={{ padding:'20px 18px',display:'flex',alignItems:'center',gap:14 }}>
              <div style={{ width:36,height:36,borderRadius:11,background:t.inputBg,border:`1px solid ${t.border}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:t.textMuted }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
              <div>
                <p style={{ fontSize:14,color:t.textSec,fontFamily:'Inter,sans-serif',fontWeight:500 }}>Plan your day</p>
                <p style={{ fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif',marginTop:2 }}>Tap to add tasks</p>
              </div>
            </div>
          ) : (
            <>
              <div style={{ height:2,background:t.border,overflow:'hidden' }}>
                <div style={{ height:'100%',background:t.teal,width:`${(doneTasks/todayTasks.length)*100}%`,transition:'width 0.5s ease' }} />
              </div>
              {todayTasks.slice(0,4).map((task,i)=>(
                <div key={task.id} onClick={e=>{e.stopPropagation();toggleTask(task.id)}} className="pressable" style={{ display:'flex',alignItems:'center',gap:14,padding:'13px 18px',borderBottom:i<Math.min(todayTasks.length,4)-1?`1px solid ${t.border}`:'none' }}>
                  <div style={{ width:20,height:20,borderRadius:'50%',flexShrink:0,border:task.done?'none':`1.5px solid ${t.borderMed}`,background:task.done?t.teal:'transparent',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s' }}>
                    {task.done&&<svg width="9" height="8" viewBox="0 0 9 8"><polyline points="1 4 3 6.5 8 1" stroke={isDark?'#000':'#fff'} strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>}
                  </div>
                  <span style={{ flex:1,fontSize:14,fontWeight:500,color:task.done?t.textMuted:t.text,textDecoration:task.done?'line-through':'none',fontFamily:'Inter,sans-serif',transition:'all 0.2s' }}>{task.title}</span>
                  {task.time&&<span style={{ fontSize:11,color:t.textFaint,fontFamily:'DM Mono,monospace' }}>{task.time}</span>}
                </div>
              ))}
              {todayTasks.length>4&&<div style={{ padding:'10px 18px',borderTop:`1px solid ${t.border}` }}><p style={{ fontSize:12,color:t.textMuted,fontFamily:'Inter,sans-serif' }}>+{todayTasks.length-4} more tasks</p></div>}
            </>
          )}
        </div>
      </div>

      {/* BOTTOM SHORTCUTS */}
      <div style={{ padding:'12px 20px 32px', display:'flex', gap:10 }}>
        {[
          { label:'All Notes', path:'/learn/notes',  icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
          { label:'Mind Map',  path:'/learn/mindmap', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="3" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="21"/><line x1="3" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="21" y2="12"/></svg> },
          { label:'Voice',     path:'/learn/voice',   icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg> },
        ].map(({label:lbl,path,icon})=>(
          <div key={path} className="pressable" onClick={()=>navigate(path)} style={{ flex:1,background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:'12px 10px',display:'flex',alignItems:'center',gap:8,boxShadow:t.shadowSm }}>
            <span style={{ color:t.textMuted }}>{icon}</span>
            <span style={{ fontSize:12,fontWeight:600,color:t.textSec,fontFamily:'Inter,sans-serif' }}>{lbl}</span>
          </div>
        ))}
      </div>
      {showSearch && <GlobalSearch onClose={() => setShowSearch(false)} />}
    </div>
  )
}