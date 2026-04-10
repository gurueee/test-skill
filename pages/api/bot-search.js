const CONVERSATIONAL = /^(what|who|how|why|when|where|tell me|explain|describe|show|give|find|search|more about|about|details on|info on|help with|i want to know|can you|could you)/i;

function extractKeyword(q) {
  let s = q.trim().replace(/\?$/, '')
    .replace(/^(what is|what are|what's|tell me about|more about|explain|describe|show me|find me|search for|info on|details on|how does|how do|i want to know about|can you explain|who knows|who has)\s+/i, '')
    .trim()
    .replace(/\s+(in telecom|in bss|in oss|at netcracker|for telecom)\s*$/i, '')
    .replace(/\s+(developer|engineer|developer roles|engineering roles|skills|skill|roles|role|jobs|job|positions)\s*$/i, '')
    .trim();
  return s || q.trim().replace(/\?$/, '').trim();
}

async function askAI(prompt) {
  // Try Gemini first (Google)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
          }),
        }
      );
      if (r.ok) {
        const d = await r.json();
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return { text, source: 'gemini', label: 'Gemini AI' };
      } else {
        const err = await r.json().catch(()=>({}));
        console.error('Gemini error:', r.status, err?.error?.message);
      }
    } catch(e) { console.error('Gemini fetch error:', e.message); }
  }

  // Try OpenAI (ChatGPT)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 400,
          messages: [
            { role: 'system', content: 'You are a helpful assistant for Netcracker Technology, a BSS/OSS telecom software company. Answer in 2-4 sentences. Be specific to telecom/BSS/OSS context.' },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (r.ok) {
        const d = await r.json();
        const text = d.choices?.[0]?.message?.content;
        if (text) return { text, source: 'openai', label: 'ChatGPT' };
      } else {
        const err = await r.json().catch(()=>({}));
        console.error('OpenAI error:', r.status, err?.error?.message);
      }
    } catch(e) { console.error('OpenAI fetch error:', e.message); }
  }

  // Try Claude as last resort
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (r.ok) {
        const d = await r.json();
        const text = d.content?.[0]?.text;
        if (text) return { text, source: 'claude', label: 'Claude AI' };
      }
    } catch(e) { console.error('Claude error:', e.message); }
  }

  return null;
}

function getBuiltinAnswer(keyword) {
  const s = keyword.toLowerCase();
  const map = {
    google:    `Google is not a Netcracker internal skill. Google Cloud Platform (GCP) is used in some deployments — try searching "GCP" or "cloud". For Google-specific skills, add them via the Upload page.`,
    gcp:       `Google Cloud Platform (GCP) is one of the hyperscalers Netcracker supports alongside AWS and Azure. GKE is used for Kubernetes deployments. Search "cloud" or "kubernetes" for related skills.`,
    microsoft: `Microsoft technologies at Netcracker include Azure, .NET, and SQL Server. Try searching "Azure", ".NET", or "C#" for specific skills.`,
    chatgpt:   `ChatGPT is OpenAI's AI assistant, not a Netcracker technical skill. This tool uses AI for insights on skills. Try searching "machine learning" or "AI" for related skills.`,
    openai:    `OpenAI is not listed as a Netcracker internal skill. For AI/ML skills, try searching "machine learning" or "data science".`,
  };

  for (const [key, answer] of Object.entries(map)) {
    if (s.includes(key)) return answer;
  }

  return `**"${keyword}"** wasn't found in the Netcracker internal database.\n\nSuggestions:\n**1.** Try a related term — e.g. a broader skill category\n**2.** Check the **Glossary** page for BSS/OSS definitions\n**3.** Add it via the **Upload page** if it should be tracked`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'query required' });

  const rawQuery = query.trim();
  const keyword  = extractKeyword(rawQuery);

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const headers  = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };

  // Search DB
  const enc = encodeURIComponent(keyword);
  const [sr, gr, jr] = await Promise.all([
    fetch(`${SUPA_URL}/rest/v1/skills?select=id,skill_name&skill_name=ilike.*${enc}*&limit=8`, { headers }),
    fetch(`${SUPA_URL}/rest/v1/glossary?select=id,term,full_form,definition,domain&or=(term.ilike.*${enc}*,definition.ilike.*${enc}*)&limit=5`, { headers }),
    fetch(`${SUPA_URL}/rest/v1/job_descriptions?select=id,title,department&or=(title.ilike.*${enc}*,department.ilike.*${enc}*)&limit=5`, { headers }),
  ]);

  const skills   = sr.ok ? await sr.json() : [];
  const glossary = gr.ok ? await gr.json() : [];
  const jds      = jr.ok ? await jr.json() : [];
  const hasDB    = skills.length > 0 || glossary.length > 0 || jds.length > 0;

  // Build AI prompt with DB context
  const dbCtx = hasDB
    ? `\n\nAlso found in Netcracker internal database: ${[
        skills.length   ? `Skills: ${skills.map(s=>s.skill_name).join(', ')}` : '',
        glossary.length ? `Glossary terms: ${glossary.map(g=>g.term).join(', ')}` : '',
        jds.length      ? `Job descriptions: ${jds.map(j=>j.title).join(', ')}` : '',
      ].filter(Boolean).join('; ')}`
    : '\n\nThis was NOT found in the Netcracker internal database.';

  const prompt = `You are a helpful assistant for Netcracker Technology, a BSS/OSS telecom software company.
User asked: "${rawQuery}"${dbCtx}
Answer in 2-4 sentences. Be specific and helpful. If not telecom-related, briefly explain and suggest a related search.`;

  const aiResult = await askAI(prompt);

  if (aiResult) {
    return res.status(200).json({
      source: hasDB ? 'db' : aiResult.source,
      aiSource: aiResult.source,
      aiLabel: aiResult.label,
      answer: aiResult.text,
      skills, glossary, jds,
    });
  }

  // DB results without AI
  if (hasDB) {
    const parts = [];
    if (skills.length)   parts.push(`Found **${skills.length} skill${skills.length>1?'s':''}** matching **${keyword}**:`);
    if (glossary.length) parts.push(glossary.map(g=>`**${g.term}**${g.full_form?' — '+g.full_form:''}: ${(g.definition||'').slice(0,100)}…`).join('\n'));
    if (jds.length)      parts.push(`**${jds.length} JD${jds.length>1?'s':''}** in ${[...new Set(jds.map(j=>j.department))].join(', ')}.`);
    return res.status(200).json({ source:'db', answer:parts.join('\n\n'), skills, glossary, jds });
  }

  // Builtin fallback — never silent
  return res.status(200).json({
    source: 'none',
    answer: getBuiltinAnswer(keyword),
    skills:[], glossary:[], jds:[],
  });
}
