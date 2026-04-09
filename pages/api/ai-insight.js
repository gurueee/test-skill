export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { skill, context } = req.body;
  if (!skill) return res.status(400).json({ error: 'skill required' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `You are a technical advisor for Netcracker Technology, a BSS/OSS telecom software company.

Skill: "${skill}"
${context}

Give a concise 2-3 sentence insight about this skill in the context of telecom/BSS/OSS engineering. Cover: what it is, why it matters in this domain, and what roles typically use it. Be direct and practical. No bullet points.`,
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return res.status(200).json({ insight: getFallbackInsight(skill) });
    }

    const data = await response.json();
    const insight = data.content?.[0]?.text || getFallbackInsight(skill);
    return res.status(200).json({ insight });

  } catch (err) {
    console.error(err);
    return res.status(200).json({ insight: getFallbackInsight(skill) });
  }
}

function getFallbackInsight(skill) {
  return `${skill} is a technical skill used across various functions at Netcracker. Teams with this skill contribute to BSS/OSS platform development, cloud deployments, and system integrations in the telecom domain.`;
}
