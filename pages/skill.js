import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout, { Spinner, Tag } from '../components/Layout';
import { supabase } from '../lib/supabase';

const BU_COLOR = { SE:'blue', SDSI:'green', SVT:'amber', NRM:'purple', 'R&D':'blue', Testing:'amber', IT:'gray', SDNC:'purple' };

// Categorise co-skills into buckets
function categoriseSkills(skills) {
  const cats = {
    'Languages':   [],
    'Databases':   [],
    'Cloud':       [],
    'DevOps':      [],
    'Frameworks':  [],
    'Other':       [],
  };
  const rules = [
    [/java|python|golang|go\b|c\+\+|ruby|perl|typescript|javascript|scala|kotlin|c#/i, 'Languages'],
    [/sql|oracle|postgres|mysql|mongo|cassandra|redis|elastic|clickhouse|mariadb/i, 'Databases'],
    [/aws|azure|gcp|cloud|openstack|kubernetes|docker|openshift/i, 'Cloud'],
    [/jenkins|gitlab|github|ansible|terraform|ci\/cd|devops|maven|gradle|sonar/i, 'DevOps'],
    [/spring|react|angular|node|django|kafka|rabbitmq|rest|api|microservice|hibernate/i, 'Frameworks'],
  ];
  skills.forEach(s => {
    let placed = false;
    for (const [rx, cat] of rules) {
      if (rx.test(s)) { cats[cat].push(s); placed = true; break; }
    }
    if (!placed) cats['Other'].push(s);
  });
  return Object.entries(cats).filter(([,v])=>v.length>0);
}

async function getSkillDetails(skillName) {
  const { data: skillRows } = await supabase
    .from('skills').select('id,skill_name').ilike('skill_name', `%${skillName}%`);
  if (!skillRows?.length) return null;

  const skillIds = skillRows.map(s=>s.id);

  const { data: links } = await supabase
    .from('employee_skills')
    .select('emp_id,skill_id,employees(id,bu,function_name,leader)')
    .in('skill_id', skillIds);

  // Group by BU → functions
  const buMap = new Map();
  for (const link of (links||[])) {
    const e = link.employees;
    if (!e) continue;
    const bu = e.bu||'Other';
    if (!buMap.has(bu)) buMap.set(bu, new Map());
    const fnKey = e.function_name||'—';
    if (!buMap.get(bu).has(fnKey))
      buMap.get(bu).set(fnKey, { fn:fnKey, leader:e.leader||'' });
  }

  const matches = [...buMap.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([bu,fnMap])=>({
    bu, fns:[...fnMap.values()], count:fnMap.size,
  }));

  // Co-occurring skills
  const empIds = [...new Set((links||[]).map(l=>l.emp_id))];
  let relatedSkills = [];
  if (empIds.length) {
    const { data: coSkills } = await supabase
      .from('employee_skills').select('skills(skill_name)')
      .in('emp_id', empIds)
      .not('skill_id','in',`(${skillIds.join(',')})`)
      .limit(200);
    const freq = {};
    (coSkills||[]).forEach(r=>{ const s=r.skills?.skill_name; if(s) freq[s]=(freq[s]||0)+1; });
    relatedSkills = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,24).map(([s])=>s);
  }

  // All leaders
  const allLeaders = [...new Set(matches.flatMap(m=>m.fns.map(f=>f.leader).filter(Boolean)))];

  return {
    exactTerm: skillRows[0].skill_name,
    matches, relatedSkills, allLeaders,
    totalFns: matches.reduce((a,b)=>a+b.count,0),
  };
}

async function getAIInsight(skillName, context) {
  const res = await fetch('/api/ai-insight',{
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ skill:skillName, context }),
  });
  const data = await res.json();
  return data.insight;
}

export default function SkillPage() {
  const router = useRouter();
  const { q }  = router.query;

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState('');
  const [aiLoad,  setAILoad]  = useState(false);
  const [aiDone,  setAIDone]  = useState(false);
  const [activeTab, setTab]   = useState('coverage'); // coverage | skills | leaders

  useEffect(()=>{
    if (!q) return;
    setLoading(true); setDetails(null); setInsight(''); setAIDone(false); setTab('coverage');
    getSkillDetails(q).then(setDetails).catch(console.error).finally(()=>setLoading(false));
  },[q]);

  const fetchInsight = async () => {
    if (!details) return;
    setAILoad(true); setInsight('');
    try {
      const ctx = `Used in BUs: ${details.matches.map(m=>m.bu).join(', ')}. Functions: ${details.totalFns}. Leaders: ${details.allLeaders.slice(0,5).join(', ')}.`;
      setInsight(await getAIInsight(q, ctx)); setAIDone(true);
    } catch { setInsight('AI insight unavailable.'); setAIDone(true); }
    finally { setAILoad(false); }
  };

  const categories = details ? categoriseSkills(details.relatedSkills) : [];

  return (
    <Layout active="/matrix">
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'32px 24px 80px' }}>

        {/* Back */}
        <button onClick={()=>router.back()} style={{
          display:'flex', alignItems:'center', gap:6, background:'none', border:'none',
          color:'var(--muted)', fontSize:13, marginBottom:24, padding:0, cursor:'pointer',
        }}>← Back</button>

        {loading && <div style={{ textAlign:'center', padding:'80px 0' }}><Spinner size={32}/></div>}

        {!loading && !details && (
          <div style={{ textAlign:'center', padding:'80px 0' }}>
            <div style={{ fontSize:32, opacity:0.2, marginBottom:12 }}>◎</div>
            <p style={{ color:'var(--muted)' }}>Skill "{q}" not found in database.</p>
          </div>
        )}

        {!loading && details && (
          <>
            {/* ── HERO BANNER ─────────────────────────────────── */}
            <div style={{
              background:'var(--card)', border:'1px solid var(--border)',
              borderRadius:'var(--radius-lg)', overflow:'hidden', marginBottom:20,
            }}>
              {/* Coloured top strip */}
              <div style={{
                height:6,
                background:'linear-gradient(90deg, var(--blue) 0%, var(--purple) 50%, var(--green) 100%)',
              }}/>

              <div style={{ padding:'28px 32px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:20 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--blue-light)',
                      letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
                      Technical Skill
                    </div>
                    <h1 style={{ fontSize:32, fontWeight:800, color:'var(--text)',
                      letterSpacing:'-0.03em', lineHeight:1.1, marginBottom:20 }}>
                      {q}
                    </h1>

                    {/* Stats row */}
                    <div style={{ display:'flex', gap:0, flexWrap:'wrap' }}>
                      {[
                        [details.matches.length,  'Business Units', 'var(--blue-light)',   'var(--blue-dim)',   'var(--blue-glow)'],
                        [details.totalFns,         'Functions',      'var(--purple)',       'var(--purple-dim)', 'rgba(139,92,246,0.3)'],
                        [details.allLeaders.length,'Leaders',        'var(--green)',        'var(--green-dim)',  'rgba(16,185,129,0.3)'],
                        [details.relatedSkills.length,'Co-skills',   'var(--amber)',        'var(--amber-dim)',  'rgba(245,158,11,0.3)'],
                      ].map(([n,l,col,bg,border],i)=>(
                        <div key={l} style={{
                          padding:'14px 24px', textAlign:'center',
                          borderRight: i<3 ? '1px solid var(--border)' : 'none',
                          background: bg, borderRadius: i===0?'8px 0 0 8px':i===3?'0 8px 8px 0':'0',
                          border:`1px solid ${border}`,
                          marginRight: i<3 ? -1 : 0,
                        }}>
                          <div style={{ fontSize:28, fontWeight:800, color:col, lineHeight:1 }}>{n}</div>
                          <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase',
                            letterSpacing:'0.07em', marginTop:4 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI button */}
                  <button onClick={fetchInsight} disabled={aiLoad} style={{
                    display:'flex', alignItems:'center', gap:8, padding:'12px 20px',
                    borderRadius:'var(--radius)', fontSize:13, fontWeight:600, cursor:'pointer',
                    background: aiDone ? 'var(--green-dim)' : 'var(--bg2)',
                    border:`1px solid ${aiDone ? 'rgba(16,185,129,0.4)' : 'var(--border2)'}`,
                    color: aiDone ? 'var(--green)' : 'var(--text2)',
                    flexShrink:0,
                  }}>
                    {aiLoad ? <><Spinner size={14}/> Thinking…</> :
                     aiDone ? <>✓ AI Insight</> : <>✦ AI Insight</>}
                  </button>
                </div>

                {/* AI output */}
                {(aiLoad || insight) && (
                  <div style={{
                    marginTop:20, padding:'16px 20px', borderRadius:'var(--radius)',
                    background:'var(--bg2)', border:'1px solid var(--border)',
                    borderLeft:'3px solid var(--blue)',
                  }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--blue-light)',
                      letterSpacing:'0.09em', textTransform:'uppercase', marginBottom:8 }}>
                      ✦ AI Insight
                    </div>
                    {aiLoad
                      ? <div style={{ display:'flex', gap:10, alignItems:'center', color:'var(--muted)', fontSize:13 }}>
                          <Spinner size={14}/> Generating…
                        </div>
                      : <p style={{ fontSize:14, color:'var(--text2)', lineHeight:1.8, margin:0 }}>{insight}</p>
                    }
                  </div>
                )}
              </div>
            </div>

            {/* ── TAB BAR ─────────────────────────────────────── */}
            <div style={{
              display:'flex', gap:2, marginBottom:20,
              borderBottom:'1px solid var(--border)', paddingBottom:'1px',
            }}>
              {[
                ['coverage', `BU Coverage (${details.matches.length})`],
                ['leaders',  `Leaders (${details.allLeaders.length})`],
                ['skills',   `Co-skills (${details.relatedSkills.length})`],
              ].map(([t,l])=>(
                <button key={t} onClick={()=>setTab(t)} style={{
                  background:'none', border:'none',
                  borderBottom: activeTab===t ? '2px solid var(--blue)' : '2px solid transparent',
                  marginBottom:'-1px', padding:'10px 18px',
                  color: activeTab===t ? 'var(--blue-light)' : 'var(--muted)',
                  fontSize:13, fontWeight: activeTab===t ? 700 : 400,
                }}>
                  {l}
                </button>
              ))}
            </div>

            {/* ── TAB: BU COVERAGE ─────────────────────────────── */}
            {activeTab==='coverage' && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
                {details.matches.map(({ bu, fns, count })=>(
                  <div key={bu} style={{
                    background:'var(--card)', border:'1px solid var(--border)',
                    borderRadius:'var(--radius-lg)', overflow:'hidden',
                  }}>
                    {/* BU header */}
                    <div style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'12px 16px', background:'var(--bg2)',
                      borderBottom:'1px solid var(--border)',
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:3, height:16, background:'var(--blue)', borderRadius:2 }}/>
                        <Tag color={BU_COLOR[bu]||'gray'}>{bu}</Tag>
                      </div>
                      <span style={{ fontSize:11, color:'var(--muted)', fontWeight:600 }}>
                        {count} function{count!==1?'s':''}
                      </span>
                    </div>
                    {/* Functions list */}
                    <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:10 }}>
                      {fns.map((fn,i)=>(
                        <div key={i} style={{
                          paddingBottom: i<fns.length-1 ? 10:0,
                          borderBottom: i<fns.length-1 ? '1px solid var(--border)':'none',
                        }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:3 }}>{fn.fn}</div>
                          {fn.leader && (
                            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                              <div style={{ width:16, height:16, borderRadius:'50%',
                                background:'var(--blue-dim)', border:'1px solid var(--blue-glow)',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:8, color:'var(--blue-light)', fontWeight:700, flexShrink:0 }}>
                                {fn.leader.trim()[0]?.toUpperCase()||'?'}
                              </div>
                              <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'var(--mono)' }}>
                                {fn.leader}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── TAB: LEADERS ─────────────────────────────────── */}
            {activeTab==='leaders' && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
                {details.allLeaders.map((leader,i)=>{
                  // Find which BUs this leader covers
                  const leaderBUs = details.matches
                    .filter(m=>m.fns.some(f=>f.leader===leader))
                    .map(m=>m.bu);
                  const leaderFns = details.matches
                    .flatMap(m=>m.fns.filter(f=>f.leader===leader).map(f=>({...f,bu:m.bu})));
                  const initials = leader.trim().split(/\s+/).map(w=>w[0]?.toUpperCase()||'').slice(0,2).join('');
                  const colors = [
                    ['#1e40af','#3b82f6'],['#065f46','#10b981'],['#4c1d95','#8b5cf6'],
                    ['#7c2d12','#f97316'],['#7f1d1d','#ef4444'],['#1e3a5f','#60a5fa'],
                  ];
                  const [bg1,bg2] = colors[i%colors.length];
                  return (
                    <div key={leader} style={{
                      background:'var(--card)', border:'1px solid var(--border)',
                      borderRadius:'var(--radius-lg)', overflow:'hidden',
                      transition:'border-color 0.15s',
                    }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border2)'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
                    >
                      {/* Mini cover */}
                      <div style={{ height:40, background:`linear-gradient(135deg,${bg1},${bg2})` }}/>
                      <div style={{ padding:'0 16px 16px' }}>
                        {/* Avatar */}
                        <div style={{
                          width:44, height:44, borderRadius:'50%',
                          background:`linear-gradient(135deg,${bg1},${bg2})`,
                          border:'3px solid var(--card)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:15, fontWeight:800, color:'#fff',
                          marginTop:-22, marginBottom:10,
                        }}>{initials}</div>
                        <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:6 }}>{leader}</div>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:10 }}>
                          {leaderBUs.map(bu=><Tag key={bu} color={BU_COLOR[bu]||'gray'}>{bu}</Tag>)}
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {leaderFns.map((fn,j)=>(
                            <div key={j} style={{ fontSize:12, color:'var(--text2)', lineHeight:1.4 }}>
                              {fn.fn}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── TAB: CO-SKILLS ───────────────────────────────── */}
            {activeTab==='skills' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {categories.map(([cat, skills])=>(
                  <div key={cat} style={{
                    background:'var(--card)', border:'1px solid var(--border)',
                    borderRadius:'var(--radius-lg)', padding:'18px 20px',
                  }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)',
                      letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:12,
                      display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:20, height:2, background:'var(--blue)', borderRadius:1 }}/>
                      {cat}
                      <span style={{ fontWeight:400, color:'var(--subtle)' }}>({skills.length})</span>
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                      {skills.map(s=>(
                        <button key={s}
                          onClick={()=>router.push(`/skill?q=${encodeURIComponent(s)}`)}
                          style={{
                            fontSize:12, padding:'6px 13px', borderRadius:6, cursor:'pointer',
                            background:'var(--bg2)', color:'var(--text2)',
                            border:'1px solid var(--border2)', fontFamily:'var(--font)', fontWeight:500,
                          }}
                          onMouseEnter={e=>{e.target.style.background='var(--blue-dim)';e.target.style.color='var(--blue-light)';e.target.style.borderColor='var(--blue-glow)';}}
                          onMouseLeave={e=>{e.target.style.background='var(--bg2)';e.target.style.color='var(--text2)';e.target.style.borderColor='var(--border2)';}}
                        >{s}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
