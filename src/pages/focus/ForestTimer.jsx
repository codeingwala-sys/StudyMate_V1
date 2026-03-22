import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { showNotification } from '../../services/notifications.service'
import { haptic } from '../../utils/haptics'
import { playTimerStart, playWarning90, playTimerDone, playBreakStart } from '../../services/sound.service'
import { useAppStore } from '../../app/store'

const randArr = () => Math.floor(Math.random() * 4)
const MODES   = ['timer','short','long','stopwatch']
const PRESETS       = [{label:'15m',sec:900},{label:'25m',sec:1500},{label:'45m',sec:2700},{label:'1h',sec:3600},{label:'2h',sec:7200}]
const SHORT_PRESETS = [{label:'5m',sec:300},{label:'10m',sec:600},{label:'15m',sec:900}]
const LONG_PRESETS  = [{label:'15m',sec:900},{label:'20m',sec:1200},{label:'30m',sec:1800},{label:'45m',sec:2700}]

function TimerFace({ dispH, dispM, dispS, dispRunH, dispRunM, dispRunS, totalSec, isDragging, dragSide, running, arcH, progress, handleDragStart, handleDragMove, handleDragEnd }) {
  const colon = `hsla(${arcH},60%,65%,${0.4 + progress * 0.4})`
  const glow  = `0 0 55px hsla(${arcH},80%,60%,${0.2 + progress * 0.5})`
  const numBig = (val, side) => (
    <div style={{ fontSize:88,fontWeight:900,fontFamily:'DM Mono,monospace',lineHeight:1,color:isDragging&&dragSide===side?`hsl(${arcH},75%,80%)`:'#fff',letterSpacing:'-4px',textShadow:glow,transition:isDragging?'none':'color 0.4s,text-shadow 0.6s',minWidth:106,textAlign:'center',userSelect:'none' }}>{String(val).padStart(2,'0')}</div>
  )
  const colonEl = <div style={{ fontSize:76,fontWeight:900,color:colon,fontFamily:'DM Mono,monospace',lineHeight:1,letterSpacing:'-2px',transition:'color 0.5s',userSelect:'none',paddingBottom:running?0:14 }}>:</div>
  const dragZone = (side,val,label,sublabel) => (
    <div onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);handleDragStart(e,side)}} onPointerMove={handleDragMove} onPointerUp={handleDragEnd} onPointerCancel={handleDragEnd}
      style={{ display:'flex',flexDirection:'column',alignItems:'center',cursor:'ns-resize',userSelect:'none',padding:'24px 12px 20px' }}>
      <div style={{ fontSize:10,color:isDragging&&dragSide===side?`hsl(${arcH},80%,72%)`:'rgba(255,255,255,0.2)',fontFamily:'Inter,sans-serif',fontWeight:600,marginBottom:6,letterSpacing:'0.8px' }}>▲ {label} ▼</div>
      {numBig(val,side)}
      <div style={{ fontSize:10,color:'rgba(255,255,255,0.18)',fontFamily:'Inter,sans-serif',marginTop:6,letterSpacing:'0.3px' }}>{sublabel}</div>
    </div>
  )
  if (!running) return (
    <div style={{ display:'flex',alignItems:'center',touchAction:'none' }}>
      {dragZone('left',dispH,'HRS','hours')}{colonEl}{dragZone('right',dispM,'MIN','minutes')}
    </div>
  )
  const showHrMin=totalSec>=3600
  return (
    <div style={{ display:'flex',alignItems:'center',touchAction:'none' }}>
      <div style={{ display:'flex',flexDirection:'column',alignItems:'center',padding:'24px 12px 20px' }}>
        {numBig(showHrMin?dispRunH:dispRunM,null)}
        <div style={{ fontSize:10,color:'rgba(255,255,255,0.18)',fontFamily:'Inter,sans-serif',marginTop:6 }}>{showHrMin?'hrs':'min'}</div>
      </div>
      {colonEl}
      <div style={{ display:'flex',flexDirection:'column',alignItems:'center',padding:'24px 12px 20px' }}>
        {numBig(showHrMin?dispRunM:dispRunS,null)}
        <div style={{ fontSize:10,color:'rgba(255,255,255,0.18)',fontFamily:'Inter,sans-serif',marginTop:6 }}>{showHrMin?'min':'sec'}</div>
      </div>
    </div>
  )
}

function StopwatchFace({ swH, swM, swS }) {
  return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:8 }}>
      <div style={{ display:'flex',alignItems:'baseline',gap:4 }}>
        <span style={{ fontSize:86,fontWeight:900,fontFamily:'DM Mono,monospace',color:'#fff',letterSpacing:'-4px',lineHeight:1,textShadow:'0 0 50px rgba(96,165,250,0.35)' }}>{String(swH).padStart(2,'0')}</span>
        <span style={{ fontSize:48,color:'rgba(96,165,250,0.5)',fontFamily:'DM Mono,monospace',fontWeight:900,letterSpacing:'-2px' }}>:</span>
        <span style={{ fontSize:86,fontWeight:900,fontFamily:'DM Mono,monospace',color:'#fff',letterSpacing:'-4px',lineHeight:1,textShadow:'0 0 50px rgba(96,165,250,0.35)' }}>{String(swM).padStart(2,'0')}</span>
        <span style={{ fontSize:48,color:'rgba(96,165,250,0.5)',fontFamily:'DM Mono,monospace',fontWeight:900,letterSpacing:'-2px' }}>:</span>
        <span style={{ fontSize:52,fontWeight:900,fontFamily:'DM Mono,monospace',color:'rgba(255,255,255,0.55)',letterSpacing:'-2px',lineHeight:1 }}>{String(swS).padStart(2,'0')}</span>
      </div>
      <div style={{ display:'flex',gap:24,marginTop:4 }}>
        {['hours','minutes','seconds'].map((l,i)=>(
          <span key={l} style={{ fontSize:10,color:'rgba(255,255,255,0.2)',fontFamily:'Inter,sans-serif',letterSpacing:'0.5px',minWidth:[64,64,52][i],textAlign:'center' }}>{l}</span>
        ))}
      </div>
    </div>
  )
}

export default function FocusTimer() {
  const navigate  = useNavigate()
  const { addSession } = useAppStore()

  // ── Canvas + animation refs ──
  const canvasRef   = useRef(null)
  const animRef     = useRef(null)
  const arrangRef   = useRef(randArr())
  const progRef     = useRef(0)
  const modeRef     = useRef('timer')
  const dragRef     = useRef({ active:false,side:'right',startY:0,startH:0,startM:25 })
  const swipeRef    = useRef({ active:false, startX:0, startMode:'' })

  // ── Repeating alarm — fires every 30s when timer ends until user dismisses ──
  const alarmIntervalRef = useRef(null)
  const [alarmActive, setAlarmActive] = useState(false)

  // Start the repeating alarm
  const startAlarm = useCallback((label, minutes) => {
    const title = label === 'short' ? '☕ Short break over!'
                : label === 'long'  ? '🌿 Long break over!'
                : '✦ Focus session complete!'
    const body  = label === 'short' ? 'Your short break has ended. Time to focus!'
                : label === 'long'  ? 'Long break done. Ready to study again?'
                : `${minutes} minutes of deep focus complete. Take a break!`

    // Always mark alarm as active so dismiss screen shows when user returns
    setAlarmActive(true)

    // Only send notifications if app is in background
    if (document.visibilityState !== 'visible') {
      showNotification(title, body, { tag: 'timer-alarm', renotify: true })
      // Repeat every 30 seconds until dismissed
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current)
      alarmIntervalRef.current = setInterval(() => {
        showNotification(title, body, { tag: 'timer-alarm', renotify: true })
      }, 30000)
    }
    // If app becomes visible later, the alarmActive banner handles it
  }, [])

  // Stop the repeating alarm
  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current)
      alarmIntervalRef.current = null
    }
    setAlarmActive(false)
  }, [])

  // Clean up alarm on unmount
  useEffect(() => () => stopAlarm(), [stopAlarm])

  // ── Per-mode independent interval refs ──
  const timerIntRef  = useRef(null)
  const shortIntRef  = useRef(null)
  const longIntRef   = useRef(null)
  const swIntRef     = useRef(null)

  // ── Per-mode elapsed refs (for canvas sub-second interpolation) ──
  const timerElRef   = useRef(0)
  const shortElRef   = useRef(0)
  const longElRef    = useRef(0)
  const swElRef      = useRef(0)

  // ── Per-mode tick refs (timestamp of last 1s tick) ──
  const timerTickRef = useRef(null)
  const shortTickRef = useRef(null)
  const longTickRef  = useRef(null)

  // ── Per-mode duration refs ──
  const timerSecRef  = useRef(1500)
  const shortSecRef  = useRef(300)
  const longSecRef   = useRef(900)
  const totalSecRef  = useRef(1500)
  // Track whether 90% warning has already fired for each mode (reset on start/reset)
  const warned90Timer = useRef(false)
  const warned90Short = useRef(false)
  const warned90Long  = useRef(false)

  // ── Restore persisted state ──
  const _s = (() => { try { return JSON.parse(localStorage.getItem('studymate_timer')||'{}') } catch { return {} } })()
  const _now = Date.now()
  const restoreMode = (mKey, durKey, defDur) => {
    const startedAt = _s[mKey+'StartedAt']
    const wasRun    = _s[mKey+'Running']
    const savedEl   = _s[mKey+'Elapsed'] || 0
    const dur       = _s[durKey] || defDur
    if (wasRun && startedAt) {
      const passed   = Math.floor((_now - startedAt) / 1000)
      const restored = Math.min(savedEl + passed, dur)
      if (restored >= dur) return { running:false, elapsed:0 }
      return { running:true, elapsed:restored }
    }
    return { running:false, elapsed:savedEl }
  }
  const _t  = restoreMode('timer','timerSec',1500)
  const _sh = restoreMode('short','shortSec',300)
  const _lo = restoreMode('long', 'longSec', 900)
  const _sw = _s.swRunning && _s.swStartedAt
    ? { running:true,  elapsed:(_s.swElapsed||0)+Math.floor((_now-_s.swStartedAt)/1000) }
    : { running:false, elapsed:_s.swElapsed||0 }

  // ── State ──
  const [mode,          setMode]         = useState(_s.mode     || 'timer')
  const [timerSec,      setTimerSec]     = useState(_s.timerSec || 1500)
  const [shortBreakSec, setShortBreakSec]= useState(_s.shortSec || 300)
  const [longBreakSec,  setLongBreakSec] = useState(_s.longSec  || 900)
  const [timerRunning,  setTimerRunning] = useState(_t.running)
  const [timerElapsed,  setTimerElapsed] = useState(_t.elapsed)
  const [shortRunning,  setShortRunning] = useState(_sh.running)
  const [shortElapsed,  setShortElapsed] = useState(_sh.elapsed)
  const [longRunning,   setLongRunning]  = useState(_lo.running)
  const [longElapsed,   setLongElapsed]  = useState(_lo.elapsed)
  const [swRunning,     setSwRunning]    = useState(_sw.running)
  const [swElapsed,     setSwElapsed]    = useState(_sw.elapsed)
  const [completed,     setCompleted]    = useState(_s.completed||0)
  const [showReward,    setShowReward]   = useState(false)
  const [isDragging,    setIsDragging]   = useState(false)
  const [draftH,        setDraftH]       = useState(0)
  const [draftM,        setDraftM]       = useState(25)
  const [dragSide,      setDragSide]     = useState(null)

  // Derived display values
  const elapsed  = mode==='short'?shortElapsed:mode==='long'?longElapsed:mode==='stopwatch'?swElapsed:timerElapsed
  const running  = mode==='short'?shortRunning:mode==='long'?longRunning:mode==='stopwatch'?swRunning:timerRunning
  const totalSec = mode==='short'?shortBreakSec:mode==='long'?longBreakSec:mode==='stopwatch'?0:timerSec

  // Keep refs in sync every render
  modeRef.current      = mode
  timerSecRef.current  = timerSec
  shortSecRef.current  = shortBreakSec
  longSecRef.current   = longBreakSec
  totalSecRef.current  = totalSec
  timerElRef.current   = timerElapsed
  shortElRef.current   = shortElapsed
  longElRef.current    = longElapsed
  swElRef.current      = swElapsed

  const progress = (mode==='timer'||mode==='short'||mode==='long') && totalSec>0 ? elapsed/totalSec : 0
  progRef.current = progress

  // ── Persist all 4 modes ──
  useEffect(() => {
    localStorage.setItem('studymate_timer', JSON.stringify({
      mode, completed, timerSec, shortSec:shortBreakSec, longSec:longBreakSec,
      timerRunning, timerElapsed, timerStartedAt: timerRunning ? Date.now()-timerElapsed*1000 : null,
      shortRunning, shortElapsed, shortStartedAt: shortRunning ? Date.now()-shortElapsed*1000 : null,
      longRunning,  longElapsed,  longStartedAt:  longRunning  ? Date.now()-longElapsed*1000  : null,
      swRunning,    swElapsed,    swStartedAt:    swRunning    ? Date.now()-swElapsed*1000    : null,
    }))
  },[mode,completed,timerSec,shortBreakSec,longBreakSec,
     timerRunning,timerElapsed,shortRunning,shortElapsed,
     longRunning,longElapsed,swRunning,swElapsed])

  // ── Visibility change — recalc elapsed when tab becomes visible ──
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const s = (() => { try { return JSON.parse(localStorage.getItem('studymate_timer')||'{}') } catch { return {} } })()
      const now = Date.now()
      ;[['timer','timerSec',1500,setTimerElapsed,setTimerRunning],
        ['short','shortSec',300, setShortElapsed,setShortRunning],
        ['long', 'longSec', 900, setLongElapsed, setLongRunning],
      ].forEach(([mk,dk,def,setEl,setRun]) => {
        if (s[mk+'Running'] && s[mk+'StartedAt']) {
          const passed = Math.floor((now-s[mk+'StartedAt'])/1000)
          const dur = s[dk]||def
          const restored = Math.min((s[mk+'Elapsed']||0)+passed, dur)
          if (restored >= dur) { setEl(0); setRun(false) }
          else setEl(restored)
        }
      })
      if (s.swRunning && s.swStartedAt) {
        setSwElapsed((s.swElapsed||0)+Math.floor((now-s.swStartedAt)/1000))
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  },[])

/* ─── CANVAS (unchanged — exact original) ─── */
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const fit = () => {
      const dpr = window.devicePixelRatio||1
      canvas.width  = canvas.offsetWidth*dpr
      canvas.height = canvas.offsetHeight*dpr
    }
    fit(); window.addEventListener('resize',fit)
    const ctx = canvas.getContext('2d')
    let t=0, shootT=0

    const CONFIGS = [
      [
        {ox:.50,oy:.42,r:.095,hue:220,sp:.0003,moons:2,ring:false},
        {ox:.24,oy:.25,r:.048,hue:290,sp:.0006,moons:1,ring:false},
        {ox:.76,oy:.24,r:.040,hue:38, sp:.0008,moons:0,ring:true },
        {ox:.16,oy:.58,r:.032,hue:165,sp:.0010,moons:1,ring:false},
        {ox:.84,oy:.60,r:.026,hue:345,sp:.0012,moons:0,ring:false},
        {ox:.50,oy:.13,r:.022,hue:55, sp:.0014,moons:0,ring:false},
        {ox:.12,oy:.42,r:.017,hue:195,sp:.0017,moons:0,ring:false},
        {ox:.88,oy:.40,r:.014,hue:315,sp:.0019,moons:0,ring:false},
      ],
      [
        {ox:.50,oy:.42,r:.095,hue:200,sp:.0003,moons:3,ring:true },
        {ox:.80,oy:.28,r:.044,hue:260,sp:.0007,moons:1,ring:false},
        {ox:.20,oy:.28,r:.044,hue:30, sp:.0007,moons:1,ring:false},
        {ox:.88,oy:.55,r:.034,hue:160,sp:.0009,moons:0,ring:false},
        {ox:.12,oy:.55,r:.034,hue:350,sp:.0009,moons:0,ring:false},
        {ox:.65,oy:.14,r:.024,hue:70, sp:.0013,moons:0,ring:false},
        {ox:.35,oy:.14,r:.024,hue:310,sp:.0013,moons:0,ring:false},
        {ox:.50,oy:.78,r:.018,hue:210,sp:.0016,moons:0,ring:false},
      ],
      [
        {ox:.36,oy:.42,r:.088,hue:215,sp:.0004,moons:2,ring:false},
        {ox:.64,oy:.42,r:.072,hue:40, sp:.0004,moons:2,ring:false},
        {ox:.18,oy:.30,r:.036,hue:285,sp:.0009,moons:0,ring:true },
        {ox:.82,oy:.30,r:.036,hue:155,sp:.0009,moons:0,ring:false},
        {ox:.18,oy:.60,r:.030,hue:340,sp:.0011,moons:1,ring:false},
        {ox:.82,oy:.60,r:.030,hue:65, sp:.0011,moons:0,ring:false},
        {ox:.50,oy:.12,r:.020,hue:190,sp:.0015,moons:0,ring:false},
        {ox:.50,oy:.80,r:.016,hue:320,sp:.0018,moons:0,ring:false},
      ],
      [
        {ox:.50,oy:.38,r:.100,hue:230,sp:.0003,moons:2,ring:true },
        {ox:.28,oy:.22,r:.042,hue:280,sp:.0008,moons:1,ring:false},
        {ox:.72,oy:.22,r:.042,hue:40, sp:.0008,moons:0,ring:false},
        {ox:.15,oy:.50,r:.034,hue:155,sp:.0010,moons:1,ring:false},
        {ox:.85,oy:.50,r:.034,hue:355,sp:.0010,moons:0,ring:false},
        {ox:.30,oy:.72,r:.028,hue:55, sp:.0012,moons:0,ring:false},
        {ox:.70,oy:.72,r:.028,hue:200,sp:.0012,moons:0,ring:false},
        {ox:.50,oy:.84,r:.018,hue:320,sp:.0016,moons:0,ring:false},
      ],
    ]

    const PLANETS = CONFIGS[arrangRef.current].map(p=>({
      ...p, angle:Math.random()*Math.PI*2,
      moons: Array.from({length:p.moons},(_,i)=>({
        dist:1.9+i*.55, angle:Math.random()*Math.PI*2,
        speed:(.018+Math.random()*.012)*(Math.random()>.5?1:-1), r:.10+Math.random()*.07,
      }))
    }))

    const STARS = Array.from({length:200},()=>({ x:Math.random(),y:Math.random(),r:Math.random()*1.5+.15,a:Math.random()*.6+.08,ph:Math.random()*Math.PI*2,sp:Math.random()*.8+.3 }))
    const SHOOTS = []
    const spawnShoot=(W,H)=>SHOOTS.push({x:Math.random()*W,y:Math.random()*H*.5,vx:(Math.random()>.5?1:-1)*(3+Math.random()*4),vy:1+Math.random()*2,life:1})

    const draw = () => {
      t+=.01; shootT+=.01
      const dpr=window.devicePixelRatio||1
      const W=canvas.width/dpr, H=canvas.height/dpr
      const _m = modeRef.current
      // isR = any timer is actively running (for canvas animation speed)
      const isR = (timerIntRef.current!==null)||(shortIntRef.current!==null)||(longIntRef.current!==null)||(swIntRef.current!==null)
      let p
      // Use the displayed mode's tick+elapsed refs for smooth sub-second interpolation
      const _mode = modeRef.current
      const _tick = _mode==='short'?shortTickRef.current:_mode==='long'?longTickRef.current:timerTickRef.current
      const _el   = _mode==='short'?shortElRef.current:_mode==='long'?longElRef.current:timerElRef.current
      if(isR && _tick && totalSecRef.current > 0) {
        const subSecond = Math.min((Date.now() - _tick) / 1000, 1)
        p = Math.min((_el + subSecond) / totalSecRef.current, 1)
      } else {
        p = progRef.current
      }
      ctx.save(); ctx.scale(dpr,dpr); ctx.clearRect(0,0,W,H)

      ctx.fillStyle=`hsl(${230+p*50},35%,${3+p*5}%)`; ctx.fillRect(0,0,W,H)
      if(p>.2){
        [[.25,.32,190,.28],[.75,.58,270,.22],[.50,.78,330,.18]].forEach(([nx,ny,nh,na])=>{
          const ng=ctx.createRadialGradient(nx*W,ny*H,0,nx*W,ny*H,W*.38)
          ng.addColorStop(0,`hsla(${nh},65%,38%,${(p-.2)*.55*na})`); ng.addColorStop(1,'transparent')
          ctx.fillStyle=ng; ctx.fillRect(0,0,W,H)
        })
      }
      STARS.forEach(s=>{
        const tw=.55+Math.sin(t*s.sp+s.ph)*.45, alpha=s.a*tw*(.25+p*.75)
        if(alpha<.02)return
        if(s.r>1.1&&alpha>.3){
          ctx.strokeStyle=`rgba(220,230,255,${alpha*.5})`; ctx.lineWidth=.4
          ctx.beginPath(); ctx.moveTo(s.x*W-s.r*2.5,s.y*H); ctx.lineTo(s.x*W+s.r*2.5,s.y*H); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(s.x*W,s.y*H-s.r*2.5); ctx.lineTo(s.x*W,s.y*H+s.r*2.5); ctx.stroke()
        }
        ctx.beginPath(); ctx.arc(s.x*W,s.y*H,s.r*tw,0,Math.PI*2); ctx.fillStyle=`rgba(220,230,255,${alpha})`; ctx.fill()
      })
      if(shootT>(isR?5:12)&&p>.1){spawnShoot(W,H);shootT=0}
      for(let i=SHOOTS.length-1;i>=0;i--){
        const s=SHOOTS[i]; s.x+=s.vx; s.y+=s.vy; s.life-=.025
        if(s.life<=0){SHOOTS.splice(i,1);continue}
        const sg=ctx.createLinearGradient(s.x,s.y,s.x-s.vx*5,s.y-s.vy*5)
        sg.addColorStop(0,`rgba(255,255,255,${s.life*.9})`); sg.addColorStop(1,'transparent')
        ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(s.x-s.vx*5,s.y-s.vy*5)
        ctx.strokeStyle=sg; ctx.lineWidth=1.5; ctx.stroke()
      }

      PLANETS.forEach((pl,idx)=>{
        const thresh=idx===0?0:Math.min(.08*idx,.65)
        const local=Math.max(0,Math.min(1,(p-thresh)/(1-thresh+.001)))
        if(local<=0)return
        pl.angle+=pl.sp*(isR?1:.15)
        const px=(pl.ox+Math.sin(t*.2+idx)*.012)*W
        const py=(pl.oy+Math.cos(t*.15+idx)*.010)*H
        const pr=pl.r*Math.min(W,H)*local
        ;[6,3.5,2,1.15].forEach((mult,li)=>{
          const ga=local*[.06,.13,.25,.55][li]
          const gg=ctx.createRadialGradient(px,py,0,px,py,pr*mult)
          gg.addColorStop(0,`hsla(${pl.hue},80%,65%,${ga})`); gg.addColorStop(1,'transparent')
          ctx.beginPath(); ctx.arc(px,py,pr*mult,0,Math.PI*2); ctx.fillStyle=gg; ctx.fill()
        })
        const bg=ctx.createRadialGradient(px-pr*.32,py-pr*.32,pr*.04,px+pr*.1,py+pr*.1,pr)
        bg.addColorStop(0,`hsla(${pl.hue+25},60%,85%,${local})`)
        bg.addColorStop(.3,`hsla(${pl.hue+10},70%,62%,${local})`)
        bg.addColorStop(.7,`hsla(${pl.hue},78%,42%,${local})`)
        bg.addColorStop(1,`hsla(${pl.hue-15},85%,18%,${local})`)
        ctx.beginPath(); ctx.arc(px,py,pr,0,Math.PI*2); ctx.fillStyle=bg; ctx.fill()
        ctx.save(); ctx.beginPath(); ctx.arc(px,py,pr*.995,0,Math.PI*2); ctx.clip()
        const bRot=t*pl.sp*80
        for(let b=0;b<3;b++){
          const by=py+Math.sin(bRot+b*1.1)*pr*(.2+b*.15)
          const bbg=ctx.createLinearGradient(px-pr,by-pr*.12,px-pr,by+pr*.12)
          bbg.addColorStop(0,'transparent'); bbg.addColorStop(.5,`hsla(${pl.hue+b*15},60%,${b%2===0?35:55}%,${local*.18})`); bbg.addColorStop(1,'transparent')
          ctx.fillStyle=bbg; ctx.fillRect(px-pr,by-pr*.12,pr*2,pr*.24)
        }
        ctx.restore()
        const spec=ctx.createRadialGradient(px-pr*.35,py-pr*.35,0,px-pr*.35,py-pr*.35,pr*.55)
        spec.addColorStop(0,`rgba(255,255,255,${local*.45})`); spec.addColorStop(.5,`rgba(255,255,255,${local*.08})`); spec.addColorStop(1,'transparent')
        ctx.beginPath(); ctx.arc(px,py,pr,0,Math.PI*2); ctx.fillStyle=spec; ctx.fill()
        const limb=ctx.createRadialGradient(px,py,pr*.7,px,py,pr*1.02)
        limb.addColorStop(0,'transparent'); limb.addColorStop(1,`hsla(${pl.hue-20},85%,5%,${local*.7})`)
        ctx.beginPath(); ctx.arc(px,py,pr*1.02,0,Math.PI*2); ctx.fillStyle=limb; ctx.fill()
        const atm=ctx.createRadialGradient(px,py,pr*.92,px,py,pr*1.22)
        atm.addColorStop(0,`hsla(${pl.hue},90%,70%,${local*.18})`); atm.addColorStop(.6,`hsla(${pl.hue},80%,55%,${local*.08})`); atm.addColorStop(1,'transparent')
        ctx.beginPath(); ctx.arc(px,py,pr*1.22,0,Math.PI*2); ctx.fillStyle=atm; ctx.fill()
        if(pl.ring&&local>.3){
          ctx.save(); ctx.translate(px,py); ctx.scale(1,.28)
          for(let ri=0;ri<3;ri++){
            const ro=pr*(1.55+ri*.35),ri2=pr*(1.3+ri*.35)
            const rg=ctx.createRadialGradient(0,0,ri2,0,0,ro)
            rg.addColorStop(0,`hsla(${pl.hue+20},55%,72%,${local*(.35-ri*.08)})`); rg.addColorStop(1,`hsla(${pl.hue+20},50%,60%,${local*(.12-ri*.03)})`)
            ctx.beginPath(); ctx.arc(0,0,ro,0,Math.PI*2); ctx.arc(0,0,ri2,0,Math.PI*2,true); ctx.fillStyle=rg; ctx.fill()
          }
          ctx.restore()
        }
        pl.moons.forEach(moon=>{
          moon.angle+=moon.speed*(isR?1:.2)
          const mx=px+Math.cos(moon.angle)*pr*(moon.dist+1)
          const my=py+Math.sin(moon.angle)*pr*(moon.dist+1)*.62
          const mr=pr*moon.r*local
          const mg=ctx.createRadialGradient(mx-mr*.3,my-mr*.3,mr*.08,mx,my,mr)
          mg.addColorStop(0,`hsla(${pl.hue+35},35%,88%,${local})`); mg.addColorStop(.6,`hsla(${pl.hue+10},30%,55%,${local})`); mg.addColorStop(1,`hsla(${pl.hue-10},40%,22%,${local})`)
          const mgG=ctx.createRadialGradient(mx,my,0,mx,my,mr*2.5)
          mgG.addColorStop(0,`hsla(${pl.hue+30},70%,70%,${local*.2})`); mgG.addColorStop(1,'transparent')
          ctx.beginPath(); ctx.arc(mx,my,mr*2.5,0,Math.PI*2); ctx.fillStyle=mgG; ctx.fill()
          ctx.beginPath(); ctx.arc(mx,my,mr,0,Math.PI*2); ctx.fillStyle=mg; ctx.fill()
        })
      })

      const cx=W/2,cy=H/2,ringR=Math.min(W,H)*.44
      ctx.beginPath(); ctx.arc(cx,cy,ringR,0,Math.PI*2); ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=1; ctx.stroke()
      if(p>0){
        const dotCount=60,aStart=-Math.PI/2
        for(let i=0;i<dotCount;i++){
          const ratio=i/dotCount; if(ratio>p)break
          const angle=aStart+ratio*Math.PI*2
          const dx=cx+Math.cos(angle)*ringR, dy=cy+Math.sin(angle)*ringR
          const dH=220+p*80
          ctx.beginPath(); ctx.arc(dx,dy,i%5===0?2.5:1.2,0,Math.PI*2)
          ctx.fillStyle=`hsla(${dH},85%,75%,${(.4+(i/dotCount)*.6)*p})`; ctx.fill()
        }
        const lA=aStart+p*Math.PI*2, ldx=cx+Math.cos(lA)*ringR, ldy=cy+Math.sin(lA)*ringR
        const cH=220+p*80
        const cg=ctx.createRadialGradient(ldx,ldy,0,ldx,ldy,10)
        cg.addColorStop(0,`hsla(${cH},100%,96%,1)`); cg.addColorStop(.4,`hsla(${cH},90%,75%,.6)`); cg.addColorStop(1,'transparent')
        ctx.beginPath(); ctx.arc(ldx,ldy,10,0,Math.PI*2); ctx.fillStyle=cg; ctx.fill()
        for(let ti=1;ti<=8;ti++){
          const ta=lA-(ti/80)*Math.PI*2
          const tx=cx+Math.cos(ta)*ringR, ty=cy+Math.sin(ta)*ringR
          ctx.beginPath(); ctx.arc(tx,ty,2-ti*.18,0,Math.PI*2)
          ctx.fillStyle=`hsla(${cH},85%,78%,${(1-ti/8)*.6})`; ctx.fill()
        }
      }
      if(isR){
        const beat=.85+Math.sin(t*2.4)*.09+Math.sin(t*4.8)*.025
        const hbG=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.min(W,H)*.28*beat)
        hbG.addColorStop(0,`hsla(${220+p*80},75%,65%,${.10+p*.15})`); hbG.addColorStop(1,'transparent')
        ctx.beginPath(); ctx.arc(cx,cy,Math.min(W,H)*.28*beat,0,Math.PI*2); ctx.fillStyle=hbG; ctx.fill()
      }
      ctx.restore()
      animRef.current=requestAnimationFrame(draw)
    }
    draw()
    return ()=>{ cancelAnimationFrame(animRef.current); window.removeEventListener('resize',fit) }
  },[])

  // ── Per-mode countdown effects — ALL run in parallel ──
  const makeCountdown = (isRunning, setElFn, elRef, secRef, tickRef, intRef, label) => {
    if (isRunning) {
      tickRef.current = Date.now()
      intRef.current = setInterval(() => {
        tickRef.current = Date.now()
        setElFn(e => {
          const next = e + 1
          elRef.current = next
          // 90% warning sound — fires once per session
          const warnedRef = label==='short' ? warned90Short : label==='long' ? warned90Long : warned90Timer
          if (!warnedRef.current && secRef.current > 0 && next / secRef.current >= 0.9) {
            warnedRef.current = true
            playWarning90()
          }
          if (next >= secRef.current) {
            clearInterval(intRef.current); intRef.current = null
            setTimeout(() => {
              setElFn(0); elRef.current = 0; tickRef.current = null
              setCompleted(cv => cv+1)
              const mins = Math.round(secRef.current/60)
              addSession({ date:new Date().toISOString(), duration:mins, type:'focus' })
              playTimerDone()
              haptic.success()
              // Start repeating alarm if app is in background
              startAlarm(label, mins)
              if (modeRef.current === label || label==='timer') {
                setShowReward(true); arrangRef.current = randArr()
                setTimeout(() => {
                  setShowReward(false)
                  // Only auto-stop alarm if app is open — if user left, keep notifying
                  if (document.visibilityState === 'visible') stopAlarm()
                }, 4500)
              }
            }, 0)
            return 0
          }
          return next
        })
      }, 1000)
    } else {
      clearInterval(intRef.current); intRef.current = null; tickRef.current = null
    }
    return () => { clearInterval(intRef.current); intRef.current = null }
  }

  useEffect(() => makeCountdown(timerRunning, setTimerElapsed, timerElRef, timerSecRef, timerTickRef, timerIntRef, 'timer'), [timerRunning]) // eslint-disable-line
  useEffect(() => makeCountdown(shortRunning, setShortElapsed, shortElRef, shortSecRef, shortTickRef, shortIntRef, 'short'), [shortRunning]) // eslint-disable-line
  useEffect(() => makeCountdown(longRunning,  setLongElapsed,  longElRef,  longSecRef,  longTickRef,  longIntRef,  'long'),  [longRunning])  // eslint-disable-line

  useEffect(() => {
    if (swRunning) {
      swIntRef.current = setInterval(() => { setSwElapsed(e => e+1); swElRef.current++ }, 1000)
    } else {
      clearInterval(swIntRef.current); swIntRef.current = null
    }
    return () => { clearInterval(swIntRef.current); swIntRef.current = null }
  }, [swRunning])

  // ── Helpers ──
  const setCurrentModeSec = useCallback((s) => {
    const m = modeRef.current
    if      (m==='short') setShortBreakSec(s)
    else if (m==='long')  setLongBreakSec(s)
    else if (m==='timer') setTimerSec(s)
  }, [])

  // Reset only the current displayed mode
  const reset = () => {
    haptic.light()
    if (mode==='timer')     { clearInterval(timerIntRef.current); timerIntRef.current=null; setTimerRunning(false); setTimerElapsed(0); timerElRef.current=0; timerTickRef.current=null; warned90Timer.current=false; stopAlarm() }
    if (mode==='short')     { clearInterval(shortIntRef.current); shortIntRef.current=null; setShortRunning(false); setShortElapsed(0); shortElRef.current=0; shortTickRef.current=null; warned90Short.current=false }
    if (mode==='long')      { clearInterval(longIntRef.current);  longIntRef.current=null;  setLongRunning(false);  setLongElapsed(0);  longElRef.current=0;  longTickRef.current=null;  warned90Long.current=false  }
    if (mode==='stopwatch') { clearInterval(swIntRef.current);    swIntRef.current=null;    setSwRunning(false);    setSwElapsed(0);    swElRef.current=0 }
  }

  // Switch ONLY changes what's displayed — does NOT stop other running timers
  const switchMode = (m) => {
    setMode(m)
    const s = m==='short'?shortBreakSec:m==='long'?longBreakSec:m==='timer'?timerSec:0
    setDraftH(Math.floor(s/3600)); setDraftM(Math.floor((s%3600)/60))
  }

  // Toggle the currently displayed mode only
  const toggleRunning = () => {
    haptic.medium()
    if (mode==='timer') {
      if (!timerRunning) { playTimerStart(); warned90Timer.current = false }
      setTimerRunning(r => !r)
    }
    if (mode==='short') {
      if (!shortRunning) { playBreakStart(); warned90Short.current = false }
      setShortRunning(r => !r)
    }
    if (mode==='long') {
      if (!longRunning) { playBreakStart(); warned90Long.current = false }
      setLongRunning(r => !r)
    }
    if (mode==='stopwatch') setSwRunning(r => !r)
  }

  // ── Drag ──
  const handleDragStart = useCallback((e, side) => {
    if (running || mode==='stopwatch') return
    const clientY = e.touches?e.touches[0].clientY:e.clientY
    const cur = mode==='short'?shortSecRef.current:mode==='long'?longSecRef.current:timerSecRef.current
    const curH=Math.floor(cur/3600), curM=Math.floor((cur%3600)/60)
    dragRef.current = { active:true, side, startY:clientY, startH:curH, startM:curM }
    setDragSide(side); setIsDragging(true); setDraftH(curH); setDraftM(curM)
  }, [running, mode])

  const handleDragMove = useCallback((e) => {
    if (!dragRef.current.active) return
    const dy = dragRef.current.startY - e.clientY
    if (dragRef.current.side==='left') setDraftH(Math.max(0,Math.min(23,dragRef.current.startH+Math.round(dy/12))))
    else                               setDraftM(Math.max(0,Math.min(59,dragRef.current.startM+Math.round(dy/4))))
  }, [])

  const handleDragEnd = useCallback(() => {
    if (!dragRef.current.active) return
    dragRef.current.active = false
    const newSec = draftH*3600+draftM*60
    if (newSec > 0) { setCurrentModeSec(newSec); setTimerRunning(false); setShortRunning(false); setLongRunning(false) }
    setIsDragging(false); setDragSide(null)
    // reset just this mode's elapsed
    if (mode==='timer') { setTimerElapsed(0); timerElRef.current=0 }
    if (mode==='short') { setShortElapsed(0); shortElRef.current=0 }
    if (mode==='long')  { setLongElapsed(0);  longElRef.current=0  }
  }, [draftH, draftM, mode, setCurrentModeSec])

  // ── Swipe ──
  const handleSwipeStart = useCallback((e) => {
    if (isDragging) return
    const x = e.touches?.[0]?.clientX ?? e.clientX
    swipeRef.current = { active:true, startX:x, startMode:modeRef.current }
  }, [isDragging])

  const handleSwipeEnd = useCallback((e) => {
    if (!swipeRef.current.active) return
    swipeRef.current.active = false
    const x = e.changedTouches?.[0]?.clientX ?? e.clientX
    const dx = x - swipeRef.current.startX
    if (Math.abs(dx) < 60) return
    const idx = MODES.indexOf(swipeRef.current.startMode)
    if (dx < 0 && idx < MODES.length-1) switchMode(MODES[idx+1])
    else if (dx > 0 && idx > 0)         switchMode(MODES[idx-1])
  }, []) // eslint-disable-line

  // ── Display values ──
  const arcH          = 220+progress*80
  const timerRemaining= totalSec-elapsed
  const dispH  = isDragging&&dragSide==='left' ?draftH:Math.floor(totalSec/3600)
  const dispM  = isDragging&&dragSide==='right'?draftM:Math.floor((totalSec%3600)/60)
  const dispS  = Math.floor(totalSec%60)
  const dispRunH=Math.floor(timerRemaining/3600)
  const dispRunM=Math.floor((timerRemaining%3600)/60)
  const dispRunS=Math.floor(timerRemaining%60)
  const swH=Math.floor(swElapsed/3600), swM=Math.floor((swElapsed%3600)/60), swS=swElapsed%60

  const PRESETS_FOCUS=[{label:'15m',sec:900},{label:'25m',sec:1500},{label:'45m',sec:2700},{label:'1h',sec:3600},{label:'2h',sec:7200}]
  const PRESETS_SHORT=[{label:'5m',sec:300},{label:'10m',sec:600},{label:'15m',sec:900}]
  const PRESETS_LONG =[{label:'15m',sec:900},{label:'20m',sec:1200},{label:'30m',sec:1800},{label:'45m',sec:2700}]
  const modePresets = mode==='short'?PRESETS_SHORT:mode==='long'?PRESETS_LONG:PRESETS_FOCUS

  const msgs=[[0,'Drag hours · minutes to set'],[.01,'Your universe is beginning to form...'],[.12,'The first planets emerge from the void'],[.28,'Gravity is pulling you into focus...'],[.45,'New worlds are being born'],[.62,'Your solar system glows brighter'],[.78,'The cosmos is alive with your energy'],[.90,'One final orbit — make it count'],[.98,'✦ A universe was born from your focus']]
  const breakMsgs={short:[[0,'Short break · drag to set'],[.3,'Rest your eyes, stretch a little...'],[.7,'Almost done — get ready to focus again']],long:[[0,'Long break · drag to set'],[.2,'You earned this — rest well 🌿'],[.6,'Recharge your mind and body'],[.85,'Coming back stronger...']]}
  const msg = mode==='short'?([...breakMsgs.short].reverse().find(([th])=>progress>=th)?.[1]||breakMsgs.short[0][1])
            : mode==='long' ?([...breakMsgs.long].reverse().find(([th]) =>progress>=th)?.[1]||breakMsgs.long[0][1])
            : [...msgs].reverse().find(([th])=>progress>=th)?.[1]||msgs[0][1]

  return (
    <div
      style={{position:'relative',height:'100dvh',background:'#000',overflow:'hidden',display:'flex',flexDirection:'column'}}
      onTouchStart={handleSwipeStart}
      onTouchEnd={handleSwipeEnd}
    >
      <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%'}} />

      {/* Nav — exact original position */}
      <div style={{position:'relative',zIndex:10,padding:'20px 16px 0'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <button onClick={()=>navigate('/focus')} style={{width:36,height:36,borderRadius:12,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.65)',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
          {completed>0&&<div style={{background:'rgba(0,0,0,0.45)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:20,padding:'7px 14px'}}><span style={{fontSize:11,fontFamily:'Inter,sans-serif',color:'rgba(255,255,255,0.5)',fontWeight:600}}>✦ {completed}</span></div>}
        </div>
        {/* Mode pill — centred, in nav area */}
        <div style={{display:'flex',justifyContent:'center'}}>
          <div style={{display:'flex',background:'rgba(0,0,0,0.50)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:24,padding:3,gap:0,boxShadow:'0 4px 20px rgba(0,0,0,0.5)'}}>
            {[
              {m:'timer',     label:'Focus'},
              {m:'short',     label:'Short Break'},
              {m:'long',      label:'Long Break'},
              {m:'stopwatch', label:'Stopwatch'},
            ].map(({m,label})=>(
              <button key={m} onClick={()=>switchMode(m)} style={{padding:'8px 14px',borderRadius:20,fontFamily:'Inter,sans-serif',background:mode===m?'rgba(255,255,255,0.15)':'transparent',border:'none',color:mode===m?'#fff':'rgba(255,255,255,0.38)',fontSize:11,fontWeight:mode===m?700:400,cursor:'pointer',transition:'all 0.25s',whiteSpace:'nowrap',position:'relative'}}>
                {label}
                {/* Green dot when this mode is actively running in background */}
                {((m==='timer'&&timerRunning)||(m==='short'&&shortRunning)||(m==='long'&&longRunning)||(m==='stopwatch'&&swRunning))&&mode!==m&&(
                  <span style={{position:'absolute',top:4,right:4,width:5,height:5,borderRadius:'50%',background:'#34d399',display:'block'}}/>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Centre — exact original structure */}
      <div style={{position:'relative',zIndex:10,flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10}}>
        {mode==='stopwatch'
          ? <StopwatchFace swH={swH} swM={swM} swS={swS} />
          : <TimerFace
              dispH={dispH} dispM={dispM} dispS={dispS}
              dispRunH={dispRunH} dispRunM={dispRunM} dispRunS={dispRunS}
              totalSec={totalSec} isDragging={isDragging} dragSide={dragSide}
              running={running} arcH={arcH} progress={progress}
              handleDragStart={handleDragStart}
              handleDragMove={handleDragMove}
              handleDragEnd={handleDragEnd}
            />
        }
        {isDragging&&(
          <div style={{fontSize:12,color:`hsl(${arcH},80%,72%)`,fontFamily:'Inter,sans-serif',fontWeight:600,letterSpacing:'0.3px'}}>
            Setting {dragSide==='left'?`${draftH}h`:`${draftM}m`} — release to confirm
          </div>
        )}
        <p style={{fontSize:12,color:'rgba(255,255,255,0.28)',fontFamily:'Inter,sans-serif',letterSpacing:'0.2px',textAlign:'center',padding:'0 44px',lineHeight:1.5,marginTop:4}}>
          {mode==='stopwatch'?(running?'Time is flowing...':'Ready · swipe to switch mode'):msg}
        </p>
      </div>

      {/* Bottom — exact original structure */}
      <div style={{position:'relative',zIndex:10,padding:'0 16px 36px',display:'flex',flexDirection:'column',gap:12}}>
        {/* Focus presets */}
        {mode==='timer'&&!running&&(
          <div style={{display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap'}}>
            {PRESETS.map(pr=>(
              <button key={pr.sec} onClick={()=>{reset();setTimerSec(pr.sec);setDraftH(Math.floor(pr.sec/3600));setDraftM(Math.floor((pr.sec%3600)/60))}} style={{padding:'7px 14px',borderRadius:20,fontFamily:'Inter,sans-serif',background:timerSec===pr.sec?`hsla(${arcH},65%,45%,.22)`:'rgba(0,0,0,0.42)',backdropFilter:'blur(10px)',border:`1px solid ${timerSec===pr.sec?`hsla(${arcH},70%,60%,.5)`:'rgba(255,255,255,0.09)'}`,color:timerSec===pr.sec?`hsl(${arcH},85%,80%)`:'rgba(255,255,255,0.38)',fontSize:12,fontWeight:600,cursor:'pointer',transition:'all 0.25s'}}>{pr.label}</button>
            ))}
          </div>
        )}
        {/* Short break presets */}
        {mode==='short'&&!running&&(
          <div style={{display:'flex',gap:6,justifyContent:'center'}}>
            {SHORT_PRESETS.map(pr=>(
              <button key={pr.sec} onClick={()=>{setShortBreakSec(pr.sec);setShortElapsed(0);shortElRef.current=0;setDraftH(0);setDraftM(Math.floor(pr.sec/60))}} style={{padding:'7px 14px',borderRadius:20,fontFamily:'Inter,sans-serif',background:shortBreakSec===pr.sec?'hsla(160,65%,40%,.22)':'rgba(0,0,0,0.42)',backdropFilter:'blur(10px)',border:`1px solid ${shortBreakSec===pr.sec?'hsla(160,70%,55%,.5)':'rgba(255,255,255,0.09)'}`,color:shortBreakSec===pr.sec?'hsl(160,85%,75%)':'rgba(255,255,255,0.38)',fontSize:12,fontWeight:600,cursor:'pointer',transition:'all 0.25s'}}>{pr.label}</button>
            ))}
          </div>
        )}
        {/* Long break presets */}
        {mode==='long'&&!running&&(
          <div style={{display:'flex',gap:6,justifyContent:'center'}}>
            {LONG_PRESETS.map(pr=>(
              <button key={pr.sec} onClick={()=>{setLongBreakSec(pr.sec);setLongElapsed(0);longElRef.current=0;setDraftH(0);setDraftM(Math.floor(pr.sec/60))}} style={{padding:'7px 14px',borderRadius:20,fontFamily:'Inter,sans-serif',background:longBreakSec===pr.sec?'hsla(270,65%,45%,.22)':'rgba(0,0,0,0.42)',backdropFilter:'blur(10px)',border:`1px solid ${longBreakSec===pr.sec?'hsla(270,70%,60%,.5)':'rgba(255,255,255,0.09)'}`,color:longBreakSec===pr.sec?'hsl(270,85%,80%)':'rgba(255,255,255,0.38)',fontSize:12,fontWeight:600,cursor:'pointer',transition:'all 0.25s'}}>{pr.label}</button>
            ))}
          </div>
        )}
        {/* Break fine-tune ± buttons */}
        {(mode==='short'||mode==='long')&&!running&&(
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:16}}>
            <span style={{fontSize:12,color:'rgba(255,255,255,0.35)',fontFamily:'Inter,sans-serif'}}>Duration</span>
            <button onClick={()=>{
              const cur=mode==='short'?shortBreakSec:longBreakSec
              const s=Math.max(60,cur-60)
              if(mode==='short'){setShortBreakSec(s);setShortElapsed(0);shortElRef.current=0;setDraftH(0);setDraftM(Math.floor(s/60))}
              else{setLongBreakSec(s);setLongElapsed(0);longElRef.current=0;setDraftH(0);setDraftM(Math.floor(s/60))}
            }} style={{width:36,height:36,borderRadius:12,background:'rgba(255,255,255,0.12)',backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',fontSize:22,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>−</button>
            <span style={{fontSize:20,fontWeight:700,color:'#fff',fontFamily:'DM Mono,monospace',minWidth:56,textAlign:'center'}}>{Math.floor((mode==='short'?shortBreakSec:longBreakSec)/60)}m</span>
            <button onClick={()=>{
              const cur=mode==='short'?shortBreakSec:longBreakSec
              const s=cur+60
              if(mode==='short'){setShortBreakSec(s);setShortElapsed(0);shortElRef.current=0;setDraftH(0);setDraftM(Math.floor(s/60))}
              else{setLongBreakSec(s);setLongElapsed(0);longElRef.current=0;setDraftH(0);setDraftM(Math.floor(s/60))}
            }} style={{width:36,height:36,borderRadius:12,background:'rgba(255,255,255,0.12)',backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',fontSize:22,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>+</button>
          </div>
        )}
        <div style={{display:'flex',gap:10}}>
          {(running||elapsed>0||swElapsed>0)&&(
            <button onClick={reset} style={{flex:1,padding:'15px',borderRadius:16,fontFamily:'Inter,sans-serif',background:'rgba(0,0,0,0.42)',backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,0.09)',color:'rgba(255,255,255,0.42)',fontSize:14,fontWeight:600,cursor:'pointer'}}>Reset</button>
          )}
          <button onClick={toggleRunning} style={{flex:2,padding:'15px',borderRadius:16,fontFamily:'Inter,sans-serif',background:running?'rgba(0,0,0,0.42)':mode==='stopwatch'?'linear-gradient(135deg,rgba(96,165,250,.88),rgba(59,130,246,.72))':`linear-gradient(135deg,hsla(${arcH},72%,58%,.9),hsla(${arcH+22},72%,46%,.75))`,backdropFilter:running?'blur(10px)':'none',border:running?'1px solid rgba(255,255,255,0.09)':'none',color:running?'rgba(255,255,255,0.55)':'#000',fontSize:15,fontWeight:700,cursor:'pointer',letterSpacing:'-0.2px',transition:'all 0.3s'}}>
            {running?'Pause':(elapsed>0||swElapsed>0)?'Resume':mode==='timer'?'Start Session':mode==='short'?'Start Short Break':mode==='long'?'Start Long Break':'Start'}
          </button>
        </div>
      </div>

      {/* ── ALARM BANNER — shown when timer ends while app is in background ── */}
      {alarmActive&&!showReward&&(
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.92)',backdropFilter:'blur(28px)',zIndex:100,animation:'fadeIn 0.4s ease'}}>
          <div style={{textAlign:'center',padding:'0 44px',display:'flex',flexDirection:'column',alignItems:'center',gap:20}}>
            <div style={{fontSize:72,lineHeight:1,animation:'alarmPulse 1s ease-in-out infinite alternate'}}>⏰</div>
            <h2 style={{fontSize:28,fontWeight:900,color:'#fff',letterSpacing:'-1px',fontFamily:'Inter,sans-serif'}}>Timer Complete!</h2>
            <p style={{fontSize:15,color:'rgba(255,255,255,0.6)',fontFamily:'Inter,sans-serif',lineHeight:1.5}}>Your session has ended. Notifications will keep ringing until you dismiss.</p>
            <button
              onClick={stopAlarm}
              style={{marginTop:8,padding:'16px 48px',borderRadius:20,background:'linear-gradient(135deg,#60a5fa,#3b82f6)',border:'none',color:'#fff',fontSize:16,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',letterSpacing:'-0.3px',boxShadow:'0 4px 24px rgba(96,165,250,0.5)'}}>
              ✓ Dismiss Alarm
            </button>
          </div>
        </div>
      )}

      {showReward&&(
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.82)',backdropFilter:'blur(28px)',zIndex:100,animation:'fadeIn 0.5s ease'}}>
          <div style={{textAlign:'center',padding:'0 44px',animation:'scaleIn 0.5s cubic-bezier(0.16,1,0.3,1)'}}>
            <div style={{fontSize:88,lineHeight:1,marginBottom:22,filter:`drop-shadow(0 0 50px hsla(${arcH},90%,70%,.95))`,animation:'starSpin 3s linear infinite'}}>✦</div>
            <h2 style={{fontSize:30,fontWeight:900,color:'#fff',letterSpacing:'-1px',marginBottom:10,fontFamily:'Inter,sans-serif'}}>Universe Forged</h2>
            <p style={{fontSize:16,color:`hsla(${arcH},65%,74%,.85)`,fontFamily:'Inter,sans-serif'}}>{mode==='short'?'Short break complete ☕':mode==='long'?'Long break complete 🌿':`${Math.round(totalSec/60)} minutes of pure focus`}</p>
            <p style={{fontSize:22,fontWeight:700,color:'#fff',marginTop:18,fontFamily:'Inter,sans-serif'}}>✦ {completed} universe{completed>1?'s':''} created</p>
          </div>
        </div>
      )}
      <style>{`
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes scaleIn{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
        @keyframes starSpin{from{transform:rotate(0deg) scale(1)}50%{transform:rotate(180deg) scale(1.15)}to{transform:rotate(360deg) scale(1)}}
        @keyframes alarmPulse{from{transform:scale(1) rotate(-8deg);filter:drop-shadow(0 0 20px rgba(251,191,36,0.6))}to{transform:scale(1.15) rotate(8deg);filter:drop-shadow(0 0 40px rgba(251,191,36,0.9))}}
      `}</style>
    </div>
  )
}
