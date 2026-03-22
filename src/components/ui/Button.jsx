const VARIANTS = {
  primary:   { background: '#ffffff', color: '#000000', border: 'none', fontWeight: 700 },
  secondary: { background: 'rgba(255,255,255,0.06)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)' },
  ghost:     { background: 'transparent', color: 'rgba(255,255,255,0.5)', border: 'none' },
  danger:    { background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' },
  success:   { background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' },
  purple:    { background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)', fontWeight: 600 },
  dark:      { background: '#111111', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)' },
}

const SIZES = {
  sm: { padding: '7px 16px',  fontSize: 12, borderRadius: 8  },
  md: { padding: '11px 22px', fontSize: 14, borderRadius: 12 },
  lg: { padding: '15px 28px', fontSize: 15, borderRadius: 14 },
}

export default function Button({ children, onClick, variant = 'primary', size = 'md', disabled = false, fullWidth = false, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="pressable"
      style={{
        ...VARIANTS[variant],
        ...SIZES[size],
        width: fullWidth ? '100%' : undefined,
        fontFamily: 'var(--font)',
        fontWeight: VARIANTS[variant].fontWeight || 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        letterSpacing: '-0.1px',
        ...style,
      }}
    >
      {children}
    </button>
  )
}