// Hook to get current theme-aware values
// Usage: const { isDark, t } = useTheme()
// t.card, t.text, t.border etc. — use these instead of hardcoded colors

import { useState, useEffect } from 'react'

export function useTheme() {
  const [isDark, setIsDark] = useState(
    () => (localStorage.getItem('studymate_theme') || 'dark') === 'dark'
  )

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') !== 'light')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const t = isDark ? {
    bg:         '#000',
    bg2:        '#0a0a0a',
    surface:    '#0e0e0e',
    card:       '#111',
    card2:      '#161616',
    border:     'rgba(255,255,255,0.08)',
    borderMed:  'rgba(255,255,255,0.13)',
    borderStrong:'rgba(255,255,255,0.22)',
    text:       '#fff',
    textSec:    'rgba(255,255,255,0.65)',
    textMuted:  'rgba(255,255,255,0.35)',
    textFaint:  'rgba(255,255,255,0.18)',
    inputBg:    'rgba(255,255,255,0.05)',
    inputBgF:   'rgba(255,255,255,0.08)',
    shadow:     '0 4px 24px rgba(0,0,0,0.6)',
    shadowSm:   '0 2px 12px rgba(0,0,0,0.4)',
    overlay:    'rgba(0,0,0,0.85)',
    navBg:      'rgba(0,0,0,0.96)',
    // semantic
    blue:    '#60a5fa',  blueBg:  'rgba(96,165,250,0.10)',
    green:   '#4ade80',  greenBg: 'rgba(74,222,128,0.10)',
    red:     '#f87171',  redBg:   'rgba(248,113,113,0.10)',
    amber:   '#fbbf24',  amberBg: 'rgba(251,191,36,0.10)',
    purple:  '#a78bfa',  purpleBg:'rgba(167,139,250,0.10)',
    orange:  '#fb923c',
    pink:    '#f472b6',
    teal:    '#34d399',
  } : {
    bg:         '#f0f0f0',
    bg2:        '#e8e8e8',
    surface:    '#ebebeb',
    card:       '#fff',
    card2:      '#f7f7f7',
    border:     'rgba(0,0,0,0.07)',
    borderMed:  'rgba(0,0,0,0.13)',
    borderStrong:'rgba(0,0,0,0.22)',
    text:       '#0a0a0a',
    textSec:    'rgba(0,0,0,0.60)',
    textMuted:  'rgba(0,0,0,0.40)',
    textFaint:  'rgba(0,0,0,0.20)',
    inputBg:    'rgba(0,0,0,0.04)',
    inputBgF:   'rgba(0,0,0,0.07)',
    shadow:     '0 4px 24px rgba(0,0,0,0.10)',
    shadowSm:   '0 2px 12px rgba(0,0,0,0.07)',
    overlay:    'rgba(0,0,0,0.45)',
    navBg:      'rgba(240,240,240,0.97)',
    // semantic — deeper for light bg contrast
    blue:    '#2563eb',  blueBg:  'rgba(37,99,235,0.10)',
    green:   '#16a34a',  greenBg: 'rgba(22,163,74,0.10)',
    red:     '#dc2626',  redBg:   'rgba(220,38,38,0.10)',
    amber:   '#d97706',  amberBg: 'rgba(217,119,6,0.10)',
    purple:  '#7c3aed',  purpleBg:'rgba(124,58,237,0.10)',
    orange:  '#ea580c',
    pink:    '#db2777',
    teal:    '#059669',
  }

  return { isDark, t }
}