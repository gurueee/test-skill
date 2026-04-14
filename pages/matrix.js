import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout, { Spinner, Empty, Tag } from '../components/Layout';
import { getAllFunctions, searchFunctions } from '../lib/api';

const BU_META = {
  SE:      { color:'blue',   label:'Software Engineering',         icon:'⬡' },
  SDSI:    { color:'green',  label:'Service Delivery & Support',   icon:'◈' },
  SVT:     { color:'amber',  label:'System Verification & Testing',icon:'◉' },
  NRM:     { color:'purple', label:'NRM',                          icon:'◑' },
  'R&D':   { color:'blue',   label:'Research & Development',       icon:'⬡' },
  Testing: { color:'amber',  label:'Testing',                      icon:'◉' },
  IT:      { color:'gray',   label:'Information Technology',       icon:'◈' },
  SDNC:    { color:'purple', label:'Solution Design & NC',         icon:'◑' },
};

// Categorise skills into buckets
const CATS = [
  ['Languages',   /\bjava\b|python|golang|\bgo\b|c\+\+|ruby|perl|typescript|javascript|scala|kotlin|c#|\.net/i],
  ['Databases',   /sql|oracle|postgres|mysql|mongo|cassandra|redis|elastic|clickhouse|mariadb|db2/i],
  ['Cloud',       /\baws\b|azure|gcp|openstack|cloud/i],
  ['Containers',  /kubernetes|docker|openshift|helm|container|k8s/i],
  ['DevOps',      /jenkins|gitlab|github|ansible|terraform|ci\/cd|devops|maven|gradle|sonar|pipeline/i],
  ['Frameworks',  /spring|react|angular|node|django|kafka|rabbitmq|rest|api|microservice|hibernate|graphql/i],
  ['Monitoring',  /grafana|prometheus|nagios|icinga|zabbix|elk|kibana|grafana|dynatrace|graylog/i],
  ['Networking',  /network|routing|switching|firewall|vpn|dns|lan|wan|tcp|ip\b/i],
];

function categorise(skills) {
  const buckets = {};
  const used = new Set();
  CATS.forEach(([cat, rx]) => {
    const matched = skills.filter(s => !used.has(s) && rx.test(s));
    matched.forEach(s => used.add(s));
    if (matched.length) buckets[cat] = matched;
  });
  const rest = skills.filter(s => !used.has(s));
  if (rest.length) buckets['Other'] = rest;
  return buckets;
}

function groupByBU(rows) {
  const map = new Map();
  for (const e of rows) {
    const bu = e.bu || 'Other';
    if (!map.has(bu)) map.set(bu, []);
    const skills = (e.employee_skills||[]).map(es=>es.skills?.skill_name).filter(Boolean).sort();
    map.get(bu).push({ fn:e.function_name||e.name||'—', leader:e.leader||'', skills });
  }
  return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([bu,fns])=>({ bu, fns }));
}

export default function Matrix() {
  const router = useRouter();
  const [q,        setQ]        = useState('');
  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [activeBU, setActiveBU] = useState('all');

  const load = async (query='') => {
    setLoading(true); setError('');
    try {
      const rows = query.trim() ? await searchFunctions(query) : await getAllFunctions();
      setData(groupByBU(rows));
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ load(); },[]);

  const onSubmit = (e) => { e.preventDefault(); load(q); };
  const allBUs   = data.map(d=>d.bu);
  const visible  = activeBU==='all' ? data : data.filter(d=>d.bu===activeBU);

  // Summary stats
  const totalFns    = data.reduce((a,b)=>a+b.fns.length,0);
  const totalSkills = new Set(data.flatMap(b=>b.fns.flatMap(f=>f.skills))).size;

  return (
    <Layout active="/matrix">
      <div style={{ maxWidth:1160, margin:'0 auto', padding:'32px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text)', letterSpacing:'-0.02em', marginBottom:4 }}>
            Skill Matrix
          </h1>
          <p style={{ color:'var(--muted)', fontSize:13 }}>
            Function-level skill coverage — {totalFns} functions · {totalSkills} unique skills · {data.length} BUs
          </p>
        </div>

        {/* Search + BU filter */}
        <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
          <form onSubmit={onSubmit} style={{ display:'flex', gap:8, minWidth:280, flex:1 }}>
            <div style={{ flex:1, position:'relative', display:'flex', alignItems:'center' }}>
              <svg style={{ position:'absolute',left:12,opacity:0.35,pointerEvents:'none' }}
                width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input value={q} onChange={e=>setQ(e.target.value)}
                placeholder="Search skill, leader, or function…"
                style={{ width:'100%', padding:'9px 12px 9px 34px', fontSize:13 }}
              />
            </div>
            <button type="submit" style={{
              padding:'9px 18px', background:'var(--blue)', color:'#fff',
              border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:600,
            }}>Search</button>
            {q && <button type="button" onClick={()=>{setQ('');load('');}} style={{
              padding:'9px 12px', background:'none', border:'1px solid var(--border)',
              color:'var(--muted)', borderRadius:'var(--radius)', fontSize:13,
            }}>Clear</button>}
          </form>

          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {['all',...allBUs].map(bu=>{
              const active = activeBU===bu;
              return (
                <button key={bu} onClick={()=>setActiveBU(bu)} style={{
                  padding:'6px 13px', borderRadius:20, fontSize:12, fontWeight:600,
                  background: active ? 'var(--blue)' : 'var(--card)',
                  color: active ? '#fff' : 'var(--muted)',
                  border: active ? '1px solid var(--blue)' : '1px solid var(--border2)',
                }}>{bu==='all'?'All BUs':bu}</button>
              );
            })}
          </div>
        </div>

        {error && (
          <div style={{ padding:'12px 16px', background:'var(--red-dim)', border:'1px solid rgba(239,68,68,0.3)',
            borderRadius:'var(--radius)', color:'var(--red)', marginBottom:16, fontSize:13 }}>⚠ {error}</div>
        )}

        {loading && <div style={{ textAlign:'center', padding:'60px 0' }}><Spinner size={28}/></div>}
        {!loading && visible.length===0 && <Empty text="No results found." />}

        {!loading && visible.map(({ bu, fns }) => (
          <BUCard key={bu} bu={bu} fns={fns} router={router} />
        ))}
      </div>
    </Layout>
  );
}

const CAT_STYLES = {
  Languages:  { color:'#60a5fa', bg:'rgba(59,130,246,0.08)',   border:'rgba(59,130,246,0.2)'  },
  Databases:  { color:'#34d399', bg:'rgba(16,185,129,0.08)',   border:'rgba(16,185,129,0.2)'  },
  Cloud:      { color:'#a78bfa', bg:'rgba(139,92,246,0.08)',   border:'rgba(139,92,246,0.2)'  },
  Containers: { color:'#22d3ee', bg:'rgba(6,182,212,0.08)',    border:'rgba(6,182,212,0.2)'   },
  DevOps:     { color:'#fb923c', bg:'rgba(249,115,22,0.08)',   border:'rgba(249,115,22,0.2)'  },
  Frameworks: { color:'#f472b6', bg:'rgba(244,114,182,0.08)',  border:'rgba(244,114,182,0.2)' },
  Monitoring: { color:'#facc15', bg:'rgba(250,204,21,0.08)',   border:'rgba(250,204,21,0.2)'  },
  Networking: { color:'#4ade80', bg:'rgba(74,222,128,0.08)',   border:'rgba(74,222,128,0.2)'  },
  Other:      { color:'#94a3b8', bg:'rgba(148,163,184,0.06)',  border:'rgba(148,163,184,0.15)'},
};

function SkillChip({ skill, cat, router }) {
  const st = CAT_STYLES[cat] || CAT_STYLES.Other;
  return (
    <span onClick={()=>router.push(`/skill?q=${encodeURIComponent(skill)}`)}
      title={`View ${skill} details`}
      style={{
        fontSize:11, padding:'3px 9px', borderRadius:5, cursor:'pointer',
        background: st.bg, color: st.color, border:`1px solid ${st.border}`,
        fontWeight:500, transition:'all 0.12s', display:'inline-block',
      }}
      onMouseEnter={e=>{e.target.style.filter='brightness(1.2)';e.target.style.transform='translateY(-1px)';}}
      onMouseLeave={e=>{e.target.style.filter='none';e.target.style.transform='none';}}
    >{skill}</span>
  );
}

function BUCard({ bu, fns, router }) {
  const [open,       setOpen]       = useState(false);
  const [expandedFn, setExpandedFn] = useState(null);
  const meta        = BU_META[bu] || { color:'gray', label:bu, icon:'◎' };
  const totalSkills = new Set(fns.flatMap(f=>f.skills)).size;
  const allSkillCats = categorise([...new Set(fns.flatMap(f=>f.skills))]);

  return (
    <div style={{
      background:'var(--card)', border:'1px solid var(--border)',
      borderRadius:'var(--radius-lg)', marginBottom:10, overflow:'hidden',
      transition:'border-color 0.15s',
    }}>
      {/* ── COLLAPSED HEADER (always visible) ── */}
      <div onClick={()=>setOpen(v=>!v)} style={{
        display:'flex', alignItems:'center', gap:14,
        padding:'16px 20px', cursor:'pointer',
        background: open ? 'var(--bg2)' : 'var(--card)',
        borderBottom: open ? '1px solid var(--border)' : 'none',
        transition:'background 0.15s',
      }}
      onMouseEnter={e=>{ if(!open) e.currentTarget.style.background='var(--card-hover)'; }}
      onMouseLeave={e=>{ if(!open) e.currentTarget.style.background='var(--card)'; }}
      >
        {/* Accent bar */}
        <div style={{ width:3, height:28, background:'var(--blue)', borderRadius:2, flexShrink:0 }}/>

        {/* BU name + label */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <span style={{ fontSize:15, fontWeight:800, color:'var(--text)', letterSpacing:'0.02em' }}>{bu}</span>
            <span style={{ fontSize:12, color:'var(--muted)' }}>{meta.label !== bu ? meta.label : ''}</span>
          </div>
          {/* Mini skill category dots — collapsed preview */}
          {!open && (
            <div style={{ display:'flex', gap:4, marginTop:5, flexWrap:'wrap' }}>
              {Object.keys(allSkillCats).slice(0,6).map(cat=>{
                const st = CAT_STYLES[cat]||CAT_STYLES.Other;
                return (
                  <span key={cat} style={{
                    fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:3,
                    background:st.bg, color:st.color, border:`1px solid ${st.border}`,
                    letterSpacing:'0.06em', textTransform:'uppercase',
                  }}>{cat}</span>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display:'flex', gap:16, flexShrink:0 }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--text)' }}>{fns.length}</div>
            <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Functions</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--text)' }}>{totalSkills}</div>
            <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Skills</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--text)' }}>{new Set(fns.map(f=>f.leader).filter(Boolean)).size}</div>
            <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Leaders</div>
          </div>
        </div>

        <span style={{ color:'var(--subtle)', fontSize:13, marginLeft:8 }}>{open?'▾':'▸'}</span>
      </div>

      {/* ── EXPANDED BODY ── */}
      {open && (
        <div className="fade-in" style={{ padding:'0' }}>

          {/* BU-level skill breakdown by category */}
          <div style={{
            padding:'16px 20px', background:'var(--bg2)',
            borderBottom:'1px solid var(--border)',
          }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)',
              letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:12 }}>
              Skill breakdown across {bu}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {Object.entries(allSkillCats).map(([cat, skills])=>{
                const st = CAT_STYLES[cat]||CAT_STYLES.Other;
                return (
                  <div key={cat} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    <div style={{ width:90, flexShrink:0, paddingTop:3 }}>
                      <span style={{
                        fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:3,
                        background:st.bg, color:st.color, border:`1px solid ${st.border}`,
                        letterSpacing:'0.06em', textTransform:'uppercase', whiteSpace:'nowrap',
                      }}>{cat} ({skills.length})</span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ flex:1 }}>
                      <div style={{ height:4, background:'var(--border)', borderRadius:2, marginBottom:6, overflow:'hidden' }}>
                        <div style={{
                          height:'100%', borderRadius:2, background:st.color,
                          width:`${Math.min(100, (skills.length/Math.max(...Object.values(allSkillCats).map(s=>s.length)))*100)}%`,
                          opacity:0.7,
                        }}/>
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {skills.slice(0,10).map(s=>(
                          <SkillChip key={s} skill={s} cat={cat} router={router}/>
                        ))}
                        {skills.length>10 && (
                          <span style={{ fontSize:11, color:'var(--subtle)', alignSelf:'center' }}>
                            +{skills.length-10} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Function cards */}
          <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)',
              letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:4 }}>
              Functions in {bu}
            </div>
            {fns.map((fn, i) => {
              const isExp = expandedFn === i;
              const cats  = categorise(fn.skills);
              const initials = fn.leader?.trim().split(/\s+/).map(w=>w[0]?.toUpperCase()||'').slice(0,2).join('') || '?';
              return (
                <div key={i} style={{
                  border:'1px solid var(--border)', borderRadius:'var(--radius)',
                  overflow:'hidden', transition:'border-color 0.15s',
                }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border2)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
                >
                  {/* Function row */}
                  <div onClick={()=>setExpandedFn(isExp ? null : i)} style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'10px 14px', cursor:'pointer', background:'var(--card)',
                  }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--card-hover)'}
                  onMouseLeave={e=>e.currentTarget.style.background='var(--card)'}
                  >
                    {/* Leader avatar */}
                    <div style={{
                      width:30, height:30, borderRadius:'50%', flexShrink:0,
                      background:'var(--blue-dim)', border:'1px solid var(--blue-glow)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:10, fontWeight:700, color:'var(--blue-light)',
                    }}>{initials}</div>

                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:2 }}>{fn.fn}</div>
                      {fn.leader && (
                        <div style={{ fontSize:11, color:'var(--muted)', fontFamily:'var(--mono)' }}>{fn.leader}</div>
                      )}
                    </div>

                    {/* Skill count + category dots */}
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                      <div style={{ display:'flex', gap:3 }}>
                        {Object.keys(cats).slice(0,5).map(cat=>{
                          const st = CAT_STYLES[cat]||CAT_STYLES.Other;
                          return (
                            <div key={cat} title={cat} style={{
                              width:8, height:8, borderRadius:'50%',
                              background:st.color, opacity:0.8,
                            }}/>
                          );
                        })}
                      </div>
                      <span style={{ fontSize:11, color:'var(--muted)', minWidth:40, textAlign:'right' }}>
                        {fn.skills.length} skills
                      </span>
                      <span style={{ color:'var(--subtle)', fontSize:11 }}>{isExp?'▾':'▸'}</span>
                    </div>
                  </div>

                  {/* Expanded function detail */}
                  {isExp && (
                    <div className="fade-in" style={{
                      padding:'14px 16px', background:'var(--bg2)',
                      borderTop:'1px solid var(--border)',
                    }}>
                      {fn.skills.length === 0
                        ? <span style={{ fontSize:12, color:'var(--subtle)' }}>No skills mapped yet.</span>
                        : Object.entries(cats).map(([cat, skills])=>(
                            <div key={cat} style={{ marginBottom:10 }}>
                              <div style={{ fontSize:9, fontWeight:700, color:CAT_STYLES[cat]?.color||'var(--muted)',
                                letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:5 }}>
                                {cat}
                              </div>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                                {skills.map(sk=>(
                                  <SkillChip key={sk} skill={sk} cat={cat} router={router}/>
                                ))}
                              </div>
                            </div>
                          ))
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
