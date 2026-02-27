# VIBE CHECK — Codebase Intelligence Engine
## Sponsor API Reference · Autonomous Agents Hackathon · Feb 27, 2026

> **Quick links:** [docs.yutori.com](https://docs.yutori.com) · [sensoai.mintlify.app](https://sensoai.mintlify.app/introduction) · [neo4j.com/docs](https://neo4j.com/docs) · [docs.tavily.com](https://docs.tavily.com)  
> **Support:** `support@yutori.com` · `tom@senso.ai` · hackathon Discord

---

## Sponsor Priority Map

| Sponsor | Priority | Role in VIBE CHECK |
|---|---|---|
| **Yutori** | 🔴 PRIMARY REASONING | n1 powers all 5 specialist agents (OpenAI-compatible). Browsing API does live CVE lookups. Research API runs deep dependency intelligence. Scouting API monitors for new CVEs post-analysis. |
| **Senso** | 🔴 ESSENTIAL | Context OS — all findings flow in via `/content`, agents query via `/search` and `/generate`, rules + webhooks are the real-time event bus |
| **Neo4j** | 🔴 ESSENTIAL | The knowledge graph — files, functions, dependencies, CVE chains, blast radius. The graph IS the product. |
| **Tavily** | 🔴 ESSENTIAL | Fast supplemental web search — quick CVE lookups, changelog snippets, confirming fix versions |
| **OpenAI** | 🟡 BACKUP | Fallback reasoning when Yutori n1 is unavailable. Structured outputs for schema-critical graph writes. |
| **Fastino** | 🟡 MODERATE | Fast entity pre-extraction (functions, imports, endpoints) before Yutori/OpenAI — cuts tokens, speeds analysis |
| **AWS** | 🟡 MODERATE | Lambda (parallel agent execution), S3 (repo storage), DynamoDB (state), EventBridge (agent coordination) |
| **Render** | 🟢 SUPPORT | Deploy the API server and Next.js dashboard |

---

## Table of Contents

1. [Yutori — Primary Reasoning Engine 🔴](#1-yutori--primary-reasoning-engine-)
2. [Senso — Context OS 🔴](#2-senso--context-os-)
3. [Neo4j — Knowledge Graph 🔴](#3-neo4j--knowledge-graph-)
4. [Tavily — Supplemental Web Search 🔴](#4-tavily--supplemental-web-search-)
5. [OpenAI — Backup Reasoning 🟡](#5-openai--backup-reasoning-)
6. [Fastino — Fast Entity Extraction 🟡](#6-fastino--fast-entity-extraction-)
7. [AWS — Infrastructure 🟡](#7-aws--infrastructure-)
8. [Render — Deployment 🟢](#8-render--deployment-)
9. [Full Integration Guide](#9-full-integration-guide)
10. [Environment Variables Checklist](#10-environment-variables-checklist)

---

## 1. Yutori — Primary Reasoning Engine 🔴

> **Why Yutori is PRIMARY:** Yutori's n1 model is a pixels-to-actions LLM built specifically for web agents. It outperforms frontier models on browser benchmarks (78.7% on Online-Mind2Web, 83.4% on Navi-Bench) while being **2.5× faster and 5.6× cheaper than Claude Opus**. For VIBE CHECK this means:
> - **n1 API** → the core reasoning brain for all five specialist agents, via a drop-in OpenAI-compatible interface  
> - **Browsing API** → navigate live NVD/GitHub Security Advisories/Snyk pages to extract CVE data autonomously  
> - **Research API** → fire 100+ MCP tools in parallel for comprehensive dependency security intelligence  
> - **Scouting API** → continuous post-analysis monitoring that alerts the dashboard the moment a new CVE drops for a repo's dependencies  

Founded by former Meta AI researchers (Dhruv Batra, Abhishek Das, Devi Parikh). n1 is initialized from Qwen3-VL and trained via RL on **live websites** — not simulations.

---

### Setup & Authentication

```bash
# Install
pip install yutori

# Option A: CLI login (saves key to ~/.yutori/config.json)
yutori auth login

# Option B: environment variable (recommended for deployed apps)
export YUTORI_API_KEY="yt-your-key-here"

# Verify connectivity
curl --request GET --url https://api.yutori.com/health
# → { "status": "ok" }
```

```python
from yutori import YutoriClient, AsyncYutoriClient
import os

# Key resolution order: explicit → YUTORI_API_KEY env → ~/.yutori/config.json
client = YutoriClient()                       # uses env/saved creds
client = YutoriClient(api_key="yt-...")       # explicit

# Configuration options
client = YutoriClient(
    api_key="yt-...",
    base_url="https://api.yutori.com/v1",     # default
    timeout=30.0,                              # seconds
)
```

> **Get access:** [platform.yutori.com/sign-up](https://platform.yutori.com/sign-up) → Billing → Set Up Billing → Settings → Create API Key

---

### n1 API — Pixels-to-Actions LLM

n1 follows the **OpenAI Chat Completions interface exactly** — same endpoint shape, same message format, same tool_calls response. You can swap it in anywhere you're currently using GPT-4o just by changing the model name.

**Endpoint:** `POST https://api.yutori.com/v1/chat/completions`  
**Model:** `n1-latest`  
**SDK namespace:** `client.chat.completions.create(...)`

#### Text reasoning — drop-in for GPT-4o

```python
from yutori import YutoriClient

client = YutoriClient()

# Any reasoning task — identical to OpenAI
response = client.chat.completions.create(
    model="n1-latest",
    messages=[
        {
            "role": "system",
            "content": "You are a senior security engineer specializing in Node.js supply chain vulnerabilities."
        },
        {
            "role": "user",
            "content": f"Analyze this package.json for vulnerable dependencies and return a JSON list of findings:\n\n{manifest_content}"
        }
    ]
)

answer = response.choices[0].message.content
print(answer)
```

#### Vision + browser action prediction

n1's unique power: given a screenshot, it predicts the next browser action (click, type, scroll, navigate). This is what powers the Browsing API under the hood — but you can also call it directly if you manage your own browser infrastructure.

```python
import base64

# Load a screenshot
with open("browser_screenshot.png", "rb") as f:
    image_b64 = base64.b64encode(f.read()).decode()

response = client.chat.completions.create(
    model="n1-latest",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Navigate to the CVE detail page for CVE-2024-29041 on nvd.nist.gov"
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{image_b64}"
                    }
                }
            ]
        }
    ]
)

message = response.choices[0].message

# n1's reasoning text
print("Reasoning:", message.content)

# Browser actions n1 wants to take
if message.tool_calls:
    for tool_call in message.tool_calls:
        action = tool_call.function.name        # "click" | "type" | "scroll" | "navigate"
        args   = tool_call.function.arguments   # JSON string: coordinates, text, etc.
        print(f"  → {action}: {args}")
```

#### Raw REST (no SDK)

```python
import requests, os

def n1_complete(messages: list, system: str = None) -> str:
    """Direct REST call to n1 — works identically to OpenAI."""
    all_messages = []
    if system:
        all_messages.append({"role": "system", "content": system})
    all_messages.extend(messages)

    resp = requests.post(
        "https://api.yutori.com/v1/chat/completions",
        headers={
            "X-API-KEY": os.environ["YUTORI_API_KEY"],
            "Content-Type": "application/json"
        },
        json={"model": "n1-latest", "messages": all_messages},
        timeout=60
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]
```

#### VIBE CHECK — n1 for each specialist agent

```python
# ── Mapper Agent: extract code structure as graph nodes ─────────────────────

def n1_extract_graph_nodes(file_content: str, file_path: str) -> dict:
    """Returns structured JSON for Neo4j graph writes."""
    response = client.chat.completions.create(
        model="n1-latest",
        messages=[{
            "role": "user",
            "content": f"""Extract all code entities from this file.
Return valid JSON with keys: functions, classes, imports, exports.
Each function: name, startLine, endLine, complexity (1-10 estimate), params (count), exported (bool).
Each import: path, type (local|package|stdlib).

File: {file_path}
---
{file_content}"""
        }]
    )
    import json
    text = response.choices[0].message.content.strip()
    # Strip markdown fences if model wraps in ```json
    if text.startswith("```"):
        text = text.split("```")[1].lstrip("json").strip()
    return json.loads(text)


# ── Quality Agent: find bugs, dead code, complexity hotspots ────────────────

def n1_quality_analysis(file_content: str, language: str) -> list:
    response = client.chat.completions.create(
        model="n1-latest",
        messages=[
            {"role": "system", "content": f"You are a {language} code quality expert."},
            {"role": "user", "content": f"""Find all quality issues in this code.
Return a JSON array. Each item: type (bug|dead_code|code_smell|high_complexity),
severity (CRITICAL|HIGH|MEDIUM|LOW), line (int), description (str), fix (one-sentence str).

{file_content}"""}
        ]
    )
    import json
    text = response.choices[0].message.content.strip().lstrip("```json").rstrip("```").strip()
    return json.loads(text)


# ── Security Agent: vulnerability analysis for a single file ────────────────

def n1_security_analysis(file_content: str, dependencies: list[dict]) -> list:
    deps = "\n".join(f"  - {d['name']}@{d['version']}" for d in dependencies)
    response = client.chat.completions.create(
        model="n1-latest",
        messages=[
            {"role": "system", "content": "You are a security expert specializing in OWASP Top 10 and supply chain attacks."},
            {"role": "user", "content": f"""Analyze for security vulnerabilities.
Known dependencies:
{deps}

Look for: injection, XSS, CSRF, insecure deps, hardcoded secrets, missing auth, path traversal.
Return JSON array. Each item: type, severity (CRITICAL|HIGH|MEDIUM|LOW),
line (int or null), description, cwe_id (e.g. CWE-79), fix.

{file_content}"""}
        ]
    )
    import json
    text = response.choices[0].message.content.strip().lstrip("```json").rstrip("```").strip()
    return json.loads(text)


# ── Doctor Agent: generate actionable fix documentation ─────────────────────

def n1_generate_fix_doc(finding: dict, codebase_context: str) -> str:
    response = client.chat.completions.create(
        model="n1-latest",
        messages=[
            {"role": "system", "content": "You are a senior engineer writing fix guides for a security audit report."},
            {"role": "user", "content": f"""Generate a complete fix guide for this finding.

Finding: {finding['type']} — {finding['description']}
File: {finding.get('file', 'N/A')} (line {finding.get('line', 'N/A')})
Severity: {finding['severity']}
Related codebase context:
{codebase_context}

Structure your response as:
## Root Cause
## Before / After Code
## Commands to Run
## Verification Steps
## Effort Estimate (Quick <30min | Medium 1-2hr | Complex >2hr)"""}
        ]
    )
    return response.choices[0].message.content


# ── Orchestrator Agent: final health score ──────────────────────────────────

def n1_compute_health_score(all_findings: list[dict]) -> dict:
    summary = "\n".join([
        f"- [{f['severity']}] {f['type']}: {f['description'][:80]}"
        for f in all_findings
    ])
    response = client.chat.completions.create(
        model="n1-latest",
        messages=[{
            "role": "user",
            "content": f"""Given these findings, compute a codebase health score.
Return JSON: {{
  "score": 0-100,
  "grade": "A|B|C|D|F",
  "risk_level": "CRITICAL|HIGH|MEDIUM|LOW",
  "summary": "one paragraph for non-technical stakeholders",
  "top_3_priorities": ["...", "...", "..."]
}}

Findings:
{summary}"""
        }]
    )
    import json
    text = response.choices[0].message.content.strip().lstrip("```json").rstrip("```").strip()
    return json.loads(text)
```

---

### Browsing API — Cloud Browser Automation

The Browsing API runs n1 on Yutori's managed cloud browser. Give it a task in natural language; it clicks, types, scrolls, and navigates to complete it. Tasks are **async** — create then poll.

**Create:** `POST https://api.yutori.com/v1/browsing/tasks`  
**Poll:** `GET https://api.yutori.com/v1/browsing/tasks/{task_id}`  
**Trajectory:** `GET https://api.yutori.com/v1/browsing/tasks/{task_id}/trajectory`  
**SDK:** `client.browsing.create(...)` / `client.browsing.get(task_id)`

#### Create and poll a browsing task

```python
import time

def browse(task_description: str, start_url: str,
           max_steps: int = 75, require_auth: bool = False,
           output_schema: dict = None, webhook_url: str = None,
           poll_interval: int = 5, timeout: int = 300) -> dict:
    """
    Create a browsing task and block until complete.

    Parameters:
      task_description  Natural language description of what to do
      start_url         URL to open first
      max_steps         Max browser actions before giving up (default 75)
      require_auth      True for login-heavy flows — picks auth-optimized provider
      output_schema     JSON Schema for structured output
      webhook_url       POST results here when done instead of polling
      poll_interval     Seconds between status checks
      timeout           Max seconds to wait

    Returns:
      result dict with keys: task_id, status, output, error
    """
    create_kwargs = {
        "task": task_description,
        "start_url": start_url,
        "max_steps": max_steps,
        "require_auth": require_auth,
    }
    if output_schema:
        create_kwargs["output_schema"] = output_schema
    if webhook_url:
        create_kwargs["webhook_url"] = webhook_url

    task = client.browsing.create(**create_kwargs)
    task_id = task["task_id"]
    print(f"  Browsing task started: {task_id}")

    if webhook_url:
        return task  # results delivered async to webhook

    # Poll until done
    deadline = time.time() + timeout
    while time.time() < deadline:
        result = client.browsing.get(task_id)
        status = result["status"]
        print(f"  [{status}] {task_id}")
        if status in ("succeeded", "failed"):
            return result
        time.sleep(poll_interval)
    raise TimeoutError(f"Browsing task {task_id} timed out after {timeout}s")
```

#### Browsing with structured JSON output

```python
# Get structured data back, not just a text blob
task = client.browsing.create(
    task="""Go to https://github.com/advisories and search for advisories
    affecting the npm package 'express'. Return the 5 most recent advisories.""",
    start_url="https://github.com/advisories",
    max_steps=75,
    webhook_url="https://your-app.onrender.com/api/yutori-browsing",
    output_schema={
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "cve_id":            {"type": "string"},
                "severity":          {"type": "string", "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"]},
                "affected_versions": {"type": "string"},
                "patched_version":   {"type": "string"},
                "description":       {"type": "string"}
            },
            "required": ["cve_id", "severity", "affected_versions", "patched_version"]
        }
    }
)
# Structured JSON array POSTed to webhook_url on completion
```

#### VIBE CHECK browsing patterns — Security Agent

```python
def browse_nvd_for_cve(package_name: str, version: str) -> dict:
    """Look up CVEs on NVD for an exact package@version."""
    return browse(
        task_description=f"""Search NVD (nvd.nist.gov/vuln/search) for all
        vulnerabilities in {package_name} version {version}.
        For each CVE return: CVE ID, CVSS v3 score and severity, affected version range,
        fixed version, brief description, whether a public exploit exists.""",
        start_url="https://nvd.nist.gov/vuln/search",
        max_steps=60,
        output_schema={
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "cve_id":          {"type": "string"},
                    "cvss_score":      {"type": "number"},
                    "severity":        {"type": "string"},
                    "affected_range":  {"type": "string"},
                    "fixed_version":   {"type": "string"},
                    "description":     {"type": "string"},
                    "has_exploit":     {"type": "boolean"}
                }
            }
        }
    )


def browse_for_migration_guide(package: str, from_ver: str, to_ver: str) -> str:
    """Doctor Agent: fetch the official upgrade/migration guide for a package."""
    result = browse(
        task_description=f"""Find the official CHANGELOG or migration guide for
        upgrading {package} from {from_ver} to {to_ver}. Extract all breaking
        changes and any required code changes.""",
        start_url=f"https://www.npmjs.com/package/{package}",
        max_steps=50,
    )
    return result.get("output", "")


def browse_snyk_advisory(package: str, ecosystem: str = "npm") -> dict:
    """Browse Snyk's vulnerability database for a package."""
    return browse(
        task_description=f"Extract all known vulnerabilities, severity scores, and upgrade paths.",
        start_url=f"https://snyk.io/advisor/{ecosystem}/{package}",
        max_steps=40,
    )
```

#### Download the task trajectory (great for demo)

```python
import requests, os

# Get every step the agent took — screenshots, actions, reasoning
trajectory = requests.get(
    f"https://api.yutori.com/v1/browsing/tasks/{task_id}/trajectory",
    headers={"X-API-KEY": os.environ["YUTORI_API_KEY"]}
).json()

for step in trajectory.get("steps", []):
    print(f"Step {step['step_number']}: {step['action']}")
    print(f"  Reasoning: {step['reasoning'][:120]}")
    # step also contains: screenshot_url, coordinates, typed_text
```

---

### Research API — Deep Multi-Source Intelligence

Unlike the Browsing API (single navigator), Research deploys **100+ MCP tools in parallel** — search engines, APIs, GitHub, npm registry, academic papers, Stack Overflow, all at once. Use this when you need comprehensive intelligence on a package's full security history, not just one CVE.

**Create:** `POST https://api.yutori.com/v1/research/tasks`  
**Poll:** `GET https://api.yutori.com/v1/research/tasks/{task_id}`  
**SDK:** `client.research.create(...)` / `client.research.get(task_id)`

```python
import time

def research(query: str, output_schema: dict = None,
             webhook_url: str = None,
             poll_interval: int = 10, timeout: int = 600) -> dict:
    """
    Create a research task and block until complete.
    Research tasks take longer than browsing — allow up to 10 minutes.

    Parameters:
      query           Natural language research question
      output_schema   JSON Schema — shapes the output field in the response
      webhook_url     POST results here when done (async alternative to polling)
      poll_interval   Seconds between status checks (default 10)
      timeout         Max seconds to wait (default 600)

    Returns:
      result dict: { task_id, status, output, ... }
      output is a markdown report string, or structured JSON if output_schema set
    """
    create_kwargs = {
        "query": query,
        "user_timezone": "America/Los_Angeles",
    }
    if output_schema:
        create_kwargs["output_schema"] = output_schema
    if webhook_url:
        create_kwargs["webhook_url"] = webhook_url

    task = client.research.create(**create_kwargs)
    task_id = task["task_id"]
    print(f"  Research task started: {task_id}")

    if webhook_url:
        return task

    deadline = time.time() + timeout
    while time.time() < deadline:
        result = client.research.get(task_id)
        status = result["status"]
        print(f"  [Research {status}] {task_id}")
        if status in ("succeeded", "failed"):
            return result
        time.sleep(poll_interval)
    raise TimeoutError(f"Research task {task_id} timed out after {timeout}s")
```

#### Research with structured output

```python
result = research(
    query="""Comprehensive security audit of these npm packages:
    - express@4.17.1
    - lodash@4.17.20
    - axios@0.21.1

    For each: all known CVEs with CVSS scores, minimum safe version,
    breaking changes in the upgrade path, any known public exploits.""",
    output_schema={
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "package":              {"type": "string"},
                "current_version":      {"type": "string"},
                "safe_version":         {"type": "string"},
                "has_breaking_changes": {"type": "boolean"},
                "cve_count":            {"type": "integer"},
                "critical_count":       {"type": "integer"},
                "cves": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id":       {"type": "string"},
                            "cvss":     {"type": "number"},
                            "severity": {"type": "string"},
                            "summary":  {"type": "string"}
                        }
                    }
                }
            }
        }
    }
)

# result["output"] is now a typed list matching the schema
for pkg in result["output"]:
    print(f"{pkg['package']}: {pkg['cve_count']} CVEs, safe version: {pkg['safe_version']}")
```

#### VIBE CHECK research patterns

```python
def research_dependency_security(packages: list[dict]) -> dict:
    """Security Agent: comprehensive CVE research on all deps in one call."""
    pkg_list = "\n".join(f"  - {p['name']}@{p['version']}" for p in packages)
    return research(
        query=f"""Conduct a full security audit for these dependencies:
{pkg_list}

For each package:
1. All CVEs from NVD and GitHub Advisories
2. CVSS scores and severity ratings
3. Minimum safe patched version
4. Breaking changes in the upgrade path
5. Known public exploit availability
6. Attack surface: is this a direct dep or transitive?

Prioritize: CRITICAL > HIGH, then by blast radius impact.""",
        output_schema={
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "package": {"type": "string"},
                    "version": {"type": "string"},
                    "safe_version": {"type": "string"},
                    "has_breaking_upgrade": {"type": "boolean"},
                    "cve_count": {"type": "integer"},
                    "cves": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "cvss": {"type": "number"},
                                "severity": {"type": "string"},
                                "has_exploit": {"type": "boolean"},
                                "summary": {"type": "string"}
                            }
                        }
                    }
                }
            }
        }
    )


def research_best_practices(language: str, frameworks: list[str]) -> str:
    """Pattern Agent: research current best practices for the detected stack."""
    result = research(
        query=f"""What are the current (2025-2026) best practices and most common
        anti-patterns for {language} projects using {', '.join(frameworks)}?
        Cover: security patterns, architectural patterns, performance patterns,
        and the top mistakes teams make. Link to official docs where possible."""
    )
    return result.get("output", "")
```

---

### Scouting API — Continuous Dependency Monitoring

Scouts run on a configurable schedule and fire a webhook when anything relevant changes. For VIBE CHECK, create a scout per analyzed repo so judges and users get alerted the instant a new CVE drops for a dependency — even after the hackathon ends. This is the feature that turns VIBE CHECK from a one-time audit into an ongoing security layer.

**Create:** `POST https://api.yutori.com/v1/scouts`  
**List:** `GET https://api.yutori.com/v1/scouts`  
**Get:** `GET https://api.yutori.com/v1/scouts/{id}`  
**Update:** `PATCH https://api.yutori.com/v1/scouts/{id}`  
**Updates:** `GET https://api.yutori.com/v1/scouts/{id}/updates`  
**Delete:** `DELETE https://api.yutori.com/v1/scouts/{id}`  
**SDK:** `client.scouts.*`

#### Create a vulnerability monitoring scout

```python
def create_dependency_scout(
    packages: list[dict],
    webhook_url: str,
    check_interval_seconds: int = 3600  # hourly
) -> str:
    """
    Create a scout that monitors for new CVEs affecting a repo's dependencies.
    Returns the scout ID.

    Parameters:
      packages                  [{"name": "express", "version": "4.17.1"}, ...]
      webhook_url               Where to POST results when new CVEs are found
      check_interval_seconds    How often to run (3600=hourly, 86400=daily)
    """
    pkg_list = ", ".join(f"{p['name']}@{p['version']}" for p in packages)

    scout = client.scouts.create(
        query=f"""Monitor for new security vulnerabilities (CVEs) affecting these packages:
        {pkg_list}
        Alert when: any new CVE is published, or an existing CVE severity is upgraded.
        Include: CVE ID, CVSS score, affected versions, patched version, brief description.""",
        output_interval=check_interval_seconds,
        user_timezone="America/Los_Angeles",
        skip_email=True,                # webhooks only — no email noise during hackathon
        webhook_url=webhook_url,
        output_schema={
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "package":   {"type": "string"},
                    "cve_id":    {"type": "string"},
                    "severity":  {"type": "string"},
                    "cvss":      {"type": "number"},
                    "summary":   {"type": "string"},
                    "fix":       {"type": "string"},
                    "published": {"type": "string"}
                }
            }
        }
    )

    scout_id = scout["id"]
    print(f"Scout created: {scout_id} — checking every {check_interval_seconds}s")
    return scout_id
```

#### Scout lifecycle management

```python
# List all active scouts
active = client.scouts.list(status="active")
for s in active:
    print(f"  {s['id']}: {s['query'][:60]}... | next_run: {s.get('next_run_at')}")

# Get a specific scout + metadata
scout = client.scouts.get(scout_id)
print(f"Last run: {scout.get('last_run_at')}")
print(f"Status:   {scout.get('status')}")

# Get the last 20 update reports
updates = client.scouts.get_updates(scout_id, limit=20)
for update in updates:
    print(f"[{update['created_at']}]")
    if update.get("output"):
        for finding in update["output"]:
            print(f"  NEW CVE: {finding['cve_id']} ({finding['severity']}) in {finding['package']}")

# Pause while running intensive analysis (avoid duplicate alerts)
client.scouts.update(scout_id, status="paused")

# Resume
client.scouts.update(scout_id, status="active")

# Archive when repo is no longer being monitored
client.scouts.update(scout_id, status="done")

# Hard delete
client.scouts.delete(scout_id)
```

#### Handle the scout webhook in your Next.js dashboard

```typescript
// app/api/yutori-scout-alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    // Payload shape:
    // {
    //   scout_id:   "scout_abc123",
    //   update_id:  "upd_xyz",
    //   created_at: "2026-02-27T10:00:00Z",
    //   output: [{ package, cve_id, severity, cvss, summary, fix, published }]
    // }
    const payload = await req.json();
    const findings = payload.output ?? [];

    for (const f of findings) {
        // Push to Senso so all agents have the new CVE context
        await fetch(`${process.env.SENSO_API}/content/raw`, {
            method: 'POST',
            headers: { 'X-Api-Key': process.env.SENSO_API_KEY!, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: `Scout Alert: ${f.cve_id} in ${f.package}`,
                text:  `Severity: ${f.severity}\nCVSS: ${f.cvss}\n${f.summary}\nFix: ${f.fix}`
            })
        });

        // Broadcast to dashboard via Server-Sent Events / WebSocket
        await broadcastToClients({ type: 'new_cve_alert', ...f });
    }

    return NextResponse.json({ received: true });
}
```

---

### Async Usage

```python
import asyncio
from yutori import AsyncYutoriClient

async def analyze_all_deps(packages: list[dict]):
    async with AsyncYutoriClient() as client:
        # Fire all research tasks concurrently
        tasks = await asyncio.gather(*[
            client.research.create(
                query=f"All CVEs for {p['name']}@{p['version']}",
                user_timezone="America/Los_Angeles"
            )
            for p in packages
        ])

        # Poll all concurrently
        results = await asyncio.gather(*[
            _poll_research(client, t["task_id"])
            for t in tasks
        ])
        return results

async def _poll_research(client, task_id: str):
    while True:
        r = await client.research.get(task_id)
        if r["status"] in ("succeeded", "failed"):
            return r
        await asyncio.sleep(10)
```

---

### CLI Reference

```bash
# Auth
yutori auth login               # browser login — saves ~/.yutori/config.json
yutori auth status              # show current credentials
yutori auth logout              # clear saved creds

# n1 browser extension (Chrome) — for local testing
# Install from Chrome Web Store, enter API key in extension settings

# Browsing — fire tasks from the terminal
yutori browse run "find all CVEs for lodash 4.17.20 on NVD" https://nvd.nist.gov
yutori browse run "log in and check the dashboard" https://app.example.com --require-auth
yutori browse get TASK_ID                     # check status

# Research — one-time deep research
yutori research run "full security audit of express@4.17.1"
yutori research get TASK_ID

# Scouts
yutori scouts list                            # list all scouts
yutori scouts get SCOUT_ID                    # details + last update
yutori scouts create -q "monitor lodash npm for new CVEs"
yutori scouts delete SCOUT_ID

# Usage & billing
yutori usage                                  # current API usage stats
```

---

### Error Handling

```python
from yutori import YutoriClient, APIError, AuthenticationError

client = YutoriClient()

try:
    result = client.research.create(query="...")
except AuthenticationError as e:
    # 401 / 403 — bad or missing key
    print(f"Auth error: {e}")
    # Fix: check YUTORI_API_KEY or run `yutori auth login`
except APIError as e:
    # Any other 4xx / 5xx
    print(f"API error (HTTP {e.status_code}): {e.message}")
    if e.status_code == 429:
        time.sleep(60)  # rate limited — back off
```

| Exception | Status | Cause |
|---|---|---|
| `AuthenticationError` | 401, 403 | Invalid or missing `X-API-KEY` |
| `APIError` | 4xx, 5xx | Check `e.status_code` and `e.message` |

---

### Decision Guide — Which Yutori API for what?

| Need | Use |
|---|---|
| Reason about code, generate JSON, analyze text | **n1 API** (via SDK or REST) |
| Navigate a live website and extract structured data | **Browsing API** |
| Comprehensive security research on 5+ packages at once | **Research API** |
| Quick one-off CVE lookup from a known URL | **Browsing API** (faster) |
| Ongoing monitoring — alert when new CVEs drop | **Scouting API** |
| Need a quick web answer without full agent overhead | Tavily (Section 4) |

---

### Env vars

```bash
YUTORI_API_KEY=yt-...
```

**Resources:**  
- Sign up: [platform.yutori.com/sign-up](https://platform.yutori.com/sign-up)  
- Docs: [docs.yutori.com](https://docs.yutori.com)  
- SDK: `pip install yutori` — [github.com/yutori-ai/yutori-sdk-python](https://github.com/yutori-ai/yutori-sdk-python)  
- MCP: [github.com/yutori-ai/yutori-mcp](https://github.com/yutori-ai/yutori-mcp)  
- Support: `support@yutori.com`

---

## 2. Senso — Context OS 🔴

> Senso is the **knowledge layer** between all your agents and the raw data. Instead of every agent querying Neo4j directly or re-running expensive Yutori tasks, everything flows into Senso once, and every agent queries Senso with natural language. The rules + webhooks system makes Senso the real-time event bus — when Senso classifies a new CRITICAL finding, it fires your dashboard webhook automatically with no polling required.

**Base URL:** `https://sdk.senso.ai/api/v1`  
**Auth:** `X-Api-Key: YOUR_KEY` on every request  
**Get key:** Email `tom@senso.ai`  
**Docs:** [sensoai.mintlify.app/introduction](https://sensoai.mintlify.app/introduction)

```python
import requests, os, time

SENSO_API = "https://sdk.senso.ai/api/v1"
SENSO_HDR = {
    "X-Api-Key": os.environ["SENSO_API_KEY"],
    "Content-Type": "application/json"
}
```

---

### Content Ingestion

All Yutori Research results, Neo4j graph analysis, security findings, and fix documents get pushed into Senso so the full system can query them with natural language.

#### POST `/content/raw` — Ingest text

```python
def senso_ingest(title: str, text: str, category_id: str = None,
                 wait_for_indexing: bool = True) -> str:
    """
    Push text content into Senso. Returns content_id.
    Status is async (202 Accepted) — set wait_for_indexing=True to block until searchable.
    """
    payload = {"title": title, "text": text}
    if category_id:
        payload["category_id"] = category_id

    resp = requests.post(f"{SENSO_API}/content/raw", headers=SENSO_HDR, json=payload)
    resp.raise_for_status()
    content_id = resp.json()["id"]  # 202 Accepted

    if wait_for_indexing:
        for _ in range(30):
            status = requests.get(
                f"{SENSO_API}/content/{content_id}", headers=SENSO_HDR
            ).json().get("processing_status")
            if status == "completed":
                break
            elif status == "failed":
                raise RuntimeError(f"Senso indexing failed: {content_id}")
            time.sleep(1)

    return content_id


# Ingest a Yutori Research result
yutori_result = research(query="All CVEs for express@4.17.1")
senso_ingest(
    title="Security Research: express@4.17.1",
    text=str(yutori_result["output"]),
    category_id=security_category_id
)

# Ingest a CVE finding from Neo4j + Yutori
senso_ingest(
    title="CVE-2024-29041 — express@4.17.1 Open Redirect",
    text="""Severity: HIGH
CVSS: 7.5
Package: express@4.17.1
Description: Open redirect vulnerability. Attackers can redirect users to malicious URLs.
Fixed in: 4.19.2
Blast Radius: 8 files, 23 functions, 4 API endpoints
Affected: src/routes/api.js (lines 12-45), src/middleware/auth.js (lines 8-22)
Fix: npm install express@4.19.2""",
    category_id=security_category_id
)
```

#### POST `/content/file` — Ingest files

```python
def senso_ingest_file(file_path: str, title: str, category_id: str = None) -> str:
    """Upload PDF, DOCX, or Markdown. Must use multipart — do NOT set Content-Type."""
    file_headers = {"X-Api-Key": os.environ["SENSO_API_KEY"]}
    with open(file_path, "rb") as f:
        data = {"title": title}
        if category_id:
            data["category_id"] = category_id
        resp = requests.post(
            f"{SENSO_API}/content/file",
            headers=file_headers,
            files={"file": (os.path.basename(file_path), f)},
            data=data
        )
    resp.raise_for_status()
    return resp.json()["id"]
```

#### GET `/content/{id}` — Check status

```python
resp = requests.get(f"{SENSO_API}/content/{content_id}", headers=SENSO_HDR)
data = resp.json()
# {
#   "id": "uuid",
#   "title": "...",
#   "processing_status": "completed" | "processing" | "queued" | "failed",
#   "created_at": "2026-02-27T10:00:00Z"
# }
```

#### GET `/content` — List all (paginated)

```python
def senso_list_all(limit: int = 100) -> list:
    items, offset = [], 0
    while True:
        resp = requests.get(
            f"{SENSO_API}/content", headers=SENSO_HDR,
            params={"limit": limit, "offset": offset}
        )
        batch = resp.json().get("items", [])
        items.extend(batch)
        if len(batch) < limit:
            break
        offset += limit
    return items
```

---

### Knowledge Taxonomy

Organise findings by domain so agents can query across relevant subsets.

#### POST `/categories/bulk` — One-time setup

```python
def senso_setup_taxonomy() -> dict:
    """Create the full VIBE CHECK category tree in one API call."""
    resp = requests.post(
        f"{SENSO_API}/categories/bulk",
        headers=SENSO_HDR,
        json={
            "categories": [
                {"name": "Security Findings", "topics": [
                    {"name": "CVE Vulnerabilities"},
                    {"name": "Code Security"},
                    {"name": "Config Issues"}
                ]},
                {"name": "Code Quality", "topics": [
                    {"name": "Bugs"}, {"name": "Dead Code"}, {"name": "Complexity"}
                ]},
                {"name": "Fix Documentation", "topics": [
                    {"name": "Critical Fixes"}, {"name": "Migration Guides"}
                ]},
                {"name": "Yutori Intelligence", "topics": [
                    {"name": "Research Reports"}, {"name": "Best Practices"}
                ]},
            ]
        }
    )
    resp.raise_for_status()
    # Map name → category_id for easy use
    return {cat["name"]: cat["category_id"]
            for cat in resp.json().get("categories", [])}

CATEGORIES = senso_setup_taxonomy()
```

#### POST `/categories/{id}/topics` — Add a topic later

```python
resp = requests.post(
    f"{SENSO_API}/categories/{category_id}/topics",
    headers=SENSO_HDR,
    json={"name": "New Topic Name"}
)
topic_id = resp.json()["topic_id"]
```

---

### Search — `POST /search`

Ask any natural language question and get an AI-synthesized, cited answer drawn from all ingested content — Yutori research results, CVE data, fix docs, everything.

```python
def senso_ask(question: str, max_results: int = 10) -> dict:
    """
    Natural language query over all ingested content.
    Returns: { answer (str), sources (list), total_results (int), processing_time_ms (int) }
    """
    resp = requests.post(
        f"{SENSO_API}/search",
        headers=SENSO_HDR,
        json={"query": question, "max_results": max_results}
    )
    resp.raise_for_status()
    return resp.json()

# Key queries for each agent stage
senso_ask("What are all critical severity CVEs and their blast radius?")["answer"]
senso_ask("Which single package fix would eliminate the most vulnerability chains?")["answer"]
senso_ask("What are the top 5 quick-win fixes under 30 minutes?")["answer"]
senso_ask("Which functions handle user input and have known vulnerabilities?")["answer"]
senso_ask("What anti-patterns were found and what are the recommended alternatives?")["answer"]
senso_ask("What is the overall codebase risk level — CRITICAL, HIGH, MEDIUM, or LOW?")["answer"]
senso_ask("Summarize all security findings for the executive dashboard header")["answer"]
```

---

### Generate — `POST /generate`

Generate new content (fix plans, executive summaries, reports) grounded in all ingested data.

```python
def senso_generate(instructions: str, content_type: str = "report",
                   save: bool = True, max_results: int = 20) -> str:
    """
    Generate AI content from the full knowledge base.

    Parameters:
      instructions    Detailed prompt for what to generate
      content_type    Label for the generated doc (any string)
      save            True = persist as new content in Senso (searchable later)
      max_results     Number of source documents to draw from (higher = richer)

    Returns:
      generated_text string
    """
    resp = requests.post(
        f"{SENSO_API}/generate",
        headers=SENSO_HDR,
        json={
            "content_type": content_type,
            "instructions": instructions,
            "save": save,
            "max_results": max_results
        }
    )
    resp.raise_for_status()
    return resp.json()["generated_text"]
    # Also available: resp.json()["sources"], resp.json()["processing_time_ms"]


# Doctor Agent: final prioritized fix plan
fix_plan = senso_generate(
    instructions="""Generate a complete prioritized fix plan for this codebase.
    Order: 1) Severity (CRITICAL first), 2) Blast radius (most files affected),
    3) Effort (quick wins when severity is equal).

    For each fix include:
    - Fix ID (FIX-001, FIX-002 ...)
    - Severity + CVSS score
    - What is wrong and why it matters
    - Affected files and function count
    - Step-by-step instructions with exact commands
    - BEFORE / AFTER code snippets where applicable
    - Which CVE chains this fix resolves
    - Effort estimate: Quick (<30min) | Medium (1-2hr) | Complex (>2hr)""",
    content_type="fix_plan",
    save=True  # persist so dashboard can retrieve it later
)

# Executive summary for dashboard header (ephemeral — don't persist)
summary = senso_generate(
    instructions="""Write a 3-paragraph executive summary of this codebase analysis.
    Paragraph 1: Overall health and risk level (non-technical language).
    Paragraph 2: The 3 most critical issues and their business impact.
    Paragraph 3: Recommended immediate actions and estimated remediation time.""",
    content_type="executive_summary",
    save=False
)
```

---

### Reusable Prompts & Templates

Define prompt templates once, call with variables from any agent.

```python
# Create a prompt template with {{variable}} placeholders
resp = requests.post(
    f"{SENSO_API}/prompts",
    headers=SENSO_HDR,
    json={
        "name": "Fix Documentation Generator",
        "text": """For the {{finding_type}} in {{file_path}} (lines {{line_range}}):
1. Root cause explanation for a senior developer
2. Business/security impact of leaving this unfixed
3. Blast radius: list of affected files and functions
4. Step-by-step fix with exact code changes (BEFORE/AFTER)
5. Commands: {{package_name}} {{current_version}} → {{target_version}}
6. Verification steps
7. Effort estimate"""
    }
)
prompt_id = resp.json()["prompt_id"]

# Create an output template (text or JSON)
resp = requests.post(
    f"{SENSO_API}/templates",
    headers=SENSO_HDR,
    json={
        "name": "Fix JSON Schema",
        "output_type": "json",
        "text": """{
  "fix_id": "{{fix_id}}",
  "severity": "{{severity}}",
  "file": "{{file_path}}",
  "effort_minutes": {{effort_minutes}},
  "steps": {{steps_array}}
}"""
    }
)
template_id = resp.json()["template_id"]

# Generate using a saved prompt + template
resp = requests.post(
    f"{SENSO_API}/generate/prompt",
    headers=SENSO_HDR,
    json={
        "prompt_id": prompt_id,
        "template_id": template_id,
        "finding_type": "Dependency Vulnerability",
        "file_path": "src/routes/api.js",
        "line_range": "12-45",
        "package_name": "express",
        "current_version": "4.17.1",
        "target_version": "4.19.2"
    }
)
generated = resp.json()["generated_text"]
```

---

### Rules + Triggers + Webhooks — Event Bus

When content matching a rule is ingested, Senso **automatically fires your webhook** — no polling. This is how the dashboard gets real-time CRITICAL alerts as agents push findings.

```
Agent pushes finding → Senso indexes → Rule matches → Trigger fires → POST to your endpoint
```

```python
def senso_setup_event_bus(dashboard_url: str, dashboard_secret: str) -> dict:
    """
    Wire up: CRITICAL/HIGH findings → webhook → dashboard.
    Call once during app initialization.
    """
    # 1) Register your webhook endpoint
    wh = requests.post(f"{SENSO_API}/webhooks", headers=SENSO_HDR, json={
        "name": "VIBE CHECK Dashboard",
        "url": dashboard_url,
        "auth": {"type": "bearer", "token": dashboard_secret}
    }).json()
    webhook_id = wh["webhook_id"]

    rule_ids = {}
    for severity in ["CRITICAL", "HIGH"]:
        # 2) Create a classification rule
        rule = requests.post(f"{SENSO_API}/rules", headers=SENSO_HDR, json={
            "name": f"{severity} Severity Detector",
            "type": "classification",
            "target": "all"          # applies to all ingested content
        }).json()
        rule_id = rule["rule_id"]
        rule_ids[severity] = rule_id

        # 3) Add the value to match against ingested text
        requests.post(
            f"{SENSO_API}/rules/{rule_id}/values",
            headers=SENSO_HDR,
            json={"value": severity}   # matches if content contains this string
        )

        # 4) Create trigger: rule match → fire webhook
        requests.post(f"{SENSO_API}/triggers", headers=SENSO_HDR, json={
            "name": f"Alert on {severity}",
            "rule_id": rule_id,
            "rule_value_id": severity,
            "webhook_id": webhook_id
        })

    print("Senso event bus configured — CRITICAL/HIGH findings will fire dashboard webhook")
    return rule_ids
```

#### Senso webhook payload shape

```json
{
  "trigger_id": "uuid",
  "rule_id": "uuid",
  "rule_value_id": "CRITICAL",
  "content": {
    "id": "uuid",
    "title": "CVE-2024-29041 — express@4.17.1",
    "text": "Severity: CRITICAL\nCVSS: 9.1\n...",
    "processing_status": "completed",
    "created_at": "2026-02-27T10:00:00Z"
  },
  "fired_at": "2026-02-27T10:00:01Z"
}
```

#### Handle Senso webhook in Next.js

```typescript
// app/api/senso-events/route.ts
export async function POST(req: NextRequest) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.DASHBOARD_WEBHOOK_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, rule_value_id } = await req.json();
    await broadcastToClients({
        type: 'new_finding',
        severity: rule_value_id,
        title: content.title,
        summary: content.text.slice(0, 200),
    });
    return NextResponse.json({ received: true });
}
```

---

### Error Reference

| Status | Meaning | Action |
|---|---|---|
| `202 Accepted` | Ingestion queued — async | Poll `GET /content/{id}` |
| `200 OK` | Success | Use body |
| `201 Created` | Resource created | Use returned ID |
| `204 No Content` | Success (DELETE) | Done |
| `400 Bad Request` | Bad JSON / missing fields | Check request body |
| `401 Unauthorized` | Bad `X-Api-Key` | Check header name and key value |
| `404 Not Found` | ID doesn't exist | Verify ID |
| `409 Conflict` | Duplicate name | Use unique name |
| `500 Internal` | Server error | Retry with backoff |

---

## 3. Neo4j — Knowledge Graph 🔴

**AuraDB Free:** 200k nodes, 400k rels — sign up at [console.neo4j.io](https://console.neo4j.io)

```bash
pip install neo4j  # v6.1.0
```

```python
from neo4j import GraphDatabase
import os

driver = GraphDatabase.driver(
    os.environ["NEO4J_URI"],       # neo4j+s://xxxx.databases.neo4j.io:7687
    auth=("neo4j", os.environ["NEO4J_PASSWORD"])
)

def q(cypher: str, **params) -> list:
    records, _, _ = driver.execute_query(cypher, **params, database_="neo4j")
    return records
```

### Schema

```cypher
// ── Nodes
(:File       { path, name, extension, language, lines })
(:Function   { name, file, startLine, endLine, complexity, exported, hasVulnerability })
(:Package    { name, version, isDev, isTransitive, vulnerable })
(:CVE        { id, severity, cvss, description, fixedVersion, hasPublicExploit })
(:Fix        { id, description, estimatedMinutes, priority })

// ── Relationships
(dir)-[:CONTAINS]->(file)
(file)-[:IMPORTS]->(file)
(file)-[:DEPENDS_ON]->(package)
(function)-[:DEFINED_IN]->(file)
(function)-[:CALLS]->(function)
(package)-[:HAS_CVE]->(cve)
(cve)-[:AFFECTS]->(file)
(fix)-[:RESOLVES]->(cve)
```

### Write helpers (called by agents after Yutori analysis)

```python
def write_file_node(path: str, language: str, lines: int):
    q("MERGE (f:File {path: $path}) SET f.language=$lang, f.lines=$lines",
      path=path, lang=language, lines=lines)

def write_function_node(name: str, file_path: str, start: int, end: int,
                        complexity: int, exported: bool):
    q("""MERGE (fn:Function {name: $name, file: $file})
         SET fn.startLine=$start, fn.endLine=$end,
             fn.complexity=$complexity, fn.exported=$exported""",
      name=name, file=file_path, start=start, end=end,
      complexity=complexity, exported=exported)
    q("MATCH (fn:Function {name:$fn,file:$f}), (fi:File {path:$f}) MERGE (fn)-[:DEFINED_IN]->(fi)",
      fn=name, f=file_path)

def write_cve(cve_id: str, package: str, version: str,
              severity: str, cvss: float, fixed_version: str):
    q("""MERGE (pkg:Package {name:$pkg, version:$ver})
           SET pkg.vulnerable = true
         MERGE (cve:CVE {id:$cve})
           SET cve.severity=$sev, cve.cvss=$cvss, cve.fixedVersion=$fixed
         MERGE (pkg)-[:HAS_CVE]->(cve)""",
      pkg=package, ver=version, cve=cve_id,
      sev=severity, cvss=cvss, fixed=fixed_version)
```

### Key analytical queries

```python
def get_blast_radius(package: str, version: str) -> dict:
    """How many files / functions are exposed if this package has a CVE?"""
    records = q("""
        MATCH (pkg:Package {name:$pkg, version:$ver})-[:HAS_CVE]->(cve:CVE)
              -[:AFFECTS]->(file:File)
        RETURN count(DISTINCT file) AS file_count,
               collect(DISTINCT file.path) AS files""",
        pkg=package, ver=version)
    return dict(records[0]) if records else {"file_count": 0, "files": []}

def get_vulnerability_chains():
    """Find attack paths from vulnerable package to user-input-handling functions."""
    return q("""
        MATCH path =
          (pkg:Package {vulnerable:true})<-[:DEPENDS_ON]-(file:File)
          <-[:DEFINED_IN]-(fn:Function {receivesUserInput:true})
        RETURN path LIMIT 25""")

def get_dead_code():
    """Functions that are never called and not exported."""
    return q("""
        MATCH (f:Function {exported:false})
        WHERE NOT EXISTS { MATCH ()-[:CALLS]->(f) }
        RETURN f.name, f.file, f.startLine ORDER BY f.file""")

def get_risk_ranked_dependencies():
    """Rank all deps by risk score = usage_depth × cve_count."""
    return q("""
        MATCH (pkg:Package)<-[:DEPENDS_ON*1..3]-(file:File)
        WITH pkg, count(DISTINCT file) AS depth
        OPTIONAL MATCH (pkg)-[:HAS_CVE]->(cve:CVE)
        RETURN pkg.name, pkg.version, depth,
               count(cve) AS cve_count,
               depth * count(cve) AS risk_score
        ORDER BY risk_score DESC LIMIT 20""")
```

---

## 4. Tavily — Supplemental Web Search 🔴

Use Tavily for **fast targeted lookups** when Yutori Research is overkill: confirm a CVSS score, grab a changelog snippet, verify a fixed version. Yutori Research goes wider and deeper; Tavily goes faster.

```bash
pip install tavily-python
```

```python
from tavily import TavilyClient
import os

tavily = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])

def quick_cve_lookup(package: str, version: str) -> str:
    result = tavily.search(
        query=f"{package} {version} CVE vulnerability CVSS severity fixed version",
        search_depth="advanced",
        include_answer=True,
        include_domains=["nvd.nist.gov", "github.com/advisories", "snyk.io"],
        max_results=5
    )
    return result.get("answer", "")

def quick_changelog(package: str, from_ver: str, to_ver: str) -> str:
    result = tavily.search(
        query=f"{package} {from_ver} to {to_ver} migration breaking changes CHANGELOG",
        search_depth="advanced",
        include_answer=True,
        max_results=3
    )
    return result.get("answer", "")

def quick_exploit_check(cve_id: str) -> str:
    result = tavily.search(
        query=f"{cve_id} exploit proof-of-concept PoC public",
        include_answer=True,
        max_results=5
    )
    return result.get("answer", "")
```

**Yutori vs Tavily decision guide:**

| Scenario | Use |
|---|---|
| All CVEs for 5+ packages | Yutori Research API |
| Deep security history + exploit details | Yutori Research API |
| Navigate a live page (auth flows, forms) | Yutori Browsing API |
| Quick CVSS score for one CVE | Tavily |
| Confirm a fixed version | Tavily |
| One-sentence web answer | Tavily |

---

## 5. OpenAI — Backup Reasoning 🟡

Use as fallback when Yutori n1 is unavailable. Interfaces are nearly identical — swap the model name.

```python
from openai import OpenAI
import os

openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

def reason(messages: list, system: str = None) -> str:
    """Try Yutori n1 first; fall back to GPT-4o on any error."""
    full = []
    if system:
        full.append({"role": "system", "content": system})
    full.extend(messages)

    try:
        from yutori import YutoriClient
        yc = YutoriClient()
        r = yc.chat.completions.create(model="n1-latest", messages=full)
        return r.choices[0].message.content
    except Exception as e:
        print(f"[Yutori unavailable: {e}] — falling back to GPT-4o")

    r = openai_client.chat.completions.create(model="gpt-4o", messages=full)
    return r.choices[0].message.content
```

### Structured outputs for schema-critical writes

```python
from pydantic import BaseModel

class CodeFinding(BaseModel):
    severity: str
    file_path: str
    line_number: int
    description: str
    fix_summary: str

class AnalysisResult(BaseModel):
    findings: list[CodeFinding]
    health_score: int
    confidence: float

# Use when you MUST have schema-safe JSON for Neo4j writes
resp = openai_client.beta.chat.completions.parse(
    model="gpt-4o",
    messages=[{"role": "user", "content": f"Analyze:\n{code}"}],
    response_format=AnalysisResult
)
result: AnalysisResult = resp.choices[0].message.parsed
```

---

## 6. Fastino — Fast Entity Extraction 🟡

Pre-process every file before sending to Yutori/OpenAI. Extract function names, imports, API endpoints at CPU speed (<150ms) to reduce the context window and focus the heavy models on what matters.

```python
import requests, os

def fastino_extract(code: str) -> list:
    """
    Run GLiNER-2 NER on code. Returns entity list in <150ms.
    Use to build focused prompts before hitting Yutori n1.
    """
    resp = requests.post(
        "https://api.fastino.ai/gliner-2",
        headers={"Authorization": f"Bearer {os.environ['FASTINO_API_KEY']}"},
        json={
            "task": "ner",
            "text": code,
            "labels": [
                "function_name", "class_name", "variable_name",
                "import_path", "api_endpoint", "database_call",
                "hardcoded_secret", "env_variable"
            ]
        },
        timeout=5
    )
    resp.raise_for_status()
    return resp.json()  # [{"entity": "getUserById", "label": "function_name", "score": 0.98}, ...]


# Mapper Agent pipeline: Fastino → focused prompt → Yutori n1
def process_file_efficiently(file_content: str, file_path: str) -> dict:
    # Step 1: fast entity extraction (Fastino, <150ms)
    entities = fastino_extract(file_content)

    # Step 2: build a focused summary for the Yutori prompt
    by_label = {}
    for e in entities:
        by_label.setdefault(e["label"], []).append(e["entity"])
    entity_summary = "\n".join(f"  {k}: {', '.join(v)}" for k, v in by_label.items())

    # Step 3: send focused context to Yutori n1 — cheaper and faster
    return n1_extract_graph_nodes(
        f"Entities detected:\n{entity_summary}\n\nFull code:\n{file_content}",
        file_path
    )
```

---

## 7. AWS — Infrastructure 🟡

```python
import boto3, json, os

# Lambda — run specialist agents in parallel
lambda_client = boto3.client("lambda", region_name=os.environ["AWS_DEFAULT_REGION"])

def invoke_agent(function_name: str, payload: dict):
    """Fire a specialist agent Lambda asynchronously."""
    lambda_client.invoke(
        FunctionName=function_name,
        InvocationType="Event",    # async — fire and forget
        Payload=json.dumps(payload).encode()
    )

def run_all_agents_parallel(repo_path: str):
    """Kick off all 4 analysis agents simultaneously."""
    for agent in ["mapper", "quality", "security", "pattern"]:
        invoke_agent(f"vibecheck-{agent}-agent", {
            "repo_path": repo_path,
            "neo4j_uri": os.environ["NEO4J_URI"],
            "yutori_api_key": os.environ["YUTORI_API_KEY"]
        })
    # Doctor agent triggered by EventBridge after all 4 complete

# S3 — store cloned repos
s3 = boto3.client("s3")

def upload_repo(local_path: str, bucket: str, prefix: str):
    import pathlib
    for f in pathlib.Path(local_path).rglob("*"):
        if f.is_file():
            s3.upload_file(str(f), bucket, f"{prefix}/{f.relative_to(local_path)}")

# DynamoDB — agent state machine
ddb = boto3.resource("dynamodb")
table = ddb.Table("vibecheck-analysis-state")

def mark_agent_done(repo_id: str, agent: str):
    table.update_item(
        Key={"repo_id": repo_id},
        UpdateExpression=f"SET {agent}_done = :t",
        ExpressionAttributeValues={":t": True}
    )
```

---

## 8. Render — Deployment 🟢

```yaml
# render.yaml
services:
  - type: web
    name: vibecheck-api
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: YUTORI_API_KEY
        sync: false
      - key: SENSO_API_KEY
        sync: false
      - key: NEO4J_URI
        sync: false
      - key: NEO4J_PASSWORD
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: TAVILY_API_KEY
        sync: false
      - key: FASTINO_API_KEY
        sync: false
      - key: DASHBOARD_WEBHOOK_SECRET
        sync: false
```

---

## 9. Full Integration Guide

### How all agents connect

```
GitHub URL
    │
    ▼
┌─────────────────────────────────────────────────┐
│  MAPPER AGENT                                   │
│  Fastino → entity extraction per file           │
│  Yutori n1 → AST analysis → graph nodes         │
│  Neo4j → write File / Function / Package nodes  │
│  Senso → ingest file summaries                  │
└────────────────────┬────────────────────────────┘
                     │ (parallel)
         ┌───────────┼────────────┐
         ▼           ▼            ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ QUALITY      │ │ SECURITY     │ │ PATTERN      │
│ Yutori n1   │ │ Yutori n1   │ │ Yutori n1   │
│ bug/smell    │ │ per-file     │ │ arch review  │
│ detection    │ │ analysis     │ │              │
│              │ │ Yutori       │ │ Yutori       │
│ Senso ingest │ │ Research:    │ │ Research:    │
│ findings     │ │ all deps     │ │ best pracs   │
│              │ │ Tavily:      │ │              │
│              │ │ quick checks │ │ Senso ingest │
│              │ │ Neo4j: CVE   │ │ patterns     │
│              │ │ Senso ingest │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
         │           │            │
         └───────────┼────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│  DOCTOR AGENT                                   │
│  Senso /search → "what are critical findings?"  │
│  Yutori n1 → generate fix doc for each finding  │
│  Yutori Browse → fetch migration guides         │
│  Senso /generate → final prioritized fix plan   │
│  Neo4j → write Fix nodes, link to CVEs          │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│  ORCHESTRATOR                                   │
│  Senso /search → health score, top issues       │
│  Senso /generate → executive summary            │
│  Neo4j → blast radius final calculations        │
│  Yutori Scout → create ongoing CVE monitor      │
└────────────────────┬────────────────────────────┘
                     ▼
              Next.js Dashboard (Render)
              Real-time via Senso + Yutori webhooks
```

### Full pipeline entry point

```python
import asyncio, os
from yutori import YutoriClient

client = YutoriClient()

async def run_vibecheck(github_url: str) -> dict:
    print(f"\n🔍 VIBE CHECK: {github_url}")

    # 1. One-time setup
    categories = senso_setup_taxonomy()
    senso_setup_event_bus(
        dashboard_url=os.environ["DASHBOARD_WEBHOOK_URL"],
        dashboard_secret=os.environ["DASHBOARD_WEBHOOK_SECRET"]
    )

    # 2. Mapper: clone repo, build graph
    repo_files = clone_and_list_files(github_url)
    dependencies = parse_manifest(github_url)

    for file_path, content in repo_files.items():
        nodes = process_file_efficiently(content, file_path)  # Fastino + Yutori n1
        write_file_node(file_path, detect_language(file_path), content.count("\n"))
        for fn in nodes.get("functions", []):
            write_function_node(fn["name"], file_path, fn["startLine"],
                                fn["endLine"], fn["complexity"], fn["exported"])
        senso_ingest(f"File: {file_path}", content,
                     category_id=categories.get("Code Quality"), wait_for_indexing=False)

    # 3. Security: Yutori Research on all deps (concurrent with quality)
    print("🔐 Running Yutori Research on dependencies...")
    sec_task = client.research.create(
        query=f"Full security audit for: "
              + ", ".join(f"{d['name']}@{d['version']}" for d in dependencies),
        user_timezone="America/Los_Angeles",
        output_schema={
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "package": {"type": "string"}, "version": {"type": "string"},
                    "safe_version": {"type": "string"},
                    "cves": {"type": "array", "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"}, "severity": {"type": "string"},
                            "cvss": {"type": "number"}
                        }
                    }}
                }
            }
        }
    )

    # 4. Quality: Yutori n1 per file (run while Research is running)
    print("🧹 Running quality analysis...")
    all_quality_issues = []
    for file_path, content in repo_files.items():
        issues = n1_quality_analysis(content, detect_language(file_path))
        all_quality_issues.extend(issues)
        for issue in issues:
            senso_ingest(
                title=f"Quality: {issue['type']} in {file_path}",
                text=f"Severity: {issue['severity']}\nLine: {issue.get('line')}\n"
                     f"Issue: {issue['description']}\nFix: {issue['fix']}",
                category_id=categories.get("Code Quality"),
                wait_for_indexing=False
            )

    # 5. Wait for Research, write CVEs to graph + Senso
    print("⏳ Waiting for Yutori Research...")
    sec_result = research(query="", poll_interval=10)  # already running
    for pkg_data in (sec_result.get("output") or []):
        for cve in pkg_data.get("cves", []):
            write_cve(cve["id"], pkg_data["package"], pkg_data["version"],
                      cve["severity"], cve["cvss"], pkg_data.get("safe_version", "unknown"))
            senso_ingest(
                title=f"CVE: {cve['id']} — {pkg_data['package']}@{pkg_data['version']}",
                text=f"Severity: {cve['severity']}\nCVSS: {cve['cvss']}\n"
                     f"Fix version: {pkg_data.get('safe_version')}",
                category_id=categories.get("Security Findings")
            )

    # 6. Doctor: generate fix plan from Senso knowledge base
    print("💊 Doctor Agent generating fix plan...")
    fix_plan = senso_generate(
        instructions="""Generate a complete prioritized fix plan.
        Order: CRITICAL → HIGH → MEDIUM, then by blast radius.
        For each fix: ID, severity, affected files, exact commands, effort estimate.""",
        content_type="fix_plan"
    )

    # 7. Orchestrator: final report + create ongoing scout
    health = senso_ask("What is the codebase health score 0-100 and grade?")["answer"]
    summary = senso_generate(
        instructions="Write a 3-paragraph executive summary for non-technical stakeholders.",
        content_type="executive_summary", save=False
    )

    # 8. Create Yutori Scout for ongoing CVE monitoring
    scout_id = create_dependency_scout(
        packages=dependencies,
        webhook_url=os.environ["DASHBOARD_WEBHOOK_URL"]
    )
    print(f"✅ Scout created: {scout_id} — repo is now under continuous CVE monitoring")

    return {
        "health": health,
        "fix_plan": fix_plan,
        "summary": summary,
        "cve_count": sum(len(p.get("cves", [])) for p in (sec_result.get("output") or [])),
        "quality_issues": len(all_quality_issues),
        "scout_id": scout_id
    }
```

---

## 10. Environment Variables Checklist

```bash
# ── PRIMARY (required on day 1) ───────────────────────────────────────────────

YUTORI_API_KEY=yt-...
# Sign up: platform.yutori.com/sign-up → Billing → Settings → API Key

SENSO_API_KEY=tgr_live_...
# Email: tom@senso.ai — key arrives in "Your Senso Platform Access" email

NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io:7687
NEO4J_PASSWORD=your-aura-password
# Sign up: console.neo4j.io → Create Free Instance

TAVILY_API_KEY=tvly-...
# Sign up: app.tavily.com → API Keys

DASHBOARD_WEBHOOK_URL=https://your-app.onrender.com/api/events
DASHBOARD_WEBHOOK_SECRET=your-random-secret-32chars

# ── BACKUP / SUPPLEMENTAL ─────────────────────────────────────────────────────

OPENAI_API_KEY=sk-...
# Fallback reasoning: platform.openai.com

FASTINO_API_KEY=...
# Fast pre-processing: fastino.ai

# ── INFRASTRUCTURE ────────────────────────────────────────────────────────────

AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-1
AWS_S3_BUCKET=vibecheck-repos
```

---

*Good luck — ship fast, integrate sponsors deeply, impress the judges.*  
**Submit on Devpost by 4:30 PM · Ask sponsor engineers directly in Discord**  
*Digital Studio Labs · February 27, 2026*