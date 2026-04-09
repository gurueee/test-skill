import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout, { Spinner, Empty, Tag } from '../components/Layout';
import { getAllFunctions, searchFunctions } from '../lib/api';

const BU_COLORS = { SE:'blue', SDSI:'green', SVT:'amber', NRM:'purple', 'R&D':'blue', Testing:'amber', IT:'gray' };

function groupByBU(rows) {
  const map = new Map();
  for (const e of rows) {
    const bu = e.bu || 'Other';
    if (!map.has(bu)) map.set(bu, []);
    const skills = (e.employee_skills||[]).map(es=>es.skills?.skill_name).filter(Boolean).sort();
    map.get(bu).push({ fn: e.function_name || e.name || '—', leader: e.leader || '', skills });
  }
  return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([bu,fns])=>({ bu, fns }));
}

export default function Matrix() {
  const router = useRouter();
  const [q,       setQ]       = useState('');
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [activeBU,setActiveBU]= useState('all');

  const load = async (query='') => {
    setLoading(true); setError('');
    try {
      const rows = query.trim() ? await searchFunctions(query) : await getAllFunctions();
      setData(groupByBU(rows));
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const onSubmit = (e) => { e.preventDefault(); load(q); };
  const allBUs   = data.map(d=>d.bu);
  const visible  = activeBU==='all' ? data : data.filter(d=>d.bu===activeBU);

  return (
    <Layout active="/matrix">
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'40px 24px 80px' }}>
        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <h1 style={{ fontSize:24, fontWeight:600, letterSpacing:'-0.02em', color:'var(--text)', marginBottom:6 }}>
            Skill Matrix
          </h1>
          <p style={{ color:'var(--muted)', fontSize:14 }}>
            Function-level skill coverage across all Business Units
          </p>
        </div>

        {/* Controls */}
        <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap', alignItems:'center' }}>
          <form onSubmit={onSubmit} style={{ display:'flex', gap:8, flex:1, minWidth:260 }}>
            <div style={{ flex:1, position:'relative', display:'flex', alignItems:'center' }}>
              <svg style={{ position:'absolute',left:12,opacity:0.35,pointerEvents:'none' }}
                width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input value={q} onChange={e=>setQ(e.target.value)}
                placeholder="Search skill or leader…"
                style={{
                  width:'100%', padding:'9px 12px 9px 34px',
                  background:'var(--card)', border:'1px solid var(--border2)',
                  borderRadius:'var(--radius)', color:'var(--text)',
                  fontSize:13, outline:'none',
                }}
                onFocus={e=>e.target.style.borderColor='var(--blue)'}
                onBlur={e=>e.target.style.borderColor='var(--border2)'}
              />
            </div>
            <button type="submit" style={{
              padding:'9px 18px', background:'var(--blue)', color:'#fff',
              border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:600,
            }}>Search</button>
            {q && <button type="button" onClick={()=>{setQ('');load('');}} style={{
              padding:'9px 14px', background:'none', border:'1px solid var(--border)',
              color:'var(--muted)', borderRadius:'var(--radius)', fontSize:13,
            }}>Clear</button>}
          </form>

          {/* BU tabs */}
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            <button onClick={()=>setActiveBU('all')} style={{
              padding:'6px 12px', borderRadius:6, fontSize:12, fontWeight:600,
              background: activeBU==='all' ? 'var(--blue-dim)' : 'none',
              border: activeBU==='all' ? '1px solid var(--blue-glow)' : '1px solid var(--border)',
              color: activeBU==='all' ? 'var(--blue)' : 'var(--muted)',
            }}>All BUs</button>
            {allBUs.map(bu=>(
              <button key={bu} onClick={()=>setActiveBU(bu)} style={{
                padding:'6px 12px', borderRadius:6, fontSize:12, fontWeight:600,
                background: activeBU===bu ? 'var(--blue-dim)' : 'none',
                border: activeBU===bu ? '1px solid var(--blue-glow)' : '1px solid var(--border)',
                color: activeBU===bu ? 'var(--blue)' : 'var(--muted)',
              }}>{bu}</button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ padding:'12px 16px', background:'rgba(239,68,68,0.08)',
            border:'1px solid rgba(239,68,68,0.2)', borderRadius:'var(--radius)',
            color:'#f87171', marginBottom:16, fontSize:13 }}>⚠ {error}</div>
        )}

        {loading && <div style={{ textAlign:'center', padding:'60px 0' }}><Spinner /></div>}

        {!loading && visible.length===0 && <Empty text="No results. Try a different search." />}

        {!loading && visible.map(({ bu, fns }) => (
          <BUCard key={bu} bu={bu} fns={fns} color={BU_COLORS[bu]||'gray'} />
        ))}
      </div>
    </Layout>
  );
}

function BUCard({ bu, fns, color }) {
  const [collapsed, setCollapsed] = useState(false);
  const totalSkills = new Set(fns.flatMap(f=>f.skills)).size;

  return (
    <div style={{
      background:'var(--card)', border:'1px solid var(--border)',
      borderRadius:'var(--radius-lg)', marginBottom:12, overflow:'hidden',
    }}>
      {/* BU Header */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'14px 20px', background:'rgba(255,255,255,0.02)',
        borderBottom: collapsed ? 'none' : '1px solid var(--border)',
        cursor:'pointer',
      }} onClick={()=>setCollapsed(v=>!v)}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:3, height:20, background:'var(--blue)', borderRadius:2 }} />
          <span style={{ fontSize:14, fontWeight:700, color:'var(--text)', letterSpacing:'0.04em' }}>{bu}</span>
          <Tag color={color}>{fns.length} functions</Tag>
          <Tag color="gray">{totalSkills} skills</Tag>
        </div>
        <span style={{ color:'var(--subtle)', fontSize:12 }}>{collapsed ? '▶' : '▼'}</span>
      </div>

      {!collapsed && (
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>
          {fns.map((fn, i) => (
            <div key={i} style={{
              paddingBottom: i<fns.length-1 ? 14 : 0,
              borderBottom: i<fns.length-1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{fn.fn}</span>
                {fn.leader && (
                  <span style={{ fontSize:12, color:'var(--subtle)', fontFamily:'var(--mono)' }}>
                    {fn.leader}
                  </span>
                )}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {fn.skills.length === 0
                  ? <span style={{ fontSize:12, color:'var(--subtle)' }}>No skills mapped</span>
                  : fn.skills.map(sk=>(
                      <span key={sk} onClick={()=>router.push(`/skill?q=${encodeURIComponent(sk)}`)} style={{ cursor:'pointer',
                        fontSize:11, padding:'3px 9px', borderRadius:5,
                        background:'rgba(59,130,246,0.06)', color:'#93c5fd',
                        border:'1px solid rgba(59,130,246,0.15)', fontWeight:500,
                      }}>{sk}</span>
                    ))
                }
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
