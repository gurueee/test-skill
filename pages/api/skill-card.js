export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { skill } = req.body;
  if (!skill) return res.status(400).json({ error: 'skill required' });

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const headers  = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };

  try {
    // Get skill IDs matching query
    const skillRes = await fetch(
      `${SUPA_URL}/rest/v1/skills?select=id,skill_name&skill_name=ilike.*${encodeURIComponent(skill)}*&limit=10`,
      { headers }
    );
    const skills = await skillRes.json();
    if (!skills?.length) return res.status(200).json({ totalBUs:0, totalFns:0, bus:[], leaders:[], functions:[] });

    const ids = skills.map(s=>s.id).join(',');

    // Get employees with these skills
    const empRes = await fetch(
      `${SUPA_URL}/rest/v1/employee_skills?select=emp_id,employees(bu,function_name,leader)&skill_id=in.(${ids})`,
      { headers }
    );
    const links = await empRes.json();

    const buSet      = new Set();
    const leaderSet  = new Set();
    const fnSet      = new Set();
    const buFnMap    = {};

    for (const link of (links||[])) {
      const e = link.employees;
      if (!e) continue;
      if (e.bu)            buSet.add(e.bu);
      if (e.leader)        leaderSet.add(e.leader);
      if (e.function_name) fnSet.add(e.function_name);
      if (e.bu && e.function_name) {
        if (!buFnMap[e.bu]) buFnMap[e.bu] = [];
        if (!buFnMap[e.bu].includes(e.function_name))
          buFnMap[e.bu].push(e.function_name);
      }
    }

    return res.status(200).json({
      totalBUs:  buSet.size,
      totalFns:  fnSet.size,
      bus:       [...buSet].sort(),
      leaders:   [...leaderSet].sort(),
      buFnMap,
    });
  } catch(e) {
    console.error('skill-card error:', e);
    return res.status(500).json({ error: e.message });
  }
}
