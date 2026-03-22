import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../../app/useTheme'
import { useAppStore } from '../../app/store'
import Header from '../../components/layout/Header'
import ShareCard from './ShareCard'
import { haptic } from '../../utils/haptics'

/* ── GitHub-style activity heatmap ── */
function ActivityHeatmap({ timerSessions, notes, t }) {
  const [tooltip, setTooltip] = useState(null)

  const minutesByDay = {}
  timerSessions.forEach(s => {
    const d = new Date(s.date); if (isNaN(d)) return
    const key = d.toDateString()
    minutesByDay[key] = (minutesByDay[key] || 0) + (s.duration || 0)
  })
  const notesByDay = {}
  notes.forEach(n => {
    const d = new Date(n.createdAt); if (isNaN(d)) return
    const key = d.toDateString()
    notesByDay[key] = (notesByDay[key] || 0) + 1
  })

  const today = new Date(); today.setHours(0,0,0,0)
  const monthFirst = new Date(today.getFullYear(), today.getMonth(), 1)
  const gridStartDate = new Date(monthFirst)
  gridStartDate.setDate(gridStartDate.getDate() - gridStartDate.getDay())
  const historyStartDate = new Date(gridStartDate)
  historyStartDate.setDate(historyStartDate.getDate() - 52 * 7)

  const buildWeeks = (from, to) => {
    const result = []; const cur = new Date(from)
    while (cur <= to) {
      const week = []
      for (let day = 0; day < 7; day++) {
        const key = cur.toDateString()
        week.push({ date: new Date(cur), key, mins: minutesByDay[key]||0, noteCount: notesByDay[key]||0, isFuture: cur > today })
        cur.setDate(cur.getDate() + 1)
      }
      result.push(week)
    }
    return result
  }

  const todayWeekEnd = new Date(today); todayWeekEnd.setDate(todayWeekEnd.getDate() + (6 - todayWeekEnd.getDay()))
  const weeks = [...buildWeeks(gridStartDate, todayWeekEnd), ...buildWeeks(historyStartDate, new Date(gridStartDate.getTime()-1))]

  const getColor = (mins, isFuture) => {
    if (isFuture) return 'transparent'
    if (mins === 0) return t.inputBg
    if (mins < 30)  return 'rgba(52,211,153,0.20)'
    if (mins < 90)  return 'rgba(52,211,153,0.45)'
    if (mins < 180) return 'rgba(52,211,153,0.70)'
    if (mins < 360) return 'rgba(52,211,153,0.88)'
    return 'rgba(52,211,153,0.98)'
  }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const COL_W  = 13
  const monthLabels = []
  weeks.forEach((week, wi) => {
    const firstOfMonth = week.find(cell => !cell.isFuture && cell.date.getDate() === 1)
    if (!firstOfMonth) return
    if (wi > weeks.length - 2) return
    const last = monthLabels[monthLabels.length - 1]
    if (last && wi - last.wi < 3) return
    monthLabels.push({ wi, label: MONTHS[firstOfMonth.date.getMonth()] })
  })

  const DAYS = ['S','M','T','W','T','F','S']

  return (
    <div>
      <div style={{ display:'flex' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:2, marginRight:4, flexShrink:0, paddingTop:20 }}>
          {DAYS.map((d, i) => (
            <div key={i} style={{ height:11, display:'flex', alignItems:'center' }}>
              <span style={{ fontSize:8, color:t.textFaint, fontFamily:'Inter,sans-serif', width:14, textAlign:'right' }}>{d}</span>
            </div>
          ))}
        </div>
        <div style={{ overflowX:'auto', flex:1, position:'relative' }}>
          <div style={{ position:'relative', height:18, marginBottom:2 }}>
            {monthLabels.map(({ wi, label }) => (
              <span key={wi} style={{ position:'absolute', left: wi * COL_W, top:0, fontSize:9, fontWeight:600, color:t.textMuted, fontFamily:'Inter,sans-serif', whiteSpace:'nowrap', lineHeight:'18px', userSelect:'none' }}>{label}</span>
            ))}
          </div>
          <div style={{ display:'flex', gap:2 }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display:'flex', flexDirection:'column', gap:2 }}>
                {week.map((cell, di) => (
                  <div key={di}
                    onMouseEnter={e => !cell.isFuture && setTooltip({ cell, x:e.clientX, y:e.clientY })}
                    onMouseLeave={() => setTooltip(null)}
                    style={{ width:11, height:11, borderRadius:2, flexShrink:0, background: getColor(cell.mins, cell.isFuture), border: cell.date.toDateString()===today.toDateString() ? '1px solid rgba(52,211,153,0.8)' : `1px solid ${cell.isFuture?'transparent':t.border}`, cursor: cell.mins>0 ? 'pointer' : 'default' }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:8, justifyContent:'flex-end', flexWrap:'wrap' }}>
        {[{c:t.inputBg,label:'0'},{c:'rgba(52,211,153,0.20)',label:'<30m'},{c:'rgba(52,211,153,0.45)',label:'1h'},{c:'rgba(52,211,153,0.70)',label:'3h'},{c:'rgba(52,211,153,0.88)',label:'6h'},{c:'rgba(52,211,153,0.98)',label:'8h+'}].map(({c:col,label}) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:2 }}>
            <div style={{ width:11, height:11, borderRadius:2, background:col, border:`1px solid ${t.border}`, flexShrink:0 }} />
            <span style={{ fontSize:9, color:t.textFaint, fontFamily:'Inter,sans-serif' }}>{label}</span>
          </div>
        ))}
      </div>
      {tooltip && (
        <div style={{ position:'fixed', left:tooltip.x+12, top:tooltip.y-60, zIndex:999, background:t.card, border:`1px solid ${t.border}`, borderRadius:10, padding:'8px 12px', pointerEvents:'none', boxShadow:t.shadow }}>
          <p style={{ fontSize:11, fontWeight:600, color:t.text, fontFamily:'Inter,sans-serif', marginBottom:2 }}>{tooltip.cell.date.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</p>
          <p style={{ fontSize:11, color:'rgba(52,211,153,0.9)', fontFamily:'Inter,sans-serif' }}>{tooltip.cell.mins>0 ? `${tooltip.cell.mins} min focused` : 'No activity'}</p>
          {tooltip.cell.noteCount>0 && <p style={{ fontSize:10, color:t.textMuted, fontFamily:'Inter,sans-serif', marginTop:1 }}>{tooltip.cell.noteCount} note{tooltip.cell.noteCount>1?'s':''} created</p>}
        </div>
      )}
    </div>
  )
}

/* ── Goals editor ── */
function GoalsPanel({ goals, updateGoals, t, onClose }) {
  const [local, setLocal] = useState({ ...goals })
  const save = () => { haptic.success(); updateGoals(local); onClose() }

  const Stepper = ({ label, val, min, max, step=1, unit, key2 }) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:`1px solid ${t.border}` }}>
      <div>
        <p style={{ fontSize:13, fontWeight:600, color:t.text, fontFamily:'Inter,sans-serif' }}>{label}</p>
        <p style={{ fontSize:11, color:t.textMuted, fontFamily:'Inter,sans-serif' }}>{val}{unit}</p>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <button onClick={()=>setLocal(g=>({...g,[key2]:Math.max(min,g[key2]-step)}))} style={{ width:30,height:30,borderRadius:8,background:t.inputBg,border:`1px solid ${t.border}`,color:t.text,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>−</button>
        <span style={{ fontSize:15,fontWeight:700,color:t.text,fontFamily:'DM Mono,monospace',minWidth:36,textAlign:'center' }}>{local[key2]}</span>
        <button onClick={()=>setLocal(g=>({...g,[key2]:Math.min(max,g[key2]+step)}))} style={{ width:30,height:30,borderRadius:8,background:t.inputBg,border:`1px solid ${t.border}`,color:t.text,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
      </div>
    </div>
  )

  return (
    <div style={{ position:'fixed',inset:0,zIndex:100,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(16px)',display:'flex',alignItems:'flex-end',padding:0 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%',background:t.card,borderRadius:'24px 24px 0 0',padding:'24px 20px 40px',border:`1px solid ${t.border}` }}>
        <div style={{ width:36,height:4,borderRadius:2,background:t.borderMed,margin:'0 auto 20px' }} />
        <p style={{ fontSize:16,fontWeight:700,color:t.text,fontFamily:'Inter,sans-serif',marginBottom:4 }}>Study Goals</p>
        <p style={{ fontSize:12,color:t.textMuted,fontFamily:'Inter,sans-serif',marginBottom:16 }}>Set your daily and weekly targets</p>
        <Stepper label="Daily Focus Goal" unit="min" min={15} max={480} step={15} key2="dailyMins" />
        <Stepper label="Weekly Tests Goal" unit=" tests" min={1} max={14} key2="weeklyTests" />
        <Stepper label="Streak Target" unit=" days" min={7} max={365} step={7} key2="streakTarget" />
        <button onClick={save} style={{ width:'100%',padding:'14px',borderRadius:14,background:t.text,border:'none',color:t.bg,fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',marginTop:20 }}>Save Goals</button>
      </div>
    </div>
  )
}

export default function ProgressHub() {
  const { isDark, t } = useTheme()
  const { testResults, timerSessions, streak, notes, todayStudied, goals, updateGoals, personalBests, refreshStreak } = useAppStore()
  const [shareResult, setShareResult] = useState(null)
  const [showGoals, setShowGoals]     = useState(false)
  const [refreshing, setRefreshing]   = useState(false)
  const pullStartY = useRef(null)
  const scrollRef  = useRef(null)

  const totalTests    = testResults.length
  const avgScore      = totalTests ? Math.round(testResults.reduce((a,r) => a+r.score, 0) / totalTests) : 0
  const totalFocusMin = timerSessions.reduce((a,s) => a+(s.duration||0), 0)
  const totalNotes    = notes.length
  const activeDays    = new Set(timerSessions.map(s => new Date(s.date).toDateString())).size
  const focusDisplay  = totalFocusMin >= 60 ? `${Math.floor(totalFocusMin/60)}h ${totalFocusMin%60}m` : `${totalFocusMin}m`
  const todayDisplay  = todayStudied >= 60 ? `${Math.floor(todayStudied/60)}h ${todayStudied%60}m` : `${todayStudied}m`

  // Weekly tests this week
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0)
  const weeklyTests = testResults.filter(r => new Date(r.date) >= weekStart).length

  // Subject performance
  const subjectScores = {}
  testResults.forEach(r => { if (!subjectScores[r.subject]) subjectScores[r.subject] = []; subjectScores[r.subject].push(r.score) })
  const subjectAvg = Object.entries(subjectScores)
    .map(([s, scores]) => ({ subject:s, avg: Math.round(scores.reduce((a,b)=>a+b,0)/scores.length), count: scores.length }))
    .sort((a,b) => b.avg - a.avg)

  // Pull to refresh
  const onTouchStart = e => { if (scrollRef.current?.scrollTop === 0) pullStartY.current = e.touches[0].clientY }
  const onTouchEnd = e => {
    if (pullStartY.current === null) return
    const dy = e.changedTouches[0].clientY - pullStartY.current
    if (dy > 70) { haptic.medium(); setRefreshing(true); refreshStreak(); setTimeout(()=>setRefreshing(false), 800) }
    pullStartY.current = null
  }

  const STATS = [
    { label:'Streak', val:`${streak}`, unit:'days', sub: streak===0?'Start today!':streak<7?`${7-streak}d to a week`:streak>=goals.streakTarget?'🏆 Goal reached!':'🔥 Keep going', color:'#fb923c',
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2C10 5 6 9 6 13a6 6 0 0012 0c0-4-4-8-6-11z" fill="rgba(251,146,60,0.9)"/><path d="M12 9c0 0-2 2-2 3.5a2 2 0 004 0C14 11 12 9 12 9z" fill="rgba(255,220,80,0.9)"/></svg> },
    { label:'Avg Score', val:`${avgScore}`, unit:'%', sub: totalTests===0?'No tests yet':`${totalTests} test${totalTests!==1?'s':''}`, color:t.green,
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
    { label:'Focus Time', val:focusDisplay, unit:'', sub:`${activeDays} active day${activeDays!==1?'s':''}`, color:t.blue,
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.blue} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { label:'Notes', val:`${totalNotes}`, unit:'', sub:`${todayDisplay} today`, color:t.purple,
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.purple} strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
  ]

  return (
    <div ref={scrollRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ padding:'0 0 80px', overflowY:'auto', height:'100%' }}>
      <Header title="Progress" subtitle="Your journey"
        right={<button onClick={()=>{haptic.light();setShowGoals(true)}} style={{ padding:'6px 14px',borderRadius:10,background:t.inputBg,border:`1px solid ${t.border}`,color:t.textSec,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif' }}>Goals</button>}
      />

      {/* Pull to refresh indicator */}
      {refreshing && (
        <div style={{ textAlign:'center', padding:'4px 0 8px', fontSize:12, color:t.teal, fontFamily:'Inter,sans-serif' }}>↻ Refreshing...</div>
      )}

      {/* ── STATS GRID ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, padding:'8px 16px 0' }}>
        {STATS.map(({ label, val, unit, sub, color, icon }) => (
          <div key={label} style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:20, padding:'16px', boxShadow:t.shadowSm, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute',top:-20,right:-20,width:80,height:80,background:`radial-gradient(circle,${color}20 0%,transparent 70%)`,borderRadius:'50%',pointerEvents:'none' }} />
            <div style={{ width:36,height:36,borderRadius:11,background:`${color}18`,border:`1px solid ${color}30`,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12 }}>{icon}</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:3 }}>
              <p style={{ fontSize:28,fontWeight:900,color,letterSpacing:'-1px',fontFamily:'Inter,sans-serif',lineHeight:1 }}>{val}</p>
              {unit && <span style={{ fontSize:13, color:t.textMuted, fontFamily:'Inter,sans-serif' }}>{unit}</span>}
            </div>
            <p style={{ fontSize:12,fontWeight:600,color:t.textSec,fontFamily:'Inter,sans-serif',marginTop:4 }}>{label}</p>
            <p style={{ fontSize:10,color:t.textMuted,fontFamily:'Inter,sans-serif',marginTop:2 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── GOALS PROGRESS ── */}
      <div style={{ margin:'12px 16px 0', background:t.card, border:`1px solid ${t.border}`, borderRadius:20, padding:'16px', boxShadow:t.shadowSm }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <p style={{ fontSize:13,fontWeight:700,color:t.text,fontFamily:'Inter,sans-serif' }}>Today's Goals</p>
          <span style={{ fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif' }}>{new Date().toLocaleDateString('en-IN',{weekday:'long'})}</span>
        </div>
        {[
          { label:'Daily Focus', current:todayStudied, goal:goals.dailyMins, unit:'min', color:t.teal },
          { label:'Weekly Tests', current:weeklyTests, goal:goals.weeklyTests, unit:` / ${goals.weeklyTests}`, color:t.blue },
          { label:'Streak Target', current:streak, goal:goals.streakTarget, unit:` / ${goals.streakTarget}d`, color:'#fb923c' },
        ].map(({ label, current, goal, unit, color }) => {
          const pct = Math.min((current/goal)*100, 100)
          const done = current >= goal
          return (
            <div key={label} style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:12,color:t.textSec,fontFamily:'Inter,sans-serif' }}>{label}</span>
                <span style={{ fontSize:12,fontWeight:700,color:done?color:t.textMuted,fontFamily:'DM Mono,monospace' }}>{done?'✓ Done':`${current}${unit}`}</span>
              </div>
              <div style={{ height:5,background:t.inputBg,borderRadius:3,overflow:'hidden' }}>
                <div style={{ height:'100%',background:color,borderRadius:3,width:`${pct}%`,transition:'width 0.5s ease' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── PERSONAL BESTS ── */}
      {(personalBests.bestDayMins > 0 || personalBests.bestScore > 0) && (
        <div style={{ margin:'12px 16px 0', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {personalBests.bestDayMins > 0 && (
            <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:16, padding:'14px', boxShadow:t.shadowSm, textAlign:'center' }}>
              <p style={{ fontSize:10,color:t.textMuted,fontFamily:'Inter,sans-serif',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:6 }}>Best Day</p>
              <p style={{ fontSize:22,fontWeight:900,color:t.blue,fontFamily:'DM Mono,monospace',lineHeight:1 }}>
                {personalBests.bestDayMins >= 60 ? `${Math.floor(personalBests.bestDayMins/60)}h${personalBests.bestDayMins%60>0?personalBests.bestDayMins%60+'m':''}` : `${personalBests.bestDayMins}m`}
              </p>
              <p style={{ fontSize:10,color:t.textFaint,fontFamily:'Inter,sans-serif',marginTop:4 }}>focus in one day</p>
            </div>
          )}
          {personalBests.bestScore > 0 && (
            <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:16, padding:'14px', boxShadow:t.shadowSm, textAlign:'center' }}>
              <p style={{ fontSize:10,color:t.textMuted,fontFamily:'Inter,sans-serif',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:6 }}>Best Score</p>
              <p style={{ fontSize:22,fontWeight:900,color:t.green,fontFamily:'DM Mono,monospace',lineHeight:1 }}>{personalBests.bestScore}%</p>
              <p style={{ fontSize:10,color:t.textFaint,fontFamily:'Inter,sans-serif',marginTop:4 }}>all time high</p>
            </div>
          )}
        </div>
      )}

      {/* ── TODAY FOCUS BAR ── */}
      {todayStudied > 0 && (
        <div style={{ margin:'12px 16px 0', background:t.card, border:`1px solid ${t.border}`, borderRadius:16, padding:'14px 16px', boxShadow:t.shadowSm }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <p style={{ fontSize:13,fontWeight:600,color:t.text,fontFamily:'Inter,sans-serif' }}>Today's Focus</p>
            <span style={{ fontSize:13,fontWeight:700,color:t.teal,fontFamily:'DM Mono,monospace' }}>{todayDisplay}</span>
          </div>
          <div style={{ height:6,background:t.inputBg,borderRadius:3,overflow:'hidden' }}>
            <div style={{ height:'100%',background:`linear-gradient(90deg,${t.teal},${t.blue})`,borderRadius:3,width:`${Math.min((todayStudied/480)*100,100)}%`,transition:'width 0.5s ease' }} />
          </div>
          <p style={{ fontSize:10,color:t.textMuted,fontFamily:'Inter,sans-serif',marginTop:5 }}>
            {todayStudied>=480?'🏆 8h goal reached!':todayStudied>=goals.dailyMins?`✓ Daily goal done! ${480-todayStudied}min to 8h`:`${goals.dailyMins-todayStudied}min to daily goal`}
          </p>
        </div>
      )}

      {/* ── ACTIVITY HEATMAP ── */}
      <div style={{ margin:'12px 16px 0', background:t.card, border:`1px solid ${t.border}`, borderRadius:20, padding:'18px 16px', boxShadow:t.shadowSm }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <p style={{ fontSize:13,fontWeight:600,color:t.text,fontFamily:'Inter,sans-serif' }}>Activity</p>
          <p style={{ fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif' }}>{activeDays} active day{activeDays!==1?'s':''}</p>
        </div>
        <ActivityHeatmap timerSessions={timerSessions} notes={notes} t={t} />
      </div>

      {/* ── SUBJECT PERFORMANCE ── */}
      {subjectAvg.length > 0 && (
        <div style={{ margin:'12px 16px 0' }}>
          <p style={{ fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.4px',color:t.textMuted,fontFamily:'Inter,sans-serif',marginBottom:10 }}>Subject Performance</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {subjectAvg.map(({ subject, avg, count }) => {
              const col = avg>=80 ? t.green : avg>=50 ? t.amber : t.red
              return (
                <div key={subject} style={{ background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:'14px 16px',boxShadow:t.shadowSm }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
                    <span style={{ fontSize:14,fontWeight:600,color:t.text,fontFamily:'Inter,sans-serif' }}>{subject}</span>
                    <span style={{ fontSize:18,fontWeight:800,color:col,fontFamily:'DM Mono,monospace' }}>{avg}%</span>
                  </div>
                  <div style={{ display:'flex', gap:2, height:6 }}>
                    {Array.from({length:20},(_,i) => {
                      const filled = i < Math.round(avg/5)
                      return <div key={i} style={{ flex:1,borderRadius:2,background:filled?col:t.inputBg,opacity:filled?(0.4+(i/20)*0.6):1 }} />
                    })}
                  </div>
                  <p style={{ fontSize:10,color:t.textMuted,fontFamily:'Inter,sans-serif',marginTop:6 }}>{count} test{count!==1?'s':''} · {avg>=80?'Excellent':avg>=65?'Good':avg>=50?'Needs work':'Struggling'}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── RECENT TESTS ── */}
      {testResults.length > 0 && (
        <div style={{ margin:'12px 16px 0' }}>
          <p style={{ fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.4px',color:t.textMuted,fontFamily:'Inter,sans-serif',marginBottom:10 }}>Recent Tests</p>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {testResults.slice(0,5).map((r,i) => {
              const col = r.score>=80?t.green:r.score>=50?t.amber:t.red
              const emoji = r.score>=80?'🏆':r.score>=60?'🌟':r.score>=40?'💪':'📚'
              return (
                <div key={i} style={{ display:'flex',alignItems:'center',gap:14,background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:'12px 16px',boxShadow:t.shadowSm }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>{emoji}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13,fontWeight:600,color:t.text,fontFamily:'Inter,sans-serif',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{r.subject}</p>
                    <p style={{ fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif',marginTop:2 }}>{r.mode} · {new Date(r.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</p>
                  </div>
                  <p style={{ fontSize:22,fontWeight:900,color:col,fontFamily:'DM Mono,monospace',lineHeight:1,flexShrink:0 }}>{r.score}<span style={{ fontSize:12,fontWeight:400,color:t.textMuted }}>%</span></p>
                  <button onClick={()=>{haptic.light();setShareResult(r)}} style={{ background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:8,padding:'5px 8px',cursor:'pointer',color:t.textMuted,flexShrink:0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── RECENT SESSIONS ── */}
      {timerSessions.length > 0 && (
        <div style={{ margin:'12px 16px 0' }}>
          <p style={{ fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.4px',color:t.textMuted,fontFamily:'Inter,sans-serif',marginBottom:10 }}>Recent Sessions</p>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {timerSessions.slice(0,4).map((s,i) => (
              <div key={i} style={{ display:'flex',alignItems:'center',gap:12,background:t.card,border:`1px solid ${t.border}`,borderRadius:12,padding:'11px 14px',boxShadow:t.shadowSm }}>
                <div style={{ width:8,height:8,borderRadius:'50%',background:t.teal,flexShrink:0 }} />
                <p style={{ flex:1,fontSize:13,color:t.textSec,fontFamily:'Inter,sans-serif' }}>
                  {s.duration>=60?`${Math.floor(s.duration/60)}h ${s.duration%60>0?s.duration%60+'m':''}`.trim():`${s.duration}min`} focus session
                </p>
                <p style={{ fontSize:11,color:t.textMuted,fontFamily:'DM Mono,monospace' }}>{new Date(s.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalTests===0 && timerSessions.length===0 && (
        <div style={{ textAlign:'center', padding:'48px 20px' }}>
          <p style={{ fontSize:48, marginBottom:12 }}>📊</p>
          <p style={{ fontSize:16,fontWeight:700,color:t.textSec,fontFamily:'Inter,sans-serif' }}>No data yet</p>
          <p style={{ fontSize:13,color:t.textMuted,fontFamily:'Inter,sans-serif',marginTop:6,lineHeight:1.6 }}>Complete a focus session or take a practice test to start building your history</p>
        </div>
      )}

      {shareResult && <ShareCard result={shareResult} onClose={()=>setShareResult(null)} />}
      {showGoals && <GoalsPanel goals={goals} updateGoals={updateGoals} t={t} onClose={()=>setShowGoals(false)} />}
    </div>
  )
}