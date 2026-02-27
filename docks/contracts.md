# VIBE CHECK — API CONTRACTS PRD v3.0
## Frontend ↔ Backend Interface Definitions

*Digital Studio Labs — February 27, 2026*

---

## TABLE OF CONTENTS

1. Overview & Conventions
2. REST API Endpoints
   - 2.1 POST /analyze
   - 2.2 GET /analysis/:id
   - 2.3 GET /analysis/:id/findings
   - 2.4 GET /analysis/:id/chains
   - 2.5 GET /analysis/:id/fixes
   - 2.6 GET /analysis/:id/graph
   - 2.7 POST /analysis/:id/senso/search
   - 2.8 POST /analysis/:id/senso/generate
3. WebSocket Protocol
4. Shared TypeScript Types
5. Component ↔ Endpoint Mapping
6. Error Handling Contract
7. State Machine: Analysis Lifecycle

---

## 1. OVERVIEW & CONVENTIONS

### Base URL

```
Development: http://localhost:3000/api/v1
Production:  https://vibecheck.app/api/v1 (stretch)
```

### Headers

```
Content-Type: application/json
Accept: application/json
```

### Response Envelope

All responses follow this pattern:
- **Success:** Direct JSON payload (no wrapper)
- **Error:** `{ "error": { "code": string, "message": string, "details"?: any } }`
- **Pagination:** `{ "items": T[], "total": number, "limit": number, "offset": number }`
- **Async:** 202 Accepted with `analysisId` for polling

### ID Prefixes

| Entity | Prefix | Example |
|--------|--------|---------|
| Analysis | `anl_` | `anl_7f3a2b` |
| Finding | `fnd_` | `fnd_001` |
| Fix | `fix_` | `fix_001` |
| Chain | `chain_` | `chain_001` |
| Senso Content | `cnt_` | `cnt_abc123` |

---

## 2. REST API ENDPOINTS

---

### 2.1 `POST /analyze`

**Purpose:** Start a new repository analysis. Returns immediately with an ID for WebSocket/polling.

**Frontend caller:** `<AnalysisInput />` component on form submit

#### Request

```typescript
interface AnalyzeRequest {
  repoUrl: string;                       // "https://github.com/user/repo"
  branch?: string;                       // defaults to repo's default branch
  scope?: 'full' | 'security-only' | 'quality-only';  // default: 'full'
  maxFiles?: number;                     // default: 500, cap for large repos
  useSensoIntelligence?: boolean;        // default: true
}
```

```json
POST /api/v1/analyze
{
  "repoUrl": "https://github.com/user/repo",
  "branch": "main",
  "scope": "full",
  "maxFiles": 500,
  "useSensoIntelligence": true
}
```

#### Response — 202 Accepted

```typescript
interface AnalyzeResponse {
  analysisId: string;                    // "anl_abc123"
  status: 'queued';
  repoName: string;                      // "user/repo"
  estimatedDuration: number;             // seconds
  websocketUrl: string;                  // "/ws/analysis/anl_abc123"
}
```

```json
{
  "analysisId": "anl_abc123",
  "status": "queued",
  "repoName": "user/repo",
  "estimatedDuration": 45,
  "websocketUrl": "/ws/analysis/anl_abc123"
}
```

#### Errors

| Status | Code | When |
|--------|------|------|
| 400 | `INVALID_URL` | Not a valid GitHub URL |
| 400 | `REPO_TOO_LARGE` | Exceeds max file limit |
| 404 | `REPO_NOT_FOUND` | GitHub returns 404 |
| 429 | `RATE_LIMITED` | Too many concurrent analyses |
| 503 | `SERVICE_UNAVAILABLE` | Neo4j/Senso/LLM unreachable |

---

### 2.2 `GET /analysis/:analysisId`

**Purpose:** Get full analysis status and results. Primary polling endpoint.

**Frontend caller:** `<Dashboard />` initial load + `<AnalysisProgress />` polling fallback

#### Response — 200 OK

```typescript
interface AnalysisResult {
  analysisId: string;
  status: AnalysisStatus;
  repoUrl: string;
  repoName: string;
  branch: string;

  detectedStack: {
    languages: string[];
    frameworks: string[];
    packageManager: string;
    buildSystem: string;
  };

  stats: {
    totalFiles: number;
    totalLines: number;
    totalDependencies: number;
    totalDevDependencies: number;
    totalFunctions: number;
    totalEndpoints: number;
  };

  healthScore: HealthScore | null;       // null while still analyzing

  findings: {
    critical: number;
    warning: number;
    info: number;
    total: number;
  };

  vulnerabilityChains: number;
  fixesGenerated: number;

  sensoIntelligence: {
    crossRepoPatterns: number;
    previousFixesApplied: number;
    knowledgeBaseContributions: number;
  };

  timestamps: {
    startedAt: string;                   // ISO 8601
    completedAt: string | null;
    duration: number | null;             // seconds
  };
}

type AnalysisStatus =
  | 'queued'
  | 'cloning'
  | 'mapping'
  | 'analyzing'
  | 'completing'
  | 'completed'
  | 'failed';
```

```json
{
  "analysisId": "anl_abc123",
  "status": "completed",
  "repoUrl": "https://github.com/user/repo",
  "repoName": "user/repo",
  "branch": "main",
  "detectedStack": {
    "languages": ["TypeScript", "JavaScript"],
    "frameworks": ["Next.js", "React"],
    "packageManager": "npm",
    "buildSystem": "next"
  },
  "stats": {
    "totalFiles": 47,
    "totalLines": 8234,
    "totalDependencies": 12,
    "totalDevDependencies": 8,
    "totalFunctions": 156,
    "totalEndpoints": 14
  },
  "healthScore": {
    "overall": 73,
    "letterGrade": "B-",
    "breakdown": {
      "codeQuality": { "score": 7, "max": 10, "status": "warning" },
      "patterns": { "score": 6, "max": 10, "status": "warning" },
      "security": { "score": 4, "max": 10, "status": "critical" },
      "dependencies": { "score": 8, "max": 10, "status": "healthy" },
      "architecture": { "score": 7, "max": 10, "status": "warning" }
    },
    "confidence": 0.91
  },
  "findings": { "critical": 3, "warning": 12, "info": 24, "total": 39 },
  "vulnerabilityChains": 4,
  "fixesGenerated": 15,
  "sensoIntelligence": {
    "crossRepoPatterns": 3,
    "previousFixesApplied": 2,
    "knowledgeBaseContributions": 39
  },
  "timestamps": {
    "startedAt": "2026-02-27T18:30:00Z",
    "completedAt": "2026-02-27T18:30:42Z",
    "duration": 42
  }
}
```

---

### 2.3 `GET /analysis/:analysisId/findings`

**Purpose:** Paginated, filterable list of all findings.

**Frontend caller:** `<FindingsPanel />`

#### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `severity` | `critical\|warning\|info` | all | Filter by severity |
| `agent` | `quality\|pattern\|security` | all | Filter by source agent |
| `limit` | number | 20 | Page size |
| `offset` | number | 0 | Pagination offset |

#### Response — 200 OK

```typescript
interface FindingsResponse {
  items: Finding[];
  total: number;
  limit: number;
  offset: number;
}
```

```json
{
  "items": [
    {
      "id": "fnd_001",
      "type": "dependency_vulnerability",
      "severity": "critical",
      "agent": "security",
      "title": "CVE-2024-29041: Express 4.17.1 Path Traversal",
      "description": "Express 4.17.1 contains a path traversal vulnerability...",
      "plainDescription": "Someone could access files they shouldn't through your web server.",
      "location": {
        "files": ["src/routes/api.js", "src/middleware/upload.js"],
        "primaryFile": "src/routes/api.js",
        "startLine": 12,
        "endLine": 45
      },
      "blastRadius": {
        "filesAffected": 8,
        "functionsAffected": 23,
        "endpointsAffected": 4
      },
      "cve": {
        "id": "CVE-2024-29041",
        "cvssScore": 9.1,
        "exploitAvailable": true,
        "fixedVersion": "4.21.0"
      },
      "chainIds": ["chain_001", "chain_003"],
      "fixId": "fix_001",
      "sensoContentId": "cnt_abc123",
      "confidence": 0.95
    }
  ],
  "total": 39,
  "limit": 20,
  "offset": 0
}
```

---

### 2.4 `GET /analysis/:analysisId/chains`

**Purpose:** Get all vulnerability chains with step-by-step attack paths.

**Frontend caller:** `<GraphPanel />` vulnerability overlay + `<FindingDetail />`

#### Response — 200 OK

```typescript
interface ChainsResponse {
  chains: VulnerabilityChain[];
}
```

```json
{
  "chains": [
    {
      "id": "chain_001",
      "severity": "critical",
      "description": "User input → unvalidated endpoint → vulnerable Express handler → database access",
      "steps": [
        { "type": "entry", "node": "POST /api/search", "description": "User-controlled input" },
        { "type": "flow", "node": "searchHandler()", "file": "src/routes/api.js:15", "description": "No input validation" },
        { "type": "vulnerability", "node": "express.static()", "cve": "CVE-2024-29041", "description": "Path traversal" },
        { "type": "impact", "node": "database.query()", "file": "src/models/user.js:30", "description": "Admin table access" }
      ],
      "blastRadius": { "files": 8, "functions": 23, "endpoints": 4 },
      "keystoneFix": "fix_001",
      "findingIds": ["fnd_001", "fnd_005", "fnd_012"]
    }
  ]
}
```

---

### 2.5 `GET /analysis/:analysisId/fixes`

**Purpose:** Prioritized fix plan with full documentation per fix.

**Frontend caller:** `<FixPlan />` + `<FindingDetail />`

#### Response — 200 OK

```typescript
interface FixesResponse {
  fixes: Fix[];
  summary: FixSummary;
}

interface FixSummary {
  totalFixes: number;
  criticalFixes: number;
  estimatedTotalEffort: string;
  keystoneFixes: number;
  chainsEliminatedByKeystones: number;
}
```

```json
{
  "fixes": [
    {
      "id": "fix_001",
      "priority": 1,
      "title": "Upgrade Express from 4.17.1 to 4.21.0",
      "severity": "critical",
      "type": "dependency_upgrade",
      "estimatedEffort": "30 minutes",
      "chainsResolved": 3,
      "findingsResolved": ["fnd_001", "fnd_005"],
      "documentation": {
        "whatsWrong": "Express 4.17.1 has a known path traversal vulnerability...",
        "affectedCode": [
          { "file": "src/routes/api.js", "lines": "12-45", "context": "serves static files" },
          { "file": "src/middleware/upload.js", "lines": "8-22", "context": "handles file uploads" }
        ],
        "steps": [
          "Update package.json: \"express\": \"^4.21.0\"",
          "Run npm install",
          "Update src/middleware/upload.js line 15...",
          "Run tests to verify"
        ],
        "beforeCode": "const filePath = path.join(uploadDir, req.params.filename)",
        "afterCode": "const filePath = path.resolve(uploadDir, path.basename(req.params.filename))",
        "migrationGuideUrl": "https://expressjs.com/en/guide/migrating-5.html"
      },
      "sensoContentId": "cnt_fix001",
      "sensoHistoricalContext": "This same CVE was fixed in 2 previous repos. Average fix time: 25 minutes."
    }
  ],
  "summary": {
    "totalFixes": 15,
    "criticalFixes": 3,
    "estimatedTotalEffort": "6.5 hours",
    "keystoneFixes": 2,
    "chainsEliminatedByKeystones": 4
  }
}
```

---

### 2.6 `GET /analysis/:analysisId/graph`

**Purpose:** Graph data for visualization. Filtered by view mode.

**Frontend caller:** `<GraphPanel />`

#### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `view` | `structure\|dependencies\|vulnerabilities` | `structure` | Graph view mode |
| `depth` | number | 2 | Traversal depth from root |

#### Response — 200 OK

```typescript
interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: {
    type: 'hierarchical' | 'force' | 'radial';
    direction?: 'TB' | 'LR';
  };
}
```

```json
{
  "nodes": [
    {
      "id": "file_001",
      "type": "file",
      "label": "api.js",
      "path": "src/routes/api.js",
      "category": "source",
      "language": "JavaScript",
      "lines": 145,
      "severity": "critical",
      "findingCount": 3,
      "metadata": { "complexity": 12, "functions": 5, "exports": 3 }
    }
  ],
  "edges": [
    {
      "id": "edge_001",
      "source": "file_001",
      "target": "file_002",
      "type": "imports",
      "isVulnerabilityChain": true,
      "chainId": "chain_001"
    }
  ],
  "layout": { "type": "hierarchical", "direction": "TB" }
}
```

---

### 2.7 `POST /analysis/:analysisId/senso/search`

**Purpose:** Natural language query against Senso knowledge base.

**Frontend caller:** `<SensoIntelligencePanel />` search box

#### Request

```typescript
interface SensoSearchRequest {
  query: string;
  maxResults?: number;                   // default: 5
}
```

#### Response — 200 OK

```typescript
interface SensoSearchResponse {
  answer: string;
  sources: {
    contentId: string;
    title: string;
    score: number;
    chunkText: string;
  }[];
  processingTimeMs: number;
  totalResults: number;
}
```

---

### 2.8 `POST /analysis/:analysisId/senso/generate`

**Purpose:** Generate content from Senso knowledge base.

**Frontend caller:** `<SensoIntelligencePanel />` generate button

#### Request

```typescript
interface SensoGenerateRequest {
  contentType: string;                   // "executive security summary"
  instructions: string;
  save?: boolean;                        // persist back to Senso
  maxResults?: number;
}
```

#### Response — 200 OK

```typescript
interface SensoGenerateResponse {
  generatedText: string;
  sources: { contentId: string; title: string; score: number }[];
  processingTimeMs: number;
  savedContentId?: string;               // if save=true
}
```

---

## 3. WEBSOCKET PROTOCOL

### Connection

```
ws://localhost:3000/ws/analysis/{analysisId}
```

Frontend connects immediately after receiving `analysisId` from `POST /analyze`.

### Message Types (Server → Client)

All messages follow: `{ "type": string, ...payload }`

```typescript
// Union type of all WebSocket messages
type WSMessage =
  | WSStatusUpdate
  | WSFinding
  | WSGraphNode
  | WSGraphEdge
  | WSAgentComplete
  | WSSensoIntelligence
  | WSComplete
  | WSError;

// Agent status change
interface WSStatusUpdate {
  type: 'status';
  agent: AgentName;
  status: 'pending' | 'running' | 'complete' | 'error';
  progress: number;                      // 0.0 - 1.0
  message: string;                       // "Building file graph..."
}

// New finding discovered
interface WSFinding {
  type: 'finding';
  finding: {
    id: string;
    severity: Severity;
    title: string;
    agent: AgentName;
  };
}

// New graph node added (for progressive graph building)
interface WSGraphNode {
  type: 'graph_node';
  node: GraphNode;
}

// New graph edge added
interface WSGraphEdge {
  type: 'graph_edge';
  edge: GraphEdge;
}

// Agent finished
interface WSAgentComplete {
  type: 'agent_complete';
  agent: AgentName;
  findingsCount: number;
  durationMs: number;
  provider: 'fastino' | 'openai' | 'tavily';  // which LLM/API was used
}

// Senso cross-repo intelligence arrived
interface WSSensoIntelligence {
  type: 'senso_intelligence';
  insight: string;
  sourceCount: number;
}

// Analysis complete — final results
interface WSComplete {
  type: 'complete';
  healthScore: HealthScore;
  findingsSummary: { critical: number; warning: number; info: number; total: number };
  duration: number;
}

// Error
interface WSError {
  type: 'error';
  agent?: AgentName;
  message: string;
  recoverable: boolean;
}

type AgentName = 'orchestrator' | 'mapper' | 'quality' | 'pattern' | 'security' | 'doctor' | 'senso';
```

### Message Sequence (Typical Scan)

```
← status: { agent: "orchestrator", status: "running", message: "Cloning repository..." }
← status: { agent: "orchestrator", status: "running", message: "Detected: Next.js + TypeScript" }
← status: { agent: "mapper", status: "running", progress: 0.1, message: "Scanning files..." }
← graph_node: { node: { type: "directory", label: "src/" } }
← graph_node: { node: { type: "file", label: "api.js" } }
← graph_edge: { edge: { source: "dir_src", target: "file_001", type: "contains" } }
... (more nodes/edges as mapper builds graph)
← status: { agent: "mapper", status: "running", progress: 0.8, message: "Extracting functions..." }
← agent_complete: { agent: "mapper", findingsCount: 0, provider: "fastino" }
← status: { agent: "quality", status: "running", message: "Analyzing code quality..." }
← status: { agent: "pattern", status: "running", message: "Checking patterns..." }
← status: { agent: "security", status: "running", message: "Searching for CVEs..." }
← finding: { finding: { id: "fnd_001", severity: "critical", title: "CVE-2024-29041..." } }
← finding: { finding: { id: "fnd_002", severity: "warning", title: "Unhandled error..." } }
← senso_intelligence: { insight: "Similar vulnerability found in 2 previous repos" }
← agent_complete: { agent: "security", findingsCount: 15, provider: "tavily" }
← agent_complete: { agent: "quality", findingsCount: 12, provider: "fastino" }
← agent_complete: { agent: "pattern", findingsCount: 8, provider: "fastino" }
← status: { agent: "doctor", status: "running", message: "Generating fix documentation..." }
← agent_complete: { agent: "doctor", findingsCount: 15, provider: "openai" }
← status: { agent: "senso", status: "running", message: "Persisting to knowledge base..." }
← agent_complete: { agent: "senso", findingsCount: 39, provider: "senso" }
← complete: { healthScore: { overall: 73, letterGrade: "B-" }, duration: 42 }
```

---

## 4. SHARED TYPESCRIPT TYPES

These types are shared between frontend and backend. Place in `src/types/shared.ts`.

```typescript
// ============================================================
// CORE DOMAIN TYPES
// ============================================================

export type Severity = 'critical' | 'warning' | 'info';
export type AgentName = 'quality' | 'pattern' | 'security';
export type GraphViewMode = 'structure' | 'dependencies' | 'vulnerabilities';
export type AnalysisStatus = 'queued' | 'cloning' | 'mapping' | 'analyzing' | 'completing' | 'completed' | 'failed';
export type CategoryStatus = 'healthy' | 'warning' | 'critical';
export type LLMProvider = 'fastino' | 'openai' | 'tavily' | 'senso';

// ============================================================
// HEALTH SCORE
// ============================================================

export interface HealthScore {
  overall: number;                       // 0-100
  letterGrade: string;                   // "A+" through "F"
  breakdown: Record<string, CategoryScore>;
  confidence: number;                    // 0-1
}

export interface CategoryScore {
  score: number;                         // 0-10
  max: number;                           // always 10
  status: CategoryStatus;
}

// ============================================================
// FINDING
// ============================================================

export interface Finding {
  id: string;                            // "fnd_001"
  type: string;                          // "dependency_vulnerability" | "code_smell" | etc.
  severity: Severity;
  agent: AgentName;
  title: string;
  description: string;                   // Technical description
  plainDescription: string;              // Junior-friendly description
  location: FindingLocation;
  blastRadius: BlastRadius;
  cve?: CVEInfo;
  chainIds: string[];
  fixId?: string;
  sensoContentId?: string;
  confidence: number;                    // 0-1
}

export interface FindingLocation {
  files: string[];
  primaryFile: string;
  startLine: number;
  endLine: number;
}

export interface BlastRadius {
  filesAffected: number;
  functionsAffected: number;
  endpointsAffected: number;
}

export interface CVEInfo {
  id: string;                            // "CVE-2024-29041"
  cvssScore: number;                     // 0-10
  exploitAvailable: boolean;
  fixedVersion: string;
}

// ============================================================
// FIX
// ============================================================

export interface Fix {
  id: string;                            // "fix_001"
  priority: number;                      // 1 = highest
  title: string;
  severity: Severity;
  type: string;                          // "dependency_upgrade" | "code_patch" | "refactor"
  estimatedEffort: string;               // "30 minutes"
  chainsResolved: number;
  findingsResolved: string[];            // finding IDs
  documentation: FixDocumentation;
  sensoContentId?: string;
  sensoHistoricalContext?: string;
}

export interface FixDocumentation {
  whatsWrong: string;
  affectedCode: AffectedCode[];
  steps: string[];
  beforeCode?: string;
  afterCode?: string;
  migrationGuideUrl?: string;
}

export interface AffectedCode {
  file: string;
  lines: string;                         // "12-45"
  context: string;                       // "serves static files"
}

// ============================================================
// VULNERABILITY CHAIN
// ============================================================

export interface VulnerabilityChain {
  id: string;                            // "chain_001"
  severity: 'critical' | 'high' | 'medium';
  description: string;
  steps: ChainStep[];
  blastRadius: { files: number; functions: number; endpoints: number };
  keystoneFix: string;                   // fix ID
  findingIds: string[];
}

export interface ChainStep {
  type: 'entry' | 'flow' | 'vulnerability' | 'impact';
  node: string;                          // display label
  file?: string;                         // "src/routes/api.js:15"
  cve?: string;                          // "CVE-2024-29041"
  description: string;
}

// ============================================================
// GRAPH
// ============================================================

export interface GraphNode {
  id: string;
  type: 'file' | 'directory' | 'function' | 'class' | 'package' | 'endpoint';
  label: string;
  path?: string;
  category?: string;                     // "source" | "test" | "config"
  language?: string;
  lines?: number;
  severity?: CategoryStatus;
  findingCount: number;
  metadata: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'contains' | 'imports' | 'depends_on' | 'calls' | 'handles';
  isVulnerabilityChain: boolean;
  chainId?: string;
}

// ============================================================
// SENSO INTELLIGENCE
// ============================================================

export interface SensoSearchResult {
  answer: string;
  sources: SensoSource[];
  processingTimeMs: number;
  totalResults: number;
}

export interface SensoSource {
  contentId: string;
  title: string;
  score: number;
  chunkText: string;
}

export interface SensoInsight {
  type: 'pattern' | 'historical_fix' | 'cross_repo';
  title: string;
  description: string;
  reposAffected: number;
  sourceContentIds: string[];
}

export interface SensoGenerateResult {
  generatedText: string;
  sources: { contentId: string; title: string; score: number }[];
  processingTimeMs: number;
  savedContentId?: string;
}

// ============================================================
// AGENT STATUS (for progress tracking)
// ============================================================

export interface AgentStatus {
  name: AgentName | 'orchestrator' | 'doctor' | 'senso' | 'mapper';
  status: 'pending' | 'running' | 'complete' | 'error';
  progress: number;                      // 0-1
  message: string;
  findingsCount?: number;
  durationMs?: number;
  provider?: LLMProvider;                // which sponsor tool was used
}
```

---

## 5. COMPONENT ↔ ENDPOINT MAPPING

This table maps every frontend component to the backend endpoints it consumes.

| Component | Endpoint(s) | Trigger | Data Used |
|-----------|------------|---------|-----------|
| `<AnalysisInput />` | `POST /analyze` | Button click | Returns `analysisId` + `websocketUrl` |
| `<AnalysisProgress />` | WebSocket `/ws/analysis/:id` | Auto-connect after analyze | `status`, `finding`, `agent_complete` messages |
| `<AnalysisProgress />` | `GET /analysis/:id` (fallback) | Poll every 2s if WS fails | `status`, `agentStatuses` |
| `<HealthScoreHero />` | `GET /analysis/:id` | On `complete` WS message | `healthScore.overall`, `letterGrade`, `confidence` |
| `<ScoreBreakdown />` | `GET /analysis/:id` | Same as above | `healthScore.breakdown` (5 category scores) |
| `<GraphPanel />` | `GET /analysis/:id/graph?view=X` | View tab change | `nodes`, `edges`, `layout` |
| `<GraphPanel />` | WebSocket `graph_node` / `graph_edge` | During analysis | Progressive graph building |
| `<FindingsPanel />` | `GET /analysis/:id/findings?severity=X` | Filter change | `items`, `total` |
| `<FindingDetail />` | `GET /analysis/:id/findings` (cached) | Finding click | Single `Finding` object |
| `<FindingDetail />` | `GET /analysis/:id/chains` | When finding has `chainIds` | Matching `VulnerabilityChain` |
| `<FindingDetail />` | `GET /analysis/:id/fixes` | When finding has `fixId` | Matching `Fix` object |
| `<FixPlan />` | `GET /analysis/:id/fixes` | Tab click / auto-load | `fixes[]`, `summary` |
| `<SensoIntelligencePanel />` | `POST /analysis/:id/senso/search` | User query submit | `answer`, `sources` |
| `<SensoIntelligencePanel />` | `POST /analysis/:id/senso/generate` | Generate button | `generatedText`, `sources` |
| `<SensoIntelligencePanel />` | `GET /analysis/:id` | Auto-load | `sensoIntelligence` summary |

---

## 6. ERROR HANDLING CONTRACT

### HTTP Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;                        // Machine-readable error code
    message: string;                     // Human-readable message
    details?: Record<string, any>;       // Additional context
  };
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_URL` | 400 | Not a valid GitHub URL |
| `INVALID_PARAMS` | 400 | Missing or invalid request parameters |
| `REPO_NOT_FOUND` | 404 | GitHub repository doesn't exist or is private |
| `ANALYSIS_NOT_FOUND` | 404 | Analysis ID doesn't exist |
| `REPO_TOO_LARGE` | 400 | Repository exceeds max file limit |
| `RATE_LIMITED` | 429 | Too many requests (include `retryAfter` in details) |
| `CLONE_FAILED` | 502 | Failed to clone repository |
| `AGENT_FAILED` | 500 | Agent execution failed (include `agent` in details) |
| `LLM_UNAVAILABLE` | 503 | Fastino/OpenAI API unreachable |
| `NEO4J_UNAVAILABLE` | 503 | Neo4j database unreachable |
| `SENSO_UNAVAILABLE` | 503 | Senso API unreachable |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### WebSocket Error Recovery

```typescript
// Frontend should implement:
// 1. Reconnect with exponential backoff (1s, 2s, 4s, max 30s)
// 2. Fall back to polling GET /analysis/:id every 2s
// 3. Show error banner if both fail after 3 retries
```

---

## 7. STATE MACHINE: ANALYSIS LIFECYCLE

```
                    POST /analyze
                         │
                         ▼
                    ┌─────────┐
                    │ QUEUED   │
                    └────┬────┘
                         │
                         ▼
                    ┌─────────┐
                    │ CLONING  │──── error ──→ FAILED
                    └────┬────┘
                         │
                         ▼
                    ┌─────────┐
                    │ MAPPING  │──── error ──→ FAILED
                    └────┬────┘
                         │
                         ▼
                    ┌──────────┐
                    │ANALYZING │──── error ──→ FAILED (partial results may exist)
                    └────┬─────┘
                         │
                         ▼
                    ┌───────────┐
                    │COMPLETING │──── error ──→ COMPLETED (with warnings)
                    └────┬──────┘
                         │
                         ▼
                    ┌───────────┐
                    │ COMPLETED │
                    └───────────┘

States and what's happening:
  QUEUED     → Request accepted, waiting to start
  CLONING    → git clone in progress
  MAPPING    → Mapper Agent building Neo4j graph (Fastino extraction)
  ANALYZING  → Quality + Pattern + Security agents running in parallel
  COMPLETING → Doctor Agent generating fixes + Senso Agent ingesting
  COMPLETED  → All results available
  FAILED     → Unrecoverable error (check agentStatuses for details)
```

### Frontend State Rendering Rules

| Status | Show | Hide |
|--------|------|------|
| `queued` | Spinner + "Queued..." | Everything else |
| `cloning` | Progress bar + repo metadata | Dashboard |
| `mapping` | Progress bar + graph building (live nodes) | Score, findings |
| `analyzing` | Progress bars per agent + live findings | Final score |
| `completing` | "Generating fixes..." + partial findings | — |
| `completed` | Full dashboard: score, graph, findings, fixes, Senso | Progress bars |
| `failed` | Error message + retry button | Dashboard |

---

*This document is the single source of truth for all frontend ↔ backend communication.*