export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'query required' });

  const q = query.trim();

  // ── Step 1: Search our DB via Supabase REST ──────────────────
  const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const headers   = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };

  const [skillsRes, glossaryRes, jdRes] = await Promise.all([
    fetch(`${SUPA_URL}/rest/v1/skills?select=id,skill_name&skill_name=ilike.*${encodeURIComponent(q)}*&limit=5`, { headers }),
    fetch(`${SUPA_URL}/rest/v1/glossary?select=id,term,full_form,definition,domain&or=(term.ilike.*${encodeURIComponent(q)}*,definition.ilike.*${encodeURIComponent(q)}*)&limit=5`, { headers }),
    fetch(`${SUPA_URL}/rest/v1/job_descriptions?select=id,title,department&or=(title.ilike.*${encodeURIComponent(q)}*,department.ilike.*${encodeURIComponent(q)}*)&limit=5`, { headers }),
  ]);

  const skills   = skillsRes.ok   ? await skillsRes.json()   : [];
  const glossary = glossaryRes.ok ? await glossaryRes.json() : [];
  const jds      = jdRes.ok       ? await jdRes.json()       : [];

  const hasResults = skills.length > 0 || glossary.length > 0 || jds.length > 0;

  // ── Step 2: Build bot response ───────────────────────────────
  if (hasResults) {
    // Found in DB — generate a natural language summary
    const parts = [];
    if (skills.length)
      parts.push(`**Skills:** ${skills.map(s=>s.skill_name).join(', ')}`);
    if (glossary.length)
      parts.push(glossary.map(g=>`**${g.term}** (${g.full_form||g.domain||''}) — ${(g.definition||'').slice(0,120)}${g.definition?.length>120?'…':''}`).join('\n'));
    if (jds.length)
      parts.push(`**JDs:** ${jds.map(j=>`${j.title} · ${j.department}`).join(', ')}`);

    return res.status(200).json({
      source: 'db',
      answer: parts.join('\n\n'),
      skills, glossary, jds,
    });
  }

  // ── Step 3: Not in DB — try Claude ──────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      source: 'none',
      answer: `I couldn't find anything for **"${q}"** in our database. Try a different keyword, or add it via the Upload page.`,
      skills:[], glossary:[], jds:[],
    });
  }

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `You are a helpful assistant for Netcracker Technology, a BSS/OSS telecom software company. 
A user searched for: "${q}"
This was NOT found in the internal skill/glossary/JD database.
Give a brief, helpful 2-3 sentence answer about what "${q}" is in the context of telecom, BSS/OSS, or software engineering. 
End with: "This term isn't in our internal database yet — consider adding it via the Upload page."`,
        }],
      }),
    });

    const aiData = await aiRes.json();
    const answer = aiData.content?.[0]?.text || `"${q}" was not found in our database.`;

    return res.status(200).json({
      source: 'claude',
      answer,
      skills:[], glossary:[], jds:[],
    });
  } catch(err) {
    return res.status(200).json({
      source: 'none',
      answer: `**"${q}"** wasn't found in our database. Try searching on Claude.ai for more information.`,
      skills:[], glossary:[], jds:[],
    });
  }
}
