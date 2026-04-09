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
- What separates a junior from a senior practitioner in this skill

4-6 sentences. No bullet points. Be direct, specific, and opinionated. Do NOT write generic filler. Write like a real expert.`;

  // ── Try Anthropic Claude ──────────────────────────────────────
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
        if (text) return res.status(200).json({ insight: text, source: 'claude', label: 'Claude AI' });
      } else {
        const errText = await r.text();
        console.error('Claude API error:', r.status, errText);
      }
    } catch(e) { console.error('Claude fetch error:', e.message); }
  }

  // ── Knowledge base fallback ───────────────────────────────────
  const { insight, matched } = getDomainInsight(skill);
  return res.status(200).json({
    insight,
    source: matched ? 'knowledge-base' : 'generic',
    label: matched ? 'Internal Knowledge Base' : 'Generic Fallback',
  });
}

function getDomainInsight(skill) {
  // IMPORTANT: more specific patterns FIRST, broad ones LAST
  // Each entry: [regex, insight text]
  const s = skill.toLowerCase().trim().replace(/\s+/g, ' ');

  const kb = [
    // ── BSS/OSS Domain skills first (most specific) ──────────────
    [/bss.?migr|data.?migr|migrat/,
     `BSS Migration at Netcracker involves extracting subscriber data, billing history, product configurations, and network inventory from a customer's legacy system (often Ericsson, Amdocs, or Comverse) and transforming it into Netcracker's data model — typically covering 5–50 million subscribers with zero tolerance for data loss. The engineering discipline requires PL/SQL or Python ETL pipeline design with automated reconciliation reports that prove 100% record-count accuracy at every stage. A delta migration strategy handles the cutover weekend (last 24–48 hours of changes) while the main load runs weeks ahead. Senior engineers build validation frameworks that compare source and target systems record-by-record and generate difference reports that the customer's finance team can sign off on.`],

    [/mediat/,
     `Mediation in Netcracker's context is the process of collecting, normalising, and routing usage data — CDRs, xDRs, IPDR, and network events — from heterogeneous network elements to billing, analytics, and fraud detection systems. Netcracker's Active Mediation (AM) platform handles billions of records daily at Tier 1 customers, performing format conversion (ASN.1, CSV, XML, binary proprietary formats), duplicate detection using sliding window algorithms, and threshold-based routing to downstream consumers. The engineering challenge is zero-loss processing with sub-second latency while tolerating network element outages and format version changes. Senior engineers design the deduplication window size, backpressure strategies, and multi-path routing topologies.`],

    [/\bocs\b|online.?charg/,
     `Online Charging System (OCS) is the real-time charging engine for prepaid subscribers — it makes credit reservation and deduction decisions in under 100ms per Ro/Gy Diameter request from the PCRF or P-GW. Netcracker's OCS must handle millions of concurrent sessions with in-memory balance state distributed across a cluster. The engineering challenge is building a consistent, low-latency distributed system where losing a node cannot result in double-charging (financial loss) or false balance exhaustion (denial of service). Senior engineers design the distributed lock strategy, balance reservation expiry logic, and the quota management algorithm that minimises round-trips to the network while not over-granting credit.`],

    [/\bcrm\b|customer.?rel/,
     `CRM in Netcracker's BSS context manages the full subscriber lifecycle — account creation, service ordering, complaint handling, and agent/retail channel interactions — typically integrated with the POC (Product Offering Catalog) for configurable bundle offers. Engineers work on the CSRD (Customer Sales Representative Desktop) UI and REST/SOAP integrations with third-party CRM systems like Salesforce or Microsoft Dynamics. The domain challenge is handling concurrent order modifications from multiple channels (web self-service, retail agent, IVR) without race conditions on subscriber state, and managing the rollback of partial order failures across multiple downstream BSS systems.`],

    [/\bbilling\b|cbm|rbm|revenue.?mgmt/,
     `BSS Billing at Netcracker spans Customer Billing Management (CBM) and Rating & Billing Management (RBM) — systems that rate usage records, apply tariff rules, calculate charges, generate invoices, and manage the financial lifecycle for B2B and B2C subscribers. The engineering complexity is correctness under scale: re-rating millions of historical CDRs retroactively when a tariff changes, handling multi-currency taxation rules across 40+ countries simultaneously, and generating legally compliant invoices within regulatory deadlines. Senior engineers understand the distinction between real-time online charging (OCS/Diameter) and offline batch billing cycles and design the billing engine's re-rating and adjustment workflows.`],

    [/product.?cat|poc\b|catalog/,
     `The Product Offering Catalog (POC) in Netcracker's BSS suite is the central repository of all telecom products, bundles, prices, and eligibility rules — it drives what can be sold, how it is priced, and what can be combined. Engineers work on the data model for hierarchical product structures (bundle → component → resource), price plan versioning for retroactive price changes, and the catalog API that feeds order management, CRM, and self-service portals. The complexity at Tier 1 operators is managing 50,000+ product variants with overlapping eligibility rules and ensuring catalog changes don't break existing subscriber entitlements.`],

    // ── Databases (specific before generic) ──────────────────────
    [/mongo.?db|mongodb/,
     `MongoDB is used in Netcracker for flexible document storage where schema evolution is frequent and hierarchical data structures are natural — primarily in the product catalog, configuration management, and session/state storage layers. Telecom product offerings change constantly (new bundles, price plans, eligibility rules) and a rigid relational schema with ALTER TABLE migrations creates unacceptable deployment friction. The production concern at scale is aggregation pipeline performance on large catalog datasets and managing the oplog for real-time change streams that trigger downstream provisioning events. Senior engineers design the shard key strategy for horizontal scaling and implement optimistic concurrency for concurrent catalog updates.`],

    [/cassandra/,
     `Apache Cassandra is Netcracker's choice for high-write-throughput, geographically distributed data — subscriber session state in OCS, real-time balance tracking, and usage counters that must survive datacenter failures without a primary/replica failover delay. The key Cassandra skill at Netcracker is data modelling for query patterns: Cassandra is query-first, not entity-first, and inappropriate partition key choices cause hotspots that degrade performance precisely during peak billing windows. Senior engineers model the balance table to distribute subscriber IDs evenly across vnodes and use lightweight transactions (LWT) sparingly because they kill throughput.`],

    [/\bpostgres|postgresql/,
     `PostgreSQL is the strategic database for Netcracker's cloud-native product generation — Cloud BSS and Cloud OSS use Postgres (typically AWS RDS Aurora or a Kubernetes-managed operator) replacing Oracle for new greenfield deployments. Engineers must understand Postgres-specific optimisations like BRIN indexes for time-series billing data (vastly smaller than B-tree for append-only CDR tables), logical replication for zero-downtime schema migrations, and PgBouncer connection pooling critical when 200+ microservices simultaneously connect to the billing database. The move from Oracle to Postgres also requires rewriting PL/SQL stored procedures into PL/pgSQL or application-layer logic.`],

    [/\boracle\b/,
     `Oracle Database is the primary relational store for Netcracker's on-premise BSS products — CBM, NRM, and OCS all have Oracle-based persistence layers with schemas refined over 20+ years of telecom deployments. Senior DBAs at Netcracker manage range-partitioned billing tables (partitioned by billing cycle month for fast purge), RAC (Real Application Clusters) for HA across two nodes, and Dataguard standby for DR — all within strict customer change-freeze windows that allow only 2-hour maintenance slots. The critical operational skill is reading Oracle AWR reports to diagnose slow rating queries during billing run windows.`],

    [/pl.?sql|plsql/,
     `PL/SQL is the language of Netcracker's data migration, configuration scripting, and legacy integration layers — most BSS products historically used Oracle as the database, and a large body of stored procedures, triggers, and packages implement billing rules, data transformation, and reconciliation reports. The practical skill is writing performant bulk operations using FORALL and BULK COLLECT for million-row billing data migrations, and reading Oracle execution plans with EXPLAIN PLAN to fix slow rating queries that run during billing windows. Senior engineers design PL/SQL frameworks that generate migration difference reports comparing source and target schemas.`],

    [/redis/,
     `Redis is used in Netcracker for high-speed caching and session state management where sub-millisecond read latency matters — rate plan cache to avoid Oracle roundtrips during real-time charging, session tokens for the self-service portal, and distributed locks for concurrent order processing. The engineering concern is cache invalidation correctness: a stale rate plan cache during a tariff change event can cause incorrect charges applied to thousands of subscribers before the cache TTL expires. Senior engineers implement cache-aside patterns with explicit invalidation on catalog change events rather than relying solely on TTL.`],

    // ── Messaging ────────────────────────────────────────────────
    [/\bkafka\b/,
     `Apache Kafka is Netcracker's backbone for real-time event streaming between BSS/OSS components — it carries CDR streams from mediation to billing, propagates order state changes across microservices, and enables async integration between OCS and CBM without tight coupling. Unlike REST calls, Kafka decouples producers from consumers so a billing engine restart doesn't drop events. Senior engineers design topic partition strategies for telecom load (millions of CDRs/hour), implement exactly-once semantics for financial transactions, tune consumer group lag for SLA compliance, and own the schema registry that prevents breaking changes across 20+ microservice consumers.`],

    [/rabbit|rabbitmq/,
     `RabbitMQ is used at Netcracker for task queuing and workflow orchestration where guaranteed delivery and complex routing matter more than raw Kafka throughput — common in order processing pipelines where a failed step must retry with backoff and eventually route to a dead-letter queue for manual investigation. The exchange/queue routing model (fanout, topic, direct) suits orchestrating multi-step BSS processes like the create-order → provision → activate → bill lifecycle. Senior engineers design dead-letter queue strategies and poison message alerting critical for telecom order fallout management where a stuck order means a customer can't activate their service.`],

    // ── Containers & Cloud ────────────────────────────────────────
    [/\bkubernetes\b|k8s/,
     `Kubernetes is the deployment substrate for all Netcracker cloud-native product modules — BSS, OSS, and NRM components run as Helm-deployed workloads on customer-managed clusters or hyperscaler environments (AWS EKS, Azure AKS). Architects at Netcracker design namespace isolation between product tenants, HPA policies tied to CDR processing load, and rolling upgrade strategies that maintain 99.99% uptime for live billing systems. The jump from junior to senior is understanding how StatefulSets handle Oracle RAC or Cassandra nodes differently from stateless microservices, and how Istio service mesh provides mutual TLS for PCI-compliant billing data flows between components.`],

    [/openshift/,
     `OpenShift is Red Hat's enterprise Kubernetes distribution and is the mandated deployment platform for several Netcracker European operator customers running on-premise air-gapped environments. It adds Security Context Constraints (SCCs) that frequently break standard Kubernetes manifests written assuming root container access — Netcracker engineers must adapt Helm charts to run with non-root UIDs and read-only root filesystems. Senior engineers handle SCC policy negotiation with the operator's security team and manage the OpenShift Operator Lifecycle Manager for product upgrades.`],

    [/\bdocker\b/,
     `Docker provides the container packaging standard for Netcracker's CI/CD pipeline — every product component ships as a multi-stage Docker image built in Jenkins, pushed to a private registry, and deployed via Helm. The critical skill is writing lean production images (Alpine-based, no dev tools, non-root user, pinned base image digest) since customer security scans reject images with known CVEs and Netcracker must deliver a clean scan report as part of the product release. Senior engineers own the base image strategy, shared layer caching for 50+ microservice builds, and the image signing workflow for supply-chain security compliance.`],

    [/\baws\b|amazon.?web/,
     `AWS is Netcracker's primary hyperscaler for cloud-hosted managed services — products like Cloud BSS and Cloud OSS run on EKS with RDS Aurora for relational data, MSK (managed Kafka) for streaming, and S3 for billing archive storage. Key AWS skills include architecting multi-AZ deployments for five-9s billing availability, using IAM roles for Kubernetes service accounts (IRSA) to avoid hardcoded credentials, and implementing AWS Cost Explorer dashboards that showback cloud spend per operator customer. The operational challenge is managing customer-specific AWS accounts with different organization policies while deploying the same Netcracker product stack.`],

    [/\bazure\b/,
     `Azure is Netcracker's second major cloud platform used for European operator deployments where data sovereignty requirements prevent AWS. AKS (Azure Kubernetes Service) is paired with Azure Service Bus or Event Hubs for messaging and Azure AD for enterprise SSO integration with operator identity systems. Senior engineers manage Terraform modules for reproducible Azure landing zones, handle Azure Policy guardrails that operators' cloud governance teams impose, and navigate the AKS upgrade cycle which is faster than on-premise Kubernetes versions operators previously managed.`],

    // ── Languages ────────────────────────────────────────────────
    [/\bjava\b/,
     `Java is the primary implementation language of Netcracker's BSS/OSS product suite — the billing engine, order management framework, mediation platform, and most integration adapters are all Java 11/17. Senior-level expectation includes JVM internals: heap tuning for long-running billing batch jobs with GC pause budgets under 200ms, profiling with JFR for CDR processing throughput bottlenecks, and designing thread-safe concurrent processing for parallel order execution. Junior engineers write business logic in Spring Boot services; architects design module boundaries, shared library versioning strategies, and Java microservice performance contracts that guarantee sub-second order API response times under 1000 concurrent users.`],

    [/\bpython\b/,
     `Python at Netcracker is the language of automation, tooling, and data pipelines — SVT teams use pytest frameworks for end-to-end system verification, SDSI monitoring teams write Ansible playbooks and Prometheus exporters, and R&D uses it for rapid prototyping of ML-based anomaly detection on network data. The production concern is understanding Python's GIL: use multiprocessing, not threading, for CPU-bound CDR analysis. Senior engineers package Python tools as Docker images for deployment in air-gapped operator environments where pip access to PyPI is blocked, requiring a vendored dependency bundle.`],

    [/\bgolang\b|\bgo\b(?!.*mongo)/,
     `Go (Golang) is used at Netcracker in performance-critical infrastructure components — monitoring agents, sidecar proxies, and high-throughput data collectors where Java's JVM startup time and memory overhead are unacceptable. Teams in SDSI and R&D write Go for tools that must start in milliseconds inside Kubernetes init containers. Senior Go engineers at Netcracker leverage goroutines for concurrent CDR parsing and use pprof extensively — the language's simplicity is deceptive; production telecom-grade Go requires deep understanding of escape analysis and interface method dispatch costs.`],

    [/\bc\+\+|cpp\b/,
     `C++ is used in Netcracker's NRM (Rating & Billing Management) core engine and some OCS real-time charging components where microsecond-level latency is required for online charging decisions in prepaid scenarios. This is legacy but business-critical code running real-time charging for hundreds of millions of subscribers at Tier 1 customers. Senior C++ engineers deal with memory management, lock-free data structures for concurrent CDR rating, and SIMD optimisations for high-volume usage record processing within strict latency budgets.`],

    [/pl.?sql|plsql/,
     `PL/SQL is the language of Netcracker's data migration and legacy billing configuration — stored procedures, triggers, and packages implement billing rules, data transformation, and reconciliation reports on Oracle. The practical skill is writing performant bulk operations (FORALL, BULK COLLECT) for million-row migrations and diagnosing slow rating queries via Oracle AWR reports. Senior engineers design PL/SQL migration frameworks that produce row-by-row difference reports for finance team sign-off.`],

    [/\bspring\b|spring.?boot/,
     `Spring Boot is Netcracker's standard Java application framework for microservices — REST APIs, event-driven consumers, and batch jobs across the BSS/OSS suite. Senior engineers go beyond @RestController: they tune HikariCP connection pools for Oracle/Postgres under billing load, implement Resilience4j circuit breakers for downstream BSS dependencies that have planned maintenance windows, and design Spring Security configurations for mutual TLS in Kubernetes service mesh environments. Understanding Spring's autoconfiguration internals prevents bean definition conflicts when composing multiple Netcracker product modules.`],

    // ── DevOps ───────────────────────────────────────────────────
    [/\bansible\b/,
     `Ansible is Netcracker's primary configuration management and deployment automation tool for on-premise operator environments — used to provision VMs, configure middleware (WebLogic, JBoss, Tomcat), deploy product packages, and run post-deployment health checks. The practical skill is writing idempotent playbooks safe to re-run after a partially-failed deployment, and managing complex inventory with 200+ hosts and operator-specific variable overrides. Senior engineers design Ansible roles that abstract operator-specific differences (network topology, OS version, storage layout) behind a clean interface that product engineering teams can use without knowing each customer's infrastructure details.`],

    [/\bjenkins\b/,
     `Jenkins orchestrates Netcracker's build and release pipelines across the product portfolio — multibranch pipelines build and unit-test every commit, release pipelines produce versioned Helm chart artefacts, and deployment pipelines drive operator environment updates. The engineering skill beyond basic Jenkinsfile authoring is shared library development (encapsulating Netcracker's standard pipeline stages as reusable Groovy), managing 50+ concurrent build agents, and integrating SonarQube quality gates and container image security scans without creating false failures that block product releases. Senior engineers design the pipeline architecture for a new product stream from scratch.`],

    [/terraform/,
     `Terraform is used at Netcracker for infrastructure-as-code across cloud deployments — provisioning EKS clusters, RDS instances, VPCs, and IAM roles for operator-specific AWS or Azure environments in a reproducible, version-controlled way. The practical challenge is managing Terraform state for 20+ operator environments without state locking conflicts, and designing module abstractions that let the same Terraform codebase deploy to AWS and Azure with environment-specific variable files. Senior engineers design the remote state backend strategy and implement Terraform CI/CD pipelines that run plan on PR and apply on merge.`],

    [/devops|ci.?cd/,
     `DevOps at Netcracker means owning the end-to-end software delivery pipeline for a product that must be deployed at 20+ unique operator environments globally, each with different security policies, network topologies, and change management processes. Practical work involves Jenkins/GitLab pipelines that build, test, and package Helm charts; Ansible playbooks for environment provisioning; and release management tooling tracking which component version is deployed where. The seniority gap is designing pipelines that work in air-gapped, offline environments — many operators mandate no internet access, requiring local mirrors of container registries, Helm repositories, and npm/Maven/pip packages.`],

    // ── Monitoring ───────────────────────────────────────────────
    [/grafana/,
     `Grafana is Netcracker's standard dashboarding platform for operational visibility — monitoring teams build dashboards that visualise CDR processing throughput, billing engine batch progress, Kubernetes pod health, and JVM metrics across operator deployments. The practical skill is writing PromQL queries that surface meaningful SLA metrics (p99 CDR processing latency, billing run duration trends) rather than just raw counters, and designing dashboard layouts that an on-call NOC engineer can interpret at 2am. Senior engineers build reusable Grafana provisioning templates (JSON model files) deployed automatically via Ansible so every new operator environment gets standardised dashboards on day one.`],

    [/prometheus/,
     `Prometheus is the metrics collection backbone for Netcracker's cloud deployments — scraping JVM metrics, Kafka consumer lag, Kubernetes resource utilisation, and custom business metrics (orders processed/minute, CDRs rated/second) from all components. The engineering skill is instrumenting Java microservices with Micrometer to expose business-meaningful metrics (not just HTTP request counts) and writing alerting rules in Prometheus that fire before an SLA breach rather than after. Senior engineers design the Prometheus federation topology for multi-cluster deployments and manage cardinality explosions that cause Prometheus OOM in high-label-count environments.`],
  ];

  for (const [rx, insight] of kb) {
    if (new RegExp(rx.source, 'i').test(s)) {
      return { insight, matched: true };
    }
  }

  return {
    insight: `No specific knowledge base entry exists for "${skill}" yet. To get a detailed technical breakdown, ensure the ANTHROPIC_API_KEY environment variable is set in your Vercel project settings — once configured, clicking AI Insight will call Claude with Netcracker-specific context to generate a principal-engineer-level explanation covering architecture patterns, telecom domain relevance, and seniority expectations for this skill.`,
    matched: false,
  };
}
