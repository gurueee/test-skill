import { useState, useRef } from 'react';
import Layout, { Spinner, Btn } from '../components/Layout';
import { supabase } from '../lib/supabase';

const SHEET_INFO = [
  { name:'Skill Mapping', desc:'BU → Function → Leader → Skills', table:'employees + skills' },
  { name:'BP-Glossary',   desc:'Term → Definition → Domain',      table:'glossary'           },
];

export default function Upload() {
  const [file,     setFile]     = useState(null);
  const [status,   setStatus]   = useState(null);
  const [message,  setMessage]  = useState('');
  const [counts,   setCounts]   = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const pickFile = (f) => {
    if (!f) return;
    if (!f.name.match(/\.xlsx?$/i)) {
      setStatus('error'); setMessage('Please upload an .xlsx file'); return;
    }
    setFile(f); setStatus(null); setMessage(''); setCounts(null);
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    pickFile(e.dataTransfer?.files?.[0]);
  };

  const loadXLSX = () => new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload  = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('Failed to load Excel parser'));
    document.head.appendChild(s);
  });

  const onProcess = async () => {
    if (!file) return;
    setStatus('loading'); setMessage('Loading Excel parser…'); setCounts(null);
    try {
      const XLSX = await loadXLSX();
      setMessage('Reading file…');
      const buffer = await file.arrayBuffer();
      const wb     = XLSX.read(buffer, { type:'array' });
      let totalSkills=0, totalEmployees=0, totalGlossary=0;

      // Skill Mapping
      if (wb.SheetNames.includes('Skill Mapping')) {
        setMessage('Processing Skill Mapping…');
        const raw = XLSX.utils.sheet_to_json(wb.Sheets['Skill Mapping'], { defval:'' });
        let lastBU = '';
        const empRows = [];
        for (const row of raw) {
          const bu = (row['BU']||'').toString().trim() || lastBU;
          const fn = (row['Function']||'').toString().trim();
          if (!fn) continue;
          lastBU = bu;
          const skills = [];
          for (const col of ['Languages/Core skills','Databases','Cloud','Other Skills']) {
            (row[col]||'').toString().split(/[,;\n\[\]\(\)]+/).forEach(p => {
              p = p.replace(/\s+/g,' ').trim().replace(/^[.\-/]+|[.\-/]+$/g,'');
              if (p.length >= 2 && p.length <= 60) skills.push(p);
            });
          }
          empRows.push({ bu, fn, leader:(row['Leaders']||'').toString().trim(), skills });
        }
        const allSkills = [...new Set(empRows.flatMap(r => r.skills))];
        if (allSkills.length)
          await supabase.from('skills').upsert(allSkills.map(s=>({skill_name:s})), {onConflict:'skill_name'});
        const { data: sr } = await supabase.from('skills').select('id,skill_name');
        const sm = Object.fromEntries((sr||[]).map(s=>[s.skill_name,s.id]));
        for (const emp of empRows) {
          const { data: ne } = await supabase.from('employees')
            .insert({name:emp.fn,bu:emp.bu,domain:emp.bu,function_name:emp.fn,leader:emp.leader})
            .select('id').single();
          if (!ne) continue;
          const links = emp.skills.map(s=>sm[s]).filter(Boolean).map(sid=>({emp_id:ne.id,skill_id:sid}));
          if (links.length) await supabase.from('employee_skills').upsert(links,{onConflict:'emp_id,skill_id'});
        }
        totalEmployees = empRows.length; totalSkills = allSkills.length;
      }

      // Glossary
      const gs = wb.SheetNames.find(s => s.toLowerCase().includes('glossary'));
      if (gs) {
        setMessage('Processing Glossary…');
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[gs], { defval:'', range:2 });
        const glossRows = raw.map(row => {
          const v = Object.values(row).map(x=>x.toString().trim());
          return { term:v[4]||'', definition:v[6]||'', domain:v[2]||'', related_skills:v[1]||'' };
        }).filter(r => r.term);
        if (glossRows.length) {
          await supabase.from('glossary').upsert(glossRows, {onConflict:'term'});
          totalGlossary = glossRows.length;
        }
      }

      setCounts({skills:totalSkills, employees:totalEmployees, glossary:totalGlossary});
      setStatus('success'); setMessage('Upload complete!');
    } catch(err) {
      console.error(err); setStatus('error'); setMessage(err.message||'Something went wrong.');
    }
  };

  return (
    <Layout active="/upload">
      <div style={{maxWidth:680,margin:'0 auto',padding:'40px 24px 80px'}}>
        <div style={{marginBottom:28}}>
          <h1 style={{fontSize:22,fontWeight:700,color:'var(--text)',letterSpacing:'-0.02em',marginBottom:4}}>
            Data Upload
          </h1>
          <p style={{color:'var(--muted)',fontSize:13}}>
            Upload an Excel file to update skills, employees, or glossary in the database
          </p>
        </div>

        <div style={{
          background:'var(--blue-dim)',border:'1px solid var(--blue-glow)',
          borderRadius:'var(--radius-lg)',padding:'16px 20px',marginBottom:24,
        }}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--blue-light)',
            letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:10}}>
            Expected sheets
          </div>
          {SHEET_INFO.map(s=>(
            <div key={s.name} style={{display:'flex',gap:8,alignItems:'baseline',marginBottom:6,flexWrap:'wrap'}}>
              <span style={{fontSize:13,fontWeight:600,color:'var(--text)',minWidth:160}}>{s.name}</span>
              <span style={{fontSize:12,color:'var(--muted)',flex:1}}>{s.desc}</span>
              <span style={{fontSize:11,color:'var(--blue-light)',fontFamily:'var(--mono)'}}>→ {s.table}</span>
            </div>
          ))}
        </div>

        <div
          onDragOver={e=>{e.preventDefault();setDragging(true);}}
          onDragLeave={()=>setDragging(false)}
          onDrop={onDrop}
          onClick={()=>inputRef.current?.click()}
          style={{
            border:`2px dashed ${dragging?'var(--blue)':'var(--border2)'}`,
            borderRadius:'var(--radius-xl)',padding:'52px 24px',
            textAlign:'center',cursor:'pointer',
            background:dragging?'var(--blue-dim)':'var(--card)',
            transition:'all 0.18s',marginBottom:20,
          }}
        >
          <input ref={inputRef} type="file" accept=".xlsx,.xls"
            onChange={e=>pickFile(e.target.files?.[0])} style={{display:'none'}}/>
          <div style={{fontSize:36,marginBottom:12}}>{file ? '📊' : '⊕'}</div>
          {file ? (
            <div>
              <div style={{fontSize:14,fontWeight:600,color:'var(--text)',marginBottom:4}}>{file.name}</div>
              <div style={{fontSize:12,color:'var(--muted)'}}>{(file.size/1024).toFixed(1)} KB — click to change</div>
            </div>
          ) : (
            <div>
              <div style={{fontSize:14,fontWeight:500,color:'var(--muted)',marginBottom:4}}>Drop your Excel file here</div>
              <div style={{fontSize:12,color:'var(--subtle)'}}>or click to browse — .xlsx files only</div>
            </div>
          )}
        </div>

        {file && status !== 'loading' && (
          <div style={{display:'flex',gap:8}}>
            <button onClick={onProcess} style={{
              flex:1,padding:'12px',background:'var(--blue)',color:'#fff',
              border:'none',borderRadius:'var(--radius)',fontSize:13,fontWeight:600,
            }}>
              Process &amp; Upload to Database
            </button>
            <button onClick={()=>{setFile(null);setStatus(null);setMessage('');}} style={{
              padding:'12px 18px',background:'none',border:'1px solid var(--border2)',
              color:'var(--muted)',borderRadius:'var(--radius)',fontSize:13,
            }}>Clear</button>
          </div>
        )}

        {status==='loading' && (
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'16px 20px',
            background:'var(--card)',border:'1px solid var(--border)',
            borderRadius:'var(--radius-lg)',marginTop:16}}>
            <Spinner/><span style={{fontSize:13,color:'var(--text2)'}}>{message}</span>
          </div>
        )}

        {status==='success' && (
          <div style={{padding:'20px 24px',borderRadius:'var(--radius-lg)',marginTop:16,
            background:'var(--green-dim)',border:'1px solid rgba(16,185,129,0.3)'}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--green)',marginBottom:12}}>✓ {message}</div>
            {counts && (
              <div style={{display:'flex',gap:24}}>
                {[['Skills',counts.skills],['Functions',counts.employees],['Glossary',counts.glossary]].map(([l,n])=>(
                  <div key={l} style={{textAlign:'center'}}>
                    <div style={{fontSize:26,fontWeight:700,color:'var(--green)'}}>{n}</div>
                    <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {status==='error' && (
          <div style={{padding:'14px 18px',borderRadius:'var(--radius-lg)',marginTop:16,
            background:'var(--red-dim)',border:'1px solid rgba(239,68,68,0.3)',
            fontSize:13,color:'var(--red)'}}>
            ⚠ {message}
          </div>
        )}
      </div>
    </Layout>
  );
}
