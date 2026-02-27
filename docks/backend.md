# VIBE CHECK — BACKEND PRD v3.0
## Agent System, Sponsor Integrations & Infrastructure

*Digital Studio Labs — February 27, 2026*

---

## TABLE OF CONTENTS

1. Vision & Architecture Overview
2. Infrastructure (Local-First, AWS Optional)
3. LLM Strategy: Fastino Primary Demo, OpenAI Backup
4. Agent Specifications (7 Agents)
5. Sponsor Tool Reference — Complete Endpoint Mapping
   - 5.1 Fastino Labs (PRIMARY DEMO — TLMs + GLiNER-2)
   - 5.2 OpenAI (BACKUP — General Reasoning)
   - 5.3 Tavily (CVE Search & Extraction)
   - 5.4 Neo4j (Knowledge Graph)
   - 5.5 Senso Context OS (Persistent Knowledge)
   - 5.6 Yutori (STRETCH — Deep Web Intelligence)
   - 5.7 AWS (OPTIONAL — Production Infra)
6. Neo4j Graph Schema
7. Database & State Schemas
8. Senso Content Architecture
9. Processing Pipeline & Data Flow
10. Build Plan (Backend Focus)

---

## 1. VISION & ARCHITECTURE OVERVIEW

VIBE CHECK is an autonomous multi-agent GitHub repository analyzer. The backend is the engine: it clones repos, builds knowledge graphs, runs 6 specialist analysis agents, searches the web for CVEs, generates fix documentation, and persists everything into Senso's Context OS.

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER: GitHub URL                                 │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR AGENT                                   │
│  Clone → Detect Stack → Dispatch Agents → Aggregate → Score             │
└──┬──────────┬──────────┬──────────┬──────────┬──────────┬───────────────┘
   │          │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼          ▼
┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐┌────────────────────┐
│ MAPPER ││QUALITY ││PATTERN ││SECURITY││ DOCTOR ││ SENSO KNOWLEDGE    │
│ AGENT  ││ AGENT  ││ AGENT  ││ AGENT  ││ AGENT  ││ AGENT              │
│        ││        ││        ││        ││        ││                    │
│ Graph  ││ Bugs & ││ Best   ││ CVEs & ││ Fix    ││ Ingest → Search → │
│ Build  ││ Smells ││ Prctce ││ Vulns  ││ Docs   ││ Generate → Learn  │
└────────┘└────────┘└────────┘└────────┘└────────┘└────────────────────┘
   │          │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼          ▼
┌──────────────────┐ ┌───────────────────┐ ┌──────────────────────────┐
│    NEO4J         │ │ FASTINO (PRIMARY) │ │    SENSO CONTEXT OS      │
│  Knowledge Graph │ │ + OPENAI (BACKUP) │ │  Persistent Knowledge    │
│  (Structure +    │ │  (TLMs + LLM      │ │  (Cross-repo intel +     │
│   Relationships) │ │   Reasoning)      │ │   Searchable findings)   │
└──────────────────┘ └───────────────────┘ └──────────────────────────┘
```

### Backend Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Runtime | Next.js 15 API Routes (Node.js) | Local-first; shared repo with frontend |
| Language | TypeScript | Shared types with frontend via contracts |
| Graph DB | Neo4j (AuraDB Free or Desktop) | Bolt protocol, neo4j driver |
| LLM (Demo) | Fastino TLMs + GLiNER-2 | 99x faster, CPU-optimized, free tier |
| LLM (Backup) | OpenAI GPT-4o | Structured outputs, tool calling |
| Web Search | Tavily API | CVE search + page extraction |
| Knowledge Base | Senso Context OS | Persistent cross-repo intelligence |
| State | SQLite (local) or in-memory JSON | Analysis records, agent status |
| Repo Storage | Local `/tmp` directory | Cloned repos |
| Real-time | WebSocket (ws library) | Agent progress streaming |
| Parsing | Tree-sitter / regex / AST | Code structure extraction |

---

## 2. INFRASTRUCTURE (LOCAL-FIRST, AWS OPTIONAL)

**Default: Everything runs locally. All sponsor APIs are cloud-hosted.**

| Component | Local Setup (DEFAULT) | AWS Optional (Stretch) |
|-----------|----------------------|----------------------|
| Backend API | Next.js API routes, localhost:3000 | Lambda + API Gateway |
| Graph DB | Neo4j AuraDB Free (cloud) or Desktop | Same |
| Repo Storage | Local `/tmp/vibe-check/repos/` | S3 bucket |
| State/DB | SQLite via better-sqlite3 | DynamoDB |
| Agent Execution | Sequential/parallel in-process | Lambda per agent |
| Frontend | Same Next.js app | Vercel |

### Environment Variables

```bash
# Required — Sponsor APIs
FASTINO_API_KEY=your_fastino_key          # Primary demo inferencing
OPENAI_API_KEY=sk-...                      # Backup reasoning
TAVILY_API_KEY=tvly-...                    # CVE search
SENSO_API_KEY=your_senso_key              # Knowledge persistence
NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
GITHUB_TOKEN=ghp_...                       # GitHub API (optional, for rate limits)

# Optional — Stretch
YUTORI_API_KEY=your_yutori_key            # Deep web research
AWS_REGION=us-east-1                       # AWS deployment
```

---

## 3. LLM STRATEGY: FASTINO PRIMARY DEMO, OPENAI BACKUP

### Why Fastino First

Fastino's Task-Specific Language Models (TLMs) are purpose-built for the exact tasks our agents perform: entity extraction, text classification, structured data parsing, and function calling. They run 99x faster than general-purpose LLMs with <150ms CPU latency. For a hackathon demo, this speed difference is dramatic and visible.

### The Dual-Provider Architecture

```typescript
// lib/llm-provider.ts — Unified LLM abstraction
interface LLMProvider {
  extractEntities(text: string, schema: string[]): Promise<EntityResult>;
  classifyText(text: string, categories: string[]): Promise<ClassifyResult>;
  extractJSON(text: string, schema: object): Promise<any>;
  reason(systemPrompt: string, userPrompt: string): Promise<string>;
  reasonStructured(systemPrompt: string, userPrompt: string, jsonSchema: object): Promise<any>;
}

// Fastino handles: extraction, classification, structured parsing
// OpenAI handles: open-ended reasoning, complex code analysis, documentation generation
```

### Agent → Provider Mapping

| Agent | Task | Primary (Fastino) | Backup (OpenAI) |
|-------|------|-------------------|-----------------|
| **Mapper** | File categorization | ✅ `classify_text` → source/test/config/docs | `gpt-4o-mini` classification |
| **Mapper** | Import/dependency extraction | ✅ `extract_entities` → package names, versions | regex fallback |
| **Mapper** | Function extraction | ✅ `extract_json` → name, params, line numbers | `gpt-4o-mini` structured |
| **Quality** | Bug classification | ✅ `classify_text` → bug/smell/dead_code/complexity | `gpt-4o` reasoning |
| **Quality** | Code analysis reasoning | Stretch: TLM function calling | ✅ `gpt-4o` structured outputs |
| **Pattern** | Anti-pattern detection | ✅ `classify_text` → anti-pattern categories | `gpt-4o` reasoning |
| **Pattern** | Best practice scoring | Stretch: TLM structured output | ✅ `gpt-4o` structured outputs |
| **Security** | CVE entity extraction | ✅ `extract_entities` → CVE IDs, versions, scores | regex fallback |
| **Security** | Vulnerability reasoning | Stretch: TLM function calling | ✅ `gpt-4o` tool calling |
| **Doctor** | Fix doc generation | Stretch: TLM text-to-JSON | ✅ `gpt-4o` generation |
| **Orchestrator** | Stack detection | ✅ `classify_text` → language/framework/build | `gpt-4o-mini` |
| **Orchestrator** | Health score computation | Local algorithm (no LLM needed) | — |

### Demo Flow — Fastino Prominently Featured

During the demo, the terminal/dashboard will show:
```
🔍 Mapper Agent: Classifying 47 files...
   ⚡ Fastino TLM: 47 classifications in 142ms (avg 3ms/file)
   → 32 source, 8 test, 4 config, 2 docs, 1 asset

🔍 Mapper Agent: Extracting dependencies...
   ⚡ Fastino GLiNER-2: 12 packages extracted in 89ms
   → express@4.17.1, react@18.2.0, next@14.0.0...

🔍 Security Agent: Parsing CVE advisories...
   ⚡ Fastino GLiNER-2: Entity extraction from 5 advisory pages in 234ms
   → CVE-2024-XXXX (CVSS 9.1), CVE-2024-YYYY (CVSS 7.8)

🔍 Quality Agent: Analyzing code patterns...
   🧠 OpenAI gpt-4o: Deep code reasoning (structured output)
   → 12 findings generated in 3.2s
```

---

## 4. AGENT SPECIFICATIONS

### Agent 1: ORCHESTRATOR

**Input:** GitHub URL
**Output:** Dispatches all agents, aggregates results, computes Health Score
**Sequence:** Clone → Detect Stack → Mapper → [Quality, Pattern, Security] parallel → Doctor → Senso Agent

```typescript
interface OrchestratorConfig {
  repoUrl: string;
  branch?: string;
  scope: 'full' | 'security-only' | 'quality-only';
  maxFiles: number;     // default 500
  useSensoIntelligence: boolean;
}

// Stack detection via Fastino classify_text
const stackDetection = await fastino.classifyText(
  packageJsonContent + fileList,
  ['next.js', 'react', 'express', 'fastapi', 'django', 'vue', 'angular', 'svelte']
);
```

**Health Score Algorithm (local, no LLM):**
```typescript
function computeHealthScore(findings: Finding[], stats: RepoStats): HealthScore {
  const weights = {
    codeQuality: 0.2,    // Quality agent findings
    patterns: 0.15,       // Pattern agent findings
    security: 0.3,        // Security agent findings (highest weight)
    dependencies: 0.2,    // Dependency freshness + CVEs
    architecture: 0.15    // Structure patterns
  };

  // Each category: 10 - (critical * 3 + warning * 1 + info * 0.2), clamped 0-10
  // Overall: weighted sum * 10, mapped to letter grade
  // Letter grades: A+ (97-100), A (93-96), A- (90-92), B+ (87-89)... F (<60)
}
```

### Agent 2: MAPPER (Foundation)

**Input:** Cloned repository directory
**Output:** Complete Neo4j knowledge graph
**Primary LLM:** Fastino (classification + extraction)

**Processing pipeline:**
1. Walk filesystem → create (:File) and (:Directory) nodes
2. **Fastino `classify_text`** → categorize each file (source/test/config/docs/assets/build/ci-cd)
3. Parse `package.json`/`requirements.txt` → **Fastino `extract_entities`** → (:Package) nodes
4. Regex + **Fastino `extract_json`** → extract imports → (:File)-[:IMPORTS]->(:File) edges
5. **Fastino `extract_json`** → extract functions/classes with line numbers → (:Function)/(:Class) nodes
6. Parse routes → (:Endpoint) nodes with handler relationships

```python
# Fastino API call for file categorization (batch)
POST https://api.fastino.ai/gliner-2
{
  "task": "classify_text",
  "text": "src/routes/api.js - contains Express route handlers with middleware",
  "schema": {
    "categories": ["source", "test", "config", "docs", "assets", "build", "ci-cd"]
  }
}
# Response: { "result": { "label": "source", "confidence": 0.97 } }

# Fastino API call for function extraction
POST https://api.fastino.ai/gliner-2
{
  "task": "extract_json",
  "text": "function searchHandler(req, res) { ... } \nexport async function getUser(id) { ... }",
  "schema": {
    "functions": [
      "name::str::Function name",
      "params::str::Parameter list",
      "exported::str::Is exported (yes/no)",
      "async::str::Is async (yes/no)",
      "start_line::str::Start line number"
    ]
  }
}
```

### Agent 3: QUALITY

**Input:** Neo4j graph + source files
**Output:** Bug findings, code smells, dead code, complexity hotspots
**Primary LLM:** OpenAI gpt-4o (complex reasoning), Fastino (classification)

**Two-pass analysis:**
1. **Pass 1 — Fastino fast scan:** Classify code blocks for smell categories
2. **Pass 2 — OpenAI deep analysis:** Detailed reasoning on flagged blocks

```typescript
// Pass 1: Fastino classifies code blocks quickly
const smellClassification = await fastino.classifyText(codeBlock, {
  categories: [
    'clean', 'unhandled_error', 'type_mismatch', 'dead_code',
    'god_function', 'magic_number', 'deep_nesting', 'duplicated_logic'
  ]
});

// Pass 2: Only blocks classified as issues get OpenAI deep analysis
if (smellClassification.label !== 'clean') {
  const finding = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [...],
    response_format: { type: 'json_schema', json_schema: findingSchema }
  });
}
```

**Finds:** Unhandled errors, type mismatches, dead exports, god functions (>50 lines), magic numbers, duplicated code, deep nesting (>4 levels)

### Agent 4: PATTERN

**Input:** Neo4j graph + project structure
**Output:** Best practice compliance scores, anti-pattern detections
**Primary LLM:** Fastino (classification), OpenAI (scoring)

**Analysis targets:**
- Framework conventions (Next.js file-based routing, React hook rules)
- Naming consistency (camelCase, PascalCase compliance)
- Layer violations (direct DB access from UI components)
- Separation of concerns (business logic in route handlers)
- Directory structure (standard patterns vs chaos)

```typescript
// Fastino classifies structural patterns
const patternResult = await fastino.classifyText(
  `Project structure: ${directoryTree}\nFramework: ${detectedFramework}`,
  {
    categories: [
      'well_structured', 'missing_separation', 'mixed_concerns',
      'non_standard_layout', 'missing_tests', 'missing_types'
    ]
  }
);
```

### Agent 5: SECURITY

**Input:** Neo4j graph + dependency list
**Output:** CVE findings, code vulnerabilities, vulnerability chains
**Primary LLM:** OpenAI (chain reasoning), Fastino (CVE entity extraction), Tavily (web search)

**Pipeline:**
1. Extract dependency list from Neo4j
2. **Tavily `/search`** → search for CVEs per dependency (batch by 3-5 packages)
3. **Fastino `extract_entities`** → parse CVE IDs, CVSS scores, versions from search results
4. **Tavily `/extract`** → deep extraction from NVD advisory pages
5. **OpenAI `gpt-4o`** → reason about vulnerability chains using graph context
6. Write (:CVE), (:Finding), (:VulnerabilityChain) nodes to Neo4j

```typescript
// Step 1: Tavily search for CVEs
const tavilyResult = await tavily.search({
  query: `"express" "4.17.1" CVE vulnerability security advisory`,
  search_depth: 'advanced',
  include_answer: true,
  max_results: 5,
  include_domains: ['nvd.nist.gov', 'github.com/advisories', 'security.snyk.io']
});

// Step 2: Fastino extracts structured CVE data from search results
const cveEntities = await fastino.extractEntities(
  tavilyResult.results.map(r => r.content).join('\n'),
  ['cve_id', 'cvss_score', 'affected_version', 'fixed_version', 'severity', 'exploit_status']
);

// Step 3: OpenAI maps vulnerability chains through the graph
const chainAnalysis = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{
    role: 'system',
    content: 'You are a security analyst. Given CVE findings and a codebase graph, identify vulnerability chains...'
  }, {
    role: 'user',
    content: `CVEs found: ${JSON.stringify(cveEntities)}\n\nGraph context: ${graphContext}`
  }],
  response_format: { type: 'json_schema', json_schema: chainSchema }
});
```

### Agent 6: DOCTOR

**Input:** All findings from agents 3-5 + Senso search results
**Output:** Prioritized fix documentation with code examples
**Primary LLM:** OpenAI gpt-4o (doc generation), Senso (historical fixes)

**Process:**
1. Collect all findings from Quality, Pattern, Security agents
2. **Senso `/search`** → find historical fixes from previous scans
3. **OpenAI `gpt-4o`** → generate fix documentation referencing specific files/lines
4. Priority ordering by: chains resolved × blast radius × severity
5. Compute effort estimates

```typescript
// Query Senso for historical fixes
const historicalFixes = await senso.search({
  query: `fix documentation for ${cve.id} ${packageName}`,
  max_results: 5
});

// Generate fix docs with graph context + historical intelligence
const fixDoc = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{
    role: 'system',
    content: `Generate fix documentation. Reference exact files and line numbers. 
              Historical context from previous scans: ${historicalFixes.answer}`
  }, {
    role: 'user',
    content: `Finding: ${finding}\nAffected code: ${affectedCode}\nGraph context: ${graphContext}`
  }],
  response_format: { type: 'json_schema', json_schema: fixDocSchema }
});
```

### Agent 7: SENSO KNOWLEDGE AGENT

**Input:** All scan results + user queries
**Output:** Persisted knowledge, cross-repo intelligence, generated content
**Tech:** Senso SDK (all endpoints)

```
SENSO KNOWLEDGE AGENT
├── POST-SCAN INGESTION
│   ├── Organize findings into Senso categories/topics
│   ├── POST /content/raw per finding (title, summary, text, category_id, topic_id)
│   ├── POST /content/raw per fix doc
│   ├── POST /content/raw for repo profile
│   └── Poll GET /content/{id} until processing_status == "completed"
│
├── PRE-SCAN INTELLIGENCE
│   ├── POST /search for prior findings matching detected stack
│   ├── POST /search for previous fix docs matching dependencies
│   └── Feed historical intelligence to Doctor Agent
│
├── ON-DEMAND INTELLIGENCE (user queries from dashboard)
│   ├── POST /search — natural language query across all scan data
│   ├── POST /generate — generate reports from knowledge base
│   └── POST /generate/prompt — prompt-driven analysis
│
├── KNOWLEDGE MANAGEMENT (app init)
│   ├── POST /categories/batch — create 5 categories + 14 topics
│   ├── POST /prompts (×4) — create analysis prompts
│   ├── POST /templates (×2) — create output templates
│   └── Store all IDs in app config
│
└── AUTOMATION (stretch)
    ├── POST /rules — create classification rules
    ├── POST /rules/{id}/values — add rule values
    ├── POST /webhooks — register alert destinations
    └── POST /triggers — link rules to webhooks
```

---

## 5. SPONSOR TOOL REFERENCE — COMPLETE ENDPOINT MAPPING

### 5.1 FASTINO LABS — PRIMARY DEMO INFERENCING

**Role:** Primary inferencing engine for entity extraction, text classification, structured data extraction, and function calling. 99x faster than LLMs with <150ms CPU latency. Ideal demo showpiece.

**Base URL:** `https://api.fastino.ai`
**Auth:** `Authorization: Bearer YOUR_FASTINO_KEY`
**Free Tier:** 10,000 requests/month
**SDK:** Python (`pip install gliner2`), also REST API

#### Endpoints

| Endpoint | Method | Task Types | Purpose in VIBE CHECK |
|----------|--------|------------|----------------------|
| `/gliner-2` | POST | `extract_entities` | Extract package names, CVE IDs, function names, versions from code and advisory text |
| `/gliner-2` | POST | `classify_text` | Classify files (source/test/config), classify code smells, detect anti-patterns, detect tech stack |
| `/gliner-2` | POST | `extract_json` | Extract structured function signatures, endpoint routes, dependency metadata |

#### `POST /gliner-2` — Entity Extraction

```json
{
  "task": "extract_entities",
  "text": "express@4.17.1 has CVE-2024-29041 with CVSS 9.1. Fixed in express@4.21.0.",
  "schema": ["package_name", "version", "cve_id", "cvss_score", "fixed_version"]
}
// Response:
{
  "result": {
    "entities": {
      "package_name": ["express"],
      "version": ["4.17.1"],
      "cve_id": ["CVE-2024-29041"],
      "cvss_score": ["9.1"],
      "fixed_version": ["4.21.0"]
    }
  }
}
```

#### `POST /gliner-2` — Text Classification

```json
{
  "task": "classify_text",
  "text": "function handleUpload(req, res) { const path = req.params.file; fs.readFile(path, ...) }",
  "schema": {
    "categories": [
      "clean_code", "unhandled_error", "path_traversal_risk",
      "injection_risk", "missing_validation", "hardcoded_secret"
    ]
  }
}
// Response:
{
  "result": { "label": "path_traversal_risk", "confidence": 0.92 }
}
```

#### `POST /gliner-2` — Structured JSON Extraction

```json
{
  "task": "extract_json",
  "text": "export async function getUser(id: string): Promise<User> { ... } // line 45-67",
  "schema": {
    "function": [
      "name::str::Function name",
      "params::str::Parameters",
      "return_type::str::Return type",
      "is_async::str::yes or no",
      "is_exported::str::yes or no"
    ]
  }
}
// Response:
{
  "result": {
    "function": [{
      "name": "getUser",
      "params": "id: string",
      "return_type": "Promise<User>",
      "is_async": "yes",
      "is_exported": "yes"
    }]
  }
}
```

#### Fastino TLM Suite (Additional Models)

Fastino also offers specialized TLMs beyond GLiNER-2:

| TLM | VIBE CHECK Usage |
|-----|-----------------|
| **Function Calling** | Agent orchestration — route tasks to tools at CPU speed |
| **Text to JSON** | Convert unstructured code analysis into structured findings |
| **PII Redaction** | Strip secrets/keys from code before sending to external LLMs |
| **Text Classification** | File categorization, smell detection, pattern classification |
| **Information Extraction** | Package names, versions, CVE IDs, function signatures |

#### Expected Usage Per Scan

| Task | Calls | Latency |
|------|-------|---------|
| File categorization (47 files) | 47 | ~150ms total (batched) |
| Dependency extraction | 1-3 | ~90ms |
| Function extraction (per file) | ~30 | ~500ms total |
| CVE entity parsing | 5-10 | ~200ms |
| Code smell classification | ~30 | ~500ms |
| **Total** | **~120 calls** | **~1.5s total** |

---

### 5.2 OPENAI — BACKUP / DEEP REASONING

**Role:** Backup for complex reasoning tasks that exceed Fastino's capabilities: multi-step code analysis, vulnerability chain synthesis, documentation generation with context.

**Base URL:** `https://api.openai.com/v1`
**Auth:** `Authorization: Bearer sk-...`

#### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/chat/completions` | POST | Code analysis, chain reasoning, fix doc generation |
| `/v1/responses` | POST | Alternative unified endpoint |
| `/v1/embeddings` | POST | Stretch — semantic code similarity |

#### Structured Outputs (Primary Pattern)

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: agentSystemPrompt },
    { role: 'user', content: analysisPrompt }
  ],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'code_findings',
      schema: {
        type: 'object',
        properties: {
          findings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['bug', 'smell', 'complexity', 'dead_code'] },
                severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
                title: { type: 'string' },
                description: { type: 'string' },
                plainDescription: { type: 'string' },
                startLine: { type: 'integer' },
                endLine: { type: 'integer' },
                confidence: { type: 'number' }
              },
              required: ['type', 'severity', 'title', 'description', 'startLine', 'endLine']
            }
          }
        },
        required: ['findings']
      }
    }
  }
});
```

#### Tool Calling (Security Agent)

```typescript
const tools = [
  {
    type: 'function',
    function: {
      name: 'search_cve',
      description: 'Search for CVE vulnerabilities for a package',
      parameters: {
        type: 'object',
        properties: {
          package_name: { type: 'string' },
          version: { type: 'string' }
        },
        required: ['package_name', 'version']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_graph',
      description: 'Query the Neo4j knowledge graph with Cypher',
      parameters: {
        type: 'object',
        properties: { cypher_query: { type: 'string' } },
        required: ['cypher_query']
      }
    }
  }
];
```

#### Models

| Model | Usage | Why |
|-------|-------|-----|
| `gpt-4o` | Quality, Pattern, Security agents | Best structured output + code reasoning |
| `gpt-4o-mini` | Mapper fallback, simple classification | Fast, cheap |
| `o3-mini` | Stretch — chain analysis | Advanced reasoning |

#### Expected Usage Per Scan

~15-30 calls, ~40-60K tokens total (only for tasks Fastino can't handle)

---

### 5.3 TAVILY — CVE Search & Content Extraction

**Role:** Fast, targeted web search for CVEs and vulnerability data. Complements Fastino entity extraction.

**Base URL:** `https://api.tavily.com`
**Auth:** `Authorization: Bearer tvly-YOUR_KEY`
**SDK:** `pip install tavily-python` / `npm install tavily`

#### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/search` | POST | CVE lookup per dependency, migration guide search |
| `/extract` | POST | Deep data extraction from NVD/Advisory pages |
| `/crawl` | POST | Stretch — crawl documentation sites |
| `/map` | POST | Stretch — discover vulnerability pages |

#### `/search` — CVE Lookup

```json
POST https://api.tavily.com/search
{
  "query": "\"express\" \"4.17.1\" CVE vulnerability security advisory",
  "search_depth": "advanced",
  "include_answer": true,
  "max_results": 5,
  "include_domains": ["nvd.nist.gov", "github.com/advisories", "security.snyk.io"],
  "days": 365
}

// Response:
{
  "answer": "Express 4.17.1 has CVE-2024-29041...",
  "results": [
    { "title": "CVE-2024-29041", "url": "https://nvd.nist.gov/...", "content": "...", "score": 0.95 }
  ],
  "response_time": 1.2
}
```

#### `/extract` — Deep CVE Data

```json
POST https://api.tavily.com/extract
{
  "urls": ["https://nvd.nist.gov/vuln/detail/CVE-2024-29041"],
  "query": "CVSS score affected versions fix version exploit available",
  "chunks_per_source": 3,
  "extract_depth": "advanced",
  "format": "markdown"
}
```

#### Usage Per Scan

1 search per dependency batch (3-5 deps per search) + 1-2 extracts per CVE found = ~10-20 calls

---

### 5.4 NEO4J — Codebase Knowledge Graph

**Role:** ESSENTIAL — the entire codebase knowledge graph. Every file, function, import, dependency, finding, and vulnerability chain lives here.

**Connection:** `neo4j+s://xxxx.databases.neo4j.io:7687` (AuraDB Free) or `neo4j://localhost:7687` (Desktop)
**Auth:** Basic (username: neo4j, password: from instance)
**SDK:** `npm install neo4j-driver`

#### Key Operations

```typescript
import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic('neo4j', process.env.NEO4J_PASSWORD)
);

// MERGE pattern (upsert — idempotent, safe for re-runs)
async function addFile(path: string, language: string, lines: number, category: string) {
  const session = driver.session();
  await session.run(
    `MERGE (f:File {path: $path})
     SET f.language = $language, f.lines = $lines, f.category = $category`,
    { path, language, lines, category }
  );
  session.close();
}

// Blast radius query
async function getBlastRadius(filePath: string, maxHops = 3) {
  const session = driver.session();
  const result = await session.run(
    `MATCH (start:File {path: $path})
     MATCH (start)-[*1..${maxHops}]->(affected)
     RETURN DISTINCT labels(affected) as type, affected.path as path, affected.name as name`,
    { path: filePath }
  );
  session.close();
  return result.records;
}

// Vulnerability chain discovery
async function findVulnerabilityChains() {
  const session = driver.session();
  const result = await session.run(
    `MATCH path = (entry:Endpoint)-[:HANDLED_BY]->(:Function)
     -[:CALLS*1..4]->(:Function)-[:DEFINED_IN]->(:File)
     -[:DEPENDS_ON]->(:Package {hasVulnerability: true})
     RETURN path`
  );
  session.close();
  return result.records;
}
```

Full schema defined in Section 6 below.

---

### 5.5 SENSO CONTEXT OS — Persistent Knowledge Layer

**Role:** ESSENTIAL — transforms VIBE CHECK from "scan and forget" into a learning intelligence system.

**Base URL:** `https://sdk.senso.ai/api/v1`
**Auth:** `X-API-Key: YOUR_SENSO_KEY`

#### Complete Endpoint Reference

| Endpoint | Method | When | Purpose |
|----------|--------|------|---------|
| `/categories` | POST | App init | Create taxonomy categories |
| `/categories/batch` | POST | App init | Batch create categories + topics |
| `/topics` | POST | App init | Create nested topics under categories |
| `/prompts` | POST | App init | Create 4 reusable analysis prompts |
| `/prompts` | GET | On demand | List available prompts |
| `/templates` | POST | App init | Create 2 output templates |
| `/content/raw` | POST | Per finding/fix/profile | **PRIMARY** — Ingest content to knowledge base |
| `/content/{id}` | GET | After ingest | Poll processing status (202 → completed) |
| `/content` | GET | Dashboard | List all knowledge base content |
| `/search` | POST | Pre-scan + dashboard | **PRIMARY** — Natural language search, cited answers |
| `/generate` | POST | Post-scan | Generate summaries from knowledge base |
| `/generate/prompt` | POST | Post-scan | Prompt-driven content generation with templates |
| `/rules` | POST | Setup (stretch) | Create classification rules |
| `/rules/{id}/values` | POST | Setup (stretch) | Add rule values |
| `/webhooks` | POST | Setup (stretch) | Register alert destinations |
| `/triggers` | POST | Setup (stretch) | Link rules to webhooks for automation |

#### Content Ingestion Pattern

```typescript
const SENSO_API = 'https://sdk.senso.ai/api/v1';
const headers = { 'X-API-Key': process.env.SENSO_API_KEY, 'Content-Type': 'application/json' };

// Ingest a finding
const response = await fetch(`${SENSO_API}/content/raw`, {
  method: 'POST', headers,
  body: JSON.stringify({
    title: `CVE-2024-29041: Express 4.17.1 Path Traversal`,
    summary: `Critical path traversal in Express 4.17.1 affecting 8 files in user/repo`,
    text: fullFindingMarkdown,    // Detailed finding with blast radius, affected files, fix steps
    category_id: categoryIds.securityVulnerabilities,
    topic_id: topicIds.dependencyCVEs
  })
});
// Returns 202 with { id: 'content_id' }

// Poll for completion
let status = 'processing';
while (status !== 'completed') {
  const check = await fetch(`${SENSO_API}/content/${contentId}`, { headers });
  const data = await check.json();
  status = data.processing_status;
  if (status === 'failed') throw new Error('Senso processing failed');
  await sleep(1000);
}
```

#### Search Pattern

```typescript
const searchResult = await fetch(`${SENSO_API}/search`, {
  method: 'POST', headers,
  body: JSON.stringify({
    query: 'Express path traversal vulnerability fix documentation',
    max_results: 5
  })
});
// Returns: { answer: '...', sources: [...], processing_time_ms: 234, total_results: 5 }
```

Full Senso content architecture in Section 8 below.

---

### 5.6 YUTORI — Deep Web Intelligence (STRETCH)

**Role:** STRETCH goal — deep multi-agent web research for complex CVE investigations and continuous monitoring.

**Base URL:** `https://api.yutori.com`
**Auth:** `x-api-key: YOUR_YUTORI_KEY`
**SDK:** `pip install yutori`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/research` | POST | Deep CVE research with 100+ MCP tools |
| `/research/{task_id}` | GET | Poll research results |
| `/browse` | POST | Navigate interactive advisory pages |
| `/browse/{task_id}` | GET | Get browsing results |
| `/scouts` | POST | Create continuous vulnerability monitoring |
| `/scouts/{id}/updates` | GET | Get monitoring updates |

Only used if Tavily results are insufficient for complex CVE chains.

---

### 5.7 AWS — Production Infrastructure (OPTIONAL)

**Role:** OPTIONAL stretch for production deployment. Not needed for demo.

| Service | Purpose | Local Alternative |
|---------|---------|-------------------|
| Lambda | Agent execution | In-process functions |
| S3 | Repo storage | Local `/tmp` |
| DynamoDB | Analysis state | SQLite |
| API Gateway | REST API | Next.js API routes |
| EventBridge | Agent orchestration | In-process events |
| Bedrock | Alternative LLM | OpenAI API direct |

---

## 6. NEO4J GRAPH SCHEMA

### Node Types

```cypher
// Codebase Structure
(:Repository {url, name, owner, branch, clonedAt, healthScore, letterGrade})
(:Directory {path, depth, fileCount})
(:File {path, name, extension, language, lines, size, category,
        lastModified, complexity, hasVulnerability: boolean})
(:Function {name, filePath, startLine, endLine, complexity, paramCount,
            exported: boolean, isAsync: boolean, receivesUserInput: boolean,
            accessesSensitiveData: boolean, hasVulnerability: boolean})
(:Class {name, filePath, startLine, endLine, methodCount, exported: boolean})
(:Endpoint {method, routePath, handler, hasAuth: boolean, hasValidation: boolean})

// Dependencies
(:Package {name, version, versionConstraint, isDev: boolean,
           isTransitive: boolean, hasVulnerability: boolean,
           latestVersion, cveCount: int})

// Findings
(:Finding {id, type, severity, title, description, plainDescription,
           location, startLine, endLine, blastRadius: int,
           agent, confidence: float, sensoContentId})
(:VulnerabilityChain {id, description, steps: int, severity, entryPoint, exitPoint})
(:CVE {id, cvssScore: float, description, fixedVersion, exploitAvailable: boolean})

// Fixes
(:Fix {id, title, priority: int, estimatedEffort, description,
       beforeCode, afterCode, sensoContentId})

// Senso References
(:SensoContent {id, sensoId, title, categoryId, topicId, processingStatus})
```

### Relationships

```cypher
// Structure
(repo)-[:CONTAINS]->(dir)
(dir)-[:CONTAINS]->(file|dir)
(file)-[:IMPORTS]->(file)
(file)-[:DEPENDS_ON]->(package)
(package)-[:DEPENDS_ON]->(package)
(function)-[:DEFINED_IN]->(file)
(function)-[:CALLS]->(function)
(class)-[:DEFINED_IN]->(file)
(endpoint)-[:HANDLED_BY]->(function)

// Data Flow
(function)-[:RECEIVES_INPUT {source: "user"|"api"|"db"|"env"}]->(dataflow)
(function)-[:WRITES_TO {target: "db"|"file"|"api"|"response"}]->(dataflow)

// Findings & Fixes
(finding)-[:AFFECTS]->(file|function|endpoint|package)
(finding)-[:PART_OF_CHAIN]->(vulnerabilityChain)
(cve)-[:IN_PACKAGE]->(package)
(finding)-[:HAS_CVE]->(cve)
(fix)-[:RESOLVES]->(finding)
(fix)-[:MODIFIES]->(file)
(fix)-[:UPGRADES]->(package)

// Senso Cross-References
(finding)-[:PERSISTED_IN]->(sensoContent)
(fix)-[:PERSISTED_IN]->(sensoContent)
(repo)-[:PROFILED_IN]->(sensoContent)
```

---

## 7. DATABASE & STATE SCHEMAS

### Analysis Record (SQLite)

```sql
CREATE TABLE analyses (
  analysis_id TEXT PRIMARY KEY,        -- "anl_" + uuid
  repo_url TEXT NOT NULL,
  repo_name TEXT NOT NULL,             -- "owner/name"
  branch TEXT DEFAULT 'main',
  clone_dir TEXT,
  detected_stack JSON,                 -- {languages, frameworks, packageManager, buildSystem}
  stats JSON,                          -- {totalFiles, totalLines, totalDependencies...}
  status TEXT DEFAULT 'queued',        -- queued|cloning|mapping|analyzing|completed|failed
  agent_statuses JSON,                 -- {mapper: {status, progress, findingsCount}...}
  health_score JSON,                   -- {overall, letterGrade, breakdown, confidence}
  findings_summary JSON,               -- {critical, warning, info, total}
  senso_content_ids JSON DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  duration_seconds INTEGER
);
```

### Senso Content Schema

```typescript
interface SensoFindingContent {
  title: string;                // "CVE-2024-29041: Express 4.17.1 Path Traversal"
  summary: string;              // One-line summary
  text: string;                 // Full structured finding markdown
  category_id: string;
  topic_id: string;
}

interface SensoFixContent {
  title: string;                // "FIX: Upgrade Express 4.17.1 → 4.21.0"
  summary: string;
  text: string;                 // Full fix documentation markdown
  category_id: string;
  topic_id: string;
}

interface SensoRepoProfile {
  title: string;                // "Repo Profile: user/repo (2026-02-27)"
  summary: string;              // "Next.js app, 47 files, Health Score: B- (73/100)"
  text: string;                 // Full repo analysis summary
  category_id: string;
  topic_id: string;
}
```

---

## 8. SENSO CONTENT ARCHITECTURE

### Taxonomy (5 Categories, 14 Topics)

| Category | Topics |
|----------|--------|
| Security Vulnerabilities | Dependency CVEs, Code Vulnerabilities, Configuration Issues, Vulnerability Chains |
| Code Quality | Bugs, Code Smells, Dead Code, Complexity Hotspots |
| Architecture & Patterns | Framework Best Practices, Anti-Patterns, Project Structure |
| Fix Documentation | Dependency Upgrades, Security Patches, Refactoring Guides |
| Repository Profiles | Health Scores, Tech Stack Analysis |

### Pre-Created Prompts (4)

1. **Security Audit Summary** — Generate concise security audit with severity counts, chains, top fixes
2. **Fix Documentation Generator** — Generate fix docs with plain language, code examples, effort estimates
3. **Cross-Repo Pattern Analyzer** — Identify recurring patterns across all scanned repos
4. **Executive Health Report** — One-page non-technical summary

### Pre-Created Templates (2)

1. **Vulnerability Report** — Markdown report with findings, chains, fix plan
2. **Fix Plan JSON** — Machine-readable fix plan

### Processing Flows

```
APP INIT:
  POST /categories/batch → create 5 categories + 14 topics → store IDs
  POST /prompts (×4) → store prompt IDs
  POST /templates (×2) → store template IDs

PRE-SCAN:
  POST /search { query: "vulnerabilities in [framework]" } → historical intel
  POST /search { query: "fix docs for [dependencies]" } → previous fixes
  → Feed to Doctor Agent

POST-SCAN:
  For each finding: POST /content/raw → poll GET /content/{id}
  For each fix: POST /content/raw
  Repo profile: POST /content/raw
  POST /generate/prompt { cross_repo_analyzer } → cross-repo intelligence

DASHBOARD QUERIES:
  POST /search { user_query } → cited answers
  POST /generate { instructions } → generated reports
```

---

## 9. PROCESSING PIPELINE & DATA FLOW

```
USER INPUT: "https://github.com/user/repo"
  │
  ▼
ORCHESTRATOR (0:00)
  ├── git clone → /tmp/vibe-check/repos/anl_abc123/
  ├── Detect stack: Fastino classify_text → "Next.js + TypeScript"
  ├── Pre-scan Senso search → historical intelligence
  └── Dispatch agents
  │
  ▼
MAPPER AGENT (0:05-0:15)
  ├── Walk filesystem → File/Directory nodes
  ├── Fastino classify_text (batch) → categorize all files
  ├── Parse package.json → Fastino extract_entities → Package nodes
  ├── Parse imports → IMPORTS edges
  ├── Fastino extract_json → Function/Class nodes
  └── All → Neo4j MERGE
  │
  ▼ (parallel)
QUALITY AGENT (0:15-0:25)          PATTERN AGENT (0:15-0:25)          SECURITY AGENT (0:15-0:30)
├── Fastino classify per block     ├── Fastino classify structure     ├── Tavily search per dep batch
├── OpenAI deep analysis on flags  ├── OpenAI score best practices   ├── Fastino extract CVE entities
└── Findings → Neo4j               └── Findings → Neo4j              ├── Tavily extract advisory pages
                                                                      ├── OpenAI chain reasoning
                                                                      └── Findings + Chains → Neo4j
  │
  ▼
DOCTOR AGENT (0:30-0:40)
  ├── Collect all findings
  ├── Senso search → historical fixes
  ├── OpenAI generate fix docs (with graph context + Senso intel)
  ├── Priority ordering
  └── Fix nodes → Neo4j
  │
  ▼
SENSO KNOWLEDGE AGENT (0:40-0:45)
  ├── POST /content/raw per finding
  ├── POST /content/raw per fix
  ├── POST /content/raw repo profile
  ├── POST /generate/prompt → cross-repo patterns
  └── Return intelligence to dashboard
  │
  ▼
HEALTH SCORE COMPUTATION (0:45)
  └── Local algorithm → HealthScore → Neo4j → WebSocket → Dashboard
```

---

## 10. BUILD PLAN (BACKEND FOCUS)

| Time | Backend Focus | Sponsor Integration |
|------|--------------|-------------------|
| 0:00-0:30 | Next.js API skeleton, Neo4j driver, Fastino client, Senso client | Senso taxonomy batch-created |
| 0:30-1:15 | Mapper Agent: git clone, file walk, Fastino classify/extract, Neo4j graph | Fastino GLiNER-2 entity extraction |
| 1:15-1:45 | WebSocket streaming, analysis state management | — |
| 1:45-2:30 | Quality + Pattern agents: Fastino classify → OpenAI deep analysis | Fastino classification + OpenAI reasoning |
| 2:30-3:15 | Security Agent: Tavily search/extract → Fastino CVE parsing → OpenAI chains | Tavily + Fastino + OpenAI + Neo4j |
| 3:15-4:00 | Doctor Agent + Senso Intelligence | Senso search/generate + OpenAI doc gen |
| 4:00-4:30 | Senso Knowledge Agent: post-scan ingestion, pre-scan intel | Full Senso integration |
| 4:30-5:00 | Polish: error handling, caching demo results, timeout guards | — |

---

## SPONSOR INTEGRATION SCORECARD

| Sponsor | Depth | Role |
|---------|-------|------|
| **Fastino** | ESSENTIAL | Primary demo inferencing — TLMs + GLiNER-2 for entity extraction, classification, structured parsing. 99x faster. The speed story. |
| **OpenAI** | ESSENTIAL | Backup reasoning — complex code analysis, vulnerability chains, documentation generation. The depth story. |
| **Neo4j** | ESSENTIAL | Codebase knowledge graph — the entire product IS the graph. |
| **Senso** | ESSENTIAL | Persistent knowledge — cross-repo intelligence, search, generate. The learning story. |
| **Tavily** | ESSENTIAL | CVE web search + advisory page extraction. The security data source. |
| **Yutori** | STRETCH | Deep web research + continuous monitoring (if time permits). |
| **AWS** | OPTIONAL | Production deployment (not needed for demo). |

---

*"Vibe code fast. VIBE CHECK before you ship."*