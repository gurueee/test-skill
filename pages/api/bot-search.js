// Keywords that signal a conversational/question query rather than direct search
const QUESTION_PATTERNS = [
  /^(what|who|how|why|when|where|tell me|explain|describe|show|give|find|search|more about|about|details on|info on|help with|i want to know|can you|could you)/i,
  /\?$/,
];

// Extract the likely skill/term keyword from a natural language query
function extractKeyword(q) {
  return q
    .replace(/^(what is|what are|tell me about|more about|explain|describe|show me|find|search for|info on|details on|how does|how do|i want to know about)\s+/i, '')
    .replace(/\?$/, '')
    .trim();
}

function isConversational(q) {
  return QUESTION_PATTERNS.some(p => p.test(q.trim()));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'query required' });

  const rawQuery = query.trim();
  const apiKey   = process.env.ANTHROPIC_API_KEY;

  // ── Step 1: If conversational, let Claude handle it directly ──
  if (isConversational(rawQuery) && apiKey) {
    // Extract keyword for DB search too
    const keyword = extractKeyword(rawQuery);

    // Search DB with extracted keyword in parallel
    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const headers  = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };

    const [skillsRes, glossaryRes, jdRes, aiRes] = await Promise.all([
      fetch(`${SUPA_URL}/rest/v1/skills?select=id,skill_name&skill_name=ilike.*${encodeURIComponent(keyword)}*&limit=5`, { headers }),
      fetch(`${SUPA_URL}/rest/v1/glossary?select=id,term,full_form,definition,domain&or=(term.ilike.*${encodeURIComponent(keyword)}*,definition.ilike.*${encodeURIComponent(keyword)}*)&limit=3`, { headers }),
      fetch(`${SUPA_URL}/rest/v1/job_descriptions?select=id,title,department&or=(title.ilike.*${encodeURIComponent(keyword)}*,department.ilike.*${encodeURIComponent(keyword)}*)&limit=3`, { headers }),
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key':apiKey, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 450,
          system: `You are a smart internal assistant for Netcracker Technology, a BSS/OSS telecom software company. 
Answer questions clearly and helpfully. Be specific about telecom/BSS/OSS context when relevant. 
Keep answers to 3-4 sentences max. Never say "I cannot" — always give useful information.`,
          messages: [{ role:'user', content: rawQuery }],
        }),
      }),
    ]);

    const skills   = skillsRes.ok   ? await skillsRes.json()   : [];
    const glossary = glossaryRes.ok ? await glossaryRes.json() : [];
    const jds      = jdRes.ok       ? await jdRes.json()       : [];
    const aiData   = await aiRes.json().catch(()=>({}));
    const aiAnswer = aiData.content?.[0]?.text || '';

    // Build combined answer
    let answer = aiAnswer || `Here's what I found for "${keyword}":`;

    // Add DB context note if we found relevant items
    if (skills.length || glossary.length || jds.length) {
      answer += '\n\n**Also found in our internal database** — see results below.';
    }

    return res.status(200).json({
      source: aiAnswer ? 'claude' : 'db',
      answer,
      skills, glossary, jds,
    });
  }

  // ── Step 2: Direct keyword search in DB ──────────────────────
  const q        = extractKeyword(rawQuery); // clean up query
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const headers  = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };

  const [skillsRes, glossaryRes, jdRes] = await Promise.all([
    fetch(`${SUPA_URL}/rest/v1/skills?select=id,skill_name&skill_name=ilike.*${encodeURIComponent(q)}*&limit=8`, { headers }),
    fetch(`${SUPA_URL}/rest/v1/glossary?select=id,term,full_form,definition,domain&or=(term.ilike.*${encodeURIComponent(q)}*,definition.ilike.*${encodeURIComponent(q)}*)&limit=5`, { headers }),
    fetch(`${SUPA_URL}/rest/v1/job_descriptions?select=id,title,department&or=(title.ilike.*${encodeURIComponent(q)}*,department.ilike.*${encodeURIComponent(q)}*)&limit=5`, { headers }),
  ]);

  const skills   = skillsRes.ok   ? await skillsRes.json()   : [];
  const glossary = glossaryRes.ok ? await glossaryRes.json() : [];
  const jds      = jdRes.ok       ? await jdRes.json()       : [];
  const hasDB    = skills.length > 0 || glossary.length > 0 || jds.length > 0;

  if (hasDB) {
    const parts = [];
    if (skills.length)   parts.push(`Found **${skills.length} skill${skills.length>1?'s':''}** matching **${q}** in our database:`);
    if (glossary.length) parts.push(glossary.map(g=>`**${g.term}**${g.full_form?' — '+g.full_form:''}: ${(g.definition||'').slice(0,100)}…`).join('\n'));
    if (jds.length)      parts.push(`**${jds.length} job description${jds.length>1?'s':''}** found in ${[...new Set(jds.map(j=>j.department))].join(', ')}.`);

    return res.status(200).json({
      source: 'db',
      answer: parts.join('\n\n'),
      skills, glossary, jds,
    });
  }

  // ── Step 3: Nothing in DB — Claude answers or honest fallback ─
  if (apiKey) {
    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key':apiKey, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: `You are a smart internal assistant for Netcracker Technology, a BSS/OSS telecom software company. 
Answer questions helpfully and specifically. Focus on telecom/BSS/OSS context. 3-4 sentences max.
If this appears to be a skill or technology, explain what it is and how it relates to telecom software engineering.
End with one sentence noting it is not yet in the internal database and can be added via the Upload page.`,
          messages: [{ role:'user', content: `Tell me about: ${q}` }],
        }),
      });
      const data = await aiRes.json();
      const answer = data.content?.[0]?.text || '';
      if (answer) return res.status(200).json({ source:'claude', answer, skills:[], glossary:[], jds:[] });
    } catch(e) { console.error('Claude error:', e); }
  }

  return res.status(200).json({
    source: 'none',
    answer: `**"${q}"** wasn't found in our internal database. ${apiKey ? '' : 'Add an Anthropic API key to Vercel environment variables to enable AI-powered answers.'} You can add this skill or term via the **Upload page**.`,
    skills:[], glossary:[], jds:[],
  });
}
