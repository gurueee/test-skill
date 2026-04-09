import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout, { Spinner, Tag } from '../components/Layout';

const CHIPS = ['Java','Kafka','OCS','CRM','Kubernetes','Python','Docker','Billing','AWS','Migration'];
const TILES = [
  { icon:'⬡', label:'Skill Matrix',  sub:'57 functions · 7 BUs',  href:'/matrix',  color:'blue'   },
  { icon:'◉', label:'JD Repository', sub:'480 job descriptions',   href:'/jd',      color:'purple' },
  { icon:'◈', label:'Glossary',      sub:'97 BSS/OSS terms',       href:'/glossary',color:'green'  },
  { icon:'◑', label:'Leaders',       sub:'Team skill mapping',     href:'/leaders', color:'amber'  },
];

const SOURCE_LABELS = {
  db:     { icon:'◈', label:'From our database', color:'var(--green)',    bg:'var(--green-dim)',  border:'rgba(16,185,129,0.3)' },
  claude: { icon:'✦', label:'From Claude AI',    color:'var(--blue-light)',bg:'var(--blue-dim)',  border:'var(--blue-glow)' },
  none:   { icon:'◎', label:'No results',        color:'var(--muted)',    bg:'var(--card)',       border:'var(--border)' },
};

export default function Home() {
  const router   = useRouter();
  const inputRef = useRef(null);
  const chatRef  = useRef(null);

  const [q,        setQ]        = useState('');
  const [messages, setMessages] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [focused,  setFocused]  = useState(false);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const send = async (query) => {
    const text = query.trim();
    if (!text || loading) return;
    setQ('');
    setMessages(prev => [...prev, { role:'user', text }]);
    setLoading(true);

    try {
      const res  = await fetch('/api/bot-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'bot',
        text: data.answer,
        source: data.source,
        skills: data.skills||[],
        glossary: data.glossary||[],
        jds: data.jds||[],
      }]);
    } catch(e) {
      setMessages(prev => [...prev, {
        role:'bot', source:'none',
        text: 'Something went wrong. Please try again.',
        skills:[], glossary:[], jds:[],
      }]);
    } finally { setLoading(false); }
  };

  const onSubmit = (e) => { e.preventDefault(); send(q); };
  const onChip   = (c) => { send(c); };
  const onClear  = () => { setMessages([]); setQ(''); };

  const hasChat = messages.length > 0;

  return (
    <Layout active="/">
      <div style={{ maxWidth:720, margin:'0 auto', padding:'48px 24px 32px', display:'flex', flexDirection:'column', minHeight:'calc(100vh - 118px)' }}>

        {/* Hero — shrinks when chat starts */}
        <div style={{
          textAlign:'center',
          marginBottom: hasChat ? 16 : 36,
          transition:'all 0.3s ease',
        }}>
          {!hasChat && (
            <>
              <div style={{
                display:'inline-flex', alignItems:'center', gap:6,
                fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase',
                color:'var(--blue-light)', background:'var(--blue-dim)',
                padding:'5px 14px', borderRadius:20, marginBottom:20,
                border:'1px solid var(--blue-glow)',
              }}>
                <span>◎</span> Netcracker Internal
              </div>
              <h1 style={{
                fontSize:'clamp(24px,5vw,40px)', fontWeight:800,
                letterSpacing:'-0.03em', lineHeight:1.1,
                color:'var(--text)', marginBottom:10,
              }}>
                Skill Visibility Engine
              </h1>
              <p style={{ color:'var(--muted)', fontSize:14, marginBottom:0, lineHeight:1.6 }}>
                Ask anything — skills, glossary terms, job roles, or telecom concepts
              </p>
            </>
          )}
          {hasChat && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>Skill Visibility Bot</span>
              <button onClick={onClear} style={{
                background:'none', border:'1px solid var(--border)',
                color:'var(--muted)', padding:'4px 12px', borderRadius:6,
                fontSize:12, cursor:'pointer',
              }}>Clear chat</button>
            </div>
          )}
        </div>

        {/* Chat messages */}
        {hasChat && (
          <div ref={chatRef} style={{
            flex:1, overflowY:'auto', display:'flex', flexDirection:'column',
            gap:16, marginBottom:16, paddingRight:4,
            maxHeight:'55vh',
          }}>
            {messages.map((msg, i) => (
              <ChatMessage key={i} msg={msg} router={router} />
            ))}
            {loading && (
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <div style={{
                  width:28, height:28, borderRadius:'50%',
                  background:'var(--blue-dim)', border:'1px solid var(--blue-glow)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:12, flexShrink:0,
                }}>✦</div>
                <div style={{
                  background:'var(--card)', border:'1px solid var(--border)',
                  borderRadius:'var(--radius-lg)', padding:'12px 16px',
                  display:'flex', alignItems:'center', gap:8,
                }}>
                  <Spinner size={14}/>
                  <span style={{ fontSize:13, color:'var(--muted)' }}>Searching database…</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input area */}
        <div>
          <form onSubmit={onSubmit} style={{ position:'relative' }}>
            <div style={{
              display:'flex', gap:0,
              background:'var(--card)',
              border:`1px solid ${focused ? 'var(--blue)' : 'var(--border2)'}`,
              borderRadius:'var(--radius-xl)',
              boxShadow: focused ? '0 0 0 3px var(--blue-dim)' : 'var(--shadow-sm)',
              overflow:'hidden', transition:'all 0.18s',
            }}>
              <svg style={{ marginLeft:18, flexShrink:0, alignSelf:'center', opacity:0.35 }}
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
                placeholder={hasChat ? 'Ask a follow-up…' : 'Ask about a skill, term, or role…'}
                style={{
                  flex:1, padding:'14px 16px', background:'none',
                  border:'none', color:'var(--text)', fontSize:14, outline:'none',
                }}
              />
              {q && (
                <button type="button" onClick={()=>setQ('')} style={{
                  background:'none', color:'var(--subtle)', padding:'0 10px',
                  fontSize:15, flexShrink:0, border:'none',
                }}>✕</button>
              )}
              <button type="submit" disabled={loading||!q.trim()} style={{
                padding:'14px 22px', background:'var(--blue)', color:'#fff',
                fontSize:13, fontWeight:700, flexShrink:0, border:'none',
                opacity:(!q.trim()||loading)?0.5:1,
                letterSpacing:'0.02em',
              }}>Ask</button>
            </div>
          </form>

          {/* Chips */}
          {!hasChat && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center', marginTop:14 }}>
              {CHIPS.map(c=>(
                <button key={c} onClick={()=>onChip(c)} style={{
                  background:'var(--card)', border:'1px solid var(--border)',
                  color:'var(--muted)', padding:'5px 13px', borderRadius:20,
                  fontSize:12, fontWeight:500,
                }}
                onMouseEnter={e=>{e.target.style.borderColor='var(--border2)';e.target.style.color='var(--text)';}}
                onMouseLeave={e=>{e.target.style.borderColor='var(--border)';e.target.style.color='var(--muted)';}}
                >{c}</button>
              ))}
            </div>
          )}
        </div>

        {/* Landing tiles — only when no chat */}
        {!hasChat && (
          <div style={{
            display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))',
            gap:10, marginTop:28,
          }}>
            {TILES.map(x=>{
              const colorMap = {
                blue:  ['var(--blue-dim)',  'var(--blue-light)',  'var(--blue-glow)'],
                purple:['var(--purple-dim)','var(--purple)',      'rgba(139,92,246,0.3)'],
                green: ['var(--green-dim)', 'var(--green)',       'rgba(16,185,129,0.3)'],
                amber: ['var(--amber-dim)', 'var(--amber)',       'rgba(245,158,11,0.3)'],
              };
              const [bg,text,border] = colorMap[x.color]||colorMap.blue;
              return (
                <div key={x.label} onClick={()=>router.push(x.href)} style={{
                  background:'var(--card)', border:'1px solid var(--border)',
                  borderRadius:'var(--radius-lg)', padding:'18px 16px',
                  cursor:'pointer', transition:'all 0.18s',
                }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=border;e.currentTarget.style.background=bg;e.currentTarget.style.transform='translateY(-2px)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--card)';e.currentTarget.style.transform='none';}}
                >
                  <div style={{ fontSize:22, marginBottom:10, color:text }}>{x.icon}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:3 }}>{x.label}</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{x.sub}</div>
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
      {/* Bot avatar */}
      <div style={{
        width:28, height:28, borderRadius:'50%', flexShrink:0,
        background:'var(--blue-dim)', border:'1px solid var(--blue-glow)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:12, color:'var(--blue-light)', marginTop:2,
      }}>✦</div>

      <div style={{ flex:1, minWidth:0 }}>
        {/* Source badge */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
          <span style={{
            fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4,
            background: src.bg, color: src.color, border:`1px solid ${src.border}`,
            letterSpacing:'0.06em', textTransform:'uppercase',
          }}>{src.icon} {src.label}</span>
          {msg.source === 'claude' && (
            <span style={{ fontSize:10, color:'var(--subtle)' }}>Not in our DB</span>
          )}
        </div>

        {/* Answer text */}
        <div style={{
          background:'var(--card)', border:'1px solid var(--border)',
          borderRadius:'4px 14px 14px 14px', padding:'14px 18px',
        }}>
          {msg.text.split('\n').map((line, i) => {
            // Bold **text**
            const parts = line.split(/\*\*(.*?)\*\*/g);
            return (
              <p key={i} style={{ fontSize:13, color:'var(--text2)', lineHeight:1.75,
                margin: i < msg.text.split('\n').length-1 ? '0 0 8px' : 0 }}>
                {parts.map((p,j) => j%2===1
                  ? <strong key={j} style={{ color:'var(--text)', fontWeight:600 }}>{p}</strong>
                  : p
                )}
              </p>
            );
          })}
        </div>

        {/* Quick result cards */}
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
                  border:'1px solid var(--border)', borderRadius:'var(--radius)',
                  cursor:'pointer',
                }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--purple)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';}}
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
  const [card,    setCard]    = useState(null);  // { bus, totalFns, leaders }
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState('');
  const [aiLoad,  setAILoad]  = useState(false);
  const [aiSrc,   setAISrc]   = useState('');

  const toggleCard = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (card) return; // already loaded
    setLoading(true);
    try {
      // Fetch skill detail from our API
      const res = await fetch('/api/skill-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch('/api/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill: skill.skill_name, context: ctx }),
      });
      const data = await res.json();
      setInsight(data.insight || '');
      setAISrc(data.source || '');
    } catch(e) { setInsight('Unavailable.'); }
    finally { setAILoad(false); }
  };

  return (
    <div style={{
      background:'var(--card)', border:`1px solid ${open ? 'var(--blue-glow)' : 'var(--border)'}`,
      borderRadius:'var(--radius-lg)', overflow:'hidden', transition:'border-color 0.15s',
    }}>
      {/* Header row */}
      <div onClick={toggleCard} style={{
        display:'flex', alignItems:'center', gap:8, padding:'11px 14px', cursor:'pointer',
      }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--card-hover)'}
      onMouseLeave={e=>e.currentTarget.style.background=''}
      >
        <Tag color="blue">Skill</Tag>
        <span style={{ fontSize:13, fontWeight:600, color:'var(--text)', flex:1 }}>{skill.skill_name}</span>
        <span style={{
          fontSize:10, fontWeight:700, color: open ? 'var(--blue-light)' : 'var(--muted)',
          letterSpacing:'0.04em',
        }}>{open ? '▾ Hide' : '▸ Explore'}</span>
      </div>

      {/* Expanded scorecard */}
      {open && (
        <div className="fade-in" style={{
          borderTop:'1px solid var(--border)',
          padding:'14px 16px', background:'var(--bg2)',
        }}>
          {loading && (
            <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--muted)', fontSize:13 }}>
              <span className="spinner" style={{ width:14, height:14 }}/> Loading…
            </div>
          )}

          {!loading && card && (
            <>
              {/* Mini stats */}
              <div style={{ display:'flex', gap:12, marginBottom:12 }}>
                {[
                  [card.totalBUs,  'BUs',       'var(--blue-light)'],
                  [card.totalFns,  'Functions', 'var(--purple)'],
                  [card.leaders?.length || 0, 'Leaders', 'var(--green)'],
                ].map(([n,l,c])=>(
                  <div key={l} style={{
                    textAlign:'center', padding:'8px 14px',
                    background:'var(--card)', borderRadius:'var(--radius)',
                    border:'1px solid var(--border)', flex:1,
                  }}>
                    <div style={{ fontSize:20, fontWeight:800, color:c }}>{n}</div>
                    <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginTop:2 }}>{l}</div>
                  </div>
                ))}
              </div>

              {/* BUs + leaders */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>
                {card.bus?.map(bu=>(
                  <span key={bu} style={{
                    fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:5,
                    background:'var(--blue-dim)', color:'var(--blue-light)',
                    border:'1px solid var(--blue-glow)',
                  }}>{bu}</span>
                ))}
              </div>

              {card.leaders?.length > 0 && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)',
                    letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:5 }}>Leaders</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {card.leaders.map(l=>(
                      <span key={l} style={{
                        fontSize:11, padding:'3px 9px', borderRadius:5,
                        background:'var(--card)', color:'var(--text2)',
                        border:'1px solid var(--border2)',
                      }}>{l}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Insight inline */}
              {!insight && (
                <button onClick={fetchAI} disabled={aiLoad} style={{
                  display:'flex', alignItems:'center', gap:6,
                  padding:'7px 14px', borderRadius:'var(--radius)',
                  background:'var(--blue-dim)', border:'1px solid var(--blue-glow)',
                  color:'var(--blue-light)', fontSize:12, fontWeight:600, cursor:'pointer',
                  marginBottom:8,
                }}>
                  {aiLoad
                    ? <><span className="spinner" style={{width:12,height:12}}/> Thinking…</>
                    : <>✦ Get AI Insight</>
                  }
                </button>
              )}

              {insight && (
                <div style={{
                  padding:'12px 14px', borderRadius:'var(--radius)',
                  background:'var(--card)', border:'1px solid var(--border)',
                  borderLeft:'3px solid var(--blue)',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                    <span style={{ fontSize:9, fontWeight:700, color:'var(--blue-light)',
                      letterSpacing:'0.08em', textTransform:'uppercase' }}>✦ AI Insight</span>
                    {aiSrc && (
                      <span style={{
                        fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:3,
                        background: aiSrc==='claude' ? 'rgba(139,92,246,0.15)' : 'rgba(16,185,129,0.1)',
                        color: aiSrc==='claude' ? 'var(--purple)' : 'var(--green)',
                        border: `1px solid ${aiSrc==='claude' ? 'rgba(139,92,246,0.3)' : 'rgba(16,185,129,0.25)'}`,
                      }}>{aiSrc==='claude' ? '⚡ Claude' : '◈ KB'}</span>
                    )}
                  </div>
                  <p style={{ fontSize:12, color:'var(--text2)', lineHeight:1.7, margin:0 }}>{insight}</p>
                </div>
              )}

              {/* Full page link */}
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

