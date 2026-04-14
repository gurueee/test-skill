export default async function handler(req, res) {
  const results = {};
  
  const geminiKey = process.env.GEMINI_API_KEY;
  results.GEMINI_API_KEY = geminiKey ? `present (${geminiKey.slice(0,8)}...)` : 'NOT SET';
  
  if (geminiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ contents:[{ parts:[{ text:'Say exactly: GEMINI_OK' }] }] }) }
      );
      const d = await r.json();
      results.gemini_test = r.ok 
        ? `✅ ${d.candidates?.[0]?.content?.parts?.[0]?.text}` 
        : `❌ ${r.status}: ${d.error?.message}`;
    } catch(e) { results.gemini_test = `❌ ${e.message}`; }
  }

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  results.ANTHROPIC_API_KEY = claudeKey ? `present (${claudeKey.slice(0,8)}...)` : 'NOT SET';
  
  if (claudeKey) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':claudeKey,'anthropic-version':'2023-06-01'},
        body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:20, messages:[{role:'user',content:'Say CLAUDE_OK'}] })
      });
      const d = await r.json();
      results.claude_test = r.ok 
        ? `✅ ${d.content?.[0]?.text}` 
        : `❌ ${r.status}: ${JSON.stringify(d.error)}`;
    } catch(e) { results.claude_test = `❌ ${e.message}`; }
  }

  return res.status(200).json(results);
}
