import { useRouter } from 'next/router';
import { useTheme } from '../lib/theme';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const NAV = [
  { href:'/',        label:'Search'  },
  { href:'/matrix',  label:'Skills'  },
  { href:'/glossary',label:'Glossary'},
  { href:'/jd',      label:'JDs'     },
  { href:'/leaders', label:'Leaders' },
  { href:'/upload',  label:'Upload'  },
];

export default function Layout({ children, active }) {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const cur  = active || router.pathname;
  const dark = theme === 'dark';
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <nav style={{
        position:'sticky', top:0, zIndex:100,
        background: dark ? 'rgba(7,11,20,0.92)' : 'rgba(245,247,250,0.92)',
        backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
        borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 20px', height:56,
        boxShadow:'var(--shadow-sm)',
      }}>
        {/* Brand */}
        <div onClick={()=>router.push('/')} style={{
          display:'flex', alignItems:'center', gap:8, cursor:'pointer', flexShrink:0,
        }}>
          <div style={{
            width:30, height:30, background:'var(--blue)',
            borderRadius:8, display:'flex', alignItems:'center',
            justifyContent:'center', fontSize:14, fontWeight:800, color:'#fff',
            boxShadow:'0 0 14px var(--blue-glow)',
          }}>S</div>
          <div style={{ display:'flex', flexDirection:'column' }}>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', letterSpacing:'-0.02em', lineHeight:1.2 }}>
              Skill Visibility
            </span>
            <span style={{ fontSize:9, color:'var(--muted)', letterSpacing:'0.07em', textTransform:'uppercase' }}>
              🔒 Netcracker Internal
            </span>
          </div>
        </div>

        {/* Desktop nav */}
        <div style={{ display:'flex', gap:2, alignItems:'center' }} className="desktop-nav">
          {NAV.map(n => {
            const isActive = cur === n.href;
            return (
              <button key={n.href} onClick={()=>router.push(n.href)}
                aria-label={`Go to ${n.label}`}
                style={{
                  display:'flex', alignItems:'center', gap:5,
                  background: isActive ? 'var(--blue-dim)' : 'none',
                  border: isActive ? '1px solid var(--blue-glow)' : '1px solid transparent',
                  color: isActive ? 'var(--blue-light)' : 'var(--muted)',
                  padding:'6px 13px', borderRadius:8,
                  fontSize:13, fontWeight: isActive ? 600 : 400,
                  cursor:'pointer',
                }}>{n.label}</button>
            );
          })}
        </div>

        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {/* Theme toggle with clear label */}
          <button onClick={toggle}
            aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
            title={`Switch to ${dark ? 'light' : 'dark'} mode`}
            style={{
              width:34, height:34, background:'var(--card)',
              border:'1px solid var(--border2)', borderRadius:8,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:15, cursor:'pointer', color:'var(--muted)',
            }}>
            {dark ? '☀️' : '🌙'}
          </button>

          {/* Mobile hamburger */}
          <button onClick={()=>setMobileOpen(v=>!v)}
            aria-label="Toggle navigation menu"
            style={{
              display:'none', width:34, height:34, background:'var(--card)',
              border:'1px solid var(--border2)', borderRadius:8,
              alignItems:'center', justifyContent:'center',
              fontSize:16, cursor:'pointer', color:'var(--text)',
            }}
            className="mobile-menu-btn">
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown nav */}
      {mobileOpen && (
        <div style={{
          position:'fixed', top:56, left:0, right:0, zIndex:99,
          background: dark ? 'var(--bg2)' : 'var(--surface)',
          borderBottom:'1px solid var(--border)',
          padding:'8px 0',
        }}>
          {NAV.map(n => (
            <button key={n.href} onClick={()=>{ router.push(n.href); setMobileOpen(false); }} style={{
              display:'block', width:'100%', textAlign:'left',
              padding:'12px 20px', background:'none', border:'none',
              color: cur===n.href ? 'var(--blue-light)' : 'var(--text)',
              fontSize:14, fontWeight: cur===n.href ? 600 : 400,
              cursor:'pointer', borderLeft: cur===n.href ? '3px solid var(--blue)' : '3px solid transparent',
            }}>{n.label}</button>
          ))}
        </div>
      )}

      <main style={{ flex:1 }}>{children}</main>

      <footer style={{
        borderTop:'1px solid var(--border)', padding:'12px 20px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background: dark ? 'var(--bg2)' : 'var(--surface)',
        flexWrap:'wrap', gap:8,
      }}>
        <span style={{ fontSize:11, color:'var(--subtle)', letterSpacing:'0.04em' }}>
          Skill Visibility Engine · v1.0
        </span>
        <span style={{ fontSize:11, color:'var(--subtle)' }}>
          Last updated: Apr 2026 · 🔒 Netcracker Internal
        </span>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

export function Spinner({ size=18 }) {
  return <span className="spinner" style={{ width:size, height:size }} />;
}

export function Empty({ text='No results found', icon='◎', sub='' }) {
  return (
    <div style={{ textAlign:'center', padding:'72px 0' }}>
      <div style={{ fontSize:36, marginBottom:14, opacity:0.2 }}>{icon}</div>
      <p style={{ color:'var(--muted)', fontSize:14, fontWeight:500, marginBottom: sub?6:0 }}>{text}</p>
      {sub && <p style={{ color:'var(--subtle)', fontSize:12 }}>{sub}</p>}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
      padding:'12px 16px', background:'var(--red-dim)',
      border:'1px solid rgba(239,68,68,0.3)', borderRadius:'var(--radius)',
      marginBottom:16,
    }}>
      <span style={{ fontSize:13, color:'var(--red)' }}>⚠ {message}</span>
      {onRetry && (
        <button onClick={onRetry} style={{
          padding:'4px 12px', background:'none', border:'1px solid var(--red)',
          color:'var(--red)', borderRadius:6, fontSize:12, cursor:'pointer', flexShrink:0,
        }}>Retry</button>
      )}
    </div>
  );
}

export function Tag({ children, color='blue' }) {
  const map = {
    blue:  ['var(--blue-dim)',  'var(--blue-light)', 'var(--blue-glow)'],
    green: ['var(--green-dim)', 'var(--green)',      'rgba(16,185,129,0.25)'],
    amber: ['var(--amber-dim)', 'var(--amber)',      'rgba(245,158,11,0.25)'],
    purple:['var(--purple-dim)','var(--purple)',     'rgba(139,92,246,0.25)'],
    red:   ['var(--red-dim)',   'var(--red)',        'rgba(239,68,68,0.25)'],
    gray:  ['rgba(107,114,128,0.08)','var(--muted)','rgba(107,114,128,0.2)'],
  };
  const [bg,text,border] = map[color]||map.gray;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center',
      fontSize:11, fontWeight:600, padding:'3px 8px',
      borderRadius:6, background:bg, color:text,
      border:`1px solid ${border}`, letterSpacing:'0.03em',
      whiteSpace:'nowrap', flexShrink:0,
    }}>{children}</span>
  );
}

export function Card({ children, style={}, onClick, hover=false }) {
  return (
    <div onClick={onClick} style={{
      background:'var(--card)', border:'1px solid var(--border)',
      borderRadius:'var(--radius-lg)', padding:'20px 24px',
      cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}
    onMouseEnter={e=>{ if(hover||onClick){ e.currentTarget.style.borderColor='var(--border2)'; e.currentTarget.style.background='var(--card-hover)'; }}}
    onMouseLeave={e=>{ if(hover||onClick){ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--card)'; }}}
    >{children}</div>
  );
}

export function Btn({ children, onClick, type='button', variant='primary', disabled=false, style={} }) {
  const styles = {
    primary: { background:'var(--blue)', color:'#fff', border:'1px solid var(--blue)' },
    ghost:   { background:'none', color:'var(--muted)', border:'1px solid var(--border2)' },
    danger:  { background:'var(--red-dim)', color:'var(--red)', border:'1px solid rgba(239,68,68,0.3)' },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      padding:'9px 18px', borderRadius:'var(--radius)',
      fontSize:13, fontWeight:600, cursor: disabled?'not-allowed':'pointer',
      ...styles[variant]||styles.primary,
      opacity: disabled ? 0.5 : 1, ...style,
    }}>{children}</button>
  );
}

// Feedback widget — thumbs up/down after search results
export function FeedbackWidget({ query }) {
  const [voted, setVoted] = useState(null);
  if (!query) return null;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10, marginTop:16,
      padding:'10px 16px', background:'var(--card)',
      border:'1px solid var(--border)', borderRadius:'var(--radius)',
    }}>
      <span style={{ fontSize:12, color:'var(--muted)' }}>Was this helpful?</span>
      {voted
        ? <span style={{ fontSize:12, color:'var(--green)' }}>✓ Thanks for your feedback!</span>
        : <>
            <button onClick={()=>setVoted('up')} aria-label="Yes, helpful"
              style={{ background:'none', border:'1px solid var(--border2)', padding:'4px 10px',
                borderRadius:6, fontSize:13, cursor:'pointer', color:'var(--muted)' }}>
              👍
            </button>
            <button onClick={()=>setVoted('down')} aria-label="No, not helpful"
              style={{ background:'none', border:'1px solid var(--border2)', padding:'4px 10px',
                borderRadius:6, fontSize:13, cursor:'pointer', color:'var(--muted)' }}>
              👎
            </button>
          </>
      }
    </div>
  );
}
