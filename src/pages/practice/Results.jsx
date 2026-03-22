import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'

export default function Results() {
  const navigate = useNavigate()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '0 24px', gap: 16, textAlign: 'center' }}>
      <p style={{ fontSize: 56 }}>📊</p>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Results</h2>
      <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Complete a test to see your results here.</p>
      <Button onClick={() => navigate('/practice')} variant="primary">Go to Practice</Button>
    </div>
  )
}