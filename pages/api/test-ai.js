export default async function handler(req, res) {
  const results = {};

  // Test Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with exactly: GEMINI_WORKING' }] }] }),
        }
      );
      const d = await r.json();
      results.gemini = r.ok ? (d.candidates?.[0]?.content?.parts?.[0]?.text || 'NO_TEXT') : `ERROR_${r.status}`;
    } catch(e) { results.gemini = `FETCH_ERROR: ${e.message}`; }
  } else { results.gemini = 'NO_KEY'; }

  // Test OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 20, messages: [{ role:'user', content:'Reply with exactly: OPENAI_WORKING' }] }),
      });
      const d = await r.json();
      results.openai = r.ok ? (d.choices?.[0]?.message?.content || 'NO_TEXT') : `ERROR_${r.status}: ${d.error?.message}`;
    } catch(e) { results.openai = `FETCH_ERROR: ${e.message}`; }
  } else { results.openai = 'NO_KEY'; }

  // Test Claude
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (claudeKey) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 20, messages: [{ role:'user', content:'Reply with exactly: CLAUDE_WORKING' }] }),
      });
      const d = await r.json();
      results.claude = r.ok ? (d.content?.[0]?.text || 'NO_TEXT') : `ERROR_${r.status}: ${JSON.stringify(d.error)}`;
    } catch(e) { results.claude = `FETCH_ERROR: ${e.message}`; }
  } else { results.claude = 'NO_KEY'; }

  const working = Object.entries(results).filter(([,v]) => v.includes('WORKING')).map(([k])=>k);
  
  return res.status(200).json({
    status: working.length > 0 ? 'OK' : 'ALL_FAILED',
    working,
    results,
    recommendation: working.length === 0
      ? 'Add GEMINI_API_KEY to Vercel env vars — get free key at aistudio.google.com'
      : `Using: ${working[0]}`,
  });
}
