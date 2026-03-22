import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../app/useTheme'
import { useAppStore } from '../../app/store'
import Header from '../../components/layout/Header'

export default function PracticeHub() {
  const { isDark, t } = useTheme()
  const navigate = useNavigate()
  const { testResults } = useAppStore()

  return (
    <div style={{ padding: '0 16px 24px', background: 'transparent' }}>
      <Header title="Practice" subtitle="Test yourself" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        {/* Card 1 */}
        <div className="pressable" onClick={() => navigate('/practice/mode1')} style={{
          background: isDark ? 'linear-gradient(135deg,rgba(167,139,250,0.12),rgba(139,92,246,0.06))' : 'linear-gradient(135deg,rgba(124,58,237,0.06),rgba(109,40,217,0.03))',
          border: '1px solid rgba(167,139,250,0.2)', borderRadius: 22, padding: '22px 20px', cursor: 'pointer',
        }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(167,139,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22 }}>◈</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: t.text, letterSpacing: '-0.3px', fontFamily: 'Inter,sans-serif' }}>Practice from My Notes</p>
              </div>
              <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, fontFamily: 'Inter,sans-serif' }}>AI reads your notes and generates MCQs, fill-in-the-blank, and true/false questions instantly.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {['MCQs','Fill-in','True/False'].map(t => (
              <span key={t} style={{ fontSize: 11, color: 'rgba(167,139,250,0.8)', background: 'rgba(167,139,250,0.1)', padding: '4px 10px', borderRadius: 20, fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Card 2 */}
        <div className="pressable" onClick={() => navigate('/practice/mode2')} style={{
          background: isDark ? 'linear-gradient(135deg,rgba(74,222,128,0.08),rgba(34,197,94,0.04))' : 'linear-gradient(135deg,rgba(22,163,74,0.06),rgba(16,122,56,0.03))',
          border: '1px solid rgba(74,222,128,0.15)', borderRadius: 22, padding: '22px 20px', cursor: 'pointer',
        }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(74,222,128,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22 }}>◎</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: t.text, letterSpacing: '-0.3px', fontFamily: 'Inter,sans-serif' }}>Adaptive Smart Test</p>
                <span style={{ fontSize: 10, fontWeight: 600, background: 'rgba(74,222,128,0.12)', color: '#4ade80', padding: '2px 8px', borderRadius: 6, fontFamily: 'Inter,sans-serif' }}>Adaptive</span>
              </div>
              <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, fontFamily: 'Inter,sans-serif' }}>Adjusts to your learning curve. Pulls from PYQs and focuses on your weak topics automatically.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {['PYQs','Adaptive Difficulty','Weak Area Focus'].map(t => (
              <span key={t} style={{ fontSize: 11, color: 'rgba(74,222,128,0.8)', background: 'rgba(74,222,128,0.08)', padding: '4px 10px', borderRadius: 20, fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      {testResults.slice(0, 3).length > 0 && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 12, fontFamily: 'Inter,sans-serif' }}>Recent Tests</p>
          {testResults.slice(0, 3).map((r, i) => (
            <div key={i} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: 'Inter,sans-serif' }}>{r.subject}</p>
                <p style={{ fontSize: 11, color: t.textMuted, fontFamily: 'Inter,sans-serif', marginTop: 2 }}>{r.mode} · {new Date(r.date).toLocaleDateString('en-IN')}</p>
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, color: r.score >= 80 ? '#4ade80' : r.score >= 50 ? '#fbbf24' : '#f87171', fontFamily: 'DM Mono,monospace' }}>{r.score}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}