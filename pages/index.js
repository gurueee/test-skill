import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout, { Spinner, Tag, FeedbackWidget, ErrorBanner } from '../components/Layout';
import { supabase } from '../lib/supabase';

const CHIPS = ['Java','Kafka','OCS','CRM','Kubernetes','Python','Docker','Billing','AWS','Migration'];

// Example prompts for onboarding (UX-03)
const EXAMPLES = [
  'What skills does a Billing Analyst need?',
  'Who on the OSS team knows Kubernetes?',
  'What is OCS in telecom?',
  'Show me Java developer roles',
];

const SOURCE_LABELS = {
  db:     { icon:'◈', label:'From our database',  color:'var(--green)',     bg:'var(--green-dim)',  border:'rgba(16,185,129,0.3)' },
  claude: { icon:'✦', label:'From Claude AI',     color:'var(--blue-light)',bg:'var(--blue-dim)',   border:'var(--blue-glow)'     },
  none:   { icon:'◎', label:'No results found',   color:'var(--muted)',     bg:'var(--card)',       border:'var(--border)'        },
};

export default function Home() {
  const router   = useRouter();
  const inputRef = useRef(null);
  const chatRef  = useRef(null);

  const [q,        setQ]        = useState('');
  const [messages, setMessages] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [focused,  setFocused]  = useState(false);
  const [error,    setError]    = useState('');

  // Reset chat when user clicks Search nav (same route = no routeChange fires)
  // We use a custom event dispatched from Layout when Search is clicked
  useEffect(() => {
    const reset = () => { setMessages([]); setQ(''); setError(''); };
    window.addEventListener('sve-reset-chat', reset);
    return () => window.removeEventListener('sve-reset-chat', reset);
  }, []);

  // Dynamic stats (BUG-02)
  const [stats,    setStats]    = useState({ fns:57, jds:480, terms:97, bus:7 });

  useEffect(() => {
    // Fetch real counts dynamically
    Promise.all([
      supabase.from('employees').select('id', { count:'exact', head:true }),
      supabase.from('job_descriptions').select('id', { count:'exact', head:true }),
      supabase.from('glossary').select('id', { count:'exact', head:true }),
    ]).then(([e, j, g]) => {
      setStats({
        fns:   e.count || 57,
        jds:   j.count || 480,
        terms: g.count || 97,
        bus:   7,
      });
    }).catch(() => {}); // silent fail — keep defaults
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const send = async (query) => {
    const text = query.trim();
    if (!text || loading) return;
    setQ(''); setError('');
    setMessages(prev => [...prev, { role:'user', text }]);
    setLoading(true);
    try {
      const res = await fetch('/api/bot-search', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ query: text }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setMessages(prev => [...prev, {
        role:'bot', text:data.answer, source:data.source,
        skills:data.skills||[], glossary:data.glossary||[], jds:data.jds||[],
        query: text,
      }]);
    } catch(e) {
      setError('Could not load results. Please refresh or try again later.');
      setMessages(prev => prev.slice(0,-1)); // remove user msg on failure
    } finally { setLoading(false); }
  };

  const onSubmit = (e) => { e.preventDefault(); send(q); };
  const onChip   = (c) => { setQ(c); send(c); };         // UX-01: chips auto-submit
  const onExample = (ex) => { setQ(ex); send(ex); };
  const onClear  = () => { setMessages([]); setQ(''); setError(''); };

  const hasChat = messages.length > 0;
  const lastBotMsg = messages.filter(m=>m.role==='bot').slice(-1)[0];

  return (
    <Layout active="/">
      <div style={{
        maxWidth:720, margin:'0 auto', padding:'48px 20px 32px',
        display:'flex', flexDirection:'column',
        minHeight:'calc(100vh - 118px)',
      }}>
        {/* Hero */}
        <div style={{
          textAlign:'center', marginBottom: hasChat ? 12 : 32,
          transition:'margin 0.3s ease',
        }}>
          {!hasChat && (
            <>
              {/* Netcracker badge (COPY-02) */}
              <div style={{
                display:'inline-flex', alignItems:'center', gap:6,
                fontSize:11, fontWeight:700, letterSpacing:'0.08em',
                textTransform:'uppercase', color:'var(--blue-light)',
                background:'var(--blue-dim)', padding:'5px 14px',
                borderRadius:20, marginBottom:20,
                border:'1px solid var(--blue-glow)',
              }}>
                🔒 Netcracker Internal
              </div>
              <h1 style={{
                fontSize:'clamp(22px,5vw,38px)', fontWeight:800,
                letterSpacing:'-0.03em', lineHeight:1.1,
                color:'var(--text)', marginBottom:10,
              }}>
                Skill Visibility Engine
              </h1>
              {/* Better subtitle (COPY-03) */}
              <p style={{ color:'var(--muted)', fontSize:14, marginBottom:0, lineHeight:1.6, maxWidth:480, margin:'0 auto 24px' }}>
                Explore Netcracker's skill matrix, JD library, and BSS/OSS glossary — all in one place.
              </p>

              {/* Live stats — dynamic (BUG-02) */}
              <div style={{ display:'flex', gap:20, justifyContent:'center', marginBottom:28, flexWrap:'wrap' }}>
                {[
                  [stats.fns,   'Functions'],
                  [stats.bus,   'Business Units'],
                  [stats.jds,   'Job Descriptions'],
                  [stats.terms, 'BSS/OSS Terms'],
                ].map(([n,l])=>(
                  <div key={l} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:800, color:'var(--blue-light)' }}>{n}</div>
                    <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{l}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {hasChat && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>
                ✦ Skill Visibility Bot
              </span>
              <button onClick={onClear} style={{
                background:'none', border:'1px solid var(--border)',
                color:'var(--muted)', padding:'4px 12px', borderRadius:6, fontSize:12, cursor:'pointer',
              }}>Clear chat</button>
            </div>
          )}
        </div>

        {/* Error banner (MISS-02) */}
        {error && (
          <ErrorBanner message={error} onRetry={()=>{ setError(''); const last = messages.slice(-1)[0]; if(last) send(last.text); }}/>
        )}

        {/* Chat */}
        {hasChat && (
          <div ref={chatRef} style={{
            flex:1, overflowY:'auto', display:'flex', flexDirection:'column',
            gap:16, marginBottom:16, paddingRight:4, maxHeight:'52vh',
          }}>
            {messages.map((msg, i) => (
              <ChatMessage key={i} msg={msg} router={router} />
            ))}
            {loading && (
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <div style={{
                  width:28, height:28, borderRadius:'50%', background:'var(--blue-dim)',
                  border:'1px solid var(--blue-glow)', display:'flex',
                  alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0,
                }}>✦</div>
                <div style={{
                  background:'var(--card)', border:'1px solid var(--border)',
                  borderRadius:'var(--radius-lg)', padding:'12px 16px',
                  display:'flex', alignItems:'center', gap:8,
                }}>
                  <Spinner size={14}/>
                  <span style={{ fontSize:13, color:'var(--muted)' }}>Searching…</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Feedback (MISS-01) */}
        {hasChat && lastBotMsg && !loading && (
          <FeedbackWidget query={lastBotMsg.query} />
        )}

        {/* Input */}
        <div style={{ marginTop: hasChat ? 12 : 0 }}>
          <form onSubmit={onSubmit} style={{ position:'relative', marginBottom:12 }}>
            <div style={{
              display:'flex',
              background:'var(--card)',
              border:`1px solid ${focused ? 'var(--blue)' : 'var(--border2)'}`,
              borderRadius:'var(--radius-xl)',
              boxShadow: focused ? '0 0 0 3px var(--blue-dim)' : 'var(--shadow-sm)',
              overflow:'hidden', transition:'all 0.18s',
            }}>
              <svg style={{ marginLeft:16, flexShrink:0, alignSelf:'center', opacity:0.35 }}
                width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                ref={inputRef} value={q}
                onChange={e=>setQ(e.target.value)}
                onFocus={()=>setFocused(true)}
                onBlur={()=>setFocused(false)}
                autoFocus
                aria-label="Search skills, glossary terms, or job roles"
                placeholder={hasChat ? 'Ask a follow-up…' : 'Search skills, roles, or BSS/OSS terms…'}
                style={{
                  flex:1, padding:'13px 12px', background:'none',
                  border:'none', color:'var(--text)', fontSize:14, outline:'none',
                }}
              />
              {q && (
                <button type="button" onClick={()=>setQ('')} aria-label="Clear search"
                  style={{ background:'none', color:'var(--subtle)', padding:'0 10px', fontSize:15, border:'none', cursor:'pointer' }}>
                  ✕
                </button>
              )}
              <button type="submit" disabled={loading||!q.trim()} aria-label="Submit search"
                style={{
                  padding:'13px 20px', background:'var(--blue)', color:'#fff',
                  fontSize:13, fontWeight:700, border:'none', cursor:'pointer',
                  opacity:(!q.trim()||loading)?0.5:1, flexShrink:0,
                }}>
                {loading ? '…' : 'Ask'}
              </button>
            </div>
          </form>

          {/* Quick-search chips with label (UX-01) */}
          {!hasChat && (
            <div>
              <p style={{ fontSize:11, color:'var(--subtle)', textAlign:'center',
                textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8, fontWeight:600 }}>
                Popular searches
              </p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center', marginBottom:16 }}>
                {CHIPS.map(c=>(
                  <button key={c} onClick={()=>onChip(c)}
                    aria-label={`Search for ${c}`}
                    style={{
                      background:'var(--card)', border:'1px solid var(--border)',
                      color:'var(--muted)', padding:'5px 13px', borderRadius:20,
                      fontSize:12, fontWeight:500, cursor:'pointer',
                    }}
                    onMouseEnter={e=>{e.target.style.borderColor='var(--border2)';e.target.style.color='var(--text)';}}
                    onMouseLeave={e=>{e.target.style.borderColor='var(--border)';e.target.style.color='var(--muted)';}}
                  >{c}</button>
                ))}
              </div>

              {/* Example prompts (UX-03) */}
              <p style={{ fontSize:11, color:'var(--subtle)', textAlign:'center',
                textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8, fontWeight:600 }}>
                Try asking
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {EXAMPLES.map(ex=>(
                  <button key={ex} onClick={()=>onExample(ex)} style={{
                    background:'var(--card)', border:'1px solid var(--border)',
                    borderRadius:'var(--radius)', padding:'10px 16px',
                    fontSize:13, color:'var(--text2)', textAlign:'left',
                    cursor:'pointer', transition:'all 0.15s', width:'100%',
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--blue-glow)';e.currentTarget.style.background='var(--blue-dim)';e.currentTarget.style.color='var(--blue-light)';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--card)';e.currentTarget.style.color='var(--text2)';}}
                  >
                    <span style={{ opacity:0.4, marginRight:8 }}>→</span>{ex}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Landing tiles */}
        {!hasChat && (
          <div style={{
            display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))',
            gap:10, marginTop:24,
          }}>
            {[
              { label:'Skill Matrix',  sub:`${stats.fns} functions · ${stats.bus} BUs`,  href:'/matrix',  color:'blue'  , desc:'Browse all skills by BU and function'        },
              { label:'JD Repository', sub:`${stats.jds} job descriptions`,               href:'/jd',      color:'purple', desc:'Browse and filter all job descriptions'       },
              { label:'Glossary',      sub:`${stats.terms} BSS/OSS terms`,                href:'/glossary',color:'green' , desc:'Telecom and BSS/OSS term definitions'         },
              { label:'Leaders',       sub:'View domain leads & their team skill profile', href:'/leaders', color:'amber' , desc:'Line managers and their team skill profiles'  },
            ].map(x=>{
              const colorMap = {
                blue:  ['var(--blue-dim)',  'var(--blue-light)',  'var(--blue-glow)'],
                purple:['var(--purple-dim)','var(--purple)',      'rgba(139,92,246,0.3)'],
                green: ['var(--green-dim)', 'var(--green)',       'rgba(16,185,129,0.3)'],
                amber: ['var(--amber-dim)', 'var(--amber)',       'rgba(245,158,11,0.3)'],
              };
              const [bg,text,border] = colorMap[x.color]||colorMap.blue;
              return (
                <div key={x.label} onClick={()=>router.push(x.href)}
                  title={x.desc}
                  style={{
                    background:'var(--card)', border:'1px solid var(--border)',
                    borderRadius:'var(--radius-lg)', padding:'18px 16px',
                    cursor:'pointer', transition:'all 0.18s',
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=border;e.currentTarget.style.background=bg;e.currentTarget.style.transform='translateY(-2px)';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--card)';e.currentTarget.style.transform='none';}}
                >
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:4 }}>{x.label}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.4 }}>{x.sub}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

function ChatMessage({ msg, router }) {
  const isUser = msg.role === 'user';
  const src    = SOURCE_LABELS[msg.source] || SOURCE_LABELS.none;

  if (isUser) return (
    <div style={{ display:'flex', justifyContent:'flex-end' }}>
      <div style={{
        background:'var(--blue)', color:'#fff',
        padding:'10px 16px', borderRadius:'14px 14px 4px 14px',
        fontSize:14, fontWeight:500, maxWidth:'80%', lineHeight:1.5,
      }}>{msg.text}</div>
    </div>
  );

  return (
    <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
      <div style={{
        width:28, height:28, borderRadius:'50%', flexShrink:0,
        background:'var(--blue-dim)', border:'1px solid var(--blue-glow)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:12, color:'var(--blue-light)', marginTop:2,
      }}>✦</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
          <span style={{
            fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4,
            background:src.bg, color:src.color, border:`1px solid ${src.border}`,
            letterSpacing:'0.06em', textTransform:'uppercase',
          }}>{src.icon} {src.label}</span>
          {msg.source==='claude' && (
            <span style={{ fontSize:10, color:'var(--subtle)' }}>Not in internal DB</span>
          )}
        </div>
        <div style={{
          background:'var(--card)', border:'1px solid var(--border)',
          borderRadius:'4px 14px 14px 14px', padding:'14px 18px',
        }}>
          {/* Empty state (COPY-04) */}
          {false ? (
            <p style={{ fontSize:13, color:'var(--muted)', margin:0 }}/>
          ) : (
            msg.text.split('\n').filter(Boolean).map((line,i)=>{
              const parts = line.split(/\*\*(.*?)\*\*/g);
              return (
                <p key={i} style={{ fontSize:13, color:'var(--text2)', lineHeight:1.75,
                  margin: i<msg.text.split('\n').length-1 ? '0 0 8px' : 0 }}>
                  {parts.map((p,j)=>j%2===1
                    ? <strong key={j} style={{ color:'var(--text)', fontWeight:600 }}>{p}</strong>
                    : p
                  )}
                </p>
              );
            })
          )}
        </div>

        {/* Result cards */}
        {(msg.skills?.length>0 || msg.glossary?.length>0 || msg.jds?.length>0) && (
          <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:6 }}>
            {msg.skills?.map(s=>(
              <SkillScoreCard key={s.id} skill={s} router={router}/>
            ))}
            {msg.glossary?.map(g=>(
              <div key={g.id} style={{
                padding:'10px 14px', background:'var(--card)',
                border:'1px solid var(--border)', borderRadius:'var(--radius)',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <Tag color="green">Glossary</Tag>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{g.term}</span>
                  {g.domain && <Tag color="gray">{g.domain}</Tag>}
                </div>
                {g.full_form && <p style={{ fontSize:12, color:'var(--blue-light)', fontWeight:600, margin:'0 0 4px' }}>{g.full_form}</p>}
                {g.definition && <p style={{ fontSize:12, color:'var(--muted)', margin:0, lineHeight:1.6 }}>{g.definition.slice(0,120)}…</p>}
              </div>
            ))}
            {msg.jds?.map(j=>(
              <div key={j.id} onClick={()=>router.push('/jd')}
                style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'9px 14px', background:'var(--card)',
                  border:'1px solid var(--border)', borderRadius:'var(--radius)', cursor:'pointer',
                }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--purple)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
              >
                <Tag color="purple">JD</Tag>
                <span style={{ fontSize:13, fontWeight:500, color:'var(--text)', flex:1 }}>{j.title}</span>
                {j.department && <Tag color="gray">{j.department}</Tag>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SkillScoreCard({ skill, router }) {
  const [open,    setOpen]    = useState(false);
  const [card,    setCard]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState('');
  const [aiLoad,  setAILoad]  = useState(false);
  const [aiSrc,   setAISrc]   = useState('');

  const toggleCard = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (card) return;
    setLoading(true);
    try {
      const res  = await fetch('/api/skill-card', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ skill: skill.skill_name }),
      });
      const data = await res.json();
      setCard(data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchAI = async () => {
    setAILoad(true);
    try {
      const ctx = card ? `Used in BUs: ${card.bus?.join(', ')}. Functions: ${card.totalFns}.` : '';
      const res  = await fetch('/api/ai-insight', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ skill: skill.skill_name, context: ctx }),
      });
      const data = await res.json();
      setInsight(data.insight||''); setAISrc(data.source||'');
    } catch { setInsight('Unavailable.'); }
    finally { setAILoad(false); }
  };

  return (
    <div style={{
      background:'var(--card)',
      border:`1px solid ${open?'var(--blue-glow)':'var(--border)'}`,
      borderRadius:'var(--radius-lg)', overflow:'hidden', transition:'border-color 0.15s',
    }}>
      <div onClick={toggleCard} style={{
        display:'flex', alignItems:'center', gap:8, padding:'11px 14px', cursor:'pointer',
      }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--card-hover)'}
      onMouseLeave={e=>e.currentTarget.style.background=''}
      >
        <Tag color="blue">Skill</Tag>
        <span style={{ fontSize:13, fontWeight:600, color:'var(--text)', flex:1 }}>{skill.skill_name}</span>
        <span style={{ fontSize:10, fontWeight:700, color: open?'var(--blue-light)':'var(--muted)', letterSpacing:'0.04em' }}>
          {open ? '▾ Hide' : '▸ Explore'}
        </span>
      </div>
      {open && (
        <div className="fade-in" style={{ borderTop:'1px solid var(--border)', padding:'14px 16px', background:'var(--bg2)' }}>
          {loading && <div style={{ display:'flex', gap:8, alignItems:'center', color:'var(--muted)', fontSize:13 }}><Spinner size={14}/>Loading…</div>}
          {!loading && card && (
            <>
              <div style={{ display:'flex', gap:10, marginBottom:12 }}>
                {[
                  [card.totalBUs,  'BUs',       'var(--blue-light)'],
                  [card.totalFns,  'Functions', 'var(--purple)'],
                  [card.leaders?.length||0,'Leaders','var(--green)'],
                ].map(([n,l,c])=>(
                  <div key={l} style={{
                    textAlign:'center', padding:'8px 12px', flex:1,
                    background:'var(--card)', borderRadius:'var(--radius)', border:'1px solid var(--border)',
                  }}>
                    <div style={{ fontSize:18, fontWeight:800, color:c }}>{n}</div>
                    <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:2 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
                {card.bus?.map(bu=>(
                  <span key={bu} style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:5,
                    background:'var(--blue-dim)', color:'var(--blue-light)', border:'1px solid var(--blue-glow)' }}>{bu}</span>
                ))}
              </div>
              {card.leaders?.length>0 && (
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'var(--muted)', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:5 }}>Leaders</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {card.leaders.map(l=>(
                      <span key={l} style={{ fontSize:11, padding:'2px 8px', borderRadius:4,
                        background:'var(--card)', color:'var(--text2)', border:'1px solid var(--border2)' }}>{l}</span>
                    ))}
                  </div>
                </div>
              )}
              {!insight && (
                <button onClick={fetchAI} disabled={aiLoad} style={{
                  display:'flex', alignItems:'center', gap:6, padding:'6px 14px',
                  borderRadius:'var(--radius)', background:'var(--blue-dim)',
                  border:'1px solid var(--blue-glow)', color:'var(--blue-light)',
                  fontSize:12, fontWeight:600, cursor:'pointer', marginBottom:8,
                }}>
                  {aiLoad ? <><Spinner size={12}/> Thinking…</> : <>✦ Get AI Insight</>}
                </button>
              )}
              {insight && (
                <div style={{ padding:'12px 14px', borderRadius:'var(--radius)', background:'var(--card)',
                  border:'1px solid var(--border)', borderLeft:'3px solid var(--blue)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                    <span style={{ fontSize:9, fontWeight:700, color:'var(--blue-light)', letterSpacing:'0.08em', textTransform:'uppercase' }}>✦ AI Insight</span>
                    {aiSrc && (
                      <span style={{ fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:3,
                        background: aiSrc==='claude'?'rgba(139,92,246,0.15)':'rgba(16,185,129,0.1)',
                        color: aiSrc==='claude'?'var(--purple)':'var(--green)',
                        border: `1px solid ${aiSrc==='claude'?'rgba(139,92,246,0.3)':'rgba(16,185,129,0.25)'}`,
                      }}>{aiSrc==='claude'?'⚡ Claude':'◈ KB'}</span>
                    )}
                  </div>
                  <p style={{ fontSize:12, color:'var(--text2)', lineHeight:1.7, margin:0 }}>{insight}</p>
                </div>
              )}
              <div style={{ marginTop:10, textAlign:'right' }}>
                <button onClick={()=>router.push(`/skill?q=${encodeURIComponent(skill.skill_name)}`)} style={{
                  background:'none', border:'none', color:'var(--blue-light)',
                  fontSize:12, fontWeight:600, cursor:'pointer', padding:0,
                }}>View full details →</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
