# VIBE CHECK — API CONTRACTS PRD v4.0
## Frontend (Next.js) ↔ Backend (FastAPI) Interface Definitions

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
3. WebSocket Protocol
4. Shared Types — TypeScript (Frontend) & Pydantic (Backend)
5. Component ↔ Endpoint Mapping
6. Error Handling Contract
7. State Machine: Analysis Lifecycle

---

## 1. OVERVIEW & CONVENTIONS

### Split Architecture

```
┌──────────────────────────┐     REST + WebSocket     ┌──────────────────────────┐
│  NEXT.JS FRONTEND        │ ◄──────────────────────► │  FASTAPI BACKEND         │
│  localhost:3000           │                          │  localhost:8000           │
│  React, Cytoscape.js     │                          │  Python 3.12, asyncio    │
│  Zustand, Framer Motion  │                          │  Pydantic, neo4j, httpx  │
└──────────────────────────┘                          └──────────────────────────┘
```

The frontend and backend are **separate processes**. The Next.js frontend calls the FastAPI backend's REST and WebSocket endpoints.

### Base URL

```
Backend API: http://localhost:8000/api/v1
WebSocket:   ws://localhost:8000/ws/analysis/{analysisId}
Frontend:    http://localhost:3000  (not relevant to contracts)
```

Production (stretch):
```
Backend API: https://api.vibecheck.app/api/v1
WebSocket:   wss://api.vibecheck.app/ws/analysis/{analysisId}
Frontend:    https://vibecheck.app
```

### CORS

The FastAPI backend allows the Next.js origin:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
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
- **Async:** 202 Accepted with `analysisId` for polling/WebSocket

### ID Prefixes

| Entity | Prefix | Example |
|--------|--------|---------|
| Analysis | `anl_` | `anl_7f3a2b` |
| Finding | `fnd_` | `fnd_001` |
| Fix | `fix_` | `fix_001` |
| Chain | `chain_` | `chain_001` |

### Frontend API Client Configuration

The Next.js frontend should configure its API base URL:

```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
```

```env
# .env.local (Next.js frontend)
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## 2. REST API ENDPOINTS

---

### 2.1 `POST /analyze`

**Purpose:** Start a new repository analysis. Returns immediately with an ID for WebSocket/polling.

**Frontend caller:** `<AnalysisInput />` component on form submit

#### FastAPI Route

```python
@router.post("/analyze", status_code=202, response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    analysis_id = f"anl_{uuid4().hex[:6]}"
    await create_analysis(analysis_id, request.repo_url, request.repo_name, request.branch)
    background_tasks.add_task(run_orchestrator, analysis_id, request)
    return AnalyzeResponse(
        analysisId=analysis_id,
        status="queued",
        repoName=extract_repo_name(request.repo_url),
        estimatedDuration=45,
        websocketUrl=f"/ws/analysis/{analysis_id}",
    )
```

#### Request

```typescript
// TypeScript (frontend)
interface AnalyzeRequest {
  repoUrl: string;
  branch?: string;
  scope?: 'full' | 'security-only' | 'quality-only';
  maxFiles?: number;
}
```

```python
# Pydantic (backend)
class AnalyzeRequest(BaseModel):
    repo_url: str = Field(alias="repoUrl")
    branch: str | None = None
    scope: Literal["full", "security-only", "quality-only"] = "full"
    max_files: int = Field(default=500, alias="maxFiles")

    model_config = ConfigDict(populate_by_name=True)
```

#### Example

```json
POST http://localhost:8000/api/v1/analyze
{
  "repoUrl": "https://github.com/user/repo",
  "branch": "main",
  "scope": "full",
  "maxFiles": 500
}
```

#### Response — 202 Accepted

```typescript
// TypeScript (frontend)
interface AnalyzeResponse {
  analysisId: string;
  status: 'queued';
  repoName: string;
  estimatedDuration: number;
  websocketUrl: string;
}
```

```python
# Pydantic (backend)
class AnalyzeResponse(BaseModel):
    analysis_id: str = Field(alias="analysisId")
    status: Literal["queued"] = "queued"
    repo_name: str = Field(alias="repoName")
    estimated_duration: int = Field(alias="estimatedDuration")
    websocket_url: str = Field(alias="websocketUrl")

    model_config = ConfigDict(populate_by_name=True, by_alias=True)
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
| 503 | `SERVICE_UNAVAILABLE` | Neo4j/LLM unreachable |

---

### 2.2 `GET /analysis/{analysisId}`

**Purpose:** Get full analysis status and results. Primary polling endpoint.

**Frontend caller:** `<Dashboard />` initial load + `<AnalysisProgress />` polling fallback

#### FastAPI Route

```python
@router.get("/analysis/{analysis_id}", response_model=AnalysisResult)
async def get_analysis(analysis_id: str):
    record = await get_analysis_record(analysis_id)
    if not record:
        raise HTTPException(404, detail={"code": "ANALYSIS_NOT_FOUND", "message": "Not found"})
    return AnalysisResult(**record)
```

#### Response — 200 OK

```typescript
// TypeScript (frontend)
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
  healthScore: HealthScore | null;
  findings: { critical: number; warning: number; info: number; total: number };
  vulnerabilityChains: number;
  fixesGenerated: number;
  timestamps: { startedAt: string; completedAt: string | null; duration: number | null };
}

type AnalysisStatus = 'queued' | 'cloning' | 'mapping' | 'analyzing' | 'completing' | 'completed' | 'failed';
```

```python
# Pydantic (backend)
class DetectedStack(BaseModel):
    languages: list[str]
    frameworks: list[str]
    package_manager: str = Field(alias="packageManager")
    build_system: str = Field(alias="buildSystem")

class RepoStats(BaseModel):
    total_files: int = Field(alias="totalFiles")
    total_lines: int = Field(alias="totalLines")
    total_dependencies: int = Field(alias="totalDependencies")
    total_dev_dependencies: int = Field(alias="totalDevDependencies")
    total_functions: int = Field(alias="totalFunctions")
    total_endpoints: int = Field(alias="totalEndpoints")

class FindingsSummary(BaseModel):
    critical: int
    warning: int
    info: int
    total: int

class Timestamps(BaseModel):
    started_at: str = Field(alias="startedAt")
    completed_at: str | None = Field(None, alias="completedAt")
    duration: int | None = None

class AnalysisResult(BaseModel):
    analysis_id: str = Field(alias="analysisId")
    status: AnalysisStatus
    repo_url: str = Field(alias="repoUrl")
    repo_name: str = Field(alias="repoName")
    branch: str
    detected_stack: DetectedStack = Field(alias="detectedStack")
    stats: RepoStats
    health_score: HealthScore | None = Field(None, alias="healthScore")
    findings: FindingsSummary
    vulnerability_chains: int = Field(alias="vulnerabilityChains")
    fixes_generated: int = Field(alias="fixesGenerated")
    timestamps: Timestamps

    model_config = ConfigDict(populate_by_name=True, by_alias=True)
```

#### Example Response

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
  "timestamps": {
    "startedAt": "2026-02-27T18:30:00Z",
    "completedAt": "2026-02-27T18:30:42Z",
    "duration": 42
  }
}
```

---

### 2.3 `GET /analysis/{analysisId}/findings`

**Purpose:** Paginated, filterable list of all findings.

**Frontend caller:** `<FindingsPanel />`

#### FastAPI Route

```python
@router.get("/analysis/{analysis_id}/findings", response_model=FindingsResponse)
async def get_findings(
    analysis_id: str,
    severity: Severity | None = None,
    agent: AgentName | None = None,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
):
    ...
```

#### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `severity` | `critical\|warning\|info` | all | Filter by severity |
| `agent` | `quality\|pattern\|security` | all | Filter by source agent |
| `limit` | number | 20 | Page size (max 100) |
| `offset` | number | 0 | Pagination offset |

#### Response — 200 OK

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
      "confidence": 0.95
    }
  ],
  "total": 39,
  "limit": 20,
  "offset": 0
}
```

---

### 2.4 `GET /analysis/{analysisId}/chains`

**Purpose:** Get all vulnerability chains with step-by-step attack paths.

**Frontend caller:** `<GraphPanel />` vulnerability overlay + `<FindingDetail />`

#### Response — 200 OK

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

### 2.5 `GET /analysis/{analysisId}/fixes`

**Purpose:** Prioritized fix plan with full documentation per fix.

**Frontend caller:** `<FixPlan />` + `<FindingDetail />`

#### Response — 200 OK

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
      }
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

### 2.6 `GET /analysis/{analysisId}/graph`

**Purpose:** Graph data for visualization. Filtered by view mode.

**Frontend caller:** `<GraphPanel />`

#### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `view` | `structure\|dependencies\|vulnerabilities` | `structure` | Graph view mode |
| `depth` | number | 2 | Traversal depth from root |

#### FastAPI Route

```python
@router.get("/analysis/{analysis_id}/graph", response_model=GraphResponse)
async def get_graph(
    analysis_id: str,
    view: GraphViewMode = "structure",
    depth: int = Query(default=2, ge=1, le=5),
):
    ...
```

#### Response — 200 OK

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

## 3. WEBSOCKET PROTOCOL

### Connection

```
ws://localhost:8000/ws/analysis/{analysisId}
```

Frontend connects immediately after receiving `analysisId` from `POST /analyze`.

#### FastAPI WebSocket Route

```python
# app/api/ws.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws.manager import ws_manager

router = APIRouter()

@router.websocket("/ws/analysis/{analysis_id}")
async def websocket_endpoint(websocket: WebSocket, analysis_id: str):
    await websocket.accept()
    ws_manager.connect(analysis_id, websocket)
    try:
        while True:
            # Keep connection alive; all messages are server → client
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(analysis_id, websocket)
```

```python
# app/ws/manager.py
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}

    def connect(self, analysis_id: str, ws: WebSocket):
        self._connections.setdefault(analysis_id, []).append(ws)

    def disconnect(self, analysis_id: str, ws: WebSocket):
        if analysis_id in self._connections:
            self._connections[analysis_id].remove(ws)

    async def broadcast(self, analysis_id: str, message: dict):
        for ws in self._connections.get(analysis_id, []):
            await ws.send_json(message)

ws_manager = ConnectionManager()
```

```python
# app/ws/broadcaster.py
class WebSocketBroadcaster:
    """Agent-facing helper that wraps ws_manager with typed methods."""

    def __init__(self, analysis_id: str):
        self.analysis_id = analysis_id

    async def send_status(self, agent: str, status: str, progress: float, message: str):
        await ws_manager.broadcast(self.analysis_id, {
            "type": "status", "agent": agent, "status": status,
            "progress": progress, "message": message,
        })

    async def send_finding(self, finding):
        await ws_manager.broadcast(self.analysis_id, {
            "type": "finding",
            "finding": {"id": finding.id, "severity": finding.severity,
                        "title": finding.title, "agent": finding.agent},
        })

    async def send_graph_node(self, node):
        await ws_manager.broadcast(self.analysis_id, {"type": "graph_node", "node": node})

    async def send_graph_edge(self, edge):
        await ws_manager.broadcast(self.analysis_id, {"type": "graph_edge", "edge": edge})

    async def send_agent_complete(self, agent: str, count: int, provider: str, duration_ms: int = 0):
        await ws_manager.broadcast(self.analysis_id, {
            "type": "agent_complete", "agent": agent,
            "findingsCount": count, "durationMs": duration_ms, "provider": provider,
        })

    async def send_complete(self, health_score, findings_summary):
        await ws_manager.broadcast(self.analysis_id, {
            "type": "complete",
            "healthScore": health_score.model_dump(by_alias=True),
            "findingsSummary": findings_summary.model_dump(by_alias=True),
            "duration": 42,
        })

    async def send_error(self, agent: str, message: str, recoverable: bool = False):
        await ws_manager.broadcast(self.analysis_id, {
            "type": "error", "agent": agent, "message": message, "recoverable": recoverable,
        })

    async def send_fastino_speed(self, message: str):
        """Special toast for Fastino speed callouts during demo."""
        await ws_manager.broadcast(self.analysis_id, {
            "type": "status", "agent": "mapper", "status": "running",
            "progress": -1, "message": f"⚡ Fastino: {message}",
        })
```

### Message Types (Server → Client)

All messages follow: `{ "type": string, ...payload }`

```typescript
// TypeScript (frontend) — Union type of all WebSocket messages
type WSMessage =
  | WSStatusUpdate
  | WSFinding
  | WSGraphNode
  | WSGraphEdge
  | WSAgentComplete
  | WSComplete
  | WSError;

interface WSStatusUpdate {
  type: 'status';
  agent: AgentName;
  status: 'pending' | 'running' | 'complete' | 'error';
  progress: number;                      // 0.0 - 1.0 (or -1 for speed callout)
  message: string;
}

interface WSFinding {
  type: 'finding';
  finding: { id: string; severity: Severity; title: string; agent: AgentName };
}

interface WSGraphNode {
  type: 'graph_node';
  node: GraphNode;
}

interface WSGraphEdge {
  type: 'graph_edge';
  edge: GraphEdge;
}

interface WSAgentComplete {
  type: 'agent_complete';
  agent: AgentName;
  findingsCount: number;
  durationMs: number;
  provider: 'fastino' | 'openai' | 'tavily';
}

interface WSComplete {
  type: 'complete';
  healthScore: HealthScore;
  findingsSummary: { critical: number; warning: number; info: number; total: number };
  duration: number;
}

interface WSError {
  type: 'error';
  agent?: AgentName;
  message: string;
  recoverable: boolean;
}

type AgentName = 'orchestrator' | 'mapper' | 'quality' | 'pattern' | 'security' | 'doctor';
```

### Message Sequence (Typical Scan)

```
← status: { agent: "orchestrator", status: "running", message: "Cloning repository..." }
← status: { agent: "orchestrator", status: "running", message: "Detected: Next.js + TypeScript" }
← status: { agent: "mapper", status: "running", progress: 0.1, message: "Scanning files..." }
← graph_node: { node: { type: "directory", label: "src/" } }
← graph_node: { node: { type: "file", label: "api.js" } }
← graph_edge: { edge: { source: "dir_src", target: "file_001", type: "contains" } }
← status: { agent: "mapper", status: "running", progress: -1, message: "⚡ Fastino: 47 files classified in 142ms" }
← agent_complete: { agent: "mapper", findingsCount: 0, provider: "fastino" }
← status: { agent: "quality", status: "running", message: "Analyzing code quality..." }
← status: { agent: "pattern", status: "running", message: "Checking patterns..." }
← status: { agent: "security", status: "running", message: "Searching for CVEs..." }
← finding: { finding: { id: "fnd_001", severity: "critical", title: "CVE-2024-29041..." } }
← finding: { finding: { id: "fnd_002", severity: "warning", title: "Unhandled error..." } }
← agent_complete: { agent: "security", findingsCount: 15, provider: "tavily" }
← agent_complete: { agent: "quality", findingsCount: 12, provider: "fastino" }
← agent_complete: { agent: "pattern", findingsCount: 8, provider: "fastino" }
← status: { agent: "doctor", status: "running", message: "Generating fix documentation..." }
← agent_complete: { agent: "doctor", findingsCount: 15, provider: "openai" }
← complete: { healthScore: { overall: 73, letterGrade: "B-" }, duration: 42 }
```

---

## 4. SHARED TYPES — TYPESCRIPT (FRONTEND) & PYDANTIC (BACKEND)

### TypeScript Types — `src/types/shared.ts` (Frontend)

```typescript
// ============================================================
// CORE ENUMS
// ============================================================

export type Severity = 'critical' | 'warning' | 'info';
export type AgentName = 'quality' | 'pattern' | 'security';
export type GraphViewMode = 'structure' | 'dependencies' | 'vulnerabilities';
export type AnalysisStatus = 'queued' | 'cloning' | 'mapping' | 'analyzing' | 'completing' | 'completed' | 'failed';
export type CategoryStatus = 'healthy' | 'warning' | 'critical';
export type LLMProvider = 'fastino' | 'openai' | 'tavily';

// ============================================================
// HEALTH SCORE
// ============================================================

export interface HealthScore {
  overall: number;
  letterGrade: string;
  breakdown: Record;
  confidence: number;
}

export interface CategoryScore {
  score: number;
  max: number;
  status: CategoryStatus;
}

// ============================================================
// FINDING
// ============================================================

export interface Finding {
  id: string;
  type: string;
  severity: Severity;
  agent: AgentName;
  title: string;
  description: string;
  plainDescription: string;
  location: FindingLocation;
  blastRadius: BlastRadius;
  cve?: CVEInfo;
  chainIds: string[];
  fixId?: string;
  confidence: number;
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
  id: string;
  cvssScore: number;
  exploitAvailable: boolean;
  fixedVersion: string;
}

// ============================================================
// FIX
// ============================================================

export interface Fix {
  id: string;
  priority: number;
  title: string;
  severity: Severity;
  type: string;
  estimatedEffort: string;
  chainsResolved: number;
  findingsResolved: string[];
  documentation: FixDocumentation;
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
  lines: string;
  context: string;
}

// ============================================================
// VULNERABILITY CHAIN
// ============================================================

export interface VulnerabilityChain {
  id: string;
  severity: 'critical' | 'high' | 'medium';
  description: string;
  steps: ChainStep[];
  blastRadius: { files: number; functions: number; endpoints: number };
  keystoneFix: string;
  findingIds: string[];
}

export interface ChainStep {
  type: 'entry' | 'flow' | 'vulnerability' | 'impact';
  node: string;
  file?: string;
  cve?: string;
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
  category?: string;
  language?: string;
  lines?: number;
  severity?: CategoryStatus;
  findingCount: number;
  metadata: Record;
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
// AGENT STATUS
// ============================================================

export interface AgentStatus {
  name: AgentName | 'orchestrator' | 'doctor' | 'mapper';
  status: 'pending' | 'running' | 'complete' | 'error';
  progress: number;
  message: string;
  findingsCount?: number;
  durationMs?: number;
  provider?: LLMProvider;
}
```

### Pydantic Models — `app/models/` (Backend)

```python
# app/models/shared.py
from __future__ import annotations
from typing import Literal, Any
from pydantic import BaseModel, Field, ConfigDict

# ============================================================
# CORE ENUMS
# ============================================================

Severity = Literal["critical", "warning", "info"]
AgentName = Literal["quality", "pattern", "security"]
FullAgentName = Literal["orchestrator", "mapper", "quality", "pattern", "security", "doctor"]
GraphViewMode = Literal["structure", "dependencies", "vulnerabilities"]
AnalysisStatus = Literal["queued", "cloning", "mapping", "analyzing", "completing", "completed", "failed"]
CategoryStatus = Literal["healthy", "warning", "critical"]
LLMProvider = Literal["fastino", "openai", "tavily"]

# ============================================================
# HEALTH SCORE
# ============================================================

class CategoryScore(BaseModel):
    score: int
    max: int = 10
    status: CategoryStatus

class HealthScore(BaseModel):
    overall: int
    letter_grade: str = Field(alias="letterGrade")
    breakdown: dict[str, CategoryScore]
    confidence: float
    model_config = ConfigDict(populate_by_name=True, by_alias=True)

# ============================================================
# FINDING
# ============================================================

class FindingLocation(BaseModel):
    files: list[str]
    primary_file: str = Field(alias="primaryFile")
    start_line: int = Field(alias="startLine")
    end_line: int = Field(alias="endLine")
    model_config = ConfigDict(populate_by_name=True, by_alias=True)

class BlastRadius(BaseModel):
    files_affected: int = Field(alias="filesAffected")
    functions_affected: int = Field(alias="functionsAffected")
    endpoints_affected: int = Field(alias="endpointsAffected")
    model_config = ConfigDict(populate_by_name=True, by_alias=True)

class CVEInfo(BaseModel):
    id: str
    cvss_score: float = Field(alias="cvssScore")
    exploit_available: bool = Field(alias="exploitAvailable")
    fixed_version: str = Field(alias="fixedVersion")
    model_config = ConfigDict(populate_by_name=True, by_alias=True)

class Finding(BaseModel):
    id: str
    type: str
    severity: Severity
    agent: AgentName
    title: str
    description: str
    plain_description: str = Field(alias="plainDescription")
    location: FindingLocation
    blast_radius: BlastRadius = Field(alias="blastRadius")
    cve: CVEInfo | None = None
    chain_ids: list[str] = Field(default_factory=list, alias="chainIds")
    fix_id: str | None = Field(None, alias="fixId")
    confidence: float
    model_config = ConfigDict(populate_by_name=True, by_alias=True)

# ============================================================
# FIX
# ============================================================

class AffectedCode(BaseModel):
    file: str
    lines: str
    context: str

class FixDocumentation(BaseModel):
    whats_wrong: str = Field(alias="whatsWrong")
    affected_code: list[AffectedCode] = Field(alias="affectedCode")
    steps: list[str]
    before_code: str | None = Field(None, alias="beforeCode")
    after_code: str | None = Field(None, alias="afterCode")
    migration_guide_url: str | None = Field(None, alias="migrationGuideUrl")
    model_config = ConfigDict(populate_by_name=True, by_alias=True)

class Fix(BaseModel):
    id: str
    priority: int
    title: str
    severity: Severity
    type: str
    estimated_effort: str = Field(alias="estimatedEffort")
    chains_resolved: int = Field(alias="chainsResolved")
    findings_resolved: list[str] = Field(alias="findingsResolved")
    documentation: FixDocumentation
    model_config = ConfigDict(populate_by_name=True, by_alias=True)

class FixSummary(BaseModel):
    total_fixes: int = Field(alias="totalFixes")
    critical_fixes: int = Field(alias="criticalFixes")
    estimated_total_effort: str = Field(alias="estimatedTotalEffort")
    keystone_fixes: int = Field(alias="keystoneFixes")
    chains_eliminated_by_keystones: int = Field(alias="chainsEliminatedByKeystones")
    model_config = ConfigDict(populate_by_name=True, by_alias=True)

# ============================================================
# VULNERABILITY CHAIN
# ============================================================

class ChainStep(BaseModel):
    type: Literal["entry", "flow", "vulnerability", "impact"]
    node: str
    file: str | None = None
    cve: str | None = None
    description: str

class VulnerabilityChain(BaseModel):
    id: str
    severity: Literal["critical", "high", "medium"]
    description: str
    steps: list[ChainStep]
    blast_radius: dict[str, int] = Field(alias="blastRadius")
    keystone_fix: str = Field(alias="keystoneFix")
    finding_ids: list[str] = Field(alias="findingIds")
    model_config = ConfigDict(populate_by_name=True, by_alias=True)

# ============================================================
# GRAPH
# ============================================================

class GraphNode(BaseModel):
    id: str
    type: Literal["file", "directory", "function", "class", "package", "endpoint"]
    label: str
    path: str | None = None
    category: str | None = None
    language: str | None = None
    lines: int | None = None
    severity: CategoryStatus | None = None
    finding_count: int = Field(0, alias="findingCount")
    metadata: dict[str, Any] = Field(default_factory=dict)
    model_config = ConfigDict(populate_by_name=True, by_alias=True)

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: Literal["contains", "imports", "depends_on", "calls", "handles"]
    is_vulnerability_chain: bool = Field(False, alias="isVulnerabilityChain")
    chain_id: str | None = Field(None, alias="chainId")
    model_config = ConfigDict(populate_by_name=True, by_alias=True)

class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    layout: dict[str, str]

```

**Key Pydantic Convention:** All models use `by_alias=True` serialization so the JSON output uses camelCase (matching the TypeScript frontend types), while Python code uses snake_case internally.

---

## 5. COMPONENT ↔ ENDPOINT MAPPING

| Component | Endpoint(s) | Trigger | Data Used |
|-----------|------------|---------|-----------|
| `<AnalysisInput />` | `POST http://localhost:8000/api/v1/analyze` | Button click | Returns `analysisId` + `websocketUrl` |
| `<AnalysisProgress />` | `ws://localhost:8000/ws/analysis/:id` | Auto-connect after analyze | `status`, `finding`, `agent_complete` messages |
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

---

## 6. ERROR HANDLING CONTRACT

### HTTP Error Response Format

```python
# FastAPI exception handler
from fastapi import HTTPException

class VibeCheckError(HTTPException):
    def __init__(self, status_code: int, code: str, message: str, details: dict = None):
        super().__init__(
            status_code=status_code,
            detail={"error": {"code": code, "message": message, "details": details}},
        )
```

```typescript
// TypeScript (frontend)
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record;
  };
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_URL` | 400 | Not a valid GitHub URL |
| `INVALID_PARAMS` | 400 | Missing or invalid request parameters (Pydantic validation) |
| `REPO_NOT_FOUND` | 404 | GitHub repository doesn't exist or is private |
| `ANALYSIS_NOT_FOUND` | 404 | Analysis ID doesn't exist |
| `REPO_TOO_LARGE` | 400 | Repository exceeds max file limit |
| `RATE_LIMITED` | 429 | Too many requests (include `retryAfter` in details) |
| `CLONE_FAILED` | 502 | Failed to clone repository |
| `AGENT_FAILED` | 500 | Agent execution failed (include `agent` in details) |
| `LLM_UNAVAILABLE` | 503 | Fastino/OpenAI API unreachable |
| `NEO4J_UNAVAILABLE` | 503 | Neo4j database unreachable |
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
  QUEUED     → Request accepted, BackgroundTask queued
  CLONING    → asyncio.create_subprocess_exec git clone
  MAPPING    → Mapper Agent building Neo4j graph (Fastino extraction)
  ANALYZING  → Quality + Pattern + Security via asyncio.TaskGroup
  COMPLETING → Doctor Agent
  COMPLETED  → All results available, Health Score computed
  FAILED     → Unrecoverable error (check agentStatuses)
```

### Frontend State Rendering Rules

| Status | Show | Hide |
|--------|------|------|
| `queued` | Spinner + "Queued..." | Everything else |
| `cloning` | Progress bar + repo metadata | Dashboard |
| `mapping` | Progress bar + graph building (live nodes) | Score, findings |
| `analyzing` | Progress bars per agent + live findings | Final score |
| `completing` | "Generating fixes..." + partial findings | — |
| `completed` | Full dashboard: score, graph, findings, fixes | Progress bars |
| `failed` | Error message + retry button | Dashboard |

---

## APPENDIX: RUNNING BOTH SERVICES

### Development Setup

```bash
# Terminal 1: FastAPI Backend
cd vibe-check-backend
pip install -r requirements.txt
cp .env.example .env  # fill in API keys
uvicorn app.main:app --reload --port 8000

# Terminal 2: Next.js Frontend
cd vibe-check-frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" > .env.local
echo "NEXT_PUBLIC_WS_URL=ws://localhost:8000" >> .env.local
npm run dev
```

### Docker Compose (Stretch)

```yaml
version: "3.9"
services:
  backend:
    build: ./vibe-check-backend
    ports: ["8000:8000"]
    env_file: ./vibe-check-backend/.env
  frontend:
    build: ./vibe-check-frontend
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://backend:8000/api/v1
      NEXT_PUBLIC_WS_URL: ws://backend:8000
    depends_on: [backend]
```

---

*This document is the single source of truth for all frontend ↔ backend communication.*