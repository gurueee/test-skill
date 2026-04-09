import { useRouter } from 'next/router';
import { useTheme } from '../lib/theme';

const NAV = [
  { href:'/',        label:'Search',  icon:'◎' },
  { href:'/matrix',  label:'Skills',  icon:'⬡' },
  { href:'/glossary',label:'Glossary',icon:'◈' },
  { href:'/jd',      label:'JDs',     icon:'◉' },
  { href:'/leaders', label:'Leaders', icon:'◑' },
  { href:'/upload',  label:'Upload',  icon:'⊕' },
];

export default function Layout({ children, active }) {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const cur = active || router.pathname;
  const dark = theme === 'dark';

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <nav style={{
        position:'sticky', top:0, zIndex:100,
        background: dark ? 'rgba(7,11,20,0.9)' : 'rgba(245,247,250,0.9)',
        backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
        borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 24px', height:58,
        boxShadow:'var(--shadow-sm)',
      }}>
        {/* Brand */}
        <div onClick={()=>router.push('/')} style={{
          display:'flex', alignItems:'center', gap:10, cursor:'pointer',
          padding:'6px 10px 6px 0',
        }}>
          <div style={{
            width:32, height:32, background:'var(--blue)',
            borderRadius:9, display:'flex', alignItems:'center',
            justifyContent:'center', fontSize:15, fontWeight:800, color:'#fff',
            boxShadow:'0 0 16px var(--blue-glow)',
            letterSpacing:'-0.03em',
          }}>S</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', letterSpacing:'-0.02em', lineHeight:1.2 }}>
              Skill Visibility
            </div>
            <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
              Netcracker
            </div>
          </div>
        </div>

        {/* Nav links */}
        <div style={{ display:'flex', gap:2, alignItems:'center' }}>
          {NAV.map(n => {
            const isActive = cur === n.href;
            return (
              <button key={n.href} onClick={()=>router.push(n.href)} style={{
                display:'flex', alignItems:'center', gap:5,
                background: isActive ? 'var(--blue-dim)' : 'none',
                border: isActive ? '1px solid var(--blue-glow)' : '1px solid transparent',
                color: isActive ? 'var(--blue-light)' : 'var(--muted)',
                padding:'6px 12px', borderRadius:8,
                fontSize:13, fontWeight: isActive ? 600 : 400,
              }}>
                <span style={{ fontSize:11, opacity:0.7 }}>{n.icon}</span>
                {n.label}
              </button>
            );
          })}
        </div>

        {/* Theme toggle */}
        <button onClick={toggle} title="Toggle theme" style={{
          width:36, height:36,
          background:'var(--card)', border:'1px solid var(--border2)',
          borderRadius:9, display:'flex', alignItems:'center',
          justifyContent:'center', fontSize:16, color:'var(--muted)',
        }}>
          {dark ? '☀' : '◑'}
        </button>
      </nav>

      <main style={{ flex:1 }}>{children}</main>

      <footer style={{
        borderTop:'1px solid var(--border)', padding:'14px 24px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background: dark ? 'var(--bg2)' : 'var(--surface)',
      }}>
        <span style={{ fontSize:11, color:'var(--subtle)', fontFamily:'var(--mono)', letterSpacing:'0.04em' }}>
          SKILL VISIBILITY ENGINE
        </span>
        <span style={{ fontSize:11, color:'var(--subtle)' }}>Netcracker Internal</span>
      </footer>
    </div>
  );
}

export function Spinner({ size=18 }) {
  return <span className="spinner" style={{ width:size, height:size }} />;
}

export function Empty({ text='No results found', icon='◎' }) {
  return (
    <div style={{ textAlign:'center', padding:'72px 0' }}>
      <div style={{ fontSize:36, marginBottom:14, opacity:0.2 }}>{icon}</div>
      <p style={{ color:'var(--muted)', fontSize:14, fontWeight:500 }}>{text}</p>
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
      fontSize:13, fontWeight:600, ...styles[variant]||styles.primary,
      opacity: disabled ? 0.5 : 1, ...style,
    }}>{children}</button>
  );
}
