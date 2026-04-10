const CONVERSATIONAL = /^(what|who|how|why|when|where|tell me|explain|describe|show|give|find|search|more about|about|details on|info on|help|i want|can you|could you)/i;

function extractKeyword(q) {
  return q.trim().replace(/\?$/, '')
    .replace(/^(what is|what are|tell me about|more about|explain|describe|show me|find|search for|how does|how do|who knows|who has)\s+/i, '')
    .replace(/\s+(in telecom|in bss|in oss|at netcracker|for telecom)\s*$/i, '')
    .replace(/\s+(developer|engineer|roles|role|jobs|positions|skills)\s*$/i, '')
    .trim() || q.trim().replace(/\?$/, '');
}

async function callAI(prompt) {
  const keys = [
    { env: 'GEMINI_API_KEY', fn: callGemini },
    { env: 'OPENAI_API_KEY', fn: callOpenAI },
    { env: 'ANTHROPIC_API_KEY', fn: callClaude },
  ];
  for (const { env, fn } of keys) {
    const key = process.env[env];
    if (!key) continue;
    try {
      const result = await fn(key, prompt);
      if (result) return result;
    } catch(e) { console.error(`${env} error:`, e.message); }
  }
  return null;
}

async function callGemini(key, prompt) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ contents:[{ parts:[{ text: prompt }] }], generationConfig:{ maxOutputTokens:400 } }) }
  );
  if (!r.ok) { console.error('Gemini', r.status, await r.text()); return null; }
  const d = await r.json();
  return { text: d.candidates?.[0]?.content?.parts?.[0]?.text, source:'gemini', label:'Gemini AI' };
}

async function callOpenAI(key, prompt) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
    body: JSON.stringify({ model:'gpt-4o-mini', max_tokens:400,
      messages:[{ role:'system', content:'You are a helpful assistant for Netcracker Technology, a BSS/OSS telecom software company.' },
                { role:'user', content:prompt }] })
  });
  if (!r.ok) { console.error('OpenAI', r.status, await r.text()); return null; }
  const d = await r.json();
  return { text: d.choices?.[0]?.message?.content, source:'openai', label:'ChatGPT' };
}

async function callClaude(key, prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST', headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
    body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:400, messages:[{ role:'user', content:prompt }] })
  });
  if (!r.ok) { console.error('Claude', r.status, await r.text()); return null; }
  const d = await r.json();
  return { text: d.content?.[0]?.text, source:'claude', label:'Claude AI' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error:'query required' });

  const rawQuery = query.trim();
  const keyword  = extractKeyword(rawQuery);

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const h = { apikey:SUPA_KEY, Authorization:`Bearer ${SUPA_KEY}` };

  const enc = encodeURIComponent(keyword);
  const [sr, gr, jr] = await Promise.all([
    fetch(`${SUPA_URL}/rest/v1/skills?select=id,skill_name&skill_name=ilike.*${enc}*&limit=8`, {headers:h}),
    fetch(`${SUPA_URL}/rest/v1/glossary?select=id,term,full_form,definition,domain&or=(term.ilike.*${enc}*,definition.ilike.*${enc}*)&limit=5`, {headers:h}),
    fetch(`${SUPA_URL}/rest/v1/job_descriptions?select=id,title,department&or=(title.ilike.*${enc}*,department.ilike.*${enc}*)&limit=5`, {headers:h}),
  ]);

  const skills   = sr.ok ? await sr.json() : [];
  const glossary = gr.ok ? await gr.json() : [];
  const jds      = jr.ok ? await jr.json() : [];
  const hasDB    = skills.length > 0 || glossary.length > 0 || jds.length > 0;

  const dbCtx = hasDB
    ? `Found in DB: ${[skills.length?`Skills: ${skills.map(s=>s.skill_name).join(', ')}`:''
      ,glossary.length?`Glossary: ${glossary.map(g=>g.term).join(', ')}`:''
      ,jds.length?`JDs: ${jds.map(j=>j.title).join(', ')}`:''].filter(Boolean).join('; ')}`
    : 'Not found in internal database.';

  const prompt = `You are a helpful assistant for Netcracker Technology (BSS/OSS telecom software).
Query: "${rawQuery}"
Internal DB result: ${dbCtx}
Give a helpful 2-4 sentence answer. Be specific. If query is unrelated to work/tech, say so briefly.`;

  const ai = await callAI(prompt);

  if (ai?.text) {
    return res.status(200).json({ source: hasDB?'db':ai.source, aiLabel:ai.label, answer:ai.text, skills, glossary, jds });
  }

  if (hasDB) {
    const parts = [];
    if (skills.length)   parts.push(`Found **${skills.length} skill(s)** matching **${keyword}**`);
    if (glossary.length) parts.push(glossary.map(g=>`**${g.term}** — ${(g.definition||'').slice(0,100)}…`).join('\n'));
    if (jds.length)      parts.push(`**${jds.length} JD(s)** in ${[...new Set(jds.map(j=>j.department))].join(', ')}`);
    return res.status(200).json({ source:'db', answer:parts.join('\n\n'), skills, glossary, jds });
  }

  return res.status(200).json({
    source:'none',
    answer:`**"${keyword}"** is not in the internal database.\n\nTry: a specific skill name (Java, Kafka, OCS), a role (Billing Analyst), or a BSS/OSS term.\n\nTo add new skills, use the **Upload page**.`,
    skills:[], glossary:[], jds:[],
  });
}
