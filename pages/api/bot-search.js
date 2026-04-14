import { searchFAQ } from '../../lib/faq';

function extractKeyword(q) {
  return q.trim().replace(/\?$/, '')
    .replace(/^(what is|what are|tell me about|more about|explain|describe|show me|find|how does|who knows|who has)\s+/i, '')
    .replace(/\s+(in telecom|at netcracker|for telecom)\s*$/i, '')
    .replace(/\s+(developer roles|engineering roles|roles|role|positions)\s*$/i, '')
    .trim() || q.trim().replace(/\?$/, '');
}

async function callGemini(key, prompt) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        contents:[{ parts:[{ text: prompt }] }],
        generationConfig:{ maxOutputTokens:400, temperature:0.7 }
      })
    }
  );
  if (!r.ok) {
    const e = await r.json().catch(()=>({}));
    console.error('Gemini error', r.status, e?.error?.message);
    return null;
  }
  const d = await r.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? { text, source:'gemini', label:'Gemini AI' } : null;
}

async function callOpenAI(key, prompt) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
    body: JSON.stringify({
      model:'gpt-4o-mini', max_tokens:400,
      messages:[
        { role:'system', content:'You are a helpful assistant for Netcracker Technology, a BSS/OSS telecom software company. Be concise and specific.' },
        { role:'user', content: prompt }
      ]
    })
  });
  if (!r.ok) return null;
  const d = await r.json();
  const text = d.choices?.[0]?.message?.content;
  return text ? { text, source:'openai', label:'ChatGPT' } : null;
}

async function callClaude(key, prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
    body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:400, messages:[{role:'user',content:prompt}] })
  });
  if (!r.ok) return null;
  const d = await r.json();
  const text = d.content?.[0]?.text;
  return text ? { text, source:'claude', label:'Claude AI' } : null;
}

async function callAny(prompt) {
  const tries = [
    [process.env.GEMINI_API_KEY,    callGemini],
    [process.env.OPENAI_API_KEY,    callOpenAI],
    [process.env.ANTHROPIC_API_KEY, callClaude],
  ];
  for (const [key, fn] of tries) {
    if (!key) continue;
    try {
      const r = await fn(key, prompt);
      if (r?.text) return r;
    } catch(e) { console.error(e.message); }
  }
  return null;
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

  // ── 1. Search DB ─────────────────────────────────────────────
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

  // ── 2. Check FAQ knowledge base (works without any API) ──────
  const faqAnswer = searchFAQ(rawQuery) || searchFAQ(keyword);

  // ── 3. Try external AI if available ─────────────────────────
  const dbCtx = hasDB
    ? `Internal DB found: ${[
        skills.length   ? `Skills: ${skills.map(s=>s.skill_name).join(', ')}` : '',
        glossary.length ? `Glossary: ${glossary.map(g=>g.term+': '+g.definition?.slice(0,80)).join(' | ')}` : '',
        jds.length      ? `JDs: ${jds.map(j=>j.title).join(', ')}` : '',
      ].filter(Boolean).join('; ')}`
    : 'Not in internal database.';

  const aiPrompt = `You are a helpful assistant for Netcracker Technology (BSS/OSS telecom company).
Question: "${rawQuery}"
${dbCtx}
Answer in 2-4 sentences. Be specific and helpful about telecom/BSS/OSS context.`;

  const ai = await callAny(aiPrompt);

  // ── 4. Build response with best available answer ─────────────
  let answer, source;

  if (ai?.text) {
    // AI answered — use it
    answer = ai.text;
    source = hasDB ? 'db' : ai.source;
  } else if (faqAnswer) {
    // FAQ answered — use it
    answer = faqAnswer;
    source = hasDB ? 'db' : 'faq';
  } else if (hasDB) {
    // DB results only
    const parts = [];
    if (skills.length)   parts.push(`Found **${skills.length} skill(s)** matching **${keyword}**:`);
    if (glossary.length) parts.push(glossary.map(g=>`**${g.term}**${g.full_form?' — '+g.full_form:''}: ${(g.definition||'').slice(0,120)}…`).join('\n'));
    if (jds.length)      parts.push(`**${jds.length} JD(s)** found in ${[...new Set(jds.map(j=>j.department))].join(', ')}.`);
    answer = parts.join('\n\n');
    source = 'db';
  } else {
    // Nothing at all — helpful guidance
    answer = `**"${keyword}"** wasn't found in the Netcracker internal database.\n\nTry searching for:\n**•** A specific skill (Java, Kafka, OCS, Kubernetes)\n**•** A role (Billing Analyst, DevOps Engineer, BA)\n**•** A BSS/OSS term (CDR, Diameter, Mediation)\n\nOr use the **Upload page** to add new skills to the database.`;
    source = 'none';
  }

  return res.status(200).json({ source, aiLabel:ai?.label, answer, skills, glossary, jds });
}
