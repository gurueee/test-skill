import { useState, useEffect, useCallback } from 'react';
import Layout, { Spinner, Empty, Tag } from '../components/Layout';
import { supabase } from '../lib/supabase';

async function fetchDepts() {
  const { data } = await supabase
    .from('job_descriptions').select('department').order('department');
  return [...new Set((data||[]).map(r=>r.department).filter(Boolean))].sort();
}

async function fetchJDs({ dept='', title='', offset=0, limit=12 }) {
  let q = supabase
    .from('job_descriptions')
    .select('id,title,department,sub_dept,content', { count:'exact' })
    .order('title')
    .range(offset, offset+limit-1);
  if (dept && dept !== 'All') q = q.ilike('department', `%${dept}%`);
  if (title.trim()) q = q.ilike('title', `%${title.trim()}%`);
  const { data, count, error } = await q;
  if (error) throw error;
  return { data: data||[], count: count||0 };
}

// Parse JD content into structured sections
function parseContent(content='') {
  const lines = content.split('\n').map(l=>l.trim()).filter(Boolean);
  const sections = [];
  let current = { heading: null, bullets: [] };

  for (const line of lines) {
    const isHeading = (
      line.endsWith(':') ||
      (line === line.toUpperCase() && line.length > 3 && line.length < 80) ||
      /^(Role|Responsibilities|Requirements?|Qualifications?|Skills?|About|What|Why|How|Key|Primary|Scope|Overview)/i.test(line)
    );
    if (isHeading) {
      if (current.heading || current.bullets.length) sections.push({...current});
      current = { heading: line.replace(/:$/, ''), bullets: [] };
    } else {
      const clean = line.replace(/^[•\-–*]\s*/, '').trim();
      if (clean) current.bullets.push(clean);
    }
  }
  if (current.heading || current.bullets.length) sections.push(current);
  return sections;
}

export default function JDPage() {
  const [depts,    setDepts]    = useState([]);
  const [dept,     setDept]     = useState('All');
  const [title,    setTitle]    = useState('');
  const [jds,      setJDs]      = useState([]);
  const [total,    setTotal]    = useState(0);
  const [offset,   setOffset]   = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [loadMore, setLoadMore] = useState(false);
  const [selected, setSelected] = useState(null); // JD shown in detail panel
  const LIMIT = 12;

  useEffect(() => { fetchDepts().then(setDepts); }, []);

  const load = useCallback(async (d=dept, t=title, o=0) => {
    if (o===0) { setLoading(true); setSelected(null); } else setLoadMore(true);
    try {
      const { data, count } = await fetchJDs({ dept:d==='All'?'':d, title:t, offset:o, limit:LIMIT });
      setJDs(prev => o===0 ? data : [...prev, ...data]);
      setTotal(count); setOffset(o);
      if (o===0 && data.length>0) setSelected(data[0]);
    } catch(e) { console.error(e); }
    finally { setLoading(false); setLoadMore(false); }
  }, []);

  useEffect(() => { load('All','',0); }, []);

  const onDept = (d) => { setDept(d); setTitle(''); load(d,'',0); };
  const onSearch = (e) => { e.preventDefault(); load(dept, title, 0); };

  return (
    <Layout active="/jd">
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'32px 24px 60px' }}>

        {/* Header */}
        <div style={{ marginBottom:20 }}>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text)', letterSpacing:'-0.02em', marginBottom:4 }}>
            JD Repository
          </h1>
          <p style={{ color:'var(--muted)', fontSize:13 }}>
            {total > 0 ? `${total} job descriptions` : ''}
            {dept !== 'All' ? ` · ${dept}` : ''}
          </p>
        </div>

        {/* Dept pill tabs */}
        <div style={{
          display:'flex', gap:6, flexWrap:'wrap', marginBottom:16,
          paddingBottom:14, borderBottom:'1px solid var(--border)',
        }}>
          {['All', ...depts].map(d => {
            const active = dept === d;
            return (
              <button key={d} onClick={()=>onDept(d)} style={{
                padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:600,
                background: active ? 'var(--blue)' : 'var(--card)',
                color: active ? '#fff' : 'var(--muted)',
                border: active ? '1px solid var(--blue)' : '1px solid var(--border2)',
                whiteSpace:'nowrap',
              }}>{d}</button>
            );
          })}
        </div>

        {/* Search */}
        <form onSubmit={onSearch} style={{ display:'flex', gap:8, marginBottom:20, maxWidth:460 }}>
          <div style={{ flex:1, position:'relative', display:'flex', alignItems:'center' }}>
            <svg style={{ position:'absolute',left:12,opacity:0.35,pointerEvents:'none' }}
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input value={title} onChange={e=>setTitle(e.target.value)}
              placeholder="Search by title…"
              style={{ width:'100%', padding:'9px 34px', fontSize:13 }}
            />
            {title && (
              <button type="button" onClick={()=>{setTitle('');load(dept,'',0);}} style={{
                position:'absolute',right:10,background:'none',
                color:'var(--subtle)',fontSize:14,padding:'2px 4px',border:'none',
              }}>✕</button>
            )}
          </div>
          <button type="submit" style={{
            padding:'9px 18px',background:'var(--blue)',color:'#fff',
            border:'none',borderRadius:'var(--radius)',fontSize:13,fontWeight:600,
          }}>Search</button>
        </form>

        {loading && <div style={{ textAlign:'center', padding:'60px 0' }}><Spinner size={28}/></div>}
        {!loading && jds.length===0 && <Empty text="No JDs found." icon="◉"/>}

        {/* Two-panel layout */}
        {!loading && jds.length>0 && (
          <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:16, alignItems:'start' }}>

            {/* LEFT: scrollable list */}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {jds.map(jd => (
                <JDListItem key={jd.id} jd={jd}
                  active={selected?.id === jd.id}
                  onClick={()=>setSelected(jd)}
                />
              ))}

              {jds.length < total && (
                <button onClick={()=>load(dept,title,offset+LIMIT)} disabled={loadMore} style={{
                  padding:'10px', background:'var(--card)',
                  border:'1px solid var(--border2)', color:'var(--muted)',
                  borderRadius:'var(--radius)', fontSize:12, fontWeight:500,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                }}>
                  {loadMore ? <><Spinner size={12}/> Loading…</> : `+ ${total-jds.length} more`}
                </button>
              )}
            </div>

            {/* RIGHT: detail panel */}
            {selected && <JDDetail jd={selected} />}
          </div>
        )}
      </div>
    </Layout>
  );
}

function JDListItem({ jd, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      padding:'12px 14px', borderRadius:'var(--radius)',
      background: active ? 'var(--blue-dim)' : 'var(--card)',
      border: active ? '1px solid var(--blue-glow)' : '1px solid var(--border)',
      cursor:'pointer', transition:'all 0.15s',
    }}
    onMouseEnter={e=>{ if(!active){ e.currentTarget.style.borderColor='var(--border2)'; e.currentTarget.style.background='var(--card-hover)'; }}}
    onMouseLeave={e=>{ if(!active){ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--card)'; }}}
    >
      <div style={{ fontSize:13, fontWeight:600,
        color: active ? 'var(--blue-light)' : 'var(--text)',
        marginBottom:5, lineHeight:1.3 }}>
        {jd.title}
      </div>
      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
        {jd.department && (
          <span style={{
            fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:4,
            background: active ? 'rgba(59,130,246,0.2)' : 'var(--bg2)',
            color: active ? 'var(--blue-light)' : 'var(--muted)',
            border:`1px solid ${active ? 'var(--blue-glow)' : 'var(--border)'}`,
            letterSpacing:'0.04em',
          }}>{jd.department}</span>
        )}
        {jd.sub_dept && jd.sub_dept !== jd.department && (
          <span style={{
            fontSize:10, padding:'2px 7px', borderRadius:4,
            background:'var(--bg2)', color:'var(--subtle)',
            border:'1px solid var(--border)',
          }}>{jd.sub_dept}</span>
        )}
      </div>
    </div>
  );
}

function JDDetail({ jd }) {
  const sections = parseContent(jd.content);

  return (
    <div className="fade-in" style={{
      background:'var(--card)', border:'1px solid var(--border)',
      borderRadius:'var(--radius-lg)', overflow:'hidden',
      position:'sticky', top:80,
    }}>
      {/* Detail header */}
      <div style={{
        padding:'24px 28px 20px',
        background:'linear-gradient(135deg, var(--bg2) 0%, var(--card) 100%)',
        borderBottom:'1px solid var(--border)',
      }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)',
          letterSpacing:'-0.02em', marginBottom:10, lineHeight:1.3 }}>
          {jd.title}
        </h2>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {jd.department && <Tag color="blue">{jd.department}</Tag>}
          {jd.sub_dept && jd.sub_dept !== jd.department && <Tag color="gray">{jd.sub_dept}</Tag>}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ padding:'24px 28px', maxHeight:'68vh', overflowY:'auto' }}>
        {sections.length === 0 ? (
          <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.7 }}>{jd.content}</p>
        ) : (
          sections.map((sec, i) => (
            <div key={i} style={{ marginBottom:22 }}>
              {sec.heading && (
                <div style={{
                  fontSize:11, fontWeight:700, color:'var(--blue-light)',
                  letterSpacing:'0.08em', textTransform:'uppercase',
                  marginBottom:10, display:'flex', alignItems:'center', gap:8,
                }}>
                  <div style={{ width:16, height:2, background:'var(--blue)', borderRadius:1, flexShrink:0 }}/>
                  {sec.heading}
                </div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {sec.bullets.map((b,j) => (
                  <div key={j} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    <div style={{
                      width:5, height:5, borderRadius:'50%',
                      background:'var(--blue)', marginTop:6, flexShrink:0, opacity:0.6,
                    }}/>
                    <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.7, margin:0 }}>{b}</p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
