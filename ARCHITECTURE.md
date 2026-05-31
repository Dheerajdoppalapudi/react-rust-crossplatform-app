# Zenith — Prompt Flows by Mode

Each section is one execution mode. Within each mode the prompts are shown as a chain — what feeds into each step comes from the step before it.

---

## Quick Reference

| Mode | Trigger | LLM calls | Search |
|------|---------|-----------|--------|
| [Instant + Interactive](#mode-1-instant--interactive) | `research_mode=instant`, `video_enabled=false`, `needs_search=false` | 2–3 | None |
| [Instant + Interactive + Auto-Search](#mode-2-instant--interactive--auto-search) | same + `needs_search=true` from classifier | 2–3 + Tavily | 3 Tavily queries |
| [Deep + Interactive](#mode-3-deep--interactive) | `research_mode=deep_research`, `video_enabled=false` | 3–5 + Tavily | 5–15 Tavily queries, up to 3 rounds |
| [Instant + Video](#mode-4-instant--video) | `research_mode=instant`, `video_enabled=true`, `needs_search=false` | 3–N | None |
| [Instant + Video + Auto-Search](#mode-5-instant--video--auto-search) | same + `needs_search=true` | 3–N + Tavily | 3 Tavily queries |
| [Deep + Video](#mode-6-deep--video) | `research_mode=deep_research`, `video_enabled=true` | 4–N + Tavily | 5–15 Tavily queries, up to 3 rounds |

---
---

## Mode 1: Instant + Interactive

> Pure LLM knowledge — no web search. The model answers from training data alone. Best for timeless concepts: CS theory, math, physics fundamentals, history. The `plan_and_classify` step decides whether search is actually needed; if `needs_search=true` the request is **rerouted to Mode 2** automatically.

**Important:**
- `enriched_prompt` from Step 1 is passed to Step 2, then further enriched and passed to Step 3
- The scene planner (Step 3) uses `claude-haiku-4-5` by default — override via `TASK_MODELS["scene_planner"]`
- Codegen (Step 4) only runs for `freeform_html`, `p5_sketch`, `slide_deck` blocks — not for `mermaid_viewer`, `chart`, etc.
- If `code_walkthrough` is selected, `step_controls` is auto-appended to the entity list

### Prompt chain

```
plan_and_classify  →  _select_entities  →  _plan_scene  →  [codegen?]
```

---

### Step 1 — `plan_and_classify`

**Prompt:** [planning_classify.md](backend/services/frame_generation/prompts/planning_classify.md)
**Model:** `gpt-4.1-mini` (hardcoded — never uses the per-request model)
**Max tokens:** 1500
**Code:** `services/frame_generation/planner.py → plan_and_classify()`

**Input assembled as a single prompt:**
```
[planning_classify.md static instructions]

## Output schema (JSON only)
{
  "domain": "physics|cs|chemistry|biology|math|history|economics|general",
  "enriched_prompt": "<2-4 sentence specific learning spec with mechanisms and numbers>",
  "suggested_followups": ["q1", "q2", "q3"],
  "needs_search": false
}
Set needs_search=true + add "search_queries":["q1","q2","q3"]
when the question requires current stats, recent events, or data the
model cannot reliably produce from training alone.

[optional prior conversation + synthesis context]

USER QUESTION: {raw user message}
```

**Output:**
```json
{
  "domain": "cs",
  "enriched_prompt": "Explain the TLS 1.3 handshake: the 1-RTT exchange where ClientHello proposes cipher suites and sends an ephemeral ECDH public key, ServerHello selects a cipher and returns its own ECDH public key plus a signed X.509 certificate, and both sides independently derive the same shared secret via ECDHE without the private key ever being transmitted. Cover how certificate chain validation proves server identity and how HSTS prevents HTTP fallback.",
  "suggested_followups": [
    "How does certificate pinning protect against a compromised CA?",
    "What changed between TLS 1.2 and TLS 1.3 in handshake round-trips?",
    "How does 0-RTT session resumption work and what are its trade-offs?"
  ],
  "needs_search": false
}
```

**What feeds forward:** `enriched_prompt`, `domain`, `suggested_followups`

---

### Step 2 — `_select_entities`

**Prompt:** [entity_selector.md](backend/services/interactive/prompts/entity_selector.md) (system) + [slim_index.md](backend/services/interactive/prompts/slim_index.md) (appended to system)
**Model:** `gemini-2.5-flash` (default — override via `TASK_MODELS["entity_selector"]`)
**Max tokens:** 800
**Code:** `services/interactive/interactive_service.py → _select_entities()`

**Input — feeds from Step 1:**
```
SYSTEM:
[entity_selector.md: 3-step instructions — enrich prompt, pick entities, recommend model]
[slim_index.md: one-line description of all 20 entity types]

USER:
Domain: cs                                     ← from Step 1
Question: [enriched_prompt from Step 1]
```

**Output:**
```json
{
  "enriched_prompt": "Explain the TLS 1.3 handshake in HTTPS: the 1-RTT negotiation covering ClientHello cipher proposal with ephemeral ECDH key, ServerHello cipher selection with its own ECDH key plus X.509 certificate, independent ECDHE shared-secret derivation on both sides, HKDF key expansion, and AES-256-GCM payload encryption. Visualise the message sequence and the key derivation steps.",
  "entities": ["mermaid_viewer", "code_walkthrough", "step_controls"],
  "model": "claude-sonnet-4-6"
}
```

**What feeds forward:** re-enriched `enriched_prompt`, `entities` list (for catalog loading), `model` (for codegen)

---

### Step 3 — `_plan_scene`

**Prompts (system, concatenated):**
- [base_planner.md](backend/services/interactive/prompts/base_planner.md) — teaching rules, output schema, citation rules
- `domains/{domain}.md` — e.g. [domains/cs.md](backend/services/interactive/prompts/domains/cs.md) — domain-specific guidance (if file exists)
- `catalog/{entity}.md` — full prop schema for each selected entity, e.g. [catalog/mermaid_viewer.md](backend/services/interactive/prompts/catalog/mermaid_viewer.md)
- [slim_index.md](backend/services/interactive/prompts/slim_index.md) — fallback one-liners for all other entity types

**Model:** `claude-haiku-4-5` (default — override via `TASK_MODELS["scene_planner"]`)
**Max tokens:** 8192
**Code:** `services/interactive/interactive_service.py → _plan_scene()`

**Input — feeds from Step 2:**
```
SYSTEM:
[base_planner.md]
[domains/cs.md]
[catalog/mermaid_viewer.md — full JSON schema for this entity's props]
[catalog/code_walkthrough.md — full schema]
[catalog/step_controls.md — full schema]
[slim_index.md]

USER:
USER QUESTION: [enriched_prompt from Step 2]
```

**Output — Scene IR (full lesson layout):**
```json
{
  "title": "How TLS 1.3 Secures Your HTTPS Connection",
  "domain": "cs",
  "learning_objective": "By the end of this, you will understand how a browser and server establish a shared secret key in one round trip and why no eavesdropper can intercept it.",
  "follow_ups": ["How does certificate pinning work?", "..."],
  "blocks": [
    {
      "id": "b1",
      "type": "text",
      "content": "Every time you open a banking site, your browser and the server perform a TLS handshake — agreeing on encryption keys in ~50ms without transmitting the key itself..."
    },
    {
      "id": "b2",
      "type": "entity",
      "entity_type": "mermaid_viewer",
      "props": {
        "diagram": "sequenceDiagram\n  Browser->>Server: ClientHello (cipher suites, ECDH pub key)\n  Server->>Browser: ServerHello (chosen cipher, ECDH pub key, Certificate)\n  Browser->>Server: Finished (encrypted)\n  Browser->>Server: GET / (AES-256-GCM encrypted)"
      }
    },
    {
      "id": "b3",
      "type": "text",
      "content": "TLS 1.3 needs only 1 round-trip. Both sides compute the same shared secret from ECDHE — neither private key is ever transmitted."
    },
    {
      "id": "b4",
      "type": "entity",
      "entity_type": "code_walkthrough",
      "props": {
        "language": "text",
        "code": "1. ClientHello  → proposes ciphers, sends ECDH public key\n2. ServerHello  → picks cipher, sends ECDH key + certificate\n3. Both compute  → shared_secret = ECDHE(my_priv, their_pub)\n4. Derive keys  → HKDF(shared_secret) → session_key\n5. All payload  → AES-256-GCM encrypted",
        "steps": [
          {"line": 1, "explanation": "Browser lists supported ciphers and its ephemeral EC public key in one message — saving a round trip vs TLS 1.2"},
          {"line": 2, "explanation": "Server picks the strongest shared cipher and proves identity via certificate signed by a trusted CA"},
          {"line": 3, "explanation": "ECDHE magic: each side multiplies (own private × other's public) and lands on the same elliptic curve point. The secret was never transmitted."},
          {"line": 4, "explanation": "HKDF stretches the shared secret into separate encryption and MAC keys for this session"},
          {"line": 5, "explanation": "Every byte — URLs, cookies, response bodies — is now encrypted"}
        ]
      }
    },
    {
      "id": "b5",
      "type": "entity",
      "entity_type": "step_controls",
      "props": {
        "steps": ["ClientHello", "ServerHello + Cert", "Key Derivation", "Encrypted Channel"],
        "targetEntityId": "b4"
      }
    },
    {
      "id": "b6",
      "type": "text",
      "content": "The certificate answers 'how do I know it's really Google?' — your browser ships with ~150 trusted CA keys. Google's cert is signed by one of them. HSTS then forces all future connections to HTTPS, closing the downgrade attack window."
    }
  ]
}
```

---

### Step 4 — Codegen *(only for `freeform_html`, `p5_sketch`, `slide_deck` blocks)*

Three variants, all same pattern — one call per block that needs code:

| Entity type | Prompt file | Max tokens |
|---|---|---|
| `freeform_html` | [canvas_codegen.md](backend/services/interactive/prompts/canvas_codegen.md) | 6000 |
| `p5_sketch` | [canvas_codegen_p5.md](backend/services/interactive/prompts/canvas_codegen_p5.md) | 6000 |
| `slide_deck` | [canvas_codegen_slides.md](backend/services/interactive/prompts/canvas_codegen_slides.md) | 8000 |

**Model:** `gemini-2.5-flash` (default — override via `TASK_MODELS["codegen"]`)
**Code:** `services/interactive/interactive_service.py → _run_codegen() / _run_p5_codegen() / _run_slide_codegen()`

**Input — feeds from Step 3 block props + Step 2 enriched_prompt:**
```
[prompt_template]
{{ENTITY_SPEC}}   ← block.props["spec"] written by scene planner in Step 3
{{USER_PROMPT}}   ← enriched_prompt from Step 2
```

**Output:** Raw HTML string → wrapped in sandboxed `<iframe srcdoc="...">` → stored on `block.html`

```html
<!-- Example for freeform_html block with spec: "Canvas animation of ECDHE key exchange" -->
<!DOCTYPE html><html><head>
<style>body{margin:0;background:#0f0f23} canvas{display:block;margin:auto}</style>
</head><body>
<canvas id="c" width="600" height="360"></canvas>
<script>
  const ctx = document.getElementById('c').getContext('2d');
  let t = 0;
  function draw() {
    ctx.clearRect(0,0,600,360);
    // draw Browser node, Server node, animated key exchange arrows
    // highlight shared secret in green when exchange complete
    t++;
    requestAnimationFrame(draw);
  }
  draw();
</script></body></html>
```

---
---

## Mode 2: Instant + Interactive + Auto-Search

> Same as Mode 1, but `plan_and_classify` returned `needs_search=true` — the question needs current data (recent events, live statistics, specific facts). A light Tavily search (3 queries) runs before entity selection. The sources are injected into `_plan_scene` for `[N]` inline citations.

**Important:**
- The decision to search is made by Step 1 (`needs_search: true`). The user does not control this directly.
- Search uses 3 Tavily queries in parallel (capped at `INSTANT_MAX_QUERIES=3`)
- Before hitting Tavily, the system checks ChromaDB for cached sources from earlier turns in the same conversation — if ≥3 cached sources exist the Tavily call is skipped entirely
- Sources are passed to `_plan_scene` via `_build_sources_block()` using `snippet` (Tavily's query-relevant extract, up to 2500 chars per source)

### Prompt chain

```
plan_and_classify  →  [Tavily × 3]  →  _select_entities  →  _plan_scene (+ sources)  →  [codegen?]
```

---

### Step 1 — `plan_and_classify`

**Prompt:** [planning_classify.md](backend/services/frame_generation/prompts/planning_classify.md)
**Model:** `gpt-4.1-mini`
**Max tokens:** 1500

Same as Mode 1 but the output includes `needs_search: true` and `search_queries`.

**Output (different from Mode 1):**
```json
{
  "domain": "physics",
  "enriched_prompt": "Summarise nuclear fusion energy milestones in 2024: the NIF Q>1 ignition result (3.15 MJ output / 2.05 MJ input), Commonwealth Fusion SPARC timeline, and private investment figures. Explain the Lawson criterion and what threshold must be crossed for a commercial power plant.",
  "suggested_followups": [
    "What is the Lawson criterion and why has it been so hard to exceed?",
    "How does inertial confinement (NIF) differ from magnetic confinement (ITER)?",
    "What is SPARC's realistic timeline for net electricity output?"
  ],
  "needs_search": true,
  "search_queries": [
    "NIF laser fusion ignition Q>1 energy output 2023 2024",
    "Commonwealth Fusion SPARC superconducting magnet first plasma 2025",
    "nuclear fusion private investment 2024 commercial power plant timeline"
  ]
}
```

**What feeds forward:** `search_queries` → Tavily, `enriched_prompt` + `domain` → Steps 3 & 4

---

### [Tavily Search — not an LLM call]

3 queries run in parallel (semaphore-capped). Each returns up to 5 results. Deduplicated by URL, ranked by Tavily score + domain authority boost. Top 5 by score feed into Step 3.

**Source object format going into Step 3:**
```json
{
  "title": "NIF Achieves Fusion Ignition",
  "url": "https://nature.com/articles/...",
  "snippet": "The National Ignition Facility produced 3.15 megajoules of energy from a 2.05 MJ laser input in December 2022, marking the first time a fusion experiment produced more energy than delivered to the target...",
  "domain": "nature.com",
  "score": 0.91
}
```

---

### Steps 2, 3, 4 — same as Mode 1

**Step 2 (`_select_entities`)** — identical input/output as Mode 1.

**Step 3 (`_plan_scene`)** — same but user message now includes a `## Research Sources` block:

```
USER:
## Research Sources
Use [N] inline citations in text blocks for factual claims.

[1] **NIF Achieves Fusion Ignition** (nature.com)
URL: https://nature.com/...
The National Ignition Facility produced 3.15 MJ from a 2.05 MJ laser input...
[up to 2500 chars of Tavily snippet per source]

[2] **SPARC Magnet Milestone** (sciencemag.org)
...

USER QUESTION: [enriched_prompt from Step 2]
```

The scene planner will now write `text` blocks with inline `[1]`, `[2]` citations.

---
---

## Mode 3: Deep + Interactive

> Full iterative research. Up to 3 Tavily search rounds with LLM gap-analysis between each round. The gap analyser looks at what was already found and generates new targeted queries for angles not yet covered. Stops early if gap analysis returns no new queries.

**Important:**
- Round 1 always runs with `search_queries` from Step 1 (up to 5 queries)
- After Round 1, `_gap_analysis` (Step 2) decides whether another round is needed — returns `{"new_queries": []}` to stop early
- Maximum 3 rounds total (`_DEEP_MAX_ROUNDS = 3` hardcoded in `generate.py`)
- `DEEP_SEARCH_ROUNDS=2` in `config.py` is **currently unused** — the code uses the hardcoded constant
- All found sources are upserted to ChromaDB for follow-up retrieval; only top 5 go to the LLM

### Prompt chain

```
plan_and_classify
    → [Tavily round 1: up to 5 queries]
    → _gap_analysis  (decides: more queries needed?)
    → [Tavily round 2: 0-3 new queries]
    → _gap_analysis  (again if round 2 ran)
    → [Tavily round 3: 0-3 new queries — then stop]
    → _select_entities
    → _plan_scene (+ all found sources)
    → [codegen?]
```

---

### Step 1 — `plan_and_classify`

**Prompt:** [planning_classify.md](backend/services/frame_generation/prompts/planning_classify.md)
**Model:** `gpt-4.1-mini`
**Max tokens:** 1500

The `deep_research + interactive` output schema always includes `search_queries` (no `needs_search` toggle).

**Output:**
```json
{
  "domain": "economics",
  "enriched_prompt": "Explain how the 2008 financial crisis unfolded: the role of mortgage-backed securities (MBS), CDO tranching, AAA ratings on subprime debt, the interbank lending freeze when Lehman collapsed, and the Fed's TARP and QE1 interventions. Include key numbers: Lehman's $600B bankruptcy, TARP's $700B, peak S&P 500 drawdown of ~57%.",
  "suggested_followups": [
    "How did AIG's CDS exposure threaten the entire financial system?",
    "Why did rating agencies give AAA ratings to subprime CDOs?",
    "What is quantitative easing and how did QE1 differ from normal monetary policy?"
  ],
  "search_queries": [
    "mortgage-backed securities CDO subprime tranching AAA rating failure 2008",
    "Lehman Brothers bankruptcy September 2008 interbank lending freeze LIBOR spike",
    "TARP bailout $700 billion troubled asset relief program effectiveness",
    "Federal Reserve quantitative easing QE1 balance sheet expansion 2008 2009",
    "2008 financial crisis global contagion European banks dollar funding"
  ]
}
```

**What feeds forward:** `search_queries` (round 1) → Tavily, `enriched_prompt` + `domain` → Steps 3–5

---

### Step 2 — `_gap_analysis` *(runs after each Tavily round)*

**Prompt:** Inline system prompt (no file — defined in `generate.py`)
**Model:** `claude-haiku-4-5`
**Max tokens:** 300
**Code:** `routers/generate.py → _gap_analysis()`

**Input — built from Tavily results after each round:**
```
SYSTEM:
You are a research gap analyzer. Identify missing angles and generate new targeted
search queries. Write queries like a domain expert. Do NOT repeat prior queries.
Return ONLY JSON. Max 3 new queries; return {"new_queries": []} if coverage is sufficient.

USER:
## User question
{original user message}

## Queries already run
- mortgage-backed securities CDO subprime tranching AAA rating failure 2008
- Lehman Brothers bankruptcy September 2008 interbank lending freeze
- TARP bailout $700 billion troubled asset relief program
- Federal Reserve QE1 balance sheet expansion 2008 2009
- 2008 financial crisis global contagion European banks dollar funding

## Summary of results found so far
[1] Investopedia - CDOs explained: ...MBS pooled into tranches, senior tranche rated AAA...
[2] NYT - Lehman collapse: ...overnight repo market froze, LIBOR-OIS spread hit 364bp...
[3] Treasury.gov - TARP overview: ...October 2008, $250B capital injection into banks...
[4] Fed Reserve - QE1: ...November 2008, $600B MBS purchases announced...
[5] FT - European contagion: ...Irish banks exposed, UK Northern Rock bank run...

Identify gaps. Return JSON.
```

**Output — gap found, generates new queries:**
```json
{
  "new_queries": [
    "AIG credit default swap CDS exposure Federal Reserve bailout $182 billion 2008",
    "SEC mark-to-market accounting rule suspension FAS 157 bank balance sheet 2008"
  ]
}
```

**Output — coverage sufficient, stops loop:**
```json
{
  "new_queries": []
}
```

**What feeds forward:** `new_queries` → next Tavily round (or stops loop if empty)

---

### Steps 3, 4, 5 — same as Mode 2

`_select_entities` → `_plan_scene` (with all found sources injected as `[N]` citations) → codegen if needed.

---
---

## Mode 4: Instant + Video

> Generates an animated educational video from LLM knowledge alone — no web search. The intent type (`math`, `process`, `architecture`, etc.) decides which rendering pipeline runs. Math uses the Beat pipeline (Manim Python animations). All other intent types use the SVG pipeline (per-frame SVG → PNG → MP4).

**Important:**
- `intent_type = "math"` → **Beat pipeline**: `planning_beats.md` + per-beat `manim_codegen_prompt.md` → Manim `.mp4` clips → ffmpeg assembly
- All other `intent_type` values → **SVG pipeline**: `planning_svg.md` → `svg_prompt.md` per frame → Playwright PNG → ffmpeg assembly
- `_vocab_plan_to_generation_plan()` between Steps 2 and 3 is **pure Python** (no LLM) — converts the vocabulary plan into per-frame `FramePlan` objects
- TTS narration (`BEAT_TTS_BACKEND=openai` default) runs after frame generation, one MP3 per frame/beat, then mixed in by ffmpeg

### Prompt chain — Math intent (Beat pipeline)

```
plan_and_classify
    → create_vocab_plan [planning_math.md]
    → beat_planner [planning_beats.md]
    → beat_codegen [manim_codegen_prompt.md]  (× N beats, parallel)
    → [TTS per beat → ffmpeg assembly]
```

### Prompt chain — Non-math intent (SVG pipeline)

```
plan_and_classify
    → create_vocab_plan [planning_svg.md]
    → svg_frame_codegen [svg_prompt.md]  (× N frames, sequential)
    → [TTS per frame → ffmpeg assembly]
```

---

### Step 1 — `plan_and_classify`

**Prompt:** [planning_classify.md](backend/services/frame_generation/prompts/planning_classify.md)
**Model:** `gpt-4.1-mini`
**Max tokens:** 1500

The `instant + video` schema adds `intent_type`, `frame_count`, and `notes` to the output.

**Output:**
```json
{
  "domain": "cs",
  "intent_type": "math",
  "frame_count": 3,
  "notes": [
    "Compare adjacent elements and swap if out of order",
    "Each full pass moves the largest unsorted element to its final position",
    "O(n²) worst/average, O(n) best case with early-exit optimisation",
    "In-place and stable",
    "Visualise on array [5, 3, 8, 1, 4]"
  ],
  "enriched_prompt": "Animate bubble sort on [5, 3, 8, 1, 4]: show adjacent comparisons with swap arrows, the 'bubble up' of the largest element each pass, sorted boundary advancing, and label O(n²) vs O(n) best case.",
  "suggested_followups": [
    "How does insertion sort compare to bubble sort in practice?",
    "Why is O(n²) so much slower than O(n log n) for large n?",
    "When would you ever choose bubble sort over quicksort?"
  ],
  "needs_search": false
}
```

**What feeds forward:** `intent_type`, `frame_count`, `enriched_prompt`, `notes` → Step 2

---

### Step 2a — `create_vocab_plan` *(Math path)*

**Prompt:** [planning_math.md](backend/services/frame_generation/prompts/planning_math.md)
**Model:** `gemini-2.5-flash` (override via `TASK_MODELS["vocab_plan"]`)
**Max tokens:** 4000
**Code:** `services/frame_generation/planner.py → create_vocab_plan()`

**Input — feeds from Step 1:**
```
[planning_math.md template]
{{INTENT_TYPE}}  → "math"
{{FRAME_COUNT}}  → "3"
{{USER_PROMPT}}  → enriched_prompt from Step 1
```

**Output — VocabularyPlan (math variant with visual_objects and continuity_plan):**
```json
{
  "intent_type": "math",
  "frame_count": 3,
  "visual_strategy": "array_sweep",
  "shared_style": {
    "strokeColor": "#1e1e1e",
    "backgroundColor": "#f8f9fa",
    "strokeWidth": 2,
    "palette": { "primary": "#339af0", "secondary": "#f03e3e", "accent": "#f59f00" }
  },
  "visual_objects": [
    { "id": "arr", "type": "array", "values": [5,3,8,1,4], "persists_frames": [0,1,2] },
    { "id": "ptr_i", "type": "pointer", "label": "i", "persists_frames": [0,1,2] },
    { "id": "ptr_j", "type": "pointer", "label": "j", "persists_frames": [0,1,2] }
  ],
  "continuity_plan": {
    "persistent_objects": ["arr", "ptr_i", "ptr_j"],
    "transition_strategy": "update_in_place"
  },
  "frames": [
    {
      "index": 0,
      "teaching_intent": "Show pass 1: compare adjacent pairs, swap 5↔3, skip 3<8, swap 8↔1, swap 8↔4 — 8 bubbles to end",
      "caption": "Pass 1: 8 Bubbles Up",
      "narration": "In pass 1 we compare every adjacent pair and swap if left > right. The largest element 8 gets swapped rightward on every comparison it wins — it 'bubbles' all the way to its final position at index 4."
    },
    {
      "index": 1,
      "teaching_intent": "Show pass 2: 5 bubbles to position 3, sorted boundary advances",
      "caption": "Pass 2: 5 Bubbles Up",
      "narration": "Pass 2 ignores the already-sorted index 4. Now 5 is the largest unsorted element — it bubbles up to index 3. Each pass needs one fewer comparison than the last."
    },
    {
      "index": 2,
      "teaching_intent": "Show final sorted state, label O(n²) comparisons, contrast O(n) early-exit best case",
      "caption": "Sorted — O(n²) Cost",
      "narration": "After n-1 passes the array is sorted. We made n×(n-1)/2 comparisons — O(n²). But if the array were already sorted, a flag can detect zero swaps in pass 1 and exit — O(n) best case."
    }
  ]
}
```

**What feeds forward:** Full VocabularyPlan → Step 3 (beat planner)

---

### Step 3 — Beat Planner *(Math path only)*

**Prompt:** [planning_beats.md](backend/services/frame_generation/prompts/planning_beats.md)
**Model:** `claude-sonnet-4-6` (override via `BEAT_PLANNER_MODEL` or `TASK_MODELS["beat_planner"]`)
**Code:** `services/frame_generation/manim/` → `beat_planner.plan_beats()`

**Input — feeds from Step 2:**
```
[planning_beats.md template]
VocabularyPlan injected: visual_strategy, frames, visual_objects, continuity_plan, palette
```

**Output — Beat Script (list of atomic animation beats):**
```json
{
  "beats": [
    {
      "beat_id": "b0_intro_array",
      "frame_index": 0,
      "title": "Initial Array",
      "type": "create_array",
      "values": [5, 3, 8, 1, 4],
      "duration_s": 1.5,
      "narration": "Here is our unsorted array: 5, 3, 8, 1, 4.",
      "caption": "Unsorted Array",
      "keywords": ["array", "bubble sort"]
    },
    {
      "beat_id": "b1_compare_01",
      "frame_index": 0,
      "title": "Compare 5 and 3",
      "type": "compare_swap",
      "indices": [0, 1],
      "swap": true,
      "duration_s": 1.2,
      "narration": "Compare 5 and 3. Since 5 > 3, we swap them.",
      "caption": "Swap 5 ↔ 3"
    },
    {
      "beat_id": "b2_compare_12",
      "frame_index": 0,
      "title": "Compare 5 and 8",
      "type": "compare_swap",
      "indices": [1, 2],
      "swap": false,
      "duration_s": 1.0,
      "narration": "Compare 5 and 8. 5 < 8, no swap needed.",
      "caption": "No Swap"
    }
  ]
}
```

**What feeds forward:** Each beat spec → Step 4 (one codegen call per beat)

---

### Step 4 — Beat Codegen *(one call per beat)*

**Prompt:** [manim_codegen_prompt.md](backend/services/frame_generation/prompts/manim_codegen_prompt.md)
**Model:** `gemini-2.5-flash` (override via `TASK_MODELS["beat_codegen"]`)
**Code:** `services/frame_generation/manim/` → `BeatGenerator.generate_beats()`

**Input — one beat spec from Step 3:**
```
[manim_codegen_prompt.md template]
Beat spec: { beat_id, type, values/indices, swap, duration_s, palette }
```

**Output — Manim Python class (one per beat, rendered to `.mp4`):**
```python
from manim import *

class Beat_b1_compare_01(Scene):
    def construct(self):
        # Array boxes
        boxes = VGroup(*[
            Square(side_length=1).set_fill(BLUE_D, opacity=0.9)
            for _ in range(5)
        ]).arrange(RIGHT, buff=0.2).move_to(ORIGIN)
        labels = VGroup(*[
            Text(str(v), font_size=36).move_to(boxes[i])
            for i, v in enumerate([3, 5, 8, 1, 4])
        ])

        # Highlight the two elements being compared
        boxes[0].set_fill("#f59f00", opacity=1)
        boxes[1].set_fill("#f59f00", opacity=1)

        self.add(boxes, labels)

        # Swap animation
        self.play(
            labels[0].animate.move_to(boxes[1]),
            labels[1].animate.move_to(boxes[0]),
            run_time=1.2,
        )
        self.wait(0.2)
```

Rendered: `manim render Beat_b1_compare_01 --quality m -o beat_b1.mp4`

---

### Step 2b — `create_vocab_plan` *(Non-math / SVG path)*

**Prompt:** [planning_svg.md](backend/services/frame_generation/prompts/planning_svg.md)
**Model:** `gemini-2.5-flash`
**Max tokens:** 3500
**Code:** `services/frame_generation/planner.py → create_vocab_plan()`

**Input — feeds from Step 1:**
```
[planning_svg.md template]
{{INTENT_TYPE}}  → "architecture"
{{FRAME_COUNT}}  → "4"
{{USER_PROMPT}}  → enriched_prompt from Step 1
```

**Output — VocabularyPlan (SVG variant):**
```json
{
  "intent_type": "architecture",
  "frame_count": 4,
  "shared_style": {
    "strokeColor": "#1e1e1e",
    "backgroundColor": "#e7f5ff",
    "strokeWidth": 2
  },
  "element_vocabulary": {
    "browser": {
      "entity_type": "browser",
      "label": "Browser",
      "fill": "#74c0fc",
      "animation_behavior": "enter"
    },
    "cdn": {
      "entity_type": "cloud",
      "label": "CDN Edge",
      "fill": "#b2f2bb",
      "animation_behavior": "enter"
    },
    "origin": {
      "entity_type": "server",
      "label": "Origin Server",
      "fill": "#ff8787",
      "animation_behavior": "enter"
    }
  },
  "frames": [
    {
      "index": 0,
      "teaching_intent": "Browser initiates DNS lookup to resolve domain to IP",
      "entities_used": ["browser"],
      "reveal_order": ["browser"],
      "caption": "DNS Lookup",
      "narration": "When you type google.com, your browser needs an IP address. It asks a DNS resolver which returns 142.250.80.46 — typically in 1-50ms before any HTTP request is sent."
    }
  ]
}
```

**What feeds forward:** VocabularyPlan → `_vocab_plan_to_generation_plan()` (pure Python, builds FramePlans with pixel coords) → Step 3 SVG codegen

---

### Step 3 — SVG Frame Codegen *(one call per frame)*

**Prompt:** [svg_prompt.md](backend/services/frame_generation/prompts/svg_prompt.md)
**Model:** `gemini-2.5-flash` (override via `TASK_MODELS["svg_frame"]`)
**Code:** `services/frame_generation/svg/svg_generator.py → generate_svg_frames()`

**Input — one FramePlan from the converted VocabularyPlan:**
```
[svg_prompt.md template]
Frame: index=2, caption="CDN Cache Hit"
Teaching intent: HTTP GET arrives at CDN; cache hit — response returns without reaching origin

Draw list (with pixel coordinates from _vocab_plan_to_generation_plan):
  browser: entity_type=browser, fill=#74c0fc, label="Browser", position=(150,200), animate=enter
  cdn:     entity_type=cloud,   fill=#b2f2bb, label="CDN Edge", position=(1400,200), animate=enter
  arrow browser→cdn: label="GET /index.html"
  arrow cdn→browser: label="200 OK (cached)", color=#2f9e44
  badge on cdn: "CACHE HIT ✓"

Shared style: strokeColor=#1e1e1e, backgroundColor=#e7f5ff, strokeWidth=2
```

**Output — SVG markup for that frame:**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="#e7f5ff"/>

  <g style="animation: fadeIn 0.5s ease forwards 0s">
    <rect x="80" y="150" width="140" height="100" rx="12"
          fill="#74c0fc" stroke="#1e1e1e" stroke-width="2"/>
    <text x="150" y="205" text-anchor="middle" font-size="18">Browser</text>
  </g>

  <g style="animation: fadeIn 0.5s ease forwards 0.3s">
    <ellipse cx="1430" cy="190" rx="90" ry="55"
             fill="#b2f2bb" stroke="#1e1e1e" stroke-width="2"/>
    <text x="1430" y="197" text-anchor="middle" font-size="18">CDN Edge</text>
  </g>

  <g style="animation: fadeIn 0.4s ease forwards 0.6s; opacity:0">
    <line x1="220" y1="182" x2="1340" y2="182"
          stroke="#1e1e1e" stroke-width="2" marker-end="url(#arrowhead)"/>
    <text x="780" y="168" text-anchor="middle" font-size="16">GET /index.html</text>
  </g>

  <g style="animation: fadeIn 0.4s ease forwards 1.0s; opacity:0">
    <line x1="1340" y1="208" x2="220" y2="208"
          stroke="#2f9e44" stroke-width="2.5" marker-end="url(#arrowhead-green)"/>
    <text x="780" y="234" text-anchor="middle" font-size="16" fill="#2f9e44">200 OK (cached)</text>
  </g>

  <text x="960" y="1055" text-anchor="middle" font-size="30" font-weight="bold">CDN Cache Hit</text>
  <!-- ... defs for arrowheads, keyframes ... -->
</svg>
```

Rendered to 1920×1080 PNG via **Playwright** (headless Chromium), then assembled with per-frame MP3 TTS audio via **ffmpeg** into the final MP4.

---
---

## Mode 5: Instant + Video + Auto-Search

> Same as Mode 4 but a light Tavily search (3 queries) runs first. The raw sources are synthesised into a clean text answer before being passed to the video pipeline. The video is built from the synthesis text, not the original question.

**Important:**
- `synthesiser.stream` runs **only in video mode with sources** — it does not run in interactive mode
- The synthesis output (`synthesis_text`) replaces the original message as input to `create_vocab_plan`
- Synthesis tokens stream live to the client as `{type:"token", text:"..."}` SSE events while the user waits
- `synthesis_text` is also saved to the session DB and used as prior context in follow-up turns

### Prompt chain

```
plan_and_classify
    → [Tavily × 3]
    → synthesiser.stream  [inline prompt]
    → create_vocab_plan   [planning_svg.md or planning_math.md]
    → beat_codegen / svg_frame_codegen  (× N)
    → [TTS → ffmpeg]
```

---

### Step 1 — `plan_and_classify`

Same as Mode 4 but `needs_search=true` with `search_queries`. *(See Mode 2 Step 1 for the output shape.)*

---

### [Tavily Search — not an LLM call]

3 queries run in parallel. Top 5 sources by score → Step 2.

---

### Step 2 — `synthesiser.stream`

**Prompt:** Inline system prompt (no file)
**Model:** `claude-haiku-4-5` (override via `TASK_MODELS["synthesiser"]`)
**Max tokens:** 4096
**Streaming:** Yes — tokens emitted as `{type:"token", text:"..."}` SSE events
**Code:** `services/research/synthesiser.py → stream()`

**Input — feeds from Tavily results:**
```
SYSTEM:
You are a research synthesiser. Write a comprehensive, well-structured answer.
Rules: inline [N] citations, 300-600 words, end with ## Summary, no invented facts.

USER:
## Question
{original user message}

## Evidence

[1] **Source Title** (domain.com)
URL: https://...
Excerpt: {snippet, up to 300 tokens — from source_processor.build_evidence_table()}

[2] ... [3] ... [4] ... [5] ...

Write your cited answer now:
```

**Output — streaming markdown (accumulated as `synthesis_text`):**
```markdown
## Nuclear Fusion: 2024 State of Play

The field crossed a threshold in December 2022 when NIF achieved **fusion ignition**
— 3.15 MJ output from 2.05 MJ input, the first Q > 1 result [1].

### Private Sector
Commonwealth Fusion Systems demonstrated a **20-tesla REBCO superconducting magnet** [2],
the key component for SPARC (targeting first plasma 2025). Private investment exceeded
**$6 billion in 2023** [3].

## Summary
Fusion reached scientific proof-of-concept. The open question is whether any project can
demonstrate sustained net electricity within the decade.
```

**What feeds forward:** `synthesis_text` → replaces original message in Step 3 (`create_vocab_plan`)

---

### Steps 3+ — same as Mode 4

`create_vocab_plan` receives `synthesis_text` instead of the raw user question. Everything else is identical.

---
---

## Mode 6: Deep + Video

> The most complete pipeline. Iterative research (up to 3 Tavily rounds with LLM gap-analysis) → streaming synthesis → animated video. Same as Mode 5 but with the full deep research loop from Mode 3 before synthesis.

**Important:**
- This is the most expensive mode: up to 8+ LLM calls + 5–15 Tavily queries + N frame codegen calls
- The synthesis step (Step 3) receives all found sources, not just the round-1 results
- Everything downstream of synthesis is identical to Mode 5

### Prompt chain

```
plan_and_classify
    → [Tavily round 1: up to 5 queries]
    → _gap_analysis          (round 1 → 2 decision)
    → [Tavily round 2: 0-3 new queries]
    → _gap_analysis          (round 2 → 3 decision)
    → [Tavily round 3: 0-3 new queries]
    → synthesiser.stream     [inline prompt]
    → create_vocab_plan      [planning_svg.md or planning_math.md]
    → beat_codegen / svg_frame_codegen  (× N)
    → [TTS → ffmpeg]
```

---

### Step 1 — `plan_and_classify`

**Prompt:** [planning_classify.md](backend/services/frame_generation/prompts/planning_classify.md)
**Model:** `gpt-4.1-mini`

The `deep_research + video` schema — same video fields as Mode 4 + always includes `search_queries`.

**Output:**
```json
{
  "domain": "physics",
  "intent_type": "process",
  "frame_count": 4,
  "notes": [
    "NIF Q>1 ignition: 3.15 MJ out / 2.05 MJ in, Dec 2022",
    "Commonwealth Fusion SPARC: 20T REBCO magnets, targeting 2025 first plasma",
    "ITER delayed to 2034",
    "Private investment > $6B in 2023",
    "Lawson criterion: n·T·τ > 10²¹ keV·s/m³"
  ],
  "enriched_prompt": "Create a 4-frame process video showing the state of nuclear fusion in 2024: NIF ignition milestone, tokamak confinement approach (SPARC/ITER), the Lawson criterion threshold, and commercial timeline.",
  "suggested_followups": ["...", "...", "..."],
  "search_queries": [
    "NIF laser fusion ignition Q>1 energy gain 2023 2024",
    "Commonwealth Fusion SPARC superconducting magnet milestone 2025",
    "ITER construction status first plasma delay 2034",
    "nuclear fusion Lawson criterion current record plasma pressure temperature",
    "fusion private investment startups commercial timeline 2024 2030"
  ]
}
```

---

### Steps 2–3 — Tavily rounds + `_gap_analysis`

Same as Mode 3 Steps 2–3 (Tavily search + gap analysis loop). *(See Mode 3 for full examples.)*

---

### Step 4 — `synthesiser.stream`

Same as Mode 5 Step 2 — receives **all** sources found across all rounds. *(See Mode 5 for full example.)*

---

### Steps 5+ — same as Mode 4 / Mode 5

`create_vocab_plan` (SVG or Math path) → frame/beat codegen → TTS → ffmpeg.
