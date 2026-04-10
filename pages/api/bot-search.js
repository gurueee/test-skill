const CONVERSATIONAL = /^(what|who|how|why|when|where|tell me|explain|describe|show|give|find|search|more about|about|details on|info on|help with|i want to know|can you|could you)/i;

function extractKeyword(q) {
  let s = q.trim().replace(/\?$/, '')
    .replace(/^(what is|what are|what's|tell me about|more about|explain|describe|show me|find me|search for|info on|details on|how does|how do|i want to know about|give me info on|can you explain|who knows|who has)\s+/i, '')
    .trim()
    .replace(/\s+(in telecom|in bss|in oss|at netcracker|for telecom)\s*$/i, '')
    .replace(/\s+(developer|engineer|developer roles|engineering roles|skills|skill|roles|role|jobs|job|positions)\s*$/i, '')
    .trim();
  return s || q.trim().replace(/\?$/, '').trim();
}

// Built-in answers for things not in DB — so bot is NEVER silent
function getBuiltinAnswer(keyword, rawQuery) {
  const s = keyword.toLowerCase();
  const builtins = {
    google:    `Google is not a Netcracker internal skill, but Google Cloud Platform (GCP) is used in some Netcracker cloud deployments alongside AWS and Azure. If you meant GCP, try searching "GCP" or "cloud". For Google-specific engineering skills, these would typically be added via the Upload page.`,
    gcp:       `Google Cloud Platform (GCP) is one of the hyperscalers Netcracker supports for cloud-native BSS/OSS deployments, alongside AWS and Azure. GKE (Google Kubernetes Engine) is used for some operator cloud environments. Search "cloud" or "kubernetes" to see related skills in our database.`,
    microsoft: `Microsoft technologies at Netcracker include Azure (cloud deployments), .NET/C# (some product modules), and SQL Server (legacy integrations). Try searching "Azure", ".NET", or "C#" to find specific skills in our database.`,
    linkedin:  `LinkedIn is a professional networking platform — not a Netcracker technical skill. If you're looking for leader profiles within Netcracker, check the Leaders page which shows domain leads and their team skill profiles.`,
    facebook:  `Facebook/Meta is not a Netcracker technical skill. If you meant React (originally developed at Meta) which is used in some Netcracker UI modules, try searching "React" instead.`,
    twitter:   `Twitter/X is not a Netcracker technical skill. If you're looking for API integration skills, try searching "REST API" or "integration" in our database.`,
    chatgpt:   `ChatGPT is OpenAI's AI assistant — not a Netcracker internal skill. This Skill Visibility Engine uses Anthropic's Claude for AI insights. If you're exploring AI/ML skills at Netcracker, try searching "machine learning" or "AI" in the database.`,
    openai:    `OpenAI is not currently listed as a Netcracker internal skill. Netcracker uses Anthropic Claude for AI-powered features in internal tools. For AI/ML related skills, try searching "machine learning" or "data science".`,
    'external search': `"External search" isn't a skill in our database. Try searching for a specific technology like "Java", "Kafka", "Kubernetes", or a role like "Billing Analyst" to find matching skills and JDs.`,
  };

  for (const [key, answer] of Object.entries(builtins)) {
    if (s.includes(key)) return answer;
  }

  // Generic helpful fallback — never say "no results" without guidance
  return `**"${keyword}"** wasn't found in the Netcracker internal skill database. This could mean:\n\n1. It's not yet mapped — you can add it via the **Upload page**\n2. Try a related term — e.g. "${keyword}" might be listed under a broader category\n3. Check the **Glossary** for BSS/OSS term definitions\n\nIf this is a technology or skill that should be tracked, consider uploading the updated Excel file with this skill added.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'query required' });

  const rawQuery = query.trim();
  const keyword  = extractKeyword(rawQuery);
  const apiKey   = process.env.ANTHROPIC_API_KEY;

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const headers  = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };

  // ── Search DB ─────────────────────────────────────────────────
  const enc = encodeURIComponent(keyword);
  const [skillsRes, glossaryRes, jdRes] = await Promise.all([
    fetch(`${SUPA_URL}/rest/v1/skills?select=id,skill_name&skill_name=ilike.*${enc}*&limit=8`, { headers }),
    fetch(`${SUPA_URL}/rest/v1/glossary?select=id,term,full_form,definition,domain&or=(term.ilike.*${enc}*,definition.ilike.*${enc}*)&limit=5`, { headers }),
    fetch(`${SUPA_URL}/rest/v1/job_descriptions?select=id,title,department&or=(title.ilike.*${enc}*,department.ilike.*${enc}*)&limit=5`, { headers }),
  ]);

  const skills   = skillsRes.ok   ? await skillsRes.json()   : [];
  const glossary = glossaryRes.ok ? await glossaryRes.json() : [];
  const jds      = jdRes.ok       ? await jdRes.json()       : [];
  const hasDB    = skills.length > 0 || glossary.length > 0 || jds.length > 0;

  // ── Try Claude for all queries (conversational or not) ────────
  if (apiKey) {
    try {
      const dbCtx = hasDB
        ? `\n\nFound in Netcracker DB: ${[
            skills.length   ? `Skills: ${skills.map(s=>s.skill_name).join(', ')}` : '',
            glossary.length ? `Glossary: ${glossary.map(g=>g.term).join(', ')}` : '',
            jds.length      ? `JDs: ${jds.map(j=>j.title).join(', ')}` : '',
          ].filter(Boolean).join('; ')}`
        : '\n\nThis was NOT found in the Netcracker internal database.';

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 350,
          system: `You are a helpful assistant for Netcracker Technology, a BSS/OSS telecom software company. 
Answer in 2-4 sentences. Be specific. If the query is about something outside Netcracker's domain (e.g. social media, consumer apps), briefly explain why it's not relevant and suggest a related internal skill to search for instead.`,
          messages: [{
            role: 'user',
            content: rawQuery + dbCtx,
          }],
        }),
      });

      if (r.ok) {
        const data = await r.json();
        const answer = data.content?.[0]?.text;
        if (answer) {
          return res.status(200).json({
            source: hasDB ? 'db' : 'claude',
            answer,
            skills, glossary, jds,
          });
        }
      }
    } catch(e) { console.error('Claude error:', e.message); }
  }

  // ── DB found but no Claude ────────────────────────────────────
  if (hasDB) {
    const parts = [];
    if (skills.length)
      parts.push(`Found **${skills.length} skill${skills.length>1?'s':''}** matching **${keyword}**:`);
    if (glossary.length)
      parts.push(glossary.map(g=>`**${g.term}**${g.full_form?' — '+g.full_form:''}: ${(g.definition||'').slice(0,100)}…`).join('\n'));
    if (jds.length)
      parts.push(`**${jds.length} JD${jds.length>1?'s':''}** found in ${[...new Set(jds.map(j=>j.department))].join(', ')}.`);

    return res.status(200).json({
      source: 'db',
      answer: parts.join('\n\n'),
      skills, glossary, jds,
    });
  }

  // ── Nothing anywhere — builtin helpful answer, NEVER silent ──
  return res.status(200).json({
    source: 'none',
    answer: getBuiltinAnswer(keyword, rawQuery),
    skills: [], glossary: [], jds: [],
  });
}
