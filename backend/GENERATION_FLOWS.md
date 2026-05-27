# Generation Flows — Prompt Sequence Documentation

Every generation request (`POST /api/generate`) routes through one of four mode combinations.
This document shows, for each flow, which LLM calls fire in sequence, which prompt files
drive them, and what the output of each call looks like.

---

## Shared prefix — always runs first

### Call 0 — `plan_and_classify`
**Prompt file:** `services/frame_generation/prompts/planning_classify.md`  
**Model:** `claude-haiku-4-5-20251001` (always Haiku via `_classify_service`, ignores user model selection)  
**Max tokens:** 1 500

**Input:**
```
Template with three substitutions:
  {{MODE_RULES}}            — schema block injected based on (research_mode, video_enabled)
  {{USER_PROMPT}}           — raw user message
  {{CONVERSATION_CONTEXT}}  — prior synthesis + ancestor chain summary (if follow-up)
```

**Output (instant + interactive):**
```json
{
  "domain": "cs",
  "enriched_prompt": "Explain how TCP's 3-way handshake establishes a connection…",
  "suggested_followups": ["What is a SYN flood attack?", "…", "…"],
  "needs_search": false
}
```

**Output (instant + video):** adds `intent_type`, `frame_count`, `notes`
```json
{
  "domain": "cs",
  "intent_type": "process",
  "frame_count": 4,
  "notes": ["SYN → SYN-ACK → ACK", "Ports are half-open until step 3", "…"],
  "enriched_prompt": "Explain how TCP's 3-way handshake…",
  "suggested_followups": ["…", "…", "…"],
  "needs_search": false
}
```

**Output (deep_research + any):** adds `search_queries` and `sub_questions`
```json
{
  ...
  "search_queries": ["TCP handshake latency overhead benchmarks", "…", "…", "…", "…"],
  "sub_questions":  ["How does TFO reduce handshake cost?", "…"]
}
```

> **Note on `needs_search`:** instant mode may set this `true` if the question requires
> live data (e.g. current prices, recent events). When true, the same search pipeline
> that runs for `deep_research` fires, but with a 3-query cap instead of 5.

---

## Flow 1 — Instant + Interactive (most common)

No web search. Two LLM calls total.

```
Call 0  planning_classify.md   (Haiku, ~300 tokens out)
Call 1  entity_selector.md     (user model / Sonnet, ~800 tokens out)
Call 2  base_planner.md        (entity-recommended model, ~4000 tokens out)
        └── optional codegen calls for freeform_html / p5_sketch / slide_deck blocks
```

### Call 1 — `_select_entities`
**Prompt file:** `services/interactive/prompts/entity_selector.md`  
**Model:** `default_llm_service` (user's chosen model, falls back to Claude default)  
**Max tokens:** 800

**Input:**
```
System: entity_selector.md (with {{SLIM_INDEX}} filled with slim_index.md catalog)
User:   "Domain: cs\n\nQuestion: <original user message>"
        (optionally prefixed with "Conversation context: …" for follow-ups)
```

**Output:**
```json
{
  "enriched_prompt": "Explain the 3-way handshake in TCP/IP networking. Cover SYN, SYN-ACK, ACK…",
  "entities": ["mermaid_viewer", "step_controls", "markdown"],
  "model": "claude-sonnet-4-6"
}
```

### Call 2 — `_plan_scene`
**Prompt files:**
- System: `services/interactive/prompts/base_planner.md`
- System (optional domain context): `services/interactive/prompts/domains/{domain}.md` (e.g. `cs.md`, `physics.md`)
- System (entity schemas): `services/interactive/prompts/catalog/{entity_name}.md` for each selected entity
- System (fallback index): `services/interactive/prompts/slim_index.md`

**Model:** entity selector's recommendation, unless the user forced a model in the UI  
**Max tokens:** 8 192 (`SCENE_PLANNER_MAX_TOKENS`)

**Input:**
```
System: base_planner.md + domain/{domain}.md + catalog/*.md for each entity + slim_index.md
User:   "USER QUESTION: <enriched_prompt>"
        (optionally prefixed with "Conversation context: …")
        (optionally includes "## Research Sources\n[1] …" block when sources exist)
```

**Output (SceneIR — Scene Intermediate Representation):**
```json
{
  "title": "TCP 3-Way Handshake",
  "learning_objective": "Understand how TCP establishes a reliable connection before data transfer",
  "follow_ups": ["What happens during TCP teardown?", "…", "…"],
  "domain": "cs",
  "blocks": [
    {
      "id": "b1",
      "type": "text",
      "content": "Before any data flows between two hosts, TCP performs…"
    },
    {
      "id": "b2",
      "type": "entity",
      "entity_type": "mermaid_viewer",
      "props": {
        "definition": "sequenceDiagram\n  Client->>Server: SYN\n  Server->>Client: SYN-ACK\n  Client->>Server: ACK",
        "caption": "Three packets exchange in sequence"
      }
    },
    {
      "id": "b3",
      "type": "entity",
      "entity_type": "step_controls",
      "props": { "steps": ["Step 1: Client sends SYN…", "Step 2: Server replies…", "…"] }
    }
  ]
}
```

### Optional codegen calls (per `freeform_html` / `p5_sketch` / `slide_deck` block)
**Prompt files:**
- `services/interactive/prompts/canvas_codegen.md` — generic HTML widget
- `services/interactive/prompts/canvas_codegen_p5.md` — p5.js animation
- `services/interactive/prompts/canvas_codegen_slides.md` — full presentation HTML

**Model:** same as scene planner (user/entity-recommended)  
**Max tokens:** 6 000 – 8 000

**Input:** `{{ENTITY_SPEC}}` (the `spec` field from the block's props) + `{{USER_PROMPT}}`

**Output:** raw HTML/JavaScript string (no JSON wrapper) — extracted from markdown fences if present, then sandboxed in an `<iframe>`.

---

## Flow 2 — Instant + Video (SVG frames)

No web search (unless `needs_search=true`). Three LLM calls for SVG path; more for Manim/Beat.

```
Call 0  planning_classify.md      (Haiku)
Call 1  planning_svg.md           (user model, intent_type ≠ "math")
     OR planning_math.md          (user model, intent_type = "math", beat pipeline disabled)
Call 2  svg_prompt.md × N frames  (user model, all frames in parallel)
     OR manim_codegen_prompt.md × N frames (user model, Manim path)
```

### Call 1 — `create_vocab_plan`
**Prompt files:**
- `services/frame_generation/prompts/planning_svg.md` — all intents except `math`
- `services/frame_generation/prompts/planning_math.md` — `math` intent only

**Model:** `request_llm_service` (user's chosen model)  
**Max tokens:** 2 500 – 4 000 (calibrated per `intent_type`)  
**Prompt caching:** static template portion is cached — saves ~90% on repeated calls

**Input:**
```
{{USER_PROMPT}}           — enriched_prompt from Call 0
{{CONVERSATION_CONTEXT}}  — ancestor chain context
{{INTENT_TYPE}}           — "process" | "architecture" | "timeline" | "illustration" | …
{{FRAME_COUNT}}           — integer 2–6 from Call 0
```

**Output (VocabularyPlan — JSON):**
```json
{
  "intent_type": "process",
  "frame_count": 4,
  "shared_style": {
    "strokeColor": "#1e1e1e",
    "backgroundColor": "#a5d8ff",
    "strokeWidth": 2
  },
  "element_vocabulary": {
    "client":  { "entity_type": "browser",  "label": "Client",  "fill": "#a5d8ff", "animation_behavior": "enter" },
    "server":  { "entity_type": "server",   "label": "Server",  "fill": "#74c0fc", "animation_behavior": "enter" },
    "packet":  { "entity_type": "document", "label": "SYN",     "fill": "#ffd43b", "animation_behavior": "loop",  "loop_speed": "medium" }
  },
  "frames": [
    {
      "caption": "Client Initiates Connection",
      "teaching_intent": "Show the client sending a SYN packet to the server",
      "entities_used": ["client", "server", "packet"],
      "reveal_order": ["client", "packet", "server"],
      "narration": "The client starts by sending a SYN packet…"
    },
    ...
  ],
  "slide_frames": [],
  "suggested_followups": ["What is a SYN flood attack?", "…", "…"],
  "notes": "SYN → SYN-ACK → ACK establishes the connection"
}
```

### Call 2 — SVG frame generation (`generate_svg_frames`)
**Prompt file:** `services/frame_generation/prompts/svg_prompt.md`  
**Model:** `request_llm_service` (user's chosen model)  
**Parallelism:** all N frames generated concurrently via `asyncio.gather`  
**Prompt caching:** static template prefix cached

**Input:** `{{DIAGRAM_DESCRIPTION}}` filled with the frame's `description` field
(composed of `teaching_intent` + `entities_used` + `narration` + style constraints + element vocabulary)

**Output per frame:** raw SVG string
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
  <rect fill="#a5d8ff" width="1200" height="675"/>
  <rect id="client" x="80" y="200" width="140" height="100" fill="#74c0fc" rx="8" …/>
  <text x="150" y="255" text-anchor="middle" font-size="18">Client</text>
  …
  <animateTransform attributeName="transform" type="translate" …/>
</svg>
```
Post-processed: saved as `.svg`, then converted to PNG via `cairosvg`
(or animated via Playwright → MP4 when `SVG_ANIMATION_ENABLED=true`).

---

## Flow 2b — Instant + Video (Math / Beat pipeline)

Triggered when `intent_type == "math"` and Manim is installed and `BEAT_PIPELINE_ENABLED=true`.
Replaces the SVG flow entirely.

```
Call 0  planning_classify.md      (Haiku)
Call 1  planning_beats.md         (gpt-4.1 — hardcoded in beat_planner.py)
Call 2  manim_codegen_prompt.md   × N beats (user model, up to BEAT_MAX_CONCURRENT_RENDERS=3 parallel)
```

### Call 1 — `plan_beats`
**Prompt file:** `services/frame_generation/prompts/planning_beats.md`  
**Model:** `gpt-4.1` (hardcoded `_planner_service` in `beat_planner.py`)  
**Max tokens:** 9 000

**Input:**
```
{{USER_PROMPT}}           — synthesis_text (if deep_research) or enriched_prompt
{{CONVERSATION_CONTEXT}}  — ancestor chain context
```

**Output (BeatScript — JSON):**
```json
{
  "topic": "TCP 3-Way Handshake",
  "beat_count": 5,
  "notes": ["SYN packet initiates handshake", "Half-open state risk", "…"],
  "suggested_followups": ["What is TFO?", "…", "…"],
  "beats": [
    {
      "title":       "Setting the Stage",
      "description": "Title card — 'TCP 3-Way Handshake' in white on dark background",
      "beat_type":   "structural",
      "narration":   "Before two hosts exchange any data, TCP must establish trust…",
      "keywords":    ["TCP", "connection", "reliable"],
      "duration_s":  3.0
    },
    {
      "title":       "Client Sends SYN",
      "description": "Animated arrow from left box (Client) to right box (Server) labelled SYN, with ISN number appearing",
      "beat_type":   "visualization",
      "narration":   "The client picks a random Initial Sequence Number and sends a SYN…",
      "keywords":    ["SYN", "ISN", "handshake step 1"],
      "duration_s":  5.0
    },
    ...
  ]
}
```

### Call 2 — `manim_codegen_prompt` per beat
**Prompt file:** `services/frame_generation/prompts/manim_codegen_prompt.md`  
**Model:** `request_llm_service` (user's chosen model)  
**Parallelism:** up to `BEAT_MAX_CONCURRENT_RENDERS` (default 3) renders run concurrently  
**Called only for `beat_type == "visualization"` beats; structural beats use template filler**

**Input:** `{{BEAT_DESCRIPTION}}` — the beat's `description` + `narration` + `keywords`

**Output:** Python Manim code
```python
from manim import *

class Scene(Scene):
    def construct(self):
        client = RoundedRectangle(corner_radius=0.2, width=2.5, height=1.5)
        client.set_fill(BLUE, opacity=0.3)
        client.move_to(LEFT * 4)
        label_c = Text("Client", font_size=28).next_to(client, DOWN)

        server = RoundedRectangle(corner_radius=0.2, width=2.5, height=1.5)
        server.set_fill(GREEN, opacity=0.3)
        server.move_to(RIGHT * 4)
        label_s = Text("Server", font_size=28).next_to(server, DOWN)

        self.play(FadeIn(client), FadeIn(label_c), FadeIn(server), FadeIn(label_s))

        arrow = Arrow(client.get_right(), server.get_left(), color=YELLOW)
        syn_label = Text("SYN", font_size=24, color=YELLOW).next_to(arrow, UP)
        self.play(GrowArrow(arrow), Write(syn_label))
        self.wait(1.5)
```
Rendered to MP4 by Manim CLI, then TTS narration is mixed in via OpenAI TTS or gTTS.
All beat MP4s are assembled into `session_final.mp4` via ffmpeg.

---

## Flow 3 — Deep Research + Interactive

Web search fires before the scene planner. Sources are injected into the scene planner as `[N]` citations.

```
Call 0  planning_classify.md      (Haiku)
        — Tavily search (3 queries × 5 results, up to 2 rounds)
Call 1  entity_selector.md        (user model)
Call 2  base_planner.md           (entity-recommended model + sources block injected)
        └── optional codegen calls
```

The `planning_classify` output includes `search_queries` (5 queries) and `sub_questions` (2 fallback queries).

**Tavily search phase** (not an LLM call — external API):
- Up to 5 queries run in parallel (capped by `asyncio.Semaphore(3)`)
- Results ranked and deduplicated; top 5 (`DEEP_SOURCES_IN_ANSWER`) fed to scene planner
- All results embedded in ChromaDB for follow-up retrieval (no re-search needed)
- Round 2 fires only if round 1 returns fewer than 5 results (uses `sub_questions`)

**Calls 1 and 2 are identical to Flow 1**, except Call 2 (scene planner) receives an additional sources block:

```
## Research Sources

Use [N] inline citations in text blocks for factual claims.

[1] **TCP Handshake Explained** (cloudflare.com)
URL: https://www.cloudflare.com/…
The TCP handshake takes 1.5 round trips before the first byte of data can be sent…

[2] **Understanding TCP** (ietf.org)
…
```

The scene planner's text blocks will then include inline citations like `[1]` and `[2]`.

---

## Flow 4 — Deep Research + Video (SVG / Beat)

Adds a synthesis step between search and frame generation.

```
Call 0  planning_classify.md      (Haiku)
        — Tavily search
Call 1  synthesiser (_SYSTEM_PROMPT inline)  (user model, streaming)
Call 2  planning_svg.md / planning_math.md   (user model)
Call 3  svg_prompt.md × N / manim_codegen_prompt.md × N  (user model)
```

### Call 1 — `synthesiser.stream`
**Prompt:** inline `_SYSTEM_PROMPT` string in `services/research/synthesiser.py` (no `.md` file)  
**Model:** `request_llm_service` (user's chosen model); streaming via `AsyncAnthropic` for Claude, fallback to non-streaming for OpenAI  
**Max tokens:** 4 096

**Input:**
```
System: "You are a research synthesiser for an AI educational app…
         Rules: use [N] citations, markdown headers, 300–600 words, end with ## Summary"
User:   "## Question\n<enriched_prompt>\n\n
         ## Evidence\n[1] Title | URL\nSnippet…\n[2] …\n\n
         Write your cited answer now:"
```

**Output:** streamed markdown (tokens emitted as SSE `{type:"token"}` events)
```markdown
## How TCP Establishes a Connection

Before any data can flow, TCP performs a **three-way handshake** to synchronise
sequence numbers and confirm both endpoints are reachable [1].

### Step 1: SYN
The client selects a random **Initial Sequence Number (ISN)** and sends a SYN segment.
This segment consumes one sequence number [2].

### Step 2: SYN-ACK
The server acknowledges with its own ISN and an ACK equal to client ISN+1 [1][3].

### Step 3: ACK
The client confirms receipt. The connection is now **ESTABLISHED** on both sides [2].

## Summary
TCP's three-way handshake costs 1.5 RTTs before data flows. It guarantees sequence
number synchronisation and mutual reachability before any payload is exchanged [1].
```

The `synthesis_text` (full accumulated string) is then passed as the effective message
to `create_vocab_plan` (Call 2), replacing `enriched_prompt` as the planning input.

**Calls 2 and 3 are identical to Flow 2** with `effective_message = synthesis_text`.

---

## Title generation — why it's redundant

The conversation title is currently set from the raw user message truncated to 80 chars
(`message[:CONVERSATION_TITLE_MAX_CHARS]`) in `insert_conversation()` — no extra LLM call.

The **lesson title** (shown as the turn header in the UI) comes from:
- Interactive flows: `scene.title` field in the SceneIR from Call 2 (`base_planner.md`)
- Video flows: not currently surfaced in the turn header (title comes from `planning_classify.md`'s `intent_type` label)

There is no separate title-generation LLM call in the current codebase. If you previously saw one, it has already been removed.

---

## LLM call count summary per flow

| Flow | Calls (no search) | Calls (with search) | Notes |
|---|---|---|---|
| Instant + Interactive | 3 (Haiku + entity_selector + planner) | +0 | +1–3 codegen per freeform/p5/slides block |
| Instant + Video SVG | 3 (Haiku + vocab_plan + N×svg_prompt) | +0 | N=2–6 frames, all parallel |
| Instant + Video Beat | 3+ (Haiku + beat_planner + N×codegen) | +0 | N=4–12 beats, 3 parallel max |
| Deep + Interactive | 3 | +0 (Tavily = no LLM) | Sources injected into planner |
| Deep + Video SVG | 4 (+ synthesiser) | +0 | Synthesis streams to UI then feeds planner |
| Deep + Video Beat | 4 (+ synthesiser) | +0 | Same as above |

---

## SSE event sequence (client-visible)

```
init            → conversation_id (fires first, updates URL)
stage           → "thinking" (plan_and_classify starts)
stage_done      → "thinking"
                          ← (search phase, if triggered)
stage           → "searching"
source          → {title, url, snippet, domain}    (one per result)
stage_done      → "searching"
stage           → "reading"
stage_done      → "reading"
                          ← (synthesis, deep+video only)
token           → streamed markdown text
synthesis_done
stage_done      → "synthesising"
                          ← (interactive branch)
stage           → "designing"
stage           → "widgets"      (entity selector)
stage_done      → "widgets"
stage           → "planning"     (scene planner)
stage_done      → "planning"
meta            → {title, follow_ups, learning_objective}
block           → {id, type, entity_type, props, html?}   (one per block)
stage_done      → "designing"
                          ← (video branch)
stage           → "planning"     (vocab plan)
stage_done      → "planning"
stage           → "generating_frames"
frame           → {index, image, caption}   (SVG path — N frames)
  OR beats_planned → {beat_titles, beat_count}
  OR beat_ready    → {beat_index, mp4_path, caption, …}
stage_done      → "generating_frames"
stage           → "assembling"   (beat path only)
stage_done      → "assembling"
done            → {session_id, conversation_id, turn_index, render_path, …}
```
