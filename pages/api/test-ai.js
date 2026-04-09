export default async function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY;
  
  if (!key) {
    return res.status(200).json({ 
      status: 'NO_KEY',
      message: 'ANTHROPIC_API_KEY is not set in environment variables'
    });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Reply with exactly: API_WORKING' }],
      }),
    });

    const status = r.status;
    const body   = await r.json();
    const text   = body.content?.[0]?.text || '';

    return res.status(200).json({
      status:   r.ok ? 'OK' : 'API_ERROR',
      httpCode: status,
      reply:    text,
      keyFirst8: key.slice(0,8) + '...',
      rawError: r.ok ? null : body,
    });
  } catch(e) {
    return res.status(200).json({
      status: 'FETCH_ERROR',
      error: e.message,
    });
  }
}
