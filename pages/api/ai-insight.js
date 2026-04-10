export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { skill, context } = req.body;
  if (!skill) return res.status(400).json({ error: 'skill required' });

  const prompt = `You are a principal engineer at Netcracker Technology, a BSS/OSS telecom software company.
Skill: "${skill}"
${context ? `Context: ${context}` : ''}
Give a 4-5 sentence expert insight: what it is, why it matters in telecom BSS/OSS, how it is used at Netcracker, junior vs senior expectations. Be specific and technical.`;

  // Try Gemini first
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
          }),
        }
      );
      if (r.ok) {
        const d = await r.json();
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return res.status(200).json({ insight: text, source: 'gemini', label: 'Gemini AI' });
      }
      const err = await r.json().catch(()=>({}));
      console.error('Gemini insight error:', r.status, err?.error?.message);
    } catch(e) { console.error('Gemini fetch error:', e.message); }
  }

  // Try OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini', max_tokens: 500,
          messages: [
            { role: 'system', content: 'You are a principal engineer at Netcracker Technology, a BSS/OSS telecom software company. Give expert technical insights.' },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (r.ok) {
        const d = await r.json();
        const text = d.choices?.[0]?.message?.content;
        if (text) return res.status(200).json({ insight: text, source: 'openai', label: 'ChatGPT' });
      }
    } catch(e) { console.error('OpenAI insight error:', e.message); }
  }

  // Try Claude as fallback
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
      });
      if (r.ok) {
        const data = await r.json();
        const text = data.content?.[0]?.text;
        if (text) return res.status(200).json({ insight: text, source: 'claude', label: 'Claude AI' });
      }
      console.error('Claude insight failed:', r.status);
    } catch(e) { console.error('Claude fetch error:', e.message); }
  }

  // Knowledge base fallback
  const { insight, matched } = getKBInsight(skill);
  return res.status(200).json({
    insight,
    source: matched ? 'knowledge-base' : 'generic',
    label:  matched ? 'Knowledge Base' : 'Generic',
  });
}

function getKBInsight(skill) {
  const s = skill.toLowerCase().trim();

  const kb = [
    [/\bsql\b/, `SQL (Structured Query Language) is the fundamental language for querying and manipulating relational databases — at Netcracker it is used daily for billing data analysis, migration scripts, performance tuning, and ad-hoc investigation of production issues on Oracle and PostgreSQL databases. Every BSS/OSS engineer interacts with SQL: developers write queries to inspect CDR processing results, DBAs write complex joins to reconcile billing discrepancies, and migration engineers write bulk INSERT/UPDATE scripts for subscriber data moves. Senior practitioners write execution-plan-aware queries with index hints, use window functions for billing period analysis, and understand how query plans differ between Oracle and Postgres. Junior engineers typically write basic SELECT/JOIN queries; the jump to senior is optimising queries that process millions of rows within billing window time constraints.`],
    [/bss.?migr|data.?migr|migrat/, `BSS Migration at Netcracker involves extracting subscriber data, billing history, and product configurations from a customer's legacy system and transforming it into Netcracker's data model — typically covering 5–50 million subscribers with zero tolerance for data loss. The engineering discipline requires ETL pipeline design with automated reconciliation reports proving 100% record-count accuracy, delta migration for the cutover weekend, and rollback capability. Senior engineers build validation frameworks comparing source and target systems record-by-record with difference reports the customer's finance team signs off on.`],
    [/mediat/, `Mediation in Netcracker's context is the process of collecting, normalising, and routing usage data (CDRs, xDRs, network events) from network elements to billing and analytics systems. Netcracker's Active Mediation platform handles billions of records daily, doing format conversion, duplicate detection, and threshold-based routing. The engineering challenge is zero-loss processing with sub-second latency while handling heterogeneous input formats from 50+ network vendors.`],
    [/\bocs\b|online.?charg/, `Online Charging System (OCS) is the real-time charging engine for prepaid subscribers making credit decisions in under 100ms per Diameter Ro/Gy request. Netcracker's OCS must handle millions of concurrent sessions with in-memory balance state. Senior engineers design the distributed lock strategy, balance reservation expiry logic, and quota management algorithms that minimise network round-trips without over-granting credit.`],
    [/\bbilling\b|cbm|rbm/, `BSS Billing at Netcracker spans Customer Billing Management and Rating & Billing Management — systems that rate CDRs, apply tariff rules, generate invoices, and manage the financial lifecycle for B2B and B2C subscribers. The complexity is correctness under scale: re-rating millions of historical CDRs when a tariff changes, handling multi-currency taxation across 40+ countries, and generating legally compliant invoices within regulatory deadlines.`],
    [/mongo.?db|mongodb/, `MongoDB is used in Netcracker for flexible document storage in the product catalog and configuration layers where schema evolution is frequent. Telecom product offerings change constantly and rigid relational schemas create deployment friction. Production concerns include aggregation pipeline performance on large catalog datasets and managing the oplog for real-time change streams triggering downstream provisioning.`],
    [/cassandra/, `Apache Cassandra is Netcracker's choice for high-write-throughput distributed data — subscriber session state in OCS, real-time balance tracking, and usage counters that must survive datacenter failures. The key skill is data modelling for query patterns and understanding how inappropriate partition key choices cause hotspots during peak billing windows.`],
    [/postgres|postgresql/, `PostgreSQL is the strategic database for Netcracker's cloud-native products replacing Oracle for new deployments. Engineers use BRIN indexes for time-series billing data, logical replication for zero-downtime schema migrations, and PgBouncer connection pooling critical when 200+ microservices connect to the billing database simultaneously.`],
    [/\boracle\b/, `Oracle Database is the primary relational store for Netcracker's on-premise BSS products with schemas refined over 20+ years. Senior DBAs manage range-partitioned billing tables, RAC for HA, and Dataguard for DR within strict customer change-freeze windows. Critical skill is reading AWR reports to diagnose slow rating queries during billing runs.`],
    [/\bkafka\b/, `Apache Kafka is Netcracker's backbone for real-time event streaming — carrying CDR streams from mediation to billing, propagating order state changes across microservices, and enabling async integration between OCS and CBM. Senior engineers design topic partition strategies for millions of CDRs/hour, implement exactly-once semantics for financial data, and own the schema registry preventing breaking changes across 20+ microservice consumers.`],
    [/\bkubernetes\b|k8s/, `Kubernetes is the deployment substrate for all Netcracker cloud-native modules — BSS, OSS, and NRM run as Helm-deployed workloads on customer clusters. Architects design HPA policies tied to CDR load, StatefulSets for Oracle RAC and Cassandra, and Istio service mesh for PCI-compliant billing data flows. The seniority gap is understanding how telecom SLA requirements translate to Kubernetes resource quotas, disruption budgets, and rolling upgrade strategies.`],
    [/\bdocker\b/, `Docker provides the container packaging standard for Netcracker's CI/CD pipeline — every component ships as a multi-stage image built in Jenkins, pushed to a private registry, and deployed via Helm. Critical skill is writing lean production images that pass customer security CVE scans, managing base image strategy for 50+ microservices, and container runtime security hardening for on-premise operator deployments.`],
    [/\bjava\b/, `Java is the primary implementation language of Netcracker's BSS/OSS suite — billing engine, order management, mediation, and integration adapters are all Java 11/17. Senior level requires JVM internals: heap tuning for billing batch jobs with GC pause budgets under 200ms, JFR profiling for CDR throughput bottlenecks, and designing thread-safe concurrent processing for parallel order execution.`],
    [/\bpython\b/, `Python at Netcracker is the language of automation, tooling, and data pipelines — SVT teams use pytest for end-to-end verification, SDSI monitoring teams write Ansible playbooks and Prometheus exporters, R&D uses it for prototyping ML-based anomaly detection. Senior engineers package Python tools as Docker images for air-gapped operator environments where pip access to PyPI is blocked.`],
    [/\bspring\b|spring.?boot/, `Spring Boot is Netcracker's standard Java microservices framework. Senior engineers tune HikariCP connection pools for Oracle/Postgres under billing load, implement Resilience4j circuit breakers for downstream BSS dependencies, and design Spring Security for mutual TLS in Kubernetes service mesh. Understanding Spring's autoconfiguration internals prevents bean definition conflicts when composing product modules.`],
    [/\bansible\b/, `Ansible is Netcracker's primary deployment automation tool for on-premise operator environments — provisioning VMs, configuring middleware (WebLogic, JBoss), deploying products, and running health checks. Senior engineers write idempotent playbooks safe to re-run after partial failures and manage inventory for 200+ host environments with operator-specific variable overrides.`],
    [/\bjenkins\b/, `Jenkins orchestrates Netcracker's build and release pipelines — multibranch pipelines for every commit, release pipelines producing versioned Helm artefacts, and deployment pipelines driving operator environment updates. Senior engineers develop shared libraries encapsulating standard pipeline stages, manage 50+ concurrent build agents, and integrate SonarQube and container security scans without creating false failures.`],
    [/grafana/, `Grafana is Netcracker's standard dashboarding platform for operational visibility — monitoring teams build dashboards for CDR throughput, billing batch progress, and JVM metrics. Senior engineers write PromQL queries surfacing meaningful SLA metrics (p99 CDR latency, billing run duration trends) and build Grafana provisioning templates deployed automatically so every new operator environment gets standardised dashboards on day one.`],
    [/prometheus/, `Prometheus is the metrics collection backbone for cloud deployments — scraping JVM, Kafka consumer lag, Kubernetes resource, and custom business metrics. Senior engineers instrument Java microservices with Micrometer to expose business-meaningful metrics and write alerting rules that fire before SLA breach. Managing cardinality explosions that cause Prometheus OOM in high-label environments is a key seniority differentiator.`],
    [/pl.?sql|plsql/, `PL/SQL is the language of Netcracker's data migration and legacy billing configuration. The practical skill is writing performant bulk operations (FORALL, BULK COLLECT) for million-row migrations and reading Oracle AWR reports to fix slow rating queries. Senior engineers design PL/SQL frameworks generating row-by-row difference reports for finance team sign-off.`],
    [/\baws\b/, `AWS is Netcracker's primary hyperscaler for cloud-hosted managed services — Cloud BSS and OSS run on EKS with RDS Aurora, MSK (managed Kafka), and S3 for billing archive. Key skills include multi-AZ deployments for five-9s billing availability, IRSA for Kubernetes service account auth, and AWS Cost Explorer showback dashboards per operator customer.`],
    [/\bazure\b/, `Azure is Netcracker's second cloud platform for European operator deployments with data sovereignty requirements. AKS is paired with Azure Service Bus and Azure AD for enterprise SSO. Senior engineers manage Terraform modules for reproducible landing zones and navigate Azure Policy guardrails operators impose on Netcracker deployments.`],
    [/golang|\bgo\b(?!.*mongo)/, `Go is used at Netcracker for performance-critical infrastructure components — monitoring agents, sidecar proxies, and data collectors where JVM startup overhead is unacceptable. Teams in SDSI and R&D write Go for tools starting in milliseconds inside Kubernetes init containers. Senior engineers leverage goroutines for concurrent CDR parsing and use pprof extensively — production telecom-grade Go requires deep escape analysis understanding.`],
    [/terraform/, `Terraform is used at Netcracker for infrastructure-as-code across cloud deployments — provisioning EKS clusters, RDS instances, VPCs, and IAM roles per operator. Managing Terraform state for 20+ operator environments without locking conflicts, designing module abstractions for AWS and Azure from the same codebase, and implementing Terraform CI/CD pipelines are senior-level skills.`],
    [/\bcrm\b/, `CRM in Netcracker's BSS context manages subscriber lifecycle — account creation, service ordering, complaints, and agent/retail channel interactions. Engineers work on CSRD (Customer Sales Representative Desktop) and REST/SOAP integrations with Salesforce or Dynamics. The domain challenge is handling concurrent order modifications from multiple channels without race conditions on subscriber state.`],
    [/product.?cat|poc\b/, `The Product Offering Catalog (POC) is Netcracker's central repository of all telecom products, bundles, prices, and eligibility rules. Engineers work on hierarchical product structures, price plan versioning, and the catalog API feeding order management and self-service portals. Complexity at Tier 1 operators is managing 50,000+ product variants with overlapping eligibility rules.`],
  ];

  for (const [rx, insight] of kb) {
    if (new RegExp(rx.source, 'i').test(s)) {
      return { insight, matched: true };
    }
  }

  return {
    insight: `No built-in knowledge base entry exists for "${skill}". Add ANTHROPIC_API_KEY to Vercel environment variables and redeploy — Claude will then generate a principal-engineer-level explanation specific to this skill in the Netcracker BSS/OSS context.`,
    matched: false,
  };
}
