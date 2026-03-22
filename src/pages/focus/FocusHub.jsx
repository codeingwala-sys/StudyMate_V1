import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../app/useTheme'
import { useAppStore } from '../../app/store'
import Header from '../../components/layout/Header'

export default function FocusHub() {
  const { isDark, t } = useTheme()
  const navigate = useNavigate()
  const { tasks, toggleTask } = useAppStore()
  const today = new Date().toDateString()
  const todayTasks = tasks.filter(t => new Date(t.date || Date.now()).toDateString() === today)
  const done = todayTasks.filter(t => t.done).length

  return (
    <div style={{ padding: '0 16px 24px', background: 'transparent' }}>
      <Header title="Focus" subtitle="Stay on track" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        <div className="pressable" onClick={() => navigate('/focus/timer')} style={{ background: 'linear-gradient(135deg,rgba(0,200,180,0.1),rgba(0,160,150,0.05))', border: '1px solid rgba(0,200,180,0.15)', borderRadius: 20, padding: 20, display: 'flex', gap: 16, alignItems: 'center', cursor: 'pointer' }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(0,200,180,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22, color: 'rgb(0,200,180)' }}>◷</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 4, letterSpacing: '-0.2px', fontFamily: 'Inter,sans-serif' }}>Focus Timer</p>
            <p style={{ fontSize: 12, color: t.textMuted, fontFamily: 'Inter,sans-serif' }}>Grow crystals while you focus · Adjustable timer</p>
          </div>
          <span style={{ color: t.textFaint, fontSize: 18 }}>›</span>
        </div>
        <div className="pressable" onClick={() => navigate('/focus/planner')} style={{ background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 20, padding: 20, display: 'flex', gap: 16, alignItems: 'center', cursor: 'pointer' }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: t.inputBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22 }}>◈</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 4, letterSpacing: '-0.2px', fontFamily: 'Inter,sans-serif' }}>Daily Planner</p>
            <p style={{ fontSize: 12, color: t.textMuted, fontFamily: 'Inter,sans-serif' }}>Schedule your study sessions</p>
          </div>
          <span style={{ color: t.textMuted, fontSize: 13, fontWeight: 600, fontFamily: 'Inter,sans-serif' }}>{todayTasks.length} tasks</span>
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', fontFamily: 'Inter,sans-serif' }}>Today's Tasks</p>
          <span style={{ fontSize: 12, color: t.textMuted, fontFamily: 'Inter,sans-serif' }}>{done}/{todayTasks.length}</span>
        </div>
        <div style={{ height: 2, background: t.inputBg, borderRadius: 1, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 1, background: t.text, width: `${todayTasks.length ? (done/todayTasks.length)*100 : 0}%`, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 18, overflow: 'hidden' }}>
          {todayTasks.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center' }}><p style={{ fontSize: 13, color: t.textFaint, fontFamily: 'Inter,sans-serif' }}>Add tasks in the Planner</p></div>
          ) : todayTasks.slice(0,5).map((task,i) => (
            <div key={task.id} onClick={() => toggleTask(task.id)} className="pressable" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderBottom: i < Math.min(todayTasks.length,5)-1 ? `1px solid ${t.border}` : 'none' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: task.done ? 'none' : `1.5px solid ${t.borderMed}`, background: task.done ? t.text : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {task.done && <span style={{ fontSize: 11, color: t.bg, fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: task.done ? t.textFaint : t.text, textDecoration: task.done ? 'line-through' : 'none', fontFamily: 'Inter,sans-serif' }}>{task.title}</span>
              {task.subject && <span style={{ fontSize: 10, color: t.textFaint, fontFamily: 'Inter,sans-serif', background: t.inputBg, padding: '2px 8px', borderRadius: 8 }}>{task.subject}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}