import { useState } from 'react'
import { useTheme } from '../../app/useTheme'
import { haptic } from '../../utils/haptics'
import { useAppStore } from '../../app/store'
import Header from '../../components/layout/Header'

const PRIORITIES = ['High', 'Medium', 'Low']
const TASK_TYPES = ['Study', 'Revision', 'Practice', 'Break', 'Exercise', 'Other']
const COLORS = { High: '#f87171', Medium: '#fbbf24', Low: '#4ade80' }

export default function DailyPlanner() {
  const { isDark, t } = useTheme()
  const { tasks, addTask, toggleTask, deleteTask } = useAppStore()
  const today  = new Date()
  const [viewDate, setViewDate]  = useState(today)
  const [showAdd, setShowAdd]    = useState(false)
  const [weekView, setWeekView]  = useState(false)
  const [form, setForm] = useState({ title:'', time:'', duration:'', priority:'Medium', type:'Study', notes:'' })

  // Build calendar: current month
  const [calMonth, setCalMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth()+1, 0).getDate()
  const firstDay    = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay()
  const monthName   = calMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  const dayTasks  = tasks.filter(t => new Date(t.date||Date.now()).toDateString() === viewDate.toDateString())
  const doneTasks = dayTasks.filter(t => t.done).length

  const getDateTasks = (d) => tasks.filter(t => new Date(t.date||Date.now()).toDateString() === d.toDateString())

  const handleAdd = () => {
    if (!form.title.trim()) return
    haptic.success()
    addTask({ ...form, date: viewDate.toISOString() })
    setForm({ title:'',time:'',duration:'',priority:'Medium',type:'Study',notes:'' })
    setShowAdd(false)
  }

  const copyWeekTasks = () => {
    // Copy this week's tasks to next week
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

  const F = ({ label, children, required }) => (
    <div style={{ marginBottom:12 }}>
      <p style={{ fontSize:10,color:t.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.9px',marginBottom:6,fontFamily:'Inter,sans-serif' }}>{label}{required&&' *'}</p>
      {children}
    </div>
  )

  const inp = { background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:10,padding:'10px 12px',color:t.text,fontSize:13,fontFamily:'Inter,sans-serif',outline:'none',width:'100%',boxSizing:'border-box' }

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
          {/* Month nav */}
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
            <button onClick={()=>setCalMonth(d=>{const n=new Date(d);n.setMonth(n.getMonth()-1);return n})} style={{ width:28,height:28,borderRadius:8,background:t.inputBg,border:'none',color:t.textSec,cursor:'pointer',fontSize:14 }}>‹</button>
            <p style={{ fontSize:14,fontWeight:700,color:t.text,fontFamily:'Inter,sans-serif' }}>{monthName}</p>
            <button onClick={()=>setCalMonth(d=>{const n=new Date(d);n.setMonth(n.getMonth()+1);return n})} style={{ width:28,height:28,borderRadius:8,background:t.inputBg,border:'none',color:t.textSec,cursor:'pointer',fontSize:14 }}>›</button>
          </div>
          {/* Weekday headers */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:6 }}>
            {['S','M','T','W','T','F','S'].map((d,i)=><div key={i} style={{ textAlign:'center',fontSize:10,color:t.textFaint,fontFamily:'Inter,sans-serif',fontWeight:600,padding:'4px 0' }}>{d}</div>)}
          </div>
          {/* Days grid */}
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

        {/* ── WEEK ROW (if week view) ── */}
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

        {/* ── SELECTED DAY ── */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
          <div>
            <p style={{ fontSize:13,fontWeight:700,color:t.text,fontFamily:'Inter,sans-serif' }}>
              {viewDate.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}
            </p>
            {dayTasks.length>0&&<p style={{ fontSize:11,color:t.textMuted,fontFamily:'Inter,sans-serif',marginTop:2 }}>{doneTasks}/{dayTasks.length} done</p>}
          </div>
          <button onClick={()=>setShowAdd(s=>!s)} style={{ width:34,height:34,borderRadius:10,background:'#fff',border:'none',color:'#000',fontSize:18,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
        </div>

        {/* Progress bar */}
        {dayTasks.length>0&&<div style={{ height:2,background:t.inputBg,borderRadius:1,overflow:'hidden',marginBottom:14 }}>
          <div style={{ height:'100%',background:'#4ade80',width:`${(doneTasks/dayTasks.length)*100}%`,transition:'width 0.4s ease' }} />
        </div>}

        {/* Add form */}
        {showAdd && (
          <div style={{ background:t.card,border:`1px solid ${t.border}`,borderRadius:20,padding:18,marginBottom:14,animation:'fadeIn 0.2s ease' }}>
            <F label="Task Title" required><input placeholder="What do you need to do?" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={inp} /></F>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
              <F label="Time"><input type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} style={inp} /></F>
              <F label="Duration"><input placeholder="e.g. 1h 30m" value={form.duration} onChange={e=>setForm(f=>({...f,duration:e.target.value}))} style={inp} /></F>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
              <F label="Priority">
                <div style={{ display:'flex',gap:5 }}>
                  {PRIORITIES.map(p=><button key={p} onClick={()=>setForm(f=>({...f,priority:p}))} style={{ flex:1,padding:'7px 4px',borderRadius:8,fontFamily:'Inter,sans-serif',background:form.priority===p?COLORS[p]:t.inputBg,border:'none',color:form.priority===p?'#000':t.textMuted,fontSize:11,fontWeight:600,cursor:'pointer' }}>{p}</button>)}
                </div>
              </F>
              <F label="Type">
                <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{...inp,appearance:'none',cursor:'pointer'}}>
                  {TASK_TYPES.map(t=><option key={t} value={t} style={{background:t.card}}>{t}</option>)}
                </select>
              </F>
            </div>
            <F label="Notes (optional)"><input placeholder="Any extra details..." value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={inp} /></F>
            <div style={{ display:'flex',gap:8,marginTop:4 }}>
              <button onClick={()=>setShowAdd(false)} style={{ flex:1,padding:'12px',borderRadius:12,background:t.inputBg,border:'none',color:t.textSec,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif' }}>Cancel</button>
              <button onClick={handleAdd} style={{ flex:2,padding:'12px',borderRadius:12,background:'#fff',border:'none',color:'#000',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif' }}>Add Task</button>
            </div>
          </div>
        )}

        {/* Tasks */}
        {dayTasks.length===0&&!showAdd&&(
          <div style={{ textAlign:'center',padding:'40px 0' }}>
            <p style={{ fontSize:14,color:t.textMuted,fontFamily:'Inter,sans-serif' }}>No tasks planned for this day</p>
            <p style={{ fontSize:12,color:t.textFaint,fontFamily:'Inter,sans-serif',marginTop:4 }}>Tap + to add your first task</p>
          </div>
        )}

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