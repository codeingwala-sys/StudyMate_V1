import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Silent — don't log to console in production
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          minHeight:'100vh', background:'#000', padding:'32px 24px', textAlign:'center'
        }}>
          <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
          <h2 style={{ fontSize:20, fontWeight:700, color:'#fff', fontFamily:'Inter,sans-serif', marginBottom:8 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize:14, color:'rgba(255,255,255,0.4)', fontFamily:'Inter,sans-serif', marginBottom:24, lineHeight:1.6 }}>
            {this.state.error?.message?.includes('API key')
              ? 'Groq API key not set. Add your key to src/services/ai.service.js'
              : 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError:false, error:null }); window.location.href = '/' }}
            style={{ padding:'12px 24px', borderRadius:12, background:'#fff', border:'none', color:'#000', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'Inter,sans-serif' }}
          >
            Go Home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}