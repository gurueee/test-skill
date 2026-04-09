export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { skill, context } = req.body;
  if (!skill) return res.status(400).json({ error: 'skill required' });

  const prompt = `You are a principal engineer and technical architect at Netcracker Technology, a global BSS/OSS telecom software company that builds billing, ordering, mediation, and network management products for Tier 1 operators like Verizon, NTT, Etisalat, and SingTel.

A team member wants to understand the skill: "${skill}"
${context ? `\nInternal context from our database: ${context}` : ''}

Write a rich, specific technical insight as if you are personally explaining this to a mid-level engineer joining your team. Cover:
- Exactly what "${skill}" is (be technically precise, not vague)
- Why it is specifically important in telecom BSS/OSS engineering at Netcracker
- How it is actually used day-to-day or in architecture (give concrete examples)
- What separates a junior from senior practitioner in this skill

4-6 sentences. No bullet points. Be direct, specific, and opinionated. Do NOT write generic responses like "this skill contributes to platform development". Write like a real expert.`;

  // ── Try Anthropic Claude ─────────────────────────────────────
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
          max_tokens: 500,
          system: 'You are a principal engineer at a telecom BSS/OSS company. Give specific, expert-level technical insights. Never be vague or generic.',
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (r.ok) {
        const data = await r.json();
        const text = data.content?.[0]?.text;
        if (text) return res.status(200).json({ insight: text, source: 'claude' });
      }
    } catch(e) { console.error('Claude error:', e.message); }
  }

  // ── Fallback: domain-specific knowledge base ─────────────────
  return res.status(200).json({
    insight: getDomainInsight(skill),
    source: 'knowledge-base',
  });
}

// Deep domain knowledge base — specific to Netcracker/telecom context
function getDomainInsight(skill) {
  const s = skill.toLowerCase().trim();

  const kb = [
    // Messaging & Streaming
    [/\bkafka\b/, `Apache Kafka is Netcracker's backbone for real-time event streaming between BSS/OSS components — it carries CDR (Call Detail Record) streams from mediation to billing, propagates order state changes across microservices, and enables async integration between OCS and CBM. Unlike REST calls, Kafka decouples producers from consumers so a billing engine outage doesn't drop events. Senior engineers are expected to design topic partition strategies for telecom load (millions of CDRs/hour), implement exactly-once semantics for financial data, and tune consumer group lag for SLA compliance. Junior engineers typically just produce/consume; architects own the schema registry, retention policies, and disaster recovery topology.`],
    [/rabbit|rabbitmq|mq\b/, `RabbitMQ is used at Netcracker for task queuing and workflow orchestration where guaranteed delivery and complex routing matter more than raw throughput — common in order processing pipelines and mediation workflows. Unlike Kafka's log-based model, RabbitMQ's exchange/queue model allows fine-grained message routing (fanout, topic, direct) which suits orchestrating multi-step BSS processes. Senior engineers design dead-letter queue strategies and poison message handling critical for telecom order fallout management.`],

    // Container & Cloud
    [/\bkubernetes\b|k8s/, `Kubernetes is the deployment substrate for all Netcracker cloud-native product modules — BSS, OSS, and NRM components run as Helm-deployed workloads on customer-managed clusters or hyperscaler environments (AWS EKS, Azure AKS). Architects at Netcracker design namespace isolation between product tenants, HPA policies tied to CDR processing load, and rolling upgrade strategies that maintain 99.99% uptime for live billing systems. The jump from junior to senior is understanding how StatefulSets handle Oracle RAC or Cassandra nodes differently from stateless microservices, and how Istio service mesh provides mutual TLS for PCI-compliant billing data.`],
    [/\bdocker\b/, `Docker provides the container packaging standard for Netcracker's CI/CD pipeline — every product component from CBM to OCS ships as a multi-stage Docker image built in Jenkins, pushed to a private registry, and deployed via Helm. The critical skill at Netcracker is writing lean production images (Alpine-based, no dev tools, specific user permissions) since customer security scans reject images with CVEs. Senior engineers own the base image strategy, layer caching optimisation for 50+ microservice builds, and container runtime security hardening for on-premise operator deployments.`],
    [/openshift/, `OpenShift is Red Hat's enterprise Kubernetes distribution and is the mandated deployment platform for several Netcracker's European operator customers who run on-premise. It adds an extra security layer (SCCs — Security Context Constraints) that often breaks standard Kubernetes manifests written assuming root access, so Netcracker engineers must adapt Helm charts specifically for OpenShift. Senior engineers handle the SCC policy negotiation with customer security teams and manage the OpenShift operator lifecycle for upgrades.`],
    [/\baws\b|amazon web/, `AWS is Netcracker's primary hyperscaler for cloud-hosted managed services deployments — products like Cloud BSS and Cloud OSS run on EKS with RDS Aurora for relational data and MSK (managed Kafka) for streaming. Key AWS skills at Netcracker include architecting multi-AZ deployments for five-9s billing availability, using IAM roles for service-to-service auth inside the cluster, and cost governance across DR and production environments billed back to the operator customer.`],
    [/\bazure\b/, `Azure is Netcracker's second major cloud platform, used for European operator deployments where data sovereignty requirements prevent AWS. The AKS (Azure Kubernetes Service) is paired with Azure Service Bus or Event Hubs for messaging, and Azure AD for enterprise SSO. Senior engineers manage Terraform modules for reproducible Azure landing zones and handle the Azure Policy guardrails operators' cloud teams impose on Netcracker's deployment.`],

    // Languages
    [/\bjava\b/, `Java is the primary implementation language of Netcracker's BSS/OSS product suite — the billing engine, order management framework, mediation platform, and most integration adapters are all Java 11/17. The expectation at senior level is JVM internals: heap tuning for long-running billing batch jobs (GC pause budgets under 200ms), profiling with JFR for CDR processing throughput bottlenecks, and designing thread-safe concurrent processing for parallel order execution. Junior engineers write business logic in Spring Boot services; architects design the module boundaries, shared library versioning strategy, and Java microservice performance contracts.`],
    [/\bpython\b/, `Python at Netcracker is the language of automation, tooling, and data — SVT teams use pytest frameworks for end-to-end system verification, SDSI monitoring teams write Ansible playbooks and custom Icinga/Prometheus exporters, and R&D uses it for rapid prototyping of ML-based anomaly detection in network data. The gap between junior and senior is understanding when Python's GIL kills parallelism (use multiprocessing not threading for CPU-bound CDR analysis) and how to package Python tools for deployment in air-gapped operator environments without pip access.`],
    [/golang|go\b/, `Go (Golang) is used at Netcracker in performance-critical infrastructure components — monitoring agents, sidecar proxies, and high-throughput data collectors where Java's JVM startup time and memory overhead are unacceptable. Teams in SDSI and R&D write Go for tools that must start in milliseconds inside Kubernetes init containers. Senior Go engineers at Netcracker leverage goroutines for concurrent CDR parsing and use pprof extensively — the language's simplicity is deceptive; production telecom-grade Go requires deep understanding of escape analysis and interface method dispatch costs.`],
    [/\bc\+\+|cpp/, `C++ is used in Netcracker's NRM (Rating & Billing Management) core engine and some OCS real-time charging components where microsecond-level latency is required for online charging decisions in prepaid scenarios. This is legacy but business-critical code running real-time charging for hundreds of millions of subscribers at customers like NTT. Senior C++ engineers here deal with memory management, lock-free data structures for concurrent rating, and SIMD optimisations for high-volume usage record processing.`],
    [/pl\/sql|plsql/, `PL/SQL is the language of Netcracker's data migration, configuration, and legacy integration layers — most BSS products historically used Oracle as the database, and a large body of stored procedures, triggers, and packages implement billing rules, data transformation, and report generation. The practical skill is writing performant bulk operations (FORALL, BULK COLLECT) for million-row billing data migrations and understanding Oracle execution plan analysis with EXPLAIN PLAN for slow rating queries.`],

    // Databases
    [/oracle/, `Oracle Database is the primary relational store for Netcracker's on-premise BSS products — CBM, NRM, and OCS all have Oracle-based persistence layers with schemas refined over 20+ years. Senior DBAs at Netcracker manage partitioned billing tables (range partitioning by billing cycle), RAC (Real Application Clusters) for HA, and Dataguard for DR — all within strict customer change-freeze windows. The move to cloud is happening but most customer production systems still run Oracle 12c/19c on-premise.`],
    [/postgres|postgresql/, `PostgreSQL is the strategic database for Netcracker's cloud-native product generation — Cloud BSS and Cloud OSS use Postgres (typically on AWS RDS Aurora or managed Kubernetes operators) replacing Oracle for new deployments. Engineers must understand Postgres-specific optimisations like BRIN indexes for time-series billing data, logical replication for zero-downtime schema migrations, and connection pooling via PgBouncer critical when 200+ microservices hit the same billing database.`],
    [/cassandra/, `Apache Cassandra is Netcracker's choice for high-write-throughput, geographically distributed data — subscriber session state in OCS, real-time balance tracking, and usage counters that must survive datacenter failures. The key Cassandra skill at Netcracker is data modelling for query patterns (Cassandra is query-first, not entity-first) and understanding how inappropriate partition key choices cause hotspots that kill performance during peak billing windows.`],
    [/mongodb|mongo/, `MongoDB is used for flexible document storage in Netcracker's product catalog and configuration management layers where schema evolution is frequent — telecom product offerings change constantly and a rigid relational schema creates deployment friction. The production concern at scale is aggregation pipeline performance on large catalog datasets and managing the oplog for real-time change streams that trigger downstream provisioning.`],

    // BSS/OSS Domain
    [/mediation/, `Mediation in Netcracker's context is the process of collecting, normalising, and routing usage data (CDRs, xDRs, network events) from network elements to billing and analytics systems. Netcracker's Active Mediation (AM) platform handles billions of records daily at Tier 1 customers, doing format conversion, duplicate detection, and threshold-based routing. The engineering challenge is zero-loss processing with sub-second latency while handling heterogeneous input formats from 50+ network vendors.`],
    [/billing|cbm|rbm/, `BSS billing at Netcracker encompasses Customer Billing Management (CBM) and Rating & Billing Management (RBM) — systems that calculate charges, generate invoices, and manage the financial lifecycle for B2B and B2C telecom subscribers. The engineering complexity is correctness under scale: re-rating millions of historical CDRs when a tariff changes, handling multi-currency taxation rules across 40+ countries, and producing legally compliant invoices within regulatory deadlines. Senior engineers understand the difference between real-time charging (OCS/Diameter) and batch billing cycles and when each applies.`],
    [/ocs|online charg/, `Online Charging System (OCS) is the real-time charging engine for prepaid subscribers — it makes credit reservation decisions in under 100ms per Ro/Gy Diameter request from the network. Netcracker's OCS (part of the RBM suite) must handle millions of concurrent sessions with in-memory balance state. The engineering challenge is building a consistent, low-latency distributed system where losing a node cannot result in financial loss (double-charging) or denial of service (false balance exhaustion).`],
    [/crm|customer rel/, `CRM in Netcracker's BSS context is the customer-facing layer managing subscriber lifecycle, order capture, complaints, and service fulfillment — typically integrated with the POC (Product Offering Catalog) for configurable offer bundles. Engineers work on the CSRD (Customer Sales Representative Desktop) and integrations with third-party CRM systems like Salesforce via REST/SOAP adapters. The domain challenge is handling concurrent order modifications from multiple channels (retail, online, agent) without race conditions on subscriber state.`],
    [/migration|data migr/, `BSS Migration at Netcracker involves extracting subscriber data, billing history, product configurations, and network inventory from a customer's legacy system (often competitors like ERICSSON/AMDOCS) and transforming it into Netcracker's data model — typically for 5-50 million subscribers with zero-tolerance for data loss. The engineering discipline is PL/SQL or Python ETL pipeline design with reconciliation reports proving 100% record count accuracy, delta migration for cutover weekend, and rollback capability. Senior engineers build automated validation frameworks that compare source and target systems record-by-record.`],
    [/devops|ci.?cd|pipeline/, `DevOps at Netcracker means owning the end-to-end software delivery pipeline for a product that must be deployed at 20+ unique operator environments globally, each with different security policies, network topologies, and change management processes. The practical work involves Jenkins/GitLab pipelines that build, test, and package Helm charts; Ansible playbooks for environment provisioning; and release management tooling that tracks which version of which component is deployed where. The seniority gap is understanding how to design pipelines that work in air-gapped, offline environments which many operators mandate.`],
    [/ansible/, `Ansible is Netcracker's primary configuration management and deployment automation tool for on-premise operator environments — used to provision VMs, configure middleware (WebLogic, JBoss), deploy product packages, and run post-deployment health checks. The practical skill is writing idempotent playbooks (safe to re-run) with proper error handling for partially-failed deployments, and managing inventory for 200+ host environments with complex variable inheritance. Senior engineers design roles that abstract operator-specific differences behind a clean interface.`],
    [/jenkins/, `Jenkins orchestrates Netcracker's build and release pipelines across the product portfolio — multibranch pipelines build and unit-test every commit, release pipelines produce versioned artefacts, and deployment pipelines drive operator environment updates. The engineering skill beyond basic Jenkinsfile authoring is shared library development (encapsulating Netcracker's standard pipeline logic), agent management at scale (50+ concurrent builds), and integrating quality gates (SonarQube, security scans) without creating false failures that block releases.`],
    [/spring|springboot|spring boot/, `Spring Boot is Netcracker's standard Java application framework for microservices — used to build REST APIs, event-driven consumers, and batch processing jobs across the BSS/OSS product suite. Senior engineers go beyond @RestController and @Service; they tune HikariCP connection pools for Oracle/Postgres, implement circuit breakers (Resilience4j) for downstream BSS dependencies, and design Spring Security configurations for mutual TLS in Kubernetes service mesh environments. Understanding Spring's autoconfiguration internals prevents the class of bugs where two modules conflict on bean definitions.`],
  ];

  for (const [rx, insight] of kb) {
    if (rx.test(s)) return insight;
  }

  // Last resort — still specific to domain, not generic waffle
  return `"${skill}" is a specialised capability within Netcracker's engineering landscape. To get a precise technical breakdown, click the AI Insight button above (requires Anthropic API key in environment variables) — it will query Claude with Netcracker-specific context and give you a principal-engineer-level explanation covering architecture patterns, telecom domain relevance, and what separates junior from senior practitioners in this skill. You can also search our internal glossary for terminology definitions.`;
}
