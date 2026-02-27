VIBE CHECK
Project Overview  —  Plain English Edition
Autonomous Code Intelligence Platform
Digital Studio Labs  ·  February 2026
"Vibe code fast. VIBE CHECK before you ship."



1. What Is VIBE CHECK?
VIBE CHECK is an autonomous code analysis platform that examines any GitHub repository and produces a comprehensive health report in under a minute. Think of it as a specialist doctor who reads your entire codebase — in seconds — and tells you exactly what's wrong, why it matters, and precisely how to fix it.

You give it one thing: a GitHub URL. It gives you back:
A letter-grade health score (like A+ through F) for your entire codebase
A live, interactive map of every file, dependency, and connection in the project
A plain-English list of every security vulnerability, bug, and bad practice found
A prioritized, step-by-step fix plan with time estimates
Intelligence that gets smarter over time



The Core Insight
Most code quality tools produce a long list of warnings and dump it on the developer. VIBE CHECK takes a fundamentally different approach: it shows you HOW problems connect to each other, tells you WHICH ones to fix first for maximum impact, and LEARNS from every scan to get better.


1.1 The Three Big Ideas

Big Idea
How It Works
Why It Matters
The Graph IS the Product
The Knowledge Graph
Compounding Intelligence
VIBE CHECK builds a living map of your codebase — every file, every function, every dependency — as a connected graph. This isn't a sidebar widget. It takes up most of the screen because it IS the insight.
Every finding, every fix, every file relationship is stored in a graph database (Neo4j). This lets VIBE CHECK answer questions like: "If I fix this one vulnerability, how many attack chains does it break?"
Every scan teaches the system something new. By the second scan of a related project, VIBE CHECK already knows common fix patterns, average fix times, and recurring security issues across your organization.



2. The Big Picture: How It All Fits Together
VIBE CHECK has two main halves: a Python-powered analysis engine running in the background, and a Next.js web interface that makes the results come alive. They talk to each other in real time.

2.1 System Architecture Diagram

                    ┌─────────────────────────┐
                    │    You (GitHub URL)      │
                    └──────────┬─────────────┘
                                 │
                    ┌──────────┴─────────────┐
                    │   WEB DASHBOARD (Next.js)  │
                    │  Graph + Score + Findings  │
                    └──────────┬─────────────┘
                                 │ Real-time
                    ┌──────────┴─────────────┐
                    │  ANALYSIS ENGINE (Python)  │
                    │    The Orchestrator        │
                    └─┬────┬────┬────┬───┬─┘
                      │      │      │      │     │
   ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌─────┐
   │ Mapper│ │Quality│ │Pattern│ │ Secur │ │Doctr│
   └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘ └─┬─┘
         │        │        │        │      │
   ┌─────┴─────┴─────┴─────┴─────┴──────────────┐
   │ Neo4j  │ Fastino │ Yutori │ OpenAI │ Tavily │
   │ Graph  │ (Speed) │(Research)│(Backup)│(Search)│
   └──────────────────────────────────────────┘


2.2 What Happens When You Hit "Analyze"
The moment you submit a GitHub URL, an automated sequence kicks off — running in about 45 seconds from start to finish:

  STEP 1  →  Clone the repository to a temporary folder
  STEP 2  →  Detect the tech stack (React? Express? Python Django?)
  STEP 3  →  Map every file, function, and dependency (MAPPER AGENT)
  STEP 4  →  Run three analysis agents SIMULTANEOUSLY:
             ├─ Quality Agent: find bugs and messy code
             ├─ Pattern Agent: check architectural best practices
             └─ Security Agent: hunt for CVEs and vulnerabilities
  STEP 5  →  Generate fix documentation (DOCTOR AGENT)
  STEP 6  →  Calculate the Health Score and reveal the dashboard


Throughout this entire process, the web dashboard is updating live. You can watch the graph build node by node, see findings appear as they're discovered, and watch each agent check in with its progress.


3. The Six Agents
VIBE CHECK's analysis is performed by a team of six specialized AI agents. Think of them like a medical team: each one is an expert in their area, and they work together to produce a complete picture.

3.1 Agent Overview

Agent
Role
What It Does
Orchestrator
The team captain
Coordinates everything. Clones the repo, detects the tech stack, fires up the other agents in sequence and in parallel, and computes the final health score.
Mapper
The cartographer
Walks every file and folder in the repository. Classifies each file (is it source code? a test? a config file?). Finds all dependencies. Extracts all function names. Builds the knowledge graph.
Quality
The code reviewer
Scans source files for bugs, messy code, uncaught errors, overly complex functions, duplicate logic, and dead code.
Pattern
The architect
Looks at the big picture. Is the project structured correctly for its framework? Are there architectural anti-patterns? Is there proper test coverage? TypeScript types?
Security
The threat hunter
Checks every dependency against public vulnerability databases (CVEs). Traces how a vulnerability in one library can create an attack path through the codebase.
Doctor
The prescriber
Takes all findings and writes specific, actionable fix instructions for each one. Produces before/after code examples. Estimates how long each fix will take.


3.2 How Agents Work Together

  SEQUENTIAL (must happen in order):
  Orchestrator → Mapper → [Quality + Pattern + Security] → Doctor

  PARALLEL (run simultaneously to save time):
  Quality ───►
  Pattern ───►► all finish → Doctor picks up their findings
  Security ──►

  TOTAL ANALYSIS TIME:  approximately 45 seconds
  for a repository with ~50 files


3.3 Agent Speed: Fastino vs. OpenAI
Different tasks require different AI tools. VIBE CHECK uses two AI providers strategically:

AI Provider
When It's Used
Fastino (Task-Specific Models)
Used for fast, precise jobs: classifying a file type, extracting CVE IDs from text, categorizing code smells. Runs in milliseconds. The Mapper agent can classify 47 files in under 150ms total.
OpenAI GPT-4o (General Reasoning)
Used for nuanced jobs: understanding complex code, mapping how a vulnerability creates an attack chain, writing fix documentation. Slower but capable of deep reasoning.



4. The Knowledge Graph (Neo4j)
The knowledge graph is the heart of VIBE CHECK. Everything the Mapper discovers — every file, function, dependency, vulnerability, and fix — lives in a graph database called Neo4j. This is what makes VIBE CHECK fundamentally different from a simple linter.



What Makes a Graph Database Special?
A regular database stores rows of data. A graph database stores RELATIONSHIPS between pieces of data. This means VIBE CHECK can answer questions like: "Starting from this API endpoint, what files, functions, and packages can be reached in 3 steps?" — a question impossible to answer quickly with a regular database.


4.1 What Gets Stored in the Graph

What's Stored
Details
Repositories
The root of each scan: URL, name, health score, tech stack detected.
Directories
Every folder in the project, with how deep it is and how many files it contains.
Files
Every file: its path, programming language, line count, category (source/test/config), and whether it contains a vulnerability.
Functions
Every function extracted from source files: name, parameters, whether it's exported, whether it receives user input.
Endpoints
Every API route found: HTTP method, path, whether it has authentication, whether it validates input.
Packages
Every dependency (npm packages, pip packages): name, version, whether it has known vulnerabilities.
Findings
Every issue discovered: severity, description, plain-language explanation, which agent found it, how many files it affects.
Vulnerability Chains
The attack paths that connect an entry point (like an API route) through multiple hops to the actual vulnerable code.
Fixes
Step-by-step remediation instructions, priority order, estimated effort, before/after examples.


4.2 How Things Connect: Relationships

  Repository  ── CONTAINS ──►  Directory
  Directory   ── CONTAINS ──►  File
  File        ── IMPORTS  ──►  File           (import statements)
  File        ── DEPENDS  ──►  Package        (npm/pip dependencies)
  Package     ── DEPENDS  ──►  Package        (transitive deps)
  Function    ── DEFINED  ──►  File           (where it lives)
  Function    ── CALLS    ──►  Function       (call graph)
  Endpoint    ── HANDLED  ──►  Function       (route handlers)
  Finding     ── AFFECTS  ──►  File/Function  (impact)
  Fix         ── RESOLVES ──►  Finding        (remediation)
  CVE         ── IN_PKG   ──►  Package        (which package has the CVE)


4.3 The Blast Radius Feature
One of the most powerful capabilities VIBE CHECK unlocks is what it calls "Blast Radius" — the ability to instantly see how far a vulnerability's impact reaches.

Click any node in the graph. Select "Show Blast Radius." Within a second, the graph illuminates like a ripple:
First ring (amber, bright): files and functions directly connected to the vulnerability
Second ring (amber, medium): everything connected to the first ring
Third ring (amber, faint): the outer edge of the blast radius

A counter overlay tells you the exact scope: "8 files, 23 functions, 4 endpoints affected." This changes how developers prioritize. A vulnerability that affects 4 endpoints is much more urgent than one that affects none.


5. The Dashboard: What You See
The VIBE CHECK dashboard is designed to do one thing above all else: communicate severity and priority instantly, without requiring the user to read anything carefully. Color and size do the heavy lifting.

5.1 The Four States of the Application

State
What It Looks Like
Empty
A single URL input box, centered on a dark canvas. Nothing else. Paste a GitHub URL and click Analyze.
Scanning
The screen splits: agent status panel on the left, the graph building live on the right. Findings appear as they're discovered. The scan line sweeps across the background.
Complete
The full dashboard reveals in a choreographed 3-second sequence: the health score counts up, the letter grade springs in, the graph fills with data, findings and fixes appear.
Failed
A calm, blame-free error message explains what went wrong. A "Try Again" button. No stack traces visible by default.


5.2 The Health Score: The Moment
The Health Score is the single most important visual element in the entire application. When the analysis completes, a 1.8-second animated sequence plays:

  T+0.0s   The score container appears
  T+0.5s   A number begins counting up: 0 → 73
           Color shifts from white to amber as it rises
  T+1.4s   The letter grade "B-" springs in with a bounce
           A glow radiates outward behind the grade letter
  T+1.8s   Confidence level fades in below
  T+2.0s   Five category cards stagger in, one by one
  T+2.5s   The graph panel fades in (already populated)
  T+3.0s   Findings and fixes appear


This sequence is intentional. The score is meant to feel like a moment of revelation, not just a data readout. The animation builds anticipation and gives the number emotional weight.



Color Semantics
Three colors mean everything in VIBE CHECK. Green (score 7-10) = healthy. Amber (score 4-6) = warning. Red (score 1-3) = critical. NOTHING else in the interface uses saturated color. This means your eye is automatically drawn to problems.


5.3 The Graph Panel
The graph takes up 60% of the screen on desktop — because it IS the product. It has three views:

View
Middle
Right
Structure View
Dependencies View
Vulnerabilities View
Shows the file/folder hierarchy. Files are colored by type (source = gray, tests = cyan, config = amber). Useful for understanding the project layout.
Shows which files import which other files, and which packages each file depends on. The graph is arranged by connection strength using a force-directed layout.
The most dramatic view. All non-vulnerable nodes fade to nearly invisible. Red edges draw sequentially along attack chains like electrical current. Chain nodes pulse.


5.4 The Dashboard Layout

 ┌────────────────────────────────────────────────────────────┐
 │  VIBE CHECK    |   user/repo  (completed 42s)             │
 ├─────────────┬────────────────────────────────────────────┤
 │   SCORE HERO   │         GRAPH PANEL (60%)             │
 │                │   [Structure] [Deps] [Vulns]   ⛶ ↺  │
 │      B-        │                                        │
 │    73/100      │   Interactive node graph                │
 │  0.91 conf.   │   showing files, deps, attack           │
 │                │   chains                                │
 │ CODE QUALITY  ├─────────────────────────────────────────┤
 │   7/10 ⚠️     │         FINDINGS PANEL (40%)           │
 │ SECURITY 4/10 │  ● Critical (3)                           │
 │               │  ○ Warning (12)                           │
 ├─────────────┴────────────────────────────────────────────┤
 │   FIX PLAN — 15 fixes · 6.5 hours · 2 keystone fixes         │
 ├────────────────────────────────────────────────────────────┤
 │   Powered by:  Neo4j ●  Fastino ⚡  Yutori  OpenAI  Tavily        │
 └────────────────────────────────────────────────────────────┘



6. Findings and the Fix Plan

6.1 How Findings Are Presented
Every issue found is called a "finding." Findings are grouped into three severity levels. The interface collapses warning and info-level findings by default — only critical issues are shown immediately. This prevents cognitive overload.

Severity Level
What It Means
Critical (Red)
Security vulnerabilities, known CVEs, paths that allow attackers to access data they shouldn't. These demand immediate attention.
Warning (Amber)
Unhandled errors, type mismatches, bad practices, code complexity issues. Important but not immediately dangerous.
Info (Gray)
Stylistic suggestions, minor code smells, informational observations. Good to know but low urgency.


Every finding has two descriptions: a technical one for experienced developers, and a plain-language one for everyone else. The plain language version appears first. An example:

🔴  CRITICAL  —  CVE-2024-29041: Express Path Traversal
In Simple Terms: Someone could access files they shouldn’t through your web server.
Technical Details: Express 4.17.1 contains a path traversal vulnerability allowing attackers to read arbitrary files via crafted URL parameters.
Affected: src/routes/api.js  ·  8 files ·  4 endpoints  ·  Part of 2 attack chains


6.2 Attack Chains
The Security Agent doesn't just find individual vulnerabilities — it maps how they connect into attack chains. An attack chain is a path an attacker could follow from an entry point (usually a public API route) all the way to a dangerous outcome (like database access or file system exposure).

  ATTACK CHAIN EXAMPLE:

  POST /api/search  →  searchHandler()  →  express.static()  →  database.query()
  [User Input]         [No Validation]      [CVE-2024-29041]     [Admin Access]

  Entry Point: The /api/search route accepts user-controlled input
  No Validation: The handler passes it directly without checking
  Vulnerability: The CVE in Express allows path traversal
  Impact: Attacker gains admin-level database access


Fixing the CVE (upgrading Express) would break this entire chain. That's why VIBE CHECK highlights "keystone fixes" — single fixes that resolve multiple attack chains at once.

6.3 The Fix Plan
Every finding above info-level gets a corresponding fix generated by the Doctor Agent. Fixes are ordered by priority and include:
The specific change required (upgrade a package, add input validation, refactor a function)
An estimated time to implement
How many findings and attack chains this fix resolves
Before-and-after code examples with exact file paths and line numbers
Historical context from previous scans when available

The Fix Plan header always shows the full scope: "15 fixes · 6.5 hours total · 2 keystone fixes eliminate 4 chains." This gives developers the information they need to plan a sprint.


7. Technology Partners
VIBE CHECK is built on five technology partners, each filling a specific role in the analysis pipeline.

Partner
Role in VIBE CHECK
📊  Neo4j
The Graph Database. Every file, function, dependency, vulnerability, and relationship is stored in Neo4j's graph database. The entire visualization you see on screen is Neo4j data rendered live. Neo4j is what makes blast radius and attack chain analysis possible.
⚡  Fastino
The Speed Engine. Fastino's Task-Specific Language Models (TLMs) handle the high-volume, precision jobs: classifying 47 files in 142ms, extracting CVE IDs from advisory text, identifying function signatures. Roughly 120 Fastino calls happen per scan, taking about 1.5 seconds total.
🔬  Yutori
The Primary Research Engine. Yutori's n1 model powers all specialist agents via an OpenAI-compatible interface. Its Browsing API does live CVE lookups on NVD and GitHub Security Advisories, while its Research API runs deep dependency intelligence across 100+ sources in parallel.
🧠  OpenAI
The Fallback Reasoner. GPT-4o serves as a backup when Yutori n1 is unavailable, and handles structured outputs for schema-critical graph writes. About 15-30 calls per scan.
🔍  Tavily
The Web Researcher. Tavily searches the public internet (specifically the National Vulnerability Database, GitHub Security Advisories, and Snyk) for quick CVE lookups, changelog snippets, and fix version confirmations.


7.1 During a Live Demo: What You'll See
While a scan is running, the footer of the dashboard shows each sponsor's logo. When that sponsor's API is being called, its logo lights up and pulses. This creates a real-time visual of the integration in action:

  0:03   Neo4j pulses     (graph connection established)
  0:05   Fastino pulses   (file classification begins)
  0:12   Fastino stops    (142ms for 47 files)
  0:15   Tavily pulses    (CVE search begins)
  0:18   Fastino pulses   (extracting CVE entities from search results)
  0:20   OpenAI pulses    (chain analysis begins)
  0:30   OpenAI pulses    (Doctor Agent generating fix docs)



8. Design Philosophy
Every visual and interaction decision in VIBE CHECK was made against a specific principle. The design was guided by synthesizing the mandates of eleven legendary designers.

8.1 The Five Non-Negotiable Mandates

Mandate
Why It Matters
The graph IS the interface
The graph panel takes 60% of the screen because it IS the insight. It shows what no static report can: how isolated problems connect into systemic risk.
The health score is the hero
The score reveal is a 1.8-second choreographed animation sequence. It's meant to feel like a moment of revelation, not just a data display.
Fix plan is co-equal with the score
The Fix Plan is never buried. It's always visible without scrolling. Developers always know what to fix next.
Three colors, three views, three seconds
Only green, amber, and red appear as saturated colors. Everything else is grayscale. The eye is automatically drawn to problems. First meaningful content appears within 3 seconds.
Knowledge compounds over time
The system retains context from previous scans. The second scan of a related project feels different from the first.


8.2 The Visual Aesthetic
VIBE CHECK's visual style is what the design team calls "Surgical Intelligence" — the feeling of medical imaging meets Bloomberg terminal meets deep space observatory. Precise, revealing, clinical.

Dark near-black background with a barely visible grid suggesting measurement precision
Three slowly drifting ambient gradient orbs (red for security, violet for quality, emerald for architecture) that pulse when relevant findings arrive
Dark glassmorphism panels — glass surfaces that sit above the atmospheric background, distorting it slightly
Monospace font (Martian Mono) for scores and grades — feels like an instrument readout, not a website
Graph nodes are nearly invisible at rest — labels only appear when you hover or select them



What It's NOT
VIBE CHECK deliberately avoids the generic "developer SaaS" aesthetic: no purple gradients on white backgrounds, no Inter font (used in 80% of developer tools), no emoji bullets in lists, no confirmation dialogs, no showing all findings at once. Restraint is respect.



9. Technical Stack Summary

9.1 Frontend
Technology
Purpose
Framework
Next.js 15 with React 19 — the web interface
Language
TypeScript (strict) — catches errors before they happen
Styling
Tailwind CSS + CSS custom properties for the design token system
Graph Library
Cytoscape.js — renders the interactive node graph, handles layouts, animations, and user interaction
State Management
Zustand — stores all live data from WebSocket messages
Animations
Framer Motion — powers the health score reveal, node animations, layout transitions
Code Highlighting
Shiki — renders before/after code examples with syntax highlighting
Icons
Lucide React


9.2 Backend
Technology
Purpose
Language & Framework
Python 3.12 + FastAPI — async-first, handles REST API and WebSocket connections simultaneously
Data Validation
Pydantic v2 — ensures data integrity throughout the pipeline
Concurrency
Python asyncio — runs Quality, Pattern, and Security agents in parallel
Graph Database
Neo4j (AuraDB) — the knowledge graph, queried via async Python driver
Analysis State
SQLite via aiosqlite — lightweight persistent state for analysis records
Web Scraping
Tavily Python SDK — handles CVE search and advisory content extraction
AI (Speed)
Fastino GLiNER-2 via REST API + gliner2 Python SDK
AI (Reasoning)
OpenAI GPT-4o via official async Python SDK
Repo Cloning
Git subprocess — clones repositories to temporary local storage
Code Parsing
Tree-sitter + Python ast module — extracts functions and structure from source files


9.3 Communication: How Frontend and Backend Talk

  REST API calls:  Frontend → Backend
  POST /analyze          Start a new analysis
  GET  /analysis/:id     Get analysis status and results
  GET  /analysis/:id/findings   Get all findings
  GET  /analysis/:id/fixes      Get the fix plan
  GET  /analysis/:id/graph      Get graph data for a specific view
  WebSocket:   Backend → Frontend (real-time streaming)
  Agent status updates ("Mapper is 80% complete")
  Graph nodes as they're discovered
  Findings as they're found
  Agent completion events with finding counts
  Final health score and completion signal



10. What Makes VIBE CHECK Different

Differentiator
Why It Matters
Attack Chain Visualization
Most scanners list vulnerabilities. VIBE CHECK shows you HOW they connect — from the entry point to the exploitable outcome — as a live animated graph. You can see the blast radius of any node in the entire graph.
Speed + Depth Combination
Fastino handles fast classification (47 files in 142ms). OpenAI handles deep reasoning. Together they deliver both speed and quality that neither can achieve alone.
Keystone Fixes
Instead of treating all fixes equally, VIBE CHECK identifies which single fixes will resolve the most attack chains. Fix one thing, break four chains.
Plain Language First
Every technical finding has a plain-language explanation that appears before the technical details. A junior developer and a security engineer can both use VIBE CHECK effectively.
Compounding Intelligence
Every scan is a learning event. The more you use VIBE CHECK, the smarter it gets about your specific codebase patterns and your team's fix habits.
Real-Time Theater
The analysis isn't hidden behind a loading spinner. You watch the graph build, see findings appear as they're discovered, observe agents checking in with progress. The process is transparent and compelling.


VIBE CHECK  —  Digital Studio Labs  —  February 2026
"Vibe code fast. VIBE CHECK before you ship."
