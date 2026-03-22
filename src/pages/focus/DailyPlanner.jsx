import { useState, useRef, useCallback } from 'react'
import { useTheme } from '../../app/useTheme'
import { haptic } from '../../utils/haptics'
import { useAppStore } from '../../app/store'
import Header from '../../components/layout/Header'

const PRIORITIES = ['High', 'Medium', 'Low']
const TASK_TYPES = ['Study', 'Revision', 'Practice', 'Break', 'Exercise', 'Other']
const COLORS = { High: '#f87171', Medium: '#fbbf24', Low: '#4ade80' }

// ── Uncontrolled form field — does NOT re-render parent on every keystroke ──
// This is the fix for the keyboard dismissing after each letter.
// The root cause: every onChange on a controlled input triggers setState →
// re-render → the Add-task container remounts → keyboard dismisses.
// Solution: use uncontrolled inputs (refs) for all text fields inside the form.
function TaskForm({ onAdd, onCancel, viewDate, t }) {
  const titleRef    = useRef(null)
  const timeRef     = useRef(null)
  const durationRef = useRef(null)
  const notesRef    = useRef(null)
  const [priority,  setPriority]  = useState('Medium')
  const [taskType,  setTaskType]  = useState('Study')

  const inp = {
    background: t.inputBg, border: `1px solid ${t.border}`,
    borderRadius: 10, padding: '10px 12px', color: t.text,
    fontSize: 13, fontFamily: 'Inter,sans-serif', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  }

  const handleAdd = () => {
    const title = titleRef.current?.value?.trim()
    if (!title) return
    haptic.success()
    onAdd({
      title,
      time:     timeRef.current?.value     || '',
      duration: durationRef.current?.value || '',
      notes:    notesRef.current?.value    || '',
      priority,
      type: taskType,
      date: viewDate.toISOString(),
    })
  }

  const F = ({ label, children, required }) => (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize:10, color:t.textMuted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.9px', marginBottom:6, fontFamily:'Inter,sans-serif' }}>
        {label}{required && ' *'}
      </p>
      {children}
    </div>
  )

  return (
    <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:20, padding:18, marginBottom:14, animation:'fadeIn 0.2s ease' }}>
      <F label="Task Title" required>
        <input
          ref={titleRef}
          placeholder="What do you need to do?"
          defaultValue=""
          // KEY FIX: no onChange/value — this is uncontrolled.
          // The input handles its own state; we only read it on submit.
          style={inp}
          // Keep keyboard open on mobile
          autoFocus
        />
      </F>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <F label="Time">
          <input ref={timeRef} type="time" defaultValue="" style={inp} />
        </F>
        <F label="Duration">
          <input ref={durationRef} placeholder="e.g. 1h 30m" defaultValue="" style={inp} />
        </F>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <F label="Priority">
          <div style={{ display:'flex', gap:5 }}>
            {PRIORITIES.map(p => (
              <button key={p} onClick={() => setPriority(p)} style={{
                flex:1, padding:'7px 4px', borderRadius:8, fontFamily:'Inter,sans-serif',
                background: priority === p ? COLORS[p] : t.inputBg,
                border: 'none',
                color: priority === p ? '#000' : t.textMuted,
                fontSize:11, fontWeight:600, cursor:'pointer',
              }}>{p}</button>
            ))}
          </div>
        </F>
        <F label="Type">
          <select
            value={taskType}
            onChange={e => setTaskType(e.target.value)}
            style={{ ...inp, appearance:'none', cursor:'pointer' }}
          >
            {TASK_TYPES.map(ty => <option key={ty} value={ty}>{ty}</option>)}
          </select>
        </F>
      </div>
      <F label="Notes (optional)">
        <input ref={notesRef} placeholder="Any extra details..." defaultValue="" style={inp} />
      </F>
      <div style={{ display:'flex', gap:8, marginTop:4 }}>
        <button onClick={onCancel} style={{ flex:1, padding:'12px', borderRadius:12, background:t.inputBg, border:'none', color:t.textSec, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>Cancel</button>
        <button onClick={handleAdd} style={{ flex:2, padding:'12px', borderRadius:12, background:'#fff', border:'none', color:'#000', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>Add Task</button>
      </div>
    </div>
  )
}

export default function DailyPlanner() {
  const { isDark, t } = useTheme()
  const { tasks, addTask, toggleTask, deleteTask } = useAppStore()
  const today  = new Date()
  const [viewDate, setViewDate]  = useState(today)
  const [showAdd, setShowAdd]    = useState(false)
  const [weekView, setWeekView]  = useState(false)

  // Build calendar: current month
  const [calMonth, setCalMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth()+1, 0).getDate()
  const firstDay    = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay()
  const monthName   = calMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  const dayTasks  = tasks.filter(t => new Date(t.date||Date.now()).toDateString() === viewDate.toDateString())
  const doneTasks = dayTasks.filter(t => t.done).length

  const getDateTasks = (d) => tasks.filter(t => new Date(t.date||Date.now()).toDateString() === d.toDateString())

  const handleAdd = useCallback((formData) => {
    addTask(formData)
    setShowAdd(false)
  }, [addTask])

  const copyWeekTasks = () => {
    const weekStart = new Date(viewDate)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const thisWeek = Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);return d})
    thisWeek.forEach(day => {
      const dayT = getDateTasks(day)
      dayT.forEach(t => {
        const nextDay = new Date(day)
        nextDay.setDate(nextDay.getDate()+7)
        addTask({ ...t, id: undefined, done: false, date: nextDay.toISOString() })
      })
    })
  }

  // Week view dates
  const weekStart = new Date(viewDate)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekDays = Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);return d})

  return (
    <div style={{ minHeight:'100vh' }}>
      <Header title="Planner" back right={
        <div style={{ display:'flex',gap:6 }}>
          <button onClick={()=>setWeekView(w=>!w)} style={{ padding:'6px 12px',borderRadius:10,background:weekView?t.text:t.inputBg,border:'none',color:weekView?t.bg:t.textMuted,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif' }}>Week</button>
          <button onClick={copyWeekTasks} title="Copy this week to next week" style={{ padding:'6px 12px',borderRadius:10,background:t.inputBg,border:'none',color:t.textSec,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif' }}>↻ Repeat</button>
        </div>
      } />

      <div style={{ padding:'0 16px 24px' }}>

        {/* ── CALENDAR ── */}
        <div style={{ background:t.card,border:`1px solid ${t.border}`,borderRadius:20,padding:'16px',marginBottom:16 }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
            <button onClick={()=>setCalMonth(d=>{const n=new Date(d);n.setMonth(n.getMonth()-1);return n})} style={{ width:28,height:28,borderRadius:8,background:t.inputBg,border:'none',color:t.textSec,cursor:'pointer',fontSize:14 }}>‹</button>
            <p style={{ fontSize:14,fontWeight:700,color:t.text,fontFamily:'Inter,sans-serif' }}>{monthName}</p>
            <button onClick={()=>setCalMonth(d=>{const n=new Date(d);n.setMonth(n.getMonth()+1);return n})} style={{ width:28,height:28,borderRadius:8,background:t.inputBg,border:'none',color:t.textSec,cursor:'pointer',fontSize:14 }}>›</button>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:6 }}>
            {['S','M','T','W','T','F','S'].map((d,i)=><div key={i} style={{ textAlign:'center',fontSize:10,color:t.textFaint,fontFamily:'Inter,sans-serif',fontWeight:600,padding:'4px 0' }}>{d}</div>)}
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2 }}>
            {Array.from({length:firstDay},(_,i)=><div key={'e'+i} />)}
            {Array.from({length:daysInMonth},(_,i)=>{
              const d = new Date(calMonth.getFullYear(),calMonth.getMonth(),i+1)
              const isSel  = d.toDateString()===viewDate.toDateString()
              const isToday = d.toDateString()===today.toDateString()
              const hasTasks = getDateTasks(d).length > 0
              return (
                <div key={i} onClick={()=>setViewDate(d)} style={{ textAlign:'center',padding:'6px 2px',borderRadius:8,cursor:'pointer',background:isSel?'#fff':'transparent',position:'relative',transition:'background 0.15s' }}>
                  <span style={{ fontSize:13,fontWeight:isSel||isToday?700:400,color:isSel?t.bg:isToday?t.blue:t.textSec,fontFamily:'Inter,sans-serif' }}>{i+1}</span>
                  {hasTasks&&!isSel&&<div style={{ width:3,height:3,borderRadius:'50%',background:'#60a5fa',margin:'2px auto 0' }} />}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── WEEK ROW ── */}
        {weekView && (
          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:16 }}>
            {weekDays.map((d,i)=>{
              const dt = getDateTasks(d)
              const isSel = d.toDateString()===viewDate.toDateString()
              return (
                <div key={i} onClick={()=>setViewDate(d)} style={{ background:isSel?t.inputBgF:t.inputBg,border:`1px solid ${isSel?t.borderMed:t.border}`,borderRadius:12,padding:'8px 4px',textAlign:'center',cursor:'pointer' }}>
                  <p style={{ fontSize:9,color:t.textMuted,fontFamily:'Inter,sans-serif',marginBottom:4 }}>{['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()]}</p>
                  <p style={{ fontSize:14,fontWeight:700,color:isSel?t.text:t.textMuted,fontFamily:'Inter,sans-serif' }}>{d.getDate()}</p>
                  {dt.length>0&&<p style={{ fontSize:9,color:'#60a5fa',fontFamily:'Inter,sans-serif',marginTop:3 }}>{dt.length}t</p>}
                </div>
              )
            })}
          </div>
        )}

        {/* ── SELECTED DAY HEADER ── */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
          <div>
            <p style={{ fontSize:13,fontWeight:700,color:t.text,fontFamily:'Inter,sans-serif' }}>
              {viewDate.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}
            </p>
            {dayTasks.length>0&&<p style={{ fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif',marginTop:2 }}>{doneTasks}/{dayTasks.length} done</p>}
          </div>
          <button
            onClick={()=>setShowAdd(s=>!s)}
            style={{ width:34,height:34,borderRadius:10,background:'#fff',border:'none',color:'#000',fontSize:18,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
            {showAdd ? '×' : '+'}
          </button>
        </div>

        {/* Progress bar */}
        {dayTasks.length>0&&(
          <div style={{ height:2,background:t.inputBg,borderRadius:1,overflow:'hidden',marginBottom:14 }}>
            <div style={{ height:'100%',background:'#4ade80',width:`${(doneTasks/dayTasks.length)*100}%`,transition:'width 0.4s ease' }} />
          </div>
        )}

        {/* ── ADD FORM — uncontrolled, keyboard stays open ── */}
        {showAdd && (
          <TaskForm
            key={viewDate.toDateString()} // remount only when date changes, not on every keystroke
            viewDate={viewDate}
            t={t}
            onAdd={handleAdd}
            onCancel={() => setShowAdd(false)}
          />
        )}

        {/* Empty state */}
        {dayTasks.length===0&&!showAdd&&(
          <div style={{ textAlign:'center',padding:'40px 0' }}>
            <p style={{ fontSize:14,color:t.textMuted,fontFamily:'Inter,sans-serif' }}>No tasks planned for this day</p>
            <p style={{ fontSize:12,color:t.textFaint,fontFamily:'Inter,sans-serif',marginTop:4 }}>Tap + to add your first task</p>
          </div>
        )}

        {/* Task list */}
        {[...dayTasks].sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99')).map(task=>(
          <div key={task.id} style={{ display:'flex',alignItems:'flex-start',gap:14,padding:'14px 16px',background:t.card,border:`1px solid ${task.priority?COLORS[task.priority]+'22':t.border}`,borderLeft:`3px solid ${task.priority?COLORS[task.priority]:t.borderMed}`,borderRadius:14,marginBottom:8 }}>
            <div onClick={()=>{ haptic.light(); toggleTask(task.id) }} className="pressable" style={{ width:20,height:20,borderRadius:'50%',flexShrink:0,marginTop:2,border:task.done?'none':`1.5px solid ${t.borderMed}`,background:task.done?t.green:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
              {task.done&&<svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1 4 3.5 6.5 9 1" stroke="#000" strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>}
            </div>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:14,fontWeight:600,color:task.done?t.textMuted:t.text,textDecoration:task.done?'line-through':'none',fontFamily:'Inter,sans-serif',marginBottom:4 }}>{task.title}</p>
              <div style={{ display:'flex',gap:8,flexWrap:'wrap',alignItems:'center' }}>
                {task.time&&<span style={{ fontSize:11,color:t.textMuted,fontFamily:'DM Mono,monospace' }}>{task.time}</span>}
                {task.duration&&<span style={{ fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif' }}>· {task.duration}</span>}
                {task.type&&<span style={{ fontSize:10,color:t.textMuted,background:t.inputBg,padding:'2px 8px',borderRadius:8,fontFamily:'Inter,sans-serif' }}>{task.type}</span>}
              </div>
              {task.notes&&<p style={{ fontSize:12,color:t.textMuted,fontFamily:'Inter,sans-serif',marginTop:4,lineHeight:1.4 }}>{task.notes}</p>}
            </div>
            <button onClick={()=>deleteTask(task.id)} style={{ background:'none',border:'none',cursor:'pointer',color:t.textFaint,fontSize:14,padding:2,flexShrink:0 }}>✕</button>
          </div>
        ))}
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  )
}
