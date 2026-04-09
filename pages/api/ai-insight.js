export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { skill, context } = req.body;
  if (!skill) return res.status(400).json({ error: 'skill required' });

  const prompt = `You are a senior technical architect at Netcracker Technology, a BSS/OSS telecom software company.

Skill: "${skill}"
${context ? `Internal context: ${context}` : ''}

Provide a rich technical insight covering:
1. What this skill/technology is and its core purpose
2. Why it matters specifically in telecom BSS/OSS engineering
3. How it is typically used at this level (architecture patterns, integration points)
4. Skill level expectations (junior vs senior) and career relevance

Keep it to 4-5 sentences. Be specific, technical, and insightful — not generic. Write as a principal engineer would explain to a new joiner.`;

  // Try Claude first
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{ role:'user', content: prompt }],
        }),
      });
      if (r.ok) {
        const data = await r.json();
        const text = data.content?.[0]?.text;
        if (text) return res.status(200).json({ insight:text, source:'claude' });
      }
    } catch(e) { console.error('Claude error:', e.message); }
  }

  // Fallback: Google Custom Search for real-world context
  const googleKey = process.env.GOOGLE_API_KEY;
  const googleCX  = process.env.GOOGLE_CX;
  if (googleKey && googleCX) {
    try {
      const q = encodeURIComponent(`${skill} telecom BSS OSS software engineering`);
      const r = await fetch(`https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCX}&q=${q}&num=3`);
      if (r.ok) {
        const data = await r.json();
        const snippets = (data.items||[]).map(i=>i.snippet).filter(Boolean).join(' ');
        if (snippets) {
          return res.status(200).json({
            insight: `Based on public knowledge: ${snippets.slice(0,400)}…`,
            source: 'google',
          });
        }
      }
    } catch(e) { console.error('Google error:', e.message); }
  }

  // Static fallback with domain-aware response
  return res.status(200).json({
    insight: getDomainInsight(skill),
    source: 'static',
  });
}

function getDomainInsight(skill) {
  const s = skill.toLowerCase();
  if (/kafka/.test(s)) return `Apache Kafka is a distributed event streaming platform critical in telecom BSS/OSS for real-time data pipelines — handling CDR streams, mediation events, and inter-system notifications at scale. In Netcracker's architecture it bridges billing, mediation, and OSS components with high-throughput, fault-tolerant message queues. Senior engineers are expected to design topic partitioning strategies, consumer group management, and schema evolution.`;
  if (/kubernetes|k8s/.test(s)) return `Kubernetes is the industry-standard container orchestration platform used to deploy and manage Netcracker's cloud-native BSS/OSS products. It enables auto-scaling, rolling deployments, and service mesh configurations critical for telecom SLA compliance. Architects use it to design multi-tenant deployments across private and public cloud environments for Tier 1 operator projects.`;
  if (/java/.test(s)) return `Java is the primary development language across Netcracker's BSS/OSS platform — used in core billing engines, order management, and mediation components. The expectation at senior level includes deep knowledge of JVM tuning, concurrent programming, and microservices design patterns with Spring Boot. It underpins most product modules including OCS, CBM, and the integration framework.`;
  if (/python/.test(s)) return `Python is used at Netcracker primarily for automation, monitoring scripts, SVT tooling, and data pipeline development. Teams in SVT, SDSI monitoring, and R&D use it for test automation frameworks, performance analysis, and DevOps tooling. Senior-level usage includes building REST API wrappers and data analysis pipelines for operational intelligence.`;
  if (/docker/.test(s)) return `Docker provides the containerisation foundation for Netcracker's cloud deployment model, packaging BSS/OSS components for consistent deployment across environments. It is used extensively in CI/CD pipelines and as the build artefact format for Kubernetes deployments. Engineers are expected to write multi-stage Dockerfiles, manage image registries, and understand networking and volume management.`;
  return `${skill} is a technical skill used across Netcracker's engineering functions. In the context of BSS/OSS telecom software, it contributes to platform development, system integration, or operational capabilities. Teams leveraging this skill typically work on product delivery or managed services engagements for Tier 1/2 telecom operators globally.`;
}
