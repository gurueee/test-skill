export default async function handler(req, res) {
  const { table } = req.query;
  const allowed = ['skills','employees','glossary','job_descriptions'];
  if (!allowed.includes(table)) return res.status(400).json({ count: 0 });

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?select=id`, {
      headers: {
        apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
        Prefer: 'count=exact', Range: '0-0',
      },
    });
    const range = r.headers.get('content-range') || '';
    const count = parseInt(range.split('/')[1]) || 0;
    return res.status(200).json({ count });
  } catch(e) {
    return res.status(200).json({ count: 0 });
  }
}
