export default async function handler(req, res) {
  const report = { keys:{}, tests:{} };

  // Report which keys are present (just first 8 chars for security)
  report.keys = {
    GEMINI_API_KEY:    process.env.GEMINI_API_KEY    ? process.env.GEMINI_API_KEY.slice(0,8)+'...'    : 'NOT SET',
    OPENAI_API_KEY:    process.env.OPENAI_API_KEY    ? process.env.OPENAI_API_KEY.slice(0,8)+'...'    : 'NOT SET',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.slice(0,8)+'...' : 'NOT SET',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ set' : 'NOT SET',
  };

  // Test whichever keys are present
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ contents:[{ parts:[{ text:'Say WORKING' }] }] }) }
      );
      const d = await r.json();
      report.tests.gemini = r.ok
        ? `✅ WORKING — ${d.candidates?.[0]?.content?.parts?.[0]?.text}`
        : `❌ ERROR ${r.status}: ${d.error?.message}`;
    } catch(e) { report.tests.gemini = `❌ FETCH_ERROR: ${e.message}`; }
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${openaiKey}`},
        body: JSON.stringify({ model:'gpt-4o-mini', max_tokens:10, messages:[{role:'user',content:'Say WORKING'}] })
      });
      const d = await r.json();
      report.tests.openai = r.ok
        ? `✅ WORKING — ${d.choices?.[0]?.message?.content}`
        : `❌ ERROR ${r.status}: ${d.error?.message}`;
    } catch(e) { report.tests.openai = `❌ FETCH_ERROR: ${e.message}`; }
  }

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (claudeKey) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':claudeKey,'anthropic-version':'2023-06-01'},
        body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:10, messages:[{role:'user',content:'Say WORKING'}] })
      });
      const d = await r.json();
      report.tests.claude = r.ok
        ? `✅ WORKING — ${d.content?.[0]?.text}`
        : `❌ ERROR ${r.status}: ${JSON.stringify(d.error)}`;
    } catch(e) { report.tests.claude = `❌ FETCH_ERROR: ${e.message}`; }
  }

  const anyWorking = Object.values(report.tests).some(v => v.startsWith('✅'));
  report.status = anyWorking ? '✅ AI IS WORKING' : '❌ NO AI WORKING — add a key to Vercel env vars';
  report.getGeminiKey = 'Free key at: aistudio.google.com → Get API key';

  return res.status(200).json(report);
}
