import { useState } from 'react';
import Layout, { Spinner, Empty, Tag } from '../components/Layout';
import { supabase } from '../lib/supabase';

const BU_COLOR = { SE:'blue', SDSI:'green', SVT:'amber', NRM:'purple', 'R&D':'blue', Testing:'amber', IT:'gray', SDNC:'purple' };

const INITIALS = (name='') => name.trim().split(/\s+/).map(w=>w[0]?.toUpperCase()||'').slice(0,2).join('');

const AVATAR_COLORS = [
  ['#1e40af','#3b82f6'], ['#065f46','#10b981'], ['#7c2d12','#f97316'],
  ['#4c1d95','#8b5cf6'], ['#7f1d1d','#ef4444'], ['#1e3a5f','#60a5fa'],
];

async function fetchLeaders(query='') {
  let q = supabase.from('employees')
    .select('id,bu,function_name,leader,employee_skills(skills(skill_name))')
    .order('leader').order('bu');
  if (query.trim()) q = q.ilike('leader', `%${query.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;

  const map = new Map();
  for (const e of (data||[])) {
    const leader = e.leader?.trim() || 'Unassigned';
    if (!map.has(leader)) map.set(leader, []);
    const skills = (e.employee_skills||[]).map(es=>es.skills?.skill_name).filter(Boolean).sort();
    map.get(leader).push({ fn:e.function_name||'—', bu:e.bu||'—', skills });
  }
  return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([leader,fns],idx)=>({
    leader, fns, idx,
    totalFns: fns.length,
    uniqueSkills: [...new Set(fns.flatMap(f=>f.skills))].length,
    bus: [...new Set(fns.map(f=>f.bu))],
    allSkills: [...new Set(fns.flatMap(f=>f.skills))].sort(),
  }));
}

export default function Leaders() {
  const [q,       setQ]       = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const load = async (query='') => {
    setLoading(true); setError(''); setResults(null);
    try { setResults(await fetchLeaders(query)); }
    catch(e) { setError(e.message); }
    finally  { setLoading(false); }
  };

  return (
    <Layout active="/leaders">
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'40px 24px 80px' }}>
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text)', letterSpacing:'-0.02em', marginBottom:4 }}>
            Leader Insights
          </h1>
          <p style={{ color:'var(--muted)', fontSize:13 }}>
            Skill coverage and function mapping per team leader
          </p>
        </div>

        {/* Search */}
        <form onSubmit={e=>{e.preventDefault();load(q);}} style={{ display:'flex', gap:8, marginBottom:32 }}>
          <div style={{ flex:1, position:'relative', display:'flex', alignItems:'center' }}>
            <svg style={{ position:'absolute',left:12,opacity:0.35,pointerEvents:'none' }}
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input value={q} onChange={e=>setQ(e.target.value)}
              placeholder="Search by leader name…"
              style={{ width:'100%', padding:'10px 12px 10px 34px', fontSize:14 }}
            />
          </div>
          <button type="submit" style={{
            padding:'10px 20px', background:'var(--blue)', color:'#fff',
            border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:600,
          }}>Search</button>
          <button type="button" onClick={()=>load('')} style={{
            padding:'10px 16px', background:'none', border:'1px solid var(--border2)',
            color:'var(--muted)', borderRadius:'var(--radius)', fontSize:13,
          }}>Show All</button>
        </form>

        {error && (
          <div style={{ padding:'12px 16px', background:'var(--red-dim)', border:'1px solid rgba(239,68,68,0.3)',
            borderRadius:'var(--radius)', color:'var(--red)', marginBottom:16, fontSize:13 }}>
            ⚠ {error}
          </div>
        )}

        {loading && <div style={{ textAlign:'center', padding:'60px 0' }}><Spinner size={28}/></div>}

        {!loading && results?.length === 0 && <Empty text="No leaders found." icon="◑" />}

        {!loading && results === null && !error && (
          <div style={{ textAlign:'center', padding:'72px 0' }}>
            <div style={{ fontSize:48, marginBottom:16, opacity:0.15 }}>◑</div>
            <p style={{ color:'var(--muted)', fontSize:15, marginBottom:8 }}>Search a leader or click Show All</p>
            <p style={{ color:'var(--subtle)', fontSize:13 }}>View skill coverage mapped to each team leader</p>
          </div>
        )}

        {/* Leader cards grid */}
        {!loading && results && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:20 }}>
            {results.map(leader => <LeaderCard key={leader.leader} data={leader} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}

function LeaderCard({ data }) {
  const [tab, setTab] = useState('functions'); // 'functions' | 'skills'
  const colors = AVATAR_COLORS[data.idx % AVATAR_COLORS.length];
  const initials = INITIALS(data.leader);

  return (
    <div style={{
      background:'var(--card)', border:'1px solid var(--border)',
      borderRadius:'var(--radius-lg)', overflow:'hidden',
      transition:'box-shadow 0.2s, border-color 0.2s',
    }}
    onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--border2)'; e.currentTarget.style.boxShadow='var(--shadow)'; }}
    onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.boxShadow='none'; }}
    >
      {/* Cover banner */}
      <div style={{
        height:64, background:`linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
        position:'relative',
      }} />

      {/* Profile section */}
      <div style={{ padding:'0 20px 16px', position:'relative' }}>
        {/* Avatar */}
        <div style={{
          width:64, height:64, borderRadius:'50%',
          background:`linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
          border:'3px solid var(--card)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:22, fontWeight:800, color:'#fff',
          marginTop:-32, marginBottom:10,
          boxShadow:'0 4px 12px rgba(0,0,0,0.3)',
        }}>{initials}</div>

        {/* Name + BUs */}
        <div style={{ marginBottom:12 }}>
          <h3 style={{ fontSize:17, fontWeight:700, color:'var(--text)', marginBottom:4, letterSpacing:'-0.01em' }}>
            {data.leader}
          </h3>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {data.bus.map(bu=>(
              <Tag key={bu} color={BU_COLOR[bu]||'gray'}>{bu}</Tag>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display:'grid', gridTemplateColumns:'1fr 1fr 1fr',
          gap:1, background:'var(--border)', borderRadius:'var(--radius)',
          overflow:'hidden', marginBottom:14,
        }}>
          {[
            [data.totalFns,    'Functions'],
            [data.uniqueSkills,'Skills'],
            [data.bus.length,  'BUs'],
          ].map(([n,l])=>(
            <div key={l} style={{
              textAlign:'center', padding:'10px 6px',
              background:'var(--bg2)',
            }}>
              <div style={{ fontSize:20, fontWeight:700, color:'var(--text)', lineHeight:1 }}>{n}</div>
              <div style={{ fontSize:10, color:'var(--muted)', marginTop:3, textTransform:'uppercase', letterSpacing:'0.06em' }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:2, marginBottom:14, borderBottom:'1px solid var(--border)', paddingBottom:'1px' }}>
          {['functions','skills'].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              background:'none', border:'none',
              borderBottom: tab===t ? '2px solid var(--blue)' : '2px solid transparent',
              color: tab===t ? 'var(--blue-light)' : 'var(--muted)',
              padding:'6px 12px', fontSize:12, fontWeight: tab===t ? 700 : 400,
              textTransform:'capitalize', marginBottom:'-2px',
            }}>{t}</button>
          ))}
        </div>

        {/* Functions tab */}
        {tab==='functions' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {data.fns.map((fn,i)=>(
              <div key={i}>
                <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{fn.fn}</span>
                  <Tag color={BU_COLOR[fn.bu]||'gray'}>{fn.bu}</Tag>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {fn.skills.slice(0,8).map(sk=>(
                    <span key={sk} style={{
                      fontSize:11, padding:'2px 8px', borderRadius:4,
                      background:'var(--blue-dim)', color:'var(--blue-light)',
                      border:'1px solid var(--blue-glow)',
                    }}>{sk}</span>
                  ))}
                  {fn.skills.length > 8 && (
                    <span style={{ fontSize:11, color:'var(--subtle)', alignSelf:'center' }}>
                      +{fn.skills.length-8} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Skills tab — all unique skills */}
        {tab==='skills' && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
            {data.allSkills.map(sk=>(
              <span key={sk} style={{
                fontSize:11, padding:'4px 10px', borderRadius:5,
                background:'var(--card-hover)', color:'var(--text2)',
                border:'1px solid var(--border2)',
              }}>{sk}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
