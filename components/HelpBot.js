import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';

const SOURCE_LABELS = {
  db:     { icon:'◈', label:'Internal DB',  color:'#10b981', bg:'rgba(16,185,129,0.12)', border:'rgba(16,185,129,0.3)' },
  claude: { icon:'⚡', label:'Claude AI',   color:'#a78bfa', bg:'rgba(139,92,246,0.12)', border:'rgba(139,92,246,0.3)' },
  none:   { icon:'◎', label:'No results',  color:'#6b7e99', bg:'rgba(107,126,153,0.1)',  border:'rgba(107,126,153,0.2)'},
};

const SUGGESTIONS = ['What is OCS?','Show Kafka skills','Billing Analyst JDs','What is mediation?'];

export default function HelpBot() {
  const router = useRouter();
  const [open,     setOpen]     = useState(false);
  const [q,        setQ]        = useState('');
  const [messages, setMessages] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [hasNew,   setHasNew]   = useState(false);
  const inputRef = useRef(null);
  const chatRef  = useRef(null);

  // Don't show on homepage (it has its own bot)
  if (router.pathname === '/') return null;

  useEffect(() => {
    if (open) {
      setTimeout(()=>inputRef.current?.focus(), 100);
      setHasNew(false);
    }
  }, [open]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const send = async (query) => {
    const text = (query || q).trim();
    if (!text || loading) return;
    setQ('');
    setMessages(prev => [...prev, { role:'user', text }]);
    setLoading(true);
    try {
      const res  = await fetch('/api/bot-search', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ query: text }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role:'bot', text:data.answer, source:data.source,
        skills:data.skills||[], glossary:data.glossary||[], jds:data.jds||[],
      }]);
      if (!open) setHasNew(true);
    } catch {
      setMessages(prev => [...prev, {
        role:'bot', source:'none',
        text:'Something went wrong. Please try again.',
        skills:[], glossary:[], jds:[],
      }]);
    } finally { setLoading(false); }
  };

  const onKey = (e) => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={()=>setOpen(v=>!v)}
        aria-label="Open help bot"
        style={{
          position:'fixed', bottom:28, right:28, zIndex:999,
          width:52, height:52, borderRadius:'50%',
          background: open ? 'var(--card)' : 'var(--blue)',
          border:`2px solid ${open ? 'var(--border2)' : 'var(--blue)'}`,
          boxShadow: open ? 'var(--shadow)' : '0 4px 20px var(--blue-glow)',
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', transition:'all 0.2s',
          fontSize:22,
        }}
        onMouseEnter={e=>{ if(!open) e.currentTarget.style.transform='scale(1.1)'; }}
        onMouseLeave={e=>{ e.currentTarget.style.transform='none'; }}
      >
        {open ? '✕' : '✦'}
        {/* Notification dot */}
        {hasNew && !open && (
          <div style={{
            position:'absolute', top:2, right:2,
            width:12, height:12, borderRadius:'50%',
            background:'#ef4444', border:'2px solid var(--bg)',
          }}/>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position:'fixed', bottom:92, right:28, zIndex:998,
          width:360, maxHeight:520,
          background:'var(--card)', border:'1px solid var(--border2)',
          borderRadius:16, boxShadow:'var(--shadow)',
          display:'flex', flexDirection:'column',
          overflow:'hidden',
          animation:'fade-up 0.2s ease both',
        }}>
          {/* Header */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'14px 16px',
            background:'linear-gradient(135deg, var(--blue) 0%, #6d28d9 100%)',
            flexShrink:0,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{
                width:28, height:28, borderRadius:'50%',
                background:'rgba(255,255,255,0.2)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:14,
              }}>✦</div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>Skill Visibility Bot</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.7)' }}>Ask about skills, roles, or BSS/OSS terms</div>
              </div>
            </div>
            {messages.length > 0 && (
              <button onClick={()=>setMessages([])} style={{
                background:'rgba(255,255,255,0.15)', border:'none',
                color:'#fff', padding:'3px 9px', borderRadius:5,
                fontSize:10, cursor:'pointer', fontWeight:600,
              }}>Clear</button>
            )}
          </div>

          {/* Messages */}
          <div ref={chatRef} style={{
            flex:1, overflowY:'auto', padding:'12px',
            display:'flex', flexDirection:'column', gap:10,
            minHeight:180, maxHeight:340,
          }}>
            {/* Empty state — suggestions */}
            {messages.length === 0 && (
              <div style={{ padding:'8px 0' }}>
                <p style={{ fontSize:12, color:'var(--muted)', marginBottom:10, textAlign:'center' }}>
                  Try asking…
                </p>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {SUGGESTIONS.map(s=>(
                    <button key={s} onClick={()=>send(s)} style={{
                      background:'var(--bg2)', border:'1px solid var(--border)',
                      borderRadius:8, padding:'8px 12px', textAlign:'left',
                      fontSize:12, color:'var(--text2)', cursor:'pointer',
                      transition:'all 0.15s',
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--blue-glow)';e.currentTarget.style.background='var(--blue-dim)';e.currentTarget.style.color='var(--blue-light)';}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg2)';e.currentTarget.style.color='var(--text2)';}}
                    >→ {s}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat messages */}
            {messages.map((msg, i) => (
              <BotMessage key={i} msg={msg} router={router} />
            ))}

            {/* Loading */}
            {loading && (
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <div style={{
                  width:24, height:24, borderRadius:'50%', flexShrink:0,
                  background:'var(--blue-dim)', border:'1px solid var(--blue-glow)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:10,
                }}>✦</div>
                <div style={{
                  background:'var(--bg2)', border:'1px solid var(--border)',
                  borderRadius:'4px 10px 10px 10px', padding:'8px 12px',
                  display:'flex', alignItems:'center', gap:6,
                }}>
                  <span className="spinner" style={{width:12,height:12}}/>
                  <span style={{ fontSize:12, color:'var(--muted)' }}>Searching…</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{
            padding:'10px 12px', borderTop:'1px solid var(--border)',
            background:'var(--bg2)', flexShrink:0,
          }}>
            <div style={{
              display:'flex', gap:6, alignItems:'center',
              background:'var(--card)', border:'1px solid var(--border2)',
              borderRadius:10, padding:'6px 6px 6px 12px',
            }}>
              <input
                ref={inputRef} value={q}
                onChange={e=>setQ(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ask anything…"
                aria-label="Ask the skill bot a question"
                style={{
                  flex:1, background:'none', border:'none',
                  color:'var(--text)', fontSize:13, outline:'none',
                }}
              />
              <button onClick={()=>send()} disabled={loading||!q.trim()}
                aria-label="Send message"
                style={{
                  width:30, height:30, borderRadius:8, flexShrink:0,
                  background: (!q.trim()||loading) ? 'var(--border)' : 'var(--blue)',
                  border:'none', color:'#fff', fontSize:14, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'all 0.15s',
                }}>↑</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BotMessage({ msg, router }) {
  const isUser = msg.role === 'user';
  const src    = SOURCE_LABELS[msg.source] || SOURCE_LABELS.none;

  if (isUser) return (
    <div style={{ display:'flex', justifyContent:'flex-end' }}>
      <div style={{
        background:'var(--blue)', color:'#fff', maxWidth:'80%',
        padding:'8px 12px', borderRadius:'10px 10px 3px 10px',
        fontSize:13, lineHeight:1.4,
      }}>{msg.text}</div>
    </div>
  );

  return (
    <div style={{ display:'flex', gap:7, alignItems:'flex-start' }}>
      <div style={{
        width:24, height:24, borderRadius:'50%', flexShrink:0, marginTop:2,
        background:'var(--blue-dim)', border:'1px solid var(--blue-glow)',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'var(--blue-light)',
      }}>✦</div>
      <div style={{ flex:1, minWidth:0 }}>
        {/* Source badge */}
        <div style={{ marginBottom:5 }}>
          <span style={{
            fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:4,
            background:src.bg, color:src.color, border:`1px solid ${src.border}`,
            letterSpacing:'0.06em', textTransform:'uppercase',
          }}>{src.icon} {src.label}</span>
        </div>

        {/* Answer */}
        <div style={{
          background:'var(--bg2)', border:'1px solid var(--border)',
          borderRadius:'3px 10px 10px 10px', padding:'10px 12px',
          marginBottom: (msg.skills?.length||msg.glossary?.length||msg.jds?.length) ? 6 : 0,
        }}>
          {msg.text.split('\n').filter(Boolean).map((line,i)=>{
            const parts = line.split(/\*\*(.*?)\*\*/g);
            return (
              <p key={i} style={{ fontSize:12, color:'var(--text2)', lineHeight:1.65,
                margin: i < msg.text.split('\n').filter(Boolean).length-1 ? '0 0 5px' : 0 }}>
                {parts.map((p,j)=>j%2===1
                  ? <strong key={j} style={{ color:'var(--text)', fontWeight:600 }}>{p}</strong>
                  : p
                )}
              </p>
            );
          })}
        </div>

        {/* Result pills */}
        {msg.skills?.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:4 }}>
            {msg.skills.map(s=>(
              <button key={s.id} onClick={()=>router.push(`/skill?q=${encodeURIComponent(s.skill_name)}`)} style={{
                fontSize:11, padding:'3px 9px', borderRadius:12,
                background:'var(--blue-dim)', color:'var(--blue-light)',
                border:'1px solid var(--blue-glow)', cursor:'pointer',
                fontWeight:600,
              }}>{s.skill_name} →</button>
            ))}
          </div>
        )}
        {msg.glossary?.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:4 }}>
            {msg.glossary.map(g=>(
              <div key={g.id} style={{
                padding:'6px 10px', background:'var(--card)',
                border:'1px solid var(--border)', borderRadius:8,
              }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text)', marginBottom:2 }}>{g.term}</div>
                {g.full_form && <div style={{ fontSize:10, color:'var(--blue-light)', marginBottom:2 }}>{g.full_form}</div>}
                {g.definition && <div style={{ fontSize:10, color:'var(--muted)', lineHeight:1.5 }}>{g.definition.slice(0,80)}…</div>}
              </div>
            ))}
          </div>
        )}
        {msg.jds?.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {msg.jds.map(j=>(
              <button key={j.id} onClick={()=>router.push('/jd')} style={{
                fontSize:11, padding:'3px 9px', borderRadius:12,
                background:'var(--purple-dim)', color:'var(--purple)',
                border:'1px solid rgba(139,92,246,0.3)', cursor:'pointer',
                fontWeight:600,
              }}>{j.title.slice(0,30)}{j.title.length>30?'…':''} →</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
