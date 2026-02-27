# VIBE CHECK — FRONTEND PRD v3.0
## Dashboard, Graph Visualization & User Experience

*Digital Studio Labs — February 27, 2026*

---

## TABLE OF CONTENTS

1. Design Philosophy & Expert Mandates
2. Design System — Visual Language
3. Application Architecture
4. Page & View States
5. Component Specifications (Deep)
   - 5.1 Layout Shell
   - 5.2 AnalysisInput (The Entry Point)
   - 5.3 AnalysisProgress (The Theater)
   - 5.4 HealthScoreHero (The Moment)
   - 5.5 ScoreBreakdown (The Diagnosis)
   - 5.6 GraphPanel (The Medium)
   - 5.7 FindingsPanel (The Evidence)
   - 5.8 FindingDetail (The Deep Dive)
   - 5.9 FixPlan (The Call to Action)
6. Animation & Motion Choreography
7. Responsive & Accessibility
8. Data Flow & State Management
9. WebSocket Integration
10. Demo-Specific Optimizations
11. Frontend Build Plan
12. File Structure

---

## 1. DESIGN PHILOSOPHY & EXPERT MANDATES

This frontend is not a dashboard. It is an **instrument for understanding code** — designed by synthesizing the principles of 11 legendary designers into five non-negotiable mandates.

### The Five Mandates

| # | Mandate | Source Designer | Implementation |
|---|---------|----------------|----------------|
| 1 | **Health Score is the hero** | Dieter Rams, Steve Jobs | Largest typographic element on screen. Emotional. Animated reveal. Everything radiates outward from it. |
| 2 | **Graph builds progressively** | Alan Kay, Steve Jobs | Never show a completed graph — let it assemble while they watch. Each node appears with intent. The graph IS the medium. |
| 3 | **Fix Plan is the call to action** | Jef Raskin, Don Norman | Co-equal with the score. User always knows what to fix next. Not a footnote — a primary panel. |
| 4 | **Intelligence compounds over time** | Tony Fadell, Don Norman | First scan feels like a report. Second scan reveals deeper insight. The system learns from every analysis. |
| 5 | **Three colors, three views, three seconds** | Jonathan Ive, Dieter Rams | Restraint everywhere. Green/amber/red. Structure/dependencies/vulnerabilities. First meaningful content in 3s. |

### Expert Design Decisions Embedded in This PRD

**Alan Kay:** The graph visualization creates new understanding — showing how isolated issues connect into systemic risk is a genuinely new way of seeing code. The graph is not a widget, it is the medium.

**Don Norman:** Progressive disclosure manages three competing mental models: report → investigation tool → intelligence system. First interaction feels familiar (score), exploration reveals depth (graph), repeated use reveals the system learns.

**Steve Jobs:** Experience breaks at three points: (1) waiting without visible progress — solved by streaming agents and progressive graph building; (2) graph looking like a hairball — solved by starting with file structure, complexifying on demand; (3) generic fixes — solved by referencing exact files, lines, functions from THIS repo.

**Jonathan Ive:** Monochrome base. Three accent colors only. Typography does the heavy lifting. Graph nodes are subtle until interacted with. Edges thin gray by default. Clinical, precise, revealing — like an X-ray.

**Kevin Systrom:** Paste URL → Click Analyze → See score. Three actions, under 2 seconds of user time. Single input bar. Zero configuration. Auto-detect GitHub URLs.

**Linus Torvalds:** 500-file hard limit. Graceful degradation for large repos. Timeout guards. Cached demo results for safety.

**Guido van Rossum:** Every finding has two descriptions: technical (for seniors) and plain-language (for everyone). Fix docs include before/after code with exact paths and lines.

---

## 2. DESIGN SYSTEM — VISUAL LANGUAGE

### Aesthetic Direction: Clinical Intelligence

The aesthetic is **medical imaging meets financial terminal** — clinical precision with the gravitas of serious tooling. Think: MRI scan readout, Bloomberg terminal clarity, surgical instrument UI. Not playful, not corporate. **Precise, revealing, authoritative.**

### Typography

```css
/* Display — The Score, The Grade */
--font-display: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;

/* Headings — Section labels, agent names */
--font-heading: 'Geist', 'Satoshi', -apple-system, sans-serif;

/* Body — Descriptions, documentation */
--font-body: 'Geist', 'Satoshi', -apple-system, sans-serif;

/* Code — File paths, code snippets */
--font-code: 'JetBrains Mono', 'Fira Code', monospace;
```

**Rationale (Ive):** Monospace for the score creates the clinical feel. Sans-serif for readability. No decorative fonts. Typography IS the design.

### Type Scale

```css
--text-hero: 7rem;           /* Health Score letter grade */
--text-score-number: 2.5rem; /* 73/100 numeric score */
--text-h1: 1.75rem;          /* Section headings */
--text-h2: 1.25rem;          /* Sub-headings */
--text-body: 0.9375rem;      /* 15px — body text */
--text-small: 0.8125rem;     /* 13px — metadata, labels */
--text-micro: 0.6875rem;     /* 11px — timestamps, secondary labels */
```

### Color System

Three semantic colors. Everything else is grayscale.

```css
/* Background & Surface */
--bg-primary: #0A0A0B;           /* Near-black canvas */
--bg-surface: #111113;           /* Card/panel surface */
--bg-surface-raised: #18181B;    /* Elevated surface */
--bg-surface-hover: #1E1E22;     /* Hover state */
--bg-input: #0F0F11;             /* Input fields */

/* Borders */
--border-default: #27272A;       /* Subtle borders */
--border-hover: #3F3F46;         /* Hover borders */
--border-active: #52525B;        /* Active/focus borders */

/* Text */
--text-primary: #FAFAFA;         /* Primary text */
--text-secondary: #A1A1AA;       /* Secondary text */
--text-tertiary: #71717A;        /* Tertiary/disabled text */

/* The Three Colors (Ive mandate) */
--color-healthy: #22C55E;        /* Green — score ≥ 7 */
--color-healthy-dim: #166534;    /* Green bg tint */
--color-warning: #F59E0B;        /* Amber — score 4-6 */
--color-warning-dim: #78350F;    /* Amber bg tint */
--color-critical: #EF4444;       /* Red — score ≤ 3 */
--color-critical-dim: #7F1D1D;   /* Red bg tint */

/* Accent (used sparingly — graph chains, active states) */
--color-accent: #3B82F6;         /* Blue — selected, focused */
--color-accent-dim: #1E3A5F;     /* Blue bg tint */

/* Agent Identity Colors (progress tracking only) */
--agent-mapper: #8B5CF6;         /* Purple */
--agent-quality: #06B6D4;        /* Cyan */
--agent-pattern: #F97316;        /* Orange */
--agent-security: #EF4444;       /* Red */
--agent-doctor: #22C55E;         /* Green */
```

**Rationale (Rams):** Dark mode is the only mode. Code is read on dark backgrounds. The three severity colors are the only saturated elements — they command attention by contrast. Everything else recedes.

### Spacing

```css
--space-1: 0.25rem;    /* 4px */
--space-2: 0.5rem;     /* 8px */
--space-3: 0.75rem;    /* 12px */
--space-4: 1rem;       /* 16px */
--space-5: 1.5rem;     /* 24px */
--space-6: 2rem;       /* 32px */
--space-8: 3rem;       /* 48px */
--space-10: 4rem;      /* 64px */
--space-12: 5rem;      /* 80px */
```

### Border Radius

```css
--radius-sm: 6px;      /* Small elements: badges, tags */
--radius-md: 8px;      /* Cards, inputs */
--radius-lg: 12px;     /* Panels, modals */
--radius-xl: 16px;     /* Hero score container */
--radius-full: 9999px; /* Pills, circular elements */
```

### Shadows & Depth

```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
--shadow-md: 0 4px 12px rgba(0,0,0,0.4);
--shadow-lg: 0 8px 30px rgba(0,0,0,0.5);
--shadow-glow-healthy: 0 0 40px rgba(34,197,94,0.15);
--shadow-glow-warning: 0 0 40px rgba(245,158,11,0.15);
--shadow-glow-critical: 0 0 40px rgba(239,68,68,0.15);
--shadow-glow-accent: 0 0 30px rgba(59,130,246,0.12);
```

### Graph-Specific Tokens

```css
/* Node sizes */
--node-sm: 8px;          /* Minor files, utilities */
--node-md: 14px;         /* Standard files */
--node-lg: 22px;         /* Entry points, high-finding files */
--node-xl: 32px;         /* Package nodes, critical findings */

/* Node colors (by type) */
--node-file: #A1A1AA;            /* Zinc — default file */
--node-directory: #71717A;       /* Dimmer — directory */
--node-function: #A78BFA;        /* Light purple — function */
--node-package: #60A5FA;         /* Light blue — package */
--node-endpoint: #34D399;        /* Emerald — endpoint */

/* Edge styles */
--edge-default: #27272A;         /* Nearly invisible by default */
--edge-import: #3F3F46;          /* Slightly visible for imports */
--edge-vulnerability: var(--color-critical);  /* Red for vuln chains */
--edge-width-default: 1px;
--edge-width-chain: 2.5px;
--edge-width-highlighted: 3.5px;
```

---

## 3. APPLICATION ARCHITECTURE

### Tech Stack

| Concern | Technology | Rationale |
|---------|------------|-----------|
| Framework | Next.js 15 (App Router) | Shared repo with backend, RSC for initial load |
| Language | TypeScript (strict) | Shared types from contracts |
| Styling | Tailwind CSS + CSS Variables | Utility-first with design tokens |
| Graph Viz | Cytoscape.js | Lightweight, supports cola/dagre layouts, good perf ≤500 nodes |
| State | Zustand | Lightweight, no boilerplate, good for WebSocket-driven state |
| WebSocket | Native WebSocket + reconnect logic | Real-time agent streaming |
| Animation | Framer Motion | Orchestrated reveals, layout animations |
| Icons | Lucide React | Consistent, tree-shakeable |
| Code Display | Shiki (syntax highlighting) | For before/after code in fix docs |

### Component Tree

```
<RootLayout>
  <ThemeProvider>             /* CSS variables, dark mode */
    <WebSocketProvider>       /* WS connection management */
      <AnalysisStore>         /* Zustand global state */
        <AppShell>
          <Header />
          <main>
            {/* Route: / (empty state) */}
            <AnalysisInput />

            {/* Route: /analysis/[id] (active/completed) */}
            <AnalysisDashboard>
              <AnalysisProgress />              /* visible during scan */
              <DashboardGrid>                   /* visible after scan or partially during */
                <HealthScoreHero />
                <ScoreBreakdown />
                <GraphPanel />
                <FindingsPanel />
                  <FindingDetail />             /* slide-over or modal */
                <FixPlan />
              </DashboardGrid>
            </AnalysisDashboard>
          </main>
          <Footer />                            /* "Powered by" sponsor logos */
        </AppShell>
      </AnalysisStore>
    </WebSocketProvider>
  </ThemeProvider>
</RootLayout>
```

---

## 4. PAGE & VIEW STATES

The application has exactly four states. The transitions between them are the core UX choreography.

### State 1: EMPTY — The Input

```
┌──────────────────────────────────────────────────────┐
│  VIBE CHECK                                         │
│                                                      │
│                                                      │
│                                                      │
│              ┌──────────────────────────┐            │
│              │  🔗 Paste a GitHub URL    │            │
│              │  ┌──────────────────────┐ │            │
│              │  │ https://github.com/  │ │            │
│              │  └──────────────────────┘ │            │
│              │       [ ⚡ Analyze ]       │            │
│              └──────────────────────────┘            │
│                                                      │
│        "Autonomous agents. Living knowledge          │
│         graph. Intelligence that compounds."         │
│                                                      │
│  ─────────────────────────────────────────────────── │
│  Powered by: Neo4j · Fastino · Yutori · OpenAI · Tavily  │
└──────────────────────────────────────────────────────┘
```

**Design rules (Systrom):** The input bar is the single dominant element. No navigation, no features visible, no settings. The background is atmospheric but calm — a very subtle grid pattern or noise texture suggesting "scan" energy. The tagline is one sentence. Sponsor logos in a quiet footer bar.

### State 2: SCANNING — The Theater

```
┌──────────────────────────────────────────────────────┐
│  VIBE CHECK                 user/repo  ● Analyzing   │
│                                                      │
│  ┌─ AGENTS ──────────────────────────────────────┐   │
│  │  ✓ Orchestrator   Detected: Next.js + TS      │   │
│  │  ◉ Mapper         ████████░░ 80% Building...  │   │
│  │  ○ Quality        Pending                     │   │
│  │  ○ Pattern        Pending                     │   │
│  │  ○ Security       Pending                     │   │
│  │  │  ○ Doctor         Pending                     │   │
│  │                                               │   │
│  │  ⚡ Fastino: 47 files classified in 142ms     │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ GRAPH (building live) ───────────────────────┐   │
│  │        ○──○                                   │   │
│  │       / \  \                                  │   │
│  │      ○   ○  ○──○                              │   │
│  │     / \     │                                 │   │
│  │    ○   ○    ○    ... nodes appearing          │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ LIVE FINDINGS ──────────────────────────────┐    │
│  │  🔴 CVE-2024-29041: Express Path Traversal   │    │
│  │  🟡 Unhandled error in auth.js:34            │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

**Design rules (Jobs, Kay):** This is theater. Every second must show visible progress. The graph builds node-by-node as the Mapper works. Agent status lines update in real-time. Live findings appear as they're discovered — critical findings get a brief pulse animation. The Fastino speed callout is visible ("47 files classified in 142ms") for sponsor demo value.

### State 3: COMPLETED — The Dashboard

```
┌──────────────────────────────────────────────────────────────────────┐
│  VIBE CHECK                        user/repo  ✓ Completed (42s)     │
│                                                                      │
│  ┌─────────────┐  ┌─────────────────────────────────────────────┐   │
│  │             │  │ Code Quality  ████████░░  7/10  ⚠️          │   │
│  │    B-       │  │ Patterns      ██████░░░░  6/10  ⚠️          │   │
│  │   73/100    │  │ Security      ████░░░░░░  4/10  🔴          │   │
│  │             │  │ Dependencies  ████████░░  8/10  ✅          │   │
│  │  0.91 conf  │  │ Architecture  ███████░░░  7/10  ⚠️          │   │
│  └─────────────┘  └─────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─ GRAPH ─────────────────────┐  ┌─ FINDINGS ─────────────────┐   │
│  │  [Structure] [Deps] [Vulns] │  │  🔴 Critical (3)           │   │
│  │                             │  │  🟡 Warning  (12)          │   │
│  │     Interactive graph       │  │  ℹ️ Info     (24)           │   │
│  │     with vulnerability      │  │                            │   │
│  │     chain overlay           │  │  [finding list...]         │   │
│  │                             │  │                            │   │
│  └─────────────────────────────┘  └────────────────────────────┘   │
│                                                                      │
│  ┌─ FIX PLAN ──────────────────────────────────────────────────┐    │
│  │  #1 ⬆️ Upgrade Express 4.17.1 → 4.21.0  [30 min] [3 chains] │    │
│  │  #2 🔧 Add input validation to /api/search  [15 min]        │    │
│  │  ...                                                         │    │
│  │  Total: 15 fixes · 6.5 hours · 2 keystone fixes             │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

**Design rules (Rams, Raskin):** The score is the hero — massive, immediate, emotional. The breakdown shows why. The graph is explorable but not overwhelming (starts in structure view). Findings are collapsed by severity. Fix plan is co-equal with the score — visible without scrolling.

### State 4: FAILED — The Recovery

Minimal: error message explaining what went wrong (agent that failed, network issue), a "Try Again" button, and optional "Try a Different Repo" link. No blame language. No technical jargon unless the user opens a "details" accordion.

---

## 5. COMPONENT SPECIFICATIONS

### 5.1 Layout Shell

```typescript
// components/layout/AppShell.tsx
```

**Structure:** Full-viewport dark shell. Header is fixed, 56px tall. Main content scrolls. Footer is fixed at bottom, 40px, shows sponsor logos.

**Header contents:**
- Left: VIBE CHECK wordmark (JetBrains Mono, 700, tracking tight, uppercase)
- Center: Repo name + status badge (when active analysis)

**Footer contents:**
- "Powered by" + sponsor logos in grayscale (Neo4j, Fastino, Yutori, OpenAI, Tavily)
- Logos colorize on hover
- During active scan, footer shows which sponsor API is currently active with a subtle pulse

**Sponsor Visibility Strategy (critical for hackathon judging):**

The footer isn't just attribution — it's a live integration indicator. During scanning:
```
Powered by:  Neo4j ●  Fastino ⚡  Yutori ○  OpenAI ○  Tavily ○
                      ↑ currently active, pulsing
```

Each sponsor logo pulses with its agent color when that sponsor's API is being called. This creates a visceral sense of multi-sponsor integration during the demo.

---

### 5.2 AnalysisInput — The Entry Point

**Implements mandate:** "Three actions, under 2 seconds of user time" (Systrom)

```typescript
interface AnalysisInputProps {
  onAnalyze: (request: AnalyzeRequest) => void;
  isLoading: boolean;
}
```

**Visual spec:**
- Centered vertically and horizontally on empty viewport
- Single input field, 480px wide max, with GitHub icon prefix
- `placeholder="Paste a GitHub URL..."` in tertiary text color
- Auto-detects GitHub URLs on paste (regex validation, immediate green border flash)
- Single button: "⚡ Analyze" — uses accent blue, full-width below input on mobile
- Advanced options (branch, scope, maxFiles) behind a collapsed "Options" chevron — never shown by default
- Below input: one-line tagline in secondary text, 14px

**Interaction flow:**
1. User pastes URL → input border flashes green for 200ms → URL auto-validated
2. User clicks Analyze (or presses Enter)
3. Button enters loading state (spinner replaces icon)
4. `POST /analyze` fires → on 202, transition to Scanning state
5. URL updates to `/analysis/[analysisId]`

**Micro-animation:** On paste detection, the GitHub icon in the input prefix does a subtle scale bounce (1.0 → 1.15 → 1.0, 200ms, ease-out).

**Error states:**
- Invalid URL: red border + "Enter a valid GitHub repository URL" below input
- Repo not found: red border + "Repository not found or is private"
- Rate limited: amber border + "Too many requests. Try again in {retryAfter}s"

---

### 5.3 AnalysisProgress — The Theater

**Implements mandate:** "Graph builds progressively" (Kay, Jobs)

```typescript
// Consumes: WebSocket /ws/analysis/:id
// All data arrives via WSMessage union type (see contracts)
```

**Layout:** Two-column on desktop, stacked on mobile.
- Left column (40%): Agent status list + sponsor activity
- Right column (60%): Live graph canvas building in real-time

**Agent Status List:**

Each of the 6 agents gets a row:

```
[icon] [name]       [status]              [detail]           [provider badge]
  ✓    Orchestrator  Complete              Next.js + TS       —
  ◉    Mapper        ████████░░ 80%       Building graph...  ⚡ Fastino
  ○    Quality       Pending               —                 —
```

- `pending`: dimmed row, circle outline icon, "Pending" in tertiary text
- `running`: bright row, animated spinning icon, progress bar, status message, provider badge
- `complete`: check icon in agent color, finding count badge, duration
- `error`: red X icon, error message, "retry" link

**Provider Badge** (critical for demo):
When an agent is running, a small badge shows which sponsor API is active:
- `⚡ Fastino` — yellow badge, for classification/extraction tasks
- `🧠 OpenAI` — green badge, for deep reasoning tasks
- `🔍 Tavily` — blue badge, for web search tasks
This makes sponsor usage visceral and visible during the demo.

**Fastino Speed Callout:**
Whenever Fastino completes a batch, a brief toast appears:
```
⚡ Fastino GLiNER-2: 47 files classified in 142ms
```
This appears below the agent list, fades after 3s. Stacks if multiple appear.

**Live Graph Canvas:**
As the Mapper agent sends `graph_node` and `graph_edge` WebSocket messages, the graph renders progressively:
- Nodes fade in with a scale animation (0 → 1, 300ms, spring ease)
- Edges draw as lines from source to target (200ms, ease-out)
- Layout recalculates smoothly (cola or dagre layout with incremental updates)
- Color-coded by file category: source (white), test (cyan), config (amber), docs (blue)

**Live Findings Feed:**
Below the graph (or as a third column on wide screens), findings appear as they arrive:
- Each finding slides in from the right with a fade
- Critical findings get a brief red pulse on the left border
- Stack limit: show last 5, with "and X more..." counter

---

### 5.4 HealthScoreHero — The Moment

**Implements mandate:** "Health Score is the hero. Large, bold, emotional." (Rams, Jobs)

```typescript
// Consumes: GET /analysis/:id → healthScore
// Props from contracts: HealthScoreHeroProps
```

**This is the single most important visual element in the entire application.**

**Layout:** Full-width panel, centered content, generous vertical padding (space-10 top/bottom).

**Visual hierarchy:**
1. **Letter Grade** — 7rem monospace. This is the largest text on screen. Colored by severity.
2. **Numeric Score** — 2.5rem monospace, secondary text. "73 / 100"
3. **Confidence** — micro text, tertiary. "0.91 confidence"

**Color logic:**
```typescript
function gradeColor(letterGrade: string): string {
  const score = gradeToScore(letterGrade);  // A+ = 97, A = 93... F = 50
  if (score >= 90) return 'var(--color-healthy)';
  if (score >= 70) return 'var(--color-warning)';
  return 'var(--color-critical)';
}
```

**The Reveal Animation (Jobs mandate: "should feel like a moment"):**

This is a 1.8-second choreographed sequence:

```
0ms:    Container fades in (opacity 0 → 1, 300ms)
300ms:  Numeric score counts up from 0 → 73 (800ms, ease-out)
        Digits change rapidly, slowing as they approach target
        Color transitions from white → severity color as number resolves
1100ms: Letter grade scales in (0.5 → 1.0, 400ms, spring bounce)
        Simultaneous: glow shadow pulses once behind the grade
1500ms: Confidence fades in (200ms)
1700ms: Glow settles to static ambient state
```

**Glow effect:** Behind the letter grade, a radial gradient glow in the severity color. Radius: 120px. Opacity: 0.15. This creates the "emotional weight" that Jobs demanded.

**Container:** `border-radius: var(--radius-xl)`. Border: 1px solid in severity color at 0.2 opacity. Background: `var(--bg-surface)` with subtle severity color tint (2% opacity).

---

### 5.5 ScoreBreakdown — The Diagnosis

**Implements mandate:** "User must immediately know what's wrong" (Raskin)

```typescript
// Consumes: GET /analysis/:id → healthScore.breakdown
// Props from contracts: ScoreBreakdownProps
```

**Layout:** Horizontal row of 5 category cards on desktop, 2-column grid on tablet, vertical stack on mobile. Sits directly to the right of (or below) the HealthScoreHero.

**Each category card:**
```
┌────────────────────────────┐
│  Code Quality          ⚠️   │
│  ████████░░  7 / 10        │
└────────────────────────────┘
```

- Category label: `--text-small`, `--font-heading`, uppercase, letter-spacing 0.05em
- Status icon: colored circle (green/amber/red) or emoji shorthand
- Progress bar: 8px tall, rounded, filled to score/max ratio
  - Fill color: severity color
  - Background: `--bg-surface-raised`
- Score: `--text-body`, monospace, "{score} / {max}"

**Interaction:** Clicking a category card filters the FindingsPanel to show only findings from that category's corresponding agent. The card gets a subtle active border.

**Animation:** Cards stagger in from left to right, 100ms delay each, 300ms duration fade+slide-up.

---

### 5.6 GraphPanel — The Medium

**Implements mandate:** "The graph IS the interface" (Alan Kay)

```typescript
// Consumes: GET /analysis/:id/graph?view=X
// Consumes: WebSocket graph_node / graph_edge (during scanning)
// Props from contracts: GraphPanelProps
```

**This is the most complex component. It is the product.**

**Layout:** Takes 60% of the main content area width. Full remaining height. Has a toolbar at top, canvas fills the rest.

**Toolbar:**
```
[ Structure | Dependencies | Vulnerabilities ]     🔍 Search    ↻ Reset    ⤢ Fullscreen
```
- Three view tabs (Nielsen mandate: three views only for MVP)
- Search: filters/highlights nodes by name/path
- Reset: returns to default zoom/position
- Fullscreen: expands graph to fill viewport

**Graph Library: Cytoscape.js**

Configuration per view:

| View | Layout | Nodes Shown | Edges Shown | Special |
|------|--------|-------------|-------------|---------|
| Structure | dagre (hierarchical TB) | Files, directories | CONTAINS | Color by category |
| Dependencies | cola (force-directed) | Files, packages | IMPORTS, DEPENDS_ON | Package nodes larger |
| Vulnerabilities | Same as current view + overlay | Same + findings | Same + vulnerability chain edges | Red chain overlay |

**Node rendering:**
```typescript
// Cytoscape node style
{
  'background-color': (node) => {
    if (node.data('severity') === 'critical') return 'var(--color-critical)';
    if (node.data('severity') === 'warning') return 'var(--color-warning)';
    return nodeTypeColor(node.data('type'));  // type-based default
  },
  'width': (node) => {
    const findings = node.data('findingCount') || 0;
    if (findings >= 3) return 'var(--node-xl)';
    if (findings >= 1) return 'var(--node-lg)';
    return 'var(--node-md)';
  },
  'border-width': (node) => node.data('findingCount') > 0 ? 2 : 0,
  'border-color': (node) => severityColor(node.data('severity')),
  'label': (node) => node.data('label'),
  'font-size': '10px',
  'color': 'var(--text-secondary)',
}
```

**Edge rendering:**
- Default: thin (`--edge-width-default`), dark (`--edge-default`), near-invisible
- Import edges: slightly brighter (`--edge-import`)
- Vulnerability chain edges: thick (`--edge-width-chain`), red (`--color-critical`), animated dash pattern

**Vulnerability overlay (the money shot):**
When switching to "Vulnerabilities" view:
1. All non-chain edges fade to 0.1 opacity (200ms)
2. Chain edges animate in with a "drawing" motion — SVG dash-offset animation from source to target
3. Chain nodes pulse once with their severity color
4. A legend appears: "Red path = attack chain. Click to see details."

**Node interaction:**
- **Hover:** Node brightens, label becomes fully opaque, tooltip shows path + finding count
- **Click:** Node selects (blue ring), FindingsPanel filters to this file, detail sidebar opens
- **Right-click/long-press:** Context menu with "Show in Findings", "Show Dependencies", "Show Blast Radius"

**"Show Blast Radius" (Alan Kay feature):**
Selecting a node and clicking "Show Blast Radius" runs a multi-hop highlight:
1. Selected node pulses
2. Direct dependents highlight (1-hop) in amber — 200ms delay
3. Transitive dependents highlight (2-hop) in lighter amber — 400ms delay
4. 3-hop in even lighter — 600ms delay
5. Numeric overlay: "8 files, 23 functions, 4 endpoints affected"

This creates the "I never saw it that way before" moment Kay demanded.

**Progressive building (during scan):**
When receiving WebSocket `graph_node` messages during the Mapper phase:
- Each node fades in at its layout position with a spring scale animation
- Edges draw as connections between existing nodes
- Layout smoothly recomputes (Cytoscape's `layout.run()` with animation)
- A counter overlay shows: "47 files · 156 functions · 12 dependencies"

---

### 5.7 FindingsPanel — The Evidence

**Implements mandate:** "Collapse by severity. Behind a click." (Rams)

```typescript
// Consumes: GET /analysis/:id/findings?severity=X&agent=X
// Props from contracts: FindingsPanelProps
```

**Layout:** Takes 40% of the main content area (right side of graph). Scrollable list.

**Header:**
```
FINDINGS (39)    Filter: [All ▾]  [All Agents ▾]
```

**Severity groups (accordion):**
```
🔴 Critical (3)                          ▾
┌──────────────────────────────────────────┐
│ CVE-2024-29041: Express Path Traversal   │
│ src/routes/api.js · 8 files affected     │
│ ⛓ Part of 2 chains                      │
├──────────────────────────────────────────┤
│ Hardcoded database password              │
│ src/config/db.js:12 · 1 file affected    │
├──────────────────────────────────────────┤
│ SQL injection in search handler          │
│ src/routes/api.js:45 · 4 endpoints       │
└──────────────────────────────────────────┘

🟡 Warning (12)                           ▸  (collapsed)
ℹ️ Info (24)                               ▸  (collapsed)
```

**Each finding row:**
- Severity dot (colored)
- Title: `--text-body`, `--font-heading`, semibold
- Subtitle: file path (monospace, tertiary) + blast radius summary
- Chain badge: if `chainIds.length > 0`, show "⛓ Part of N chains" in accent blue
- Right side: "Show in Graph" button (ghost style, appears on hover)

**Interaction:**
- Click finding → opens FindingDetail slide-over
- "Show in Graph" → highlights affected nodes in GraphPanel, pans to center them
- Filter dropdowns filter the list, update counts

**Empty state:** "No findings in this category. Nice work!" with a green check icon.

---

### 5.8 FindingDetail — The Deep Dive

**Implements mandate:** "Two descriptions: technical + plain language" (van Rossum)

```typescript
// Consumes: Finding + Fix + VulnerabilityChain
// Props from contracts: FindingDetailProps
```

**Layout:** Slide-over panel from right, 500px wide, overlays the FindingsPanel.

**Sections (top to bottom):**

1. **Header**
   ```
   🔴 CRITICAL                                    [✕ Close]
   CVE-2024-29041: Express 4.17.1 Path Traversal
   95% confidence · Security Agent
   ```

2. **Plain Language** (van Rossum mandate)
   ```
   💬 In Simple Terms
   "Someone could access files they shouldn't through your web server."
   ```
   Light surface card, body text, approachable. This goes FIRST.

3. **Technical Description**
   ```
   📋 Technical Details
   Express 4.17.1 contains a path traversal vulnerability allowing
   attackers to read arbitrary files via crafted URL parameters...
   ```

4. **Affected Code**
   ```
   📁 Affected Files
   src/routes/api.js        lines 12-45    (serves static files)
   src/middleware/upload.js  lines 8-22     (handles file uploads)
   ```
   File paths are monospace, clickable (highlights in graph).

5. **Blast Radius** (visual)
   ```
   💥 Blast Radius
   ┌────┬────┬────┐
   │ 8  │ 23 │ 4  │
   │files│func│endp│
   └────┴────┴────┘
   ```
   Three stat boxes, colored by severity.

6. **Vulnerability Chain** (if `chainIds.length > 0`)
   ```
   ⛓ Attack Chain
   POST /api/search → searchHandler() → express.static() → database.query()
   [User Input]     [No Validation]   [CVE-2024-29041]  [Admin Access]
   ```
   Horizontal flow diagram with step nodes. Click "View in Graph" to highlight chain.

7. **Fix Documentation** (if `fixId` exists)
   ```
   🔧 Fix: Upgrade Express 4.17.1 → 4.21.0
   Estimated effort: 30 minutes · Resolves 3 chains

   Steps:
   1. Update package.json: "express": "^4.21.0"
   2. Run npm install
   3. Update src/middleware/upload.js line 15...

   Before:
   ┌──────────────────────────────────────────────┐
   │ const filePath = path.join(uploadDir,        │
   │                  req.params.filename)         │
   └──────────────────────────────────────────────┘
   After:
   ┌──────────────────────────────────────────────┐
   │ const filePath = path.resolve(uploadDir,     │
   │                  path.basename(              │
   │                    req.params.filename))      │
   └──────────────────────────────────────────────┘
   ```
   Code blocks use Shiki with the dark theme for syntax highlighting.

---

### 5.9 FixPlan — The Call to Action

**Implements mandate:** "Co-equal with the score. User always knows what to fix next." (Raskin)

```typescript
// Consumes: GET /analysis/:id/fixes
// Props from contracts: FixPlanProps
```

**Layout:** Full-width panel below the graph/findings area. Always visible without scrolling on desktop.

**Header:**
```
FIX PLAN                            [ Export ▾ ]
15 fixes · 6.5 hours total · 2 keystone fixes eliminate 4 chains
```

The summary line is critical — it quantifies the total remediation effort and highlights keystones.

**Fix list (priority ordered):**

```
#1  ⬆️ CRITICAL   Upgrade Express 4.17.1 → 4.21.0
    30 min · Resolves 3 chains · 2 findings
    🧠 "Fixed in 2 previous repos — avg 25 min"               [View Fix ▸]

#2  🔧 CRITICAL   Add input validation to /api/search endpoint
    15 min · Resolves 1 chain · 1 finding                     [View Fix ▸]

#3  🔧 WARNING    Handle uncaught promise in auth middleware
    10 min · 1 finding                                        [View Fix ▸]
```

**Each fix row:**
- Priority number (monospace, large)
- Type icon: ⬆️ dependency upgrade, 🔧 code patch, 🏗️ refactor
- Severity badge
- Title
- Effort estimate + chains resolved + findings resolved
- "View Fix" expands to full documentation inline, OR opens FindingDetail

**Keystone Fix Highlight:**
Fixes that are "keystones" (resolving multiple chains) get a special treatment:
- Left border: 3px solid accent blue
- Badge: "⚡ Keystone — fixes N chains"
- These always sort to top regardless of severity

**Export dropdown:** Markdown (downloads .md file), JSON (downloads .json)

---

## 6. ANIMATION & MOTION CHOREOGRAPHY

### Principles

1. **Motion serves understanding, not decoration** (Ive)
2. **Progressive reveals create narrative** (Jobs)
3. **Speed callouts serve sponsor visibility** (hackathon strategy)

### Core Animations

| Animation | Duration | Easing | Trigger |
|-----------|----------|--------|---------|
| Page transition (empty → scanning) | 400ms | ease-out | POST /analyze returns 202 |
| Agent status change | 200ms | ease-in-out | WebSocket status message |
| Graph node appear | 300ms | spring (stiffness: 200, damping: 20) | WebSocket graph_node |
| Graph edge draw | 200ms | ease-out | WebSocket graph_edge |
| Finding slide-in | 250ms | ease-out | WebSocket finding |
| Critical finding pulse | 600ms | ease-in-out, 2 cycles | Finding severity === critical |
| Health Score count-up | 800ms | ease-out (decelerate) | Analysis complete |
| Letter grade reveal | 400ms | spring (overshoot) | After count-up completes |
| Grade glow pulse | 1000ms | ease-in-out, 1 cycle | After grade reveal |
| Score breakdown stagger | 5 × 100ms delay, 300ms each | ease-out | After grade settle |
| Vulnerability chain draw | 400ms per step | ease-out, sequential | View switch to Vulnerabilities |
| Blast radius ripple | 3 × 200ms delay | ease-out | "Show Blast Radius" click |
| Fastino speed toast | 200ms in, 3000ms hold, 300ms out | ease-out | After Fastino batch completes |
| FindingDetail slide-over | 300ms | ease-out | Finding click |

### Motion Choreography: The Complete Score Reveal

This is the signature animation — the 3-second sequence from "analysis complete" to "user sees their grade."

```
T+0ms:     Dashboard skeleton fades in (layout visible, content pending)
T+100ms:   Score container appears (border + background, no content)
T+300ms:   Numeric score begins counting: 0 → 73
           Digits animate rapidly, decelerating (ease-out quadratic)
           Color shifts: white → yellow → amber (matching final severity)
T+1100ms:  Count completes at 73. Brief pause (100ms).
T+1200ms:  Letter grade "B-" scales in from 0.5 → 1.0 with spring overshoot
           Glow shadow expands from 0 → 40px radius
T+1600ms:  Glow settles. Confidence text fades in.
T+1700ms:  Score breakdown cards stagger in (5 cards, 100ms apart)
T+2200ms:  Graph panel fades in with existing graph data
T+2500ms:  Findings panel fades in
T+2800ms:  Fix plan slides up from bottom. Dashboard fully revealed.
```

---

## 7. RESPONSIVE & ACCESSIBILITY

### Breakpoints

```css
--bp-mobile: 640px;
--bp-tablet: 1024px;
--bp-desktop: 1280px;
--bp-wide: 1536px;
```

### Layout Adaptations

| Viewport | Layout |
|----------|--------|
| Wide (≥1536px) | 3-column: graph (50%) + findings (25%) + detail (25%) |
| Desktop (≥1280px) | 2-column: graph (60%) + findings (40%), fix plan full-width below |
| Tablet (≥1024px) | 2-column: graph (55%) + findings (45%), stacked sections |
| Mobile (<1024px) | Single column: score → graph → findings → fixes. Graph has min-height 400px with pinch-zoom. |

### Accessibility

- All severity colors also use icons/shapes (not color-alone)
- Graph nodes have `aria-label` with full file path + finding count
- Keyboard navigation: Tab through findings, Enter to expand, Escape to close
- Screen reader: Health Score announced as "Health score: B minus, 73 out of 100, confidence 91%"
- Focus indicators: 2px solid accent blue outline on all interactive elements
- Motion: `prefers-reduced-motion` disables count-up animation (instant reveal)

---

## 8. DATA FLOW & STATE MANAGEMENT

### Zustand Store

```typescript
interface AnalysisStore {
  // Core state
  analysisId: string | null;
  status: AnalysisStatus;
  result: AnalysisResult | null;

  // Agent tracking
  agentStatuses: Map<AgentName, AgentStatus>;

  // Graph
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  currentGraphView: GraphViewMode;
  selectedNodeId: string | null;
  highlightedChainId: string | null;

  // Findings
  findings: Finding[];
  findingFilters: { severity?: Severity; agent?: AgentName };
  selectedFindingId: string | null;

  // Fixes
  fixes: Fix[];
  fixSummary: FixSummary | null;

  // Chains
  chains: VulnerabilityChain[];

  // Live feed (during scanning)
  liveFindings: Finding[];

  // Actions
  setAnalysisId: (id: string) => void;
  addGraphNode: (node: GraphNode) => void;
  addGraphEdge: (edge: GraphEdge) => void;
  addLiveFinding: (finding: Finding) => void;
  updateAgentStatus: (agent: AgentName, status: AgentStatus) => void;
  setComplete: (result: AnalysisResult) => void;
  setGraphView: (view: GraphViewMode) => void;
  selectNode: (nodeId: string | null) => void;
  selectFinding: (findingId: string | null) => void;
  highlightChain: (chainId: string | null) => void;
}
```

### Data Loading Strategy

| Data | When Loaded | How |
|------|-------------|-----|
| Analysis status | Continuous during scan | WebSocket + fallback polling |
| Graph nodes/edges | Streaming during scan | WebSocket `graph_node`/`graph_edge` |
| Live findings | Streaming during scan | WebSocket `finding` |
| Full findings list | On analysis complete | `GET /analysis/:id/findings` |
| Vulnerability chains | On analysis complete | `GET /analysis/:id/chains` |
| Fix plan | On analysis complete | `GET /analysis/:id/fixes` |
| Full graph data | On view change | `GET /analysis/:id/graph?view=X` |

---

## 9. WEBSOCKET INTEGRATION

```typescript
// hooks/useAnalysisWebSocket.ts

function useAnalysisWebSocket(analysisId: string) {
  const store = useAnalysisStore();
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const maxRetries = 5;

  useEffect(() => {
    if (!analysisId) return;

    function connect() {
      const ws = new WebSocket(`ws://localhost:3000/ws/analysis/${analysisId}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const msg: WSMessage = JSON.parse(event.data);

        switch (msg.type) {
          case 'status':
            store.updateAgentStatus(msg.agent, {
              name: msg.agent,
              status: msg.status,
              progress: msg.progress,
              message: msg.message,
            });
            break;

          case 'graph_node':
            store.addGraphNode(msg.node);
            break;

          case 'graph_edge':
            store.addGraphEdge(msg.edge);
            break;

          case 'finding':
            store.addLiveFinding(msg.finding);
            break;

          case 'agent_complete':
            store.updateAgentStatus(msg.agent, {
              name: msg.agent,
              status: 'complete',
              progress: 1,
              message: `${msg.findingsCount} findings`,
              findingsCount: msg.findingsCount,
              durationMs: msg.durationMs,
              provider: msg.provider,
            });
            break;

          case 'complete':
            store.setComplete(msg);
            // Trigger full data loads
            fetchFindings(analysisId);
            fetchChains(analysisId);
            fetchFixes(analysisId);
            break;

          case 'error':
            if (!msg.recoverable) {
              store.setFailed(msg.message);
            }
            break;
        }
      };

      ws.onclose = () => {
        if (retriesRef.current < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000);
          retriesRef.current++;
          setTimeout(connect, delay);
        } else {
          // Fall back to polling
          startPolling(analysisId);
        }
      };
    }

    connect();
    return () => wsRef.current?.close();
  }, [analysisId]);
}
```

---

## 10. DEMO-SPECIFIC OPTIMIZATIONS

These are hackathon-specific shortcuts that make the 3-minute demo flawless.

### Pre-Cached Demo Repo

Have one pre-analyzed repo cached in Neo4j. If the demo repo URL is detected, skip the actual scan and replay cached results with artificial timing to simulate the streaming experience. This ensures:
- No network failures during demo
- Consistent, impressive findings
- Predictable timing for the script

```typescript
const DEMO_REPO = 'https://github.com/digitalstudiolabs/demo-vulnerable-app';

if (repoUrl === DEMO_REPO) {
  // Replay cached results with theatrical timing
  await replayDemoResults(analysisId);
}
```

### Demo Timing Script

The cached replay uses this timing (matching the 3-minute demo script):

```
0:00 - URL paste, analyze click
0:03 - Orchestrator complete, detected stack appears
0:05 - Mapper starts, graph nodes begin appearing
0:12 - Mapper complete (Fastino speed toast: "47 files in 142ms")
0:15 - Quality + Pattern + Security agents start in parallel
0:20 - First critical finding appears (red pulse)
0:30 - All agents complete
0:32 - Doctor starts generating fixes
0:37 - Complete! Health Score reveals: B-
0:42 - Dashboard fully rendered
```

### Sponsor Visibility Checklist (for judges)

During the demo, these sponsor touchpoints must be visible:

| Sponsor | Visible Moment | What They See |
|---------|---------------|---------------|
| **Fastino** | 0:05-0:12 | "⚡ Fastino GLiNER-2: 47 files classified in 142ms" toast + provider badge on Mapper |
| **Fastino** | 0:15-0:25 | Provider badges on Quality + Pattern agents showing Fastino classification |
| **OpenAI** | 0:25-0:37 | Provider badge on Security (chain analysis) + Doctor (fix generation) |
| **Neo4j** | 0:05-0:42 | The entire graph panel — it IS Neo4j |
| **Tavily** | 0:15-0:25 | Provider badge on Security agent during CVE search |

### Footer Sponsor Pulse Timing

During the demo, the footer sponsor logos activate in sequence:
```
0:03  Neo4j pulses (graph connection established)
0:05  Fastino pulses (mapper classification begins)
0:12  Fastino stops, Neo4j pulses again (graph writes)
0:15  Tavily pulses (CVE search begins)
0:18  Fastino pulses (CVE entity extraction)
0:20  OpenAI pulses (chain analysis begins)
0:30  OpenAI pulses (Doctor agent)
```

This creates a visual rhythm of sponsor integration that judges can feel.

---

## 11. FRONTEND BUILD PLAN

| Time | Focus | Deliverable |
|------|-------|-------------|
| 0:00-0:20 | **Scaffold** | Next.js app, Tailwind config with design tokens, layout shell, header/footer with sponsor logos |
| 0:20-0:40 | **AnalysisInput** | URL input with validation, POST /analyze call, route to /analysis/[id] |
| 0:40-1:15 | **WebSocket + Progress** | WS connection hook, AnalysisProgress component with agent status rows and provider badges |
| 1:15-2:00 | **GraphPanel** | Cytoscape.js integration, structure view, progressive node building from WS, three view tabs |
| 2:00-2:30 | **HealthScoreHero + Breakdown** | Score reveal animation, letter grade with glow, five category cards with severity colors |
| 2:30-3:15 | **FindingsPanel + FindingDetail** | Severity-grouped list, slide-over detail with dual descriptions, code blocks, chain visualization |
| 3:15-3:45 | **FixPlan** | Priority-ordered list, keystone highlights, documentation expansion, export button |
| 3:45-4:15 | **Vulnerability overlay** | Graph vulnerability view, chain edge animation, blast radius ripple |
| 4:30-5:00 | **Polish** | Demo repo caching, animation timing, sponsor pulse choreography, responsive fixes |
| 5:00-5:15 | **Demo prep** | Run through demo script 2x, verify all sponsor touchpoints visible, record backup video |

---

## 12. FILE STRUCTURE

```
src/
├── app/
│   ├── layout.tsx                       # Root layout with providers
│   ├── page.tsx                         # Empty state → AnalysisInput
│   ├── analysis/
│   │   └── [id]/
│   │       └── page.tsx                 # Analysis dashboard
│   └── globals.css                      # Design tokens, base styles
│
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx                 # Header + main + footer
│   │   ├── Header.tsx                   # Wordmark + repo info
│   │   └── SponsorFooter.tsx            # Sponsor logos with active pulse
│   │
│   ├── input/
│   │   └── AnalysisInput.tsx            # URL input + validate + submit
│   │
│   ├── progress/
│   │   ├── AnalysisProgress.tsx         # Agent list + live graph + live findings
│   │   ├── AgentStatusRow.tsx           # Single agent status with provider badge
│   │   ├── ProviderBadge.tsx            # "⚡ Fastino" / "🧠 OpenAI" badge
│   │   └── FastinoSpeedToast.tsx        # Speed callout toast
│   │
│   ├── score/
│   │   ├── HealthScoreHero.tsx          # THE score. THE moment.
│   │   ├── ScoreCountUp.tsx             # Animated number counter
│   │   ├── LetterGradeReveal.tsx        # Spring-animated grade with glow
│   │   └── ScoreBreakdown.tsx           # Five category cards
│   │
│   ├── graph/
│   │   ├── GraphPanel.tsx               # Container with toolbar + canvas
│   │   ├── GraphCanvas.tsx              # Cytoscape.js wrapper
│   │   ├── GraphToolbar.tsx             # View tabs + search + reset
│   │   ├── VulnerabilityOverlay.tsx     # Chain edge animation logic
│   │   └── BlastRadiusRipple.tsx        # Multi-hop highlight animation
│   │
│   ├── findings/
│   │   ├── FindingsPanel.tsx            # Severity-grouped accordion list
│   │   ├── FindingRow.tsx               # Single finding in list
│   │   ├── FindingDetail.tsx            # Slide-over with full detail
│   │   ├── ChainVisualization.tsx       # Horizontal step flow
│   │   └── CodeBlock.tsx                # Shiki-highlighted code display
│   │
│   ├── fixes/
│   │   ├── FixPlan.tsx                  # Priority list with summary
│   │   ├── FixRow.tsx                   # Single fix with expand
│   │   └── FixDocumentation.tsx         # Full fix doc with before/after
│   │
│
├── hooks/
│   ├── useAnalysisWebSocket.ts          # WS connection + message routing
│   ├── useAnalysisPolling.ts            # Fallback polling
│   └── useAnalysisData.ts              # Data fetching (findings, chains, fixes, graph)
│
├── stores/
│   └── analysisStore.ts                 # Zustand store (full state)
│
├── lib/
│   ├── api.ts                           # REST API client (typed)
│   ├── colors.ts                        # Severity → color mapping
│   ├── grades.ts                        # Score → letter grade mapping
│   └── demo.ts                          # Demo repo detection + cached replay
│
├── types/
│   └── shared.ts                        # ALL shared types from contracts PRD
│
└── styles/
    ├── tokens.css                       # Design system variables
    └── graph.css                        # Cytoscape.js custom styles
```

---

## APPENDIX: DESIGN DECISIONS LOG

| Decision | Chosen | Rejected | Rationale |
|----------|--------|----------|-----------|
| Graph library | Cytoscape.js | Neo4j NVL, D3, Sigma.js | Cytoscape: best layout algorithms (cola, dagre), good perf ≤500 nodes, great API. NVL is Neo4j-specific but heavier. D3 is too low-level for hackathon timeline. |
| State management | Zustand | Redux, Jotai, React Context | Zustand: minimal boilerplate, perfect for WS-driven updates, no provider wrapping. |
| Animation library | Framer Motion | CSS animations, GSAP | Framer Motion: best React integration, spring physics, layout animations. CSS-only insufficient for orchestrated sequences. |
| Dark mode only | Yes | Light mode option | Code is read on dark backgrounds. Clinical aesthetic requires dark. One mode = less code. |
| Score reveal animation | Count-up + spring grade | Instant reveal | Jobs mandate: "should feel like a moment." The 1.8s sequence creates emotional impact. `prefers-reduced-motion` gets instant fallback. |
| Three graph views | Structure, Dependencies, Vulnerabilities | + Function Calls, Category View | Nielsen mandate: three is the max for hackathon cognitive load. Additional views are v2 stretch. |
| Finding dual-description | Both technical + plain | Technical only | van Rossum mandate: every finding readable by juniors. Plain description is the FIRST thing shown. |

---

*"Vibe code fast. VIBE CHECK before you ship."*