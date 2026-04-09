import { useState, useEffect } from 'react';
import Layout, { Spinner, Empty, Tag } from '../components/Layout';
import { getGlossary } from '../lib/api';

const DOMAIN_COLOR = (d='') => {
  if (d.includes('CLOUD')) return 'blue';
  if (d.includes('TOMS'))  return 'purple';
  if (d.includes('RM'))    return 'green';
  if (d.includes('BSS') || d.includes('OSS')) return 'amber';
  return 'gray';
};

export default function Glossary() {
  const [terms,   setTerms]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [q,       setQ]       = useState('');
  const [domain,  setDomain]  = useState('');

  const load = async (search='', dom='') => {
    setLoading(true);
    try { setTerms(await getGlossary({ search, domain: dom })); }
    catch(e) { console.error(e); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const domains = [...new Set(terms.map(t=>t.domain).filter(Boolean))].sort();

  return (
    <Layout active="/glossary">
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'40px 24px 80px' }}>
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text)', letterSpacing:'-0.02em', marginBottom:4 }}>
            Glossary
          </h1>
          <p style={{ color:'var(--muted)', fontSize:13 }}>
            {terms.length} BSS/OSS/telecom terms — click any card to expand
          </p>
        </div>

        <form onSubmit={e=>{e.preventDefault();load(q,domain);}}
          style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
          <div style={{ flex:2, minWidth:220, position:'relative', display:'flex', alignItems:'center' }}>
            <svg style={{ position:'absolute',left:12,opacity:0.35,pointerEvents:'none' }}
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input value={q} onChange={e=>setQ(e.target.value)}
              placeholder="Search term or definition…"
              style={{ width:'100%', padding:'9px 12px 9px 34px', fontSize:13 }}
            />
          </div>
          <select value={domain} onChange={e=>setDomain(e.target.value)}
            style={{ padding:'9px 12px', fontSize:13, minWidth:180,
              color: domain ? 'var(--text)' : 'var(--muted)' }}>
            <option value="">All domains</option>
            {domains.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
          <button type="submit" style={{
            padding:'9px 20px', background:'var(--blue)', color:'#fff',
            border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:600,
          }}>Search</button>
          {(q||domain) && (
            <button type="button" onClick={()=>{setQ('');setDomain('');load();}} style={{
              padding:'9px 14px', background:'none', border:'1px solid var(--border)',
              color:'var(--muted)', borderRadius:'var(--radius)', fontSize:13,
            }}>Clear</button>
          )}
        </form>

        {loading && <div style={{ textAlign:'center', padding:'60px 0' }}><Spinner size={28}/></div>}
        {!loading && terms.length===0 && <Empty text="No terms found." />}

        {!loading && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
            {terms.map(t => <GlossCard key={t.id} t={t} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}

function GlossCard({ t }) {
  const [open, setOpen] = useState(false);

  return (
    <div onClick={()=>setOpen(v=>!v)} style={{
      background:'var(--card)',
      border:`1px solid ${open ? 'var(--blue-glow)' : 'var(--border)'}`,
      borderRadius:'var(--radius-lg)', padding:'18px 20px',
      cursor:'pointer', transition:'all 0.18s',
    }}
    onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--border2)';e.currentTarget.style.background='var(--card-hover)';}}
    onMouseLeave={e=>{e.currentTarget.style.borderColor=open?'var(--blue-glow)':'var(--border)';e.currentTarget.style.background='var(--card)';}}
    >
      {/* Row 1: Term + Domain tag + chevron */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
        <span style={{ fontSize:20, fontWeight:800, color:'var(--text)', letterSpacing:'-0.02em', flex:1 }}>
          {t.term}
        </span>
        {t.domain && <Tag color={DOMAIN_COLOR(t.domain)}>{t.domain}</Tag>}
        <span style={{ fontSize:11, color:'var(--subtle)', marginLeft:2 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Row 2: Full form — always visible */}
      {t.full_form && (
        <p style={{
          fontSize:13, fontWeight:600, color:'var(--blue-light)',
          margin:0, lineHeight:1.4,
          marginBottom: open ? 14 : 0,
        }}>
          {t.full_form}
        </p>
      )}

      {/* Expanded content */}
      {open && (
        <div className="fade-in">
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:14, display:'flex', flexDirection:'column', gap:14 }}>

            {/* Technical Definition */}
            {t.definition && (
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)',
                  letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:5 }}>
                  Technical Definition
                </div>
                <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.7, margin:0 }}>
                  {t.definition}
                </p>
              </div>
            )}

            {/* Usage */}
            {t.usage && (
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)',
                  letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:5 }}>
                  Usage
                </div>
                <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.7, margin:0 }}>
                  {t.usage}
                </p>
              </div>
            )}

            {/* Category */}
            {t.related_skills && (
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)',
                  letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:5 }}>
                  Category
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {t.related_skills.split(',').filter(s=>s.trim()).map(s=>(
                    <span key={s} style={{
                      fontSize:11, padding:'3px 9px', borderRadius:5,
                      background:'var(--green-dim)', color:'var(--green)',
                      border:'1px solid rgba(16,185,129,0.2)', fontWeight:500,
                    }}>{s.trim()}</span>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
