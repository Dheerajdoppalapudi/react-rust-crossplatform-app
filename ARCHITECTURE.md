# Zenith — Full Architecture & Execution Flow

---

## 1. Six Execution Modes

| # | Mode | Search | Renderer |
|---|------|--------|----------|
| 1 | Instant + Interactive | None (LLM knowledge) | Scene planner → blocks |
| 2 | Instant + Interactive + auto-search | Tavily light (3 queries) | Scene planner → cited blocks |
| 3 | Deep + Interactive | Tavily deep (5+ queries) | Scene planner → cited blocks |
| 4 | Instant + Video | None | Manim / SVG / Mermaid |
| 5 | Instant + Video + auto-search | Tavily light | Synthesiser → Manim / SVG / Mermaid |
| 6 | Deep + Video | Tavily deep | Synthesiser → Manim / SVG / Mermaid |

---

## 2. Full Execution Flow

```
POST /api/generate
  {message, mode, video_enabled, conversation_id, ...}

  ① ALWAYS — init event
     yield {type:'init', conversation_id}  ← URL updates immediately

  ② ALWAYS — plan_and_classify [claude-haiku-4-5]
     Input:  message + conversation_context + prior_synthesis_text
     Prompt: planning_classify.md + {{MODE_RULES}} injected per mode

     Instant + Interactive output:
       { domain, enriched_prompt, suggested_followups,
         needs_search: bool, search_queries?: string[] }

     Deep + Interactive output:
       { domain, enriched_prompt, suggested_followups,
         search_queries: string[5], sub_questions: string[2] }

     Instant + Video output:
       { domain, enriched_prompt, suggested_followups,
         intent_type, frame_count, notes,
         needs_search: bool, search_queries?: string[] }

     Deep + Video output:
       { domain, enriched_prompt, suggested_followups,
         intent_type, frame_count, notes,
         search_queries: string[5], sub_questions: string[2] }

  ③ CONDITIONAL — _search_phase()
     Triggers when:
       mode == 'deep_research'          → always
       mode == 'instant' + needs_search → light (3 queries)

     Skipped when:
       mode == 'instant' + needs_search=false → pure LLM, no Tavily

     Inside _search_phase():
       Round 1: Tavily.search(query) × N in parallel
                → deduplicate by URL
                → yield {type:'source'} for EVERY result found
                → yield {type:'stage_done', stage:'searching', sources_found:N}

       Round 2: (deep only, if total results < 5)
                → 1-2 follow-up queries from sub_questions[]

       Extra sources:
                → URLs pasted in message → tavily.extract()
                → Uploaded files         → extract_text()

       After all rounds:
                → rank_and_deduplicate(all_results, DEEP_SEARCH_SOURCES=10)
                → SAVE all_final to output_dir/sources_raw.json  ← full raw content
                → top 5 = final (DEEP_SOURCES_IN_ANSWER=5)
                → truncate_content(final[i].content) → 4800 chars per source

       yield {type:'stage', stage:'reading', label:'Reading 5 sources…'}
       yield {type:'_sources_ready',
              sources:      [source_summary(s) for s in all_final],  ← ALL, for UI
              sources_full: [source_full(s)    for s in final]        ← TOP-5, for LLM
             }

  ④ BRANCH — video_enabled?

  ─────────────────────────────────────────────────────
  BRANCH A: video_enabled=false → INTERACTIVE PIPELINE
  ─────────────────────────────────────────────────────

    yield {type:'stage', stage:'designing', label:'Designing the lesson…'}

    _select_entities(enriched_prompt, domain) [claude-sonnet-4-6, ~1s]
      Input:  enriched_prompt  ← richer than original message
      Prompt: entity_selector.md + slim_index.md
      Output: { enriched_prompt, entities: string[], model }

    _plan_scene(enriched_prompt, entities, sources_full) [sonnet/gpt-4.1, ~8-12s]
      System: base_planner.md + domain prompt + catalog (full schemas for selected entities)
      User:   conversation_context
              + ## Research Sources (sources_full injected with [N] numbering)
              + USER QUESTION: enriched_prompt
      Output: SceneIR {
                title, follow_ups, learning_objective,
                blocks: [
                  {type:'text',   content:'MBS are bonds [1]. Banks sell mortgages [2]...'},
                  {type:'entity', entity_type:'mermaid_viewer', props:{chart:'graph TD...'}},
                  {type:'text',   content:'Risk transferred because [3]...'},
                  {type:'entity', entity_type:'comparison_table', props:{...}}
                ]
              }

    Codegen (only for freeform_html / p5_sketch entity types):
      → _run_codegen() [sonnet] → generates raw HTML
      → _wrap_in_sandbox() → sandboxed iframe

    Emit:
      yield {type:'meta',  title, follow_ups, learning_objective}
      yield {type:'block', block:{...}}  × N blocks in order
      yield {type:'stage_done', stage:'designing', duration_s}

  ─────────────────────────────────────────────────────
  BRANCH B: video_enabled=true → VIDEO PIPELINE
  ─────────────────────────────────────────────────────

    [IF sources_full] → Synthesise
      yield {type:'stage', stage:'synthesising'}

      synthesiser.stream(message, sources_full) [haiku, streaming]
        → yields tokens  → yield {type:'token', text}
        → synthesis_text accumulated

      yield {type:'stage_done', stage:'synthesising'}

    effective_message = synthesis_text || message

    run_video_pipeline_from_intent(intent, synthesis_text):

      ┌── intent_type → renderer selection ──────────────────────┐
      │                                                           │
      │  'math'                → MANIM pipeline                   │
      │  'illustration'        → SVG pipeline                     │
      │  'comparison'          → SVG pipeline                     │
      │  'concept_analogy'     → SVG pipeline                     │
      │  'process'             → MERMAID → Excalidraw pipeline    │
      │  'architecture'        → MERMAID → Excalidraw pipeline    │
      │  'timeline'            → MERMAID → Excalidraw pipeline    │
      │  anything else         → Slim JSON → Excalidraw (fallback)│
      └───────────────────────────────────────────────────────────┘

      Stage 1A: create_vocab_plan(effective_message, intent)
        [haiku] → intent classification, element vocabulary (no coords)

      Stage 1.5 (parallel with 1B):
        svg/component_generator → DB lookup + LLM for icon SVGs

      Stage 1B: create_spatial_plan(vocab_plan)
        [haiku/sonnet] → pixel coordinates for each element

      Stage 2 — Frame rendering (one path):
        MANIM:   manim_generator.generate_manim_frames() → MP4 clips
        SVG:     svg_generator.generate_svg_frames()     → PNG files
        MERMAID: mermaid_generator.generate_mermaid_frames()
                   → POST to mermaid-sidecar :3001 → Excalidraw JSON
        FALLBACK:planner.generate_all_frames()           → Slim JSON
                   → combiner → excalidraw_enhancer → Full Excalidraw JSON

      Stage 3 — TTS narration:
        tts_service.generate() [gTTS default / OpenAI TTS if ?use_openai_tts=true]
        → per-frame MP3 audio

      Stage 4 — Assembly:
        video_assembler.assemble() [ffmpeg]
        → frames + audio → MP4

      yield {type:'frame', index, image, caption} × N
      yield {type:'stage_done', ...}

  ⑤ ALWAYS — Finalise

    ChromaDB:  upsert_sources(conversation_id, sources_full)
               (embeds top-5 content for follow-up semantic retrieval)

    SQLite:    update_session(
                 status='done',
                 synthesis_text,          ← for follow-up context
                 sources_json=sources,    ← ALL found sources for UI
                 stages_json,
                 ...token usage, model, etc.
               )

    Disk:      output_dir/sources_raw.json  ← all ranked sources, full content
               output_dir/scene_ir.json     ← (interactive) final block layout
               output_dir/activity_log.json ← LLM call trace

    yield {type:'done', session_id, conversation_id, ...}
```

---

## 3. The Source Truncation Problem — Evidence & Fix

### What Tavily Returns

From a real session (`47f7fd042cf2...`) — 10 sources found, 5 fed to LLM:

| Source | `content` size | `snippet` size |
|--------|---------------|---------------|
| congress.gov | 33,486 chars | 2,313 chars |
| en.wikipedia.org (wars) | **345,305 chars** | 2,032 chars |
| britannica.com | 27,099 chars | 1,638 chars |
| bbc.com | 4,985 chars | 2,051 chars |
| en.wikipedia.org (2025) | **394,700 chars** | 1,478 chars |

### The Bug

In `interactive_service.py`, `_build_sources_block` does:

```python
content = (s.get("content") or s.get("snippet") or "")[:800]
```

**What the LLM actually receives for congress.gov (800 chars of `content`):**
```
# India-Pakistan Conflict in Spring 2025 | Congress.gov | Library of Congress
[skip to main content]
Navigation
[![Image 1: Congress.gov]
*   [Advanced Searches]
*   [Browse]
*   [Legislation]
*   [Congressional Record]
← PURE NAVIGATION BOILERPLATE
```

**What it should receive (snippet, 2,313 chars):**
```
Military Operations

Late on May 6 and into May 7, India's military launched "Operation Sindoor"
with drone and missile strikes on nine alleged terrorist targets in both
Pakistani-held Kashmir and Pakistan proper, including the alleged LeT
headquarters and that of Jaish-e-Mohammed...
← ACTUAL RELEVANT CONTENT
```

### Why `content[:800]` is broken for most pages

`content` = full scraped HTML-to-text of the page. Every page starts with:
- `<title>` tag → page title
- Navigation links (`*   [Browse]`, `*   [Legislation]`, etc.)
- Header/hero elements
- Often 2,000–8,000 chars of boilerplate before any article text

The 800-char cutoff almost always lands inside navigation. Real content starts at offset 2,000–10,000+ for most sites.

### What Perplexity Does

Perplexity's retrieval pipeline (public knowledge):
1. **Query-focused chunking**: split each page into 512-token chunks with 64-token overlap
2. **Embed each chunk** with a retrieval model
3. **Top-K retrieval per document**: rank chunks by cosine similarity to the query embedding
4. **Assemble context**: take the top 2-3 chunks per source (not the top of the document)

They never take `content[:N]`. They always retrieve by relevance within the document.

### Recommended Fix (3 levels — pick where to stop)

#### Level 1 — Immediate (30 min, 90% of the gain)

**Use `snippet` as the primary context, not `content`.**

Tavily's `snippet` is already their query-focused extraction — it's what their search algorithm decided is most relevant. It's 1,500–2,400 chars of real content per source.

Change `_build_sources_block` in `interactive_service.py`:

```python
# CURRENT (broken):
content = (s.get("content") or s.get("snippet") or "")[:800]

# FIX: snippet first (already query-relevant), then clean content paragraphs
def _extract_body(s: dict, budget: int = 3000) -> str:
    snippet = (s.get("snippet") or "")
    content = (s.get("content") or "")

    # Strip navigation lines from content
    clean_lines = [
        line for line in content.split("\n")
        if len(line.strip()) > 80          # skip short nav items
        and line.count("](") < 2          # skip markdown link lists
        and not line.strip().startswith("*   [")  # skip bullet nav
    ]
    clean_content = "\n".join(clean_lines)

    # Use snippet as base (already query-relevant)
    # Append clean content paragraphs up to budget
    body = snippet
    remaining = budget - len(body)
    if remaining > 200 and clean_content:
        body += "\n\n" + clean_content[:remaining]

    return body[:budget]
```

Result: 5 sources × 3,000 chars = 15,000 chars ≈ 3,750 tokens (well within scene planner budget).

#### Level 2 — Query-focused paragraph scoring (2-3 hours)

When `content` is available and > 5,000 chars, score each paragraph by keyword overlap with `enriched_prompt`:

```python
def _score_paragraph(para: str, query_words: set) -> float:
    para_words = set(para.lower().split())
    return len(para_words & query_words) / (len(para_words) + 1)

def _extract_relevant_paragraphs(content: str, query: str, budget: int) -> str:
    query_words = set(query.lower().split()) - STOP_WORDS
    paragraphs = [p for p in content.split("\n\n") if len(p.strip()) > 100]
    scored = sorted(paragraphs, key=lambda p: _score_paragraph(p, query_words), reverse=True)
    result, used = [], 0
    for para in scored:
        if used + len(para) > budget: break
        result.append(para)
        used += len(para)
    return "\n\n".join(result)
```

Pass `enriched_prompt` into `_build_sources_block` and use this for long documents.

#### Level 3 — Per-document chunk retrieval (1 day, proper RAG)

For Wikipedia (345k chars), paragraph scoring isn't enough. Real solution:
- Chunk each source into 512-char chunks at sentence boundaries
- Embed chunks (you already have ChromaDB + OpenAI embeddings)
- At query time, retrieve top-3 chunks per source using cosine similarity
- This is what Perplexity, You.com, and Bing Copilot all do

The groundwork is already in place (`vector_store.py`). Would need a per-source sub-collection in ChromaDB, or a local FAISS index per session.

---

## 4. Data Flow Diagram

```
User message
     │
     ▼
plan_and_classify [Haiku]
     │
     ├── needs_search=false ──────────────────────────────┐
     │                                                    │
     └── needs_search=true ──► _search_phase              │
                                    │                     │
                              Tavily × N queries          │
                              deduplicate + rank          │
                              save sources_raw.json       │
                              truncate top-5              │
                                    │                     │
                              sources_full (top-5)        │
                              sources (all, for UI)       │
                                    │                     │
                    ┌───────────────┘                     │
                    │                                     │
     ┌──────────────┴─────────────────────────────────────┤
     │                                                    │
video_enabled=false                              video_enabled=true
     │                                                    │
     ▼                                                    ▼
_select_entities [Sonnet]                    synthesiser [Haiku]
     │                                       synthesis_text
     ▼                                                    │
_plan_scene [Sonnet]                                      ▼
  ← sources injected                        run_video_pipeline_from_intent
  ← entity schemas injected                     │
     │                                           ├── math      → Manim
     ▼                                           ├── svg types → SVG
SceneIR                                         ├── mermaid   → Excalidraw
     │                                           └── fallback  → Excalidraw
     ├── freeform_html → codegen [Sonnet]                │
     ├── p5_sketch     → codegen [Sonnet]                ▼
     └── other         → emit as-is              TTS → ffmpeg → MP4
     │
     ▼
Emit: meta → blocks × N
     │
     ▼
Finalise: ChromaDB upsert, SQLite update, done event
```

---

## 5. File Map

```
backend/
├── routers/
│   └── generate.py              ← Single SSE endpoint, all 6 modes
│
├── services/
│   ├── frame_generation/
│   │   ├── planner.py           ← plan_and_classify(), classify_intent()
│   │   ├── prompts/
│   │   │   └── planning_classify.md  ← {{MODE_RULES}} placeholder
│   │   ├── manim/               ← Math animation pipeline
│   │   ├── svg/                 ← Illustration pipeline
│   │   └── mermaid/             ← Process/architecture/timeline pipeline
│   │
│   ├── interactive/
│   │   ├── interactive_service.py   ← _select_entities, _plan_scene, run_interactive_pipeline
│   │   ├── scene_ir.py              ← SceneIR pydantic model + block validation
│   │   └── prompts/
│   │       ├── entity_selector.md   ← Entity + model selection prompt
│   │       ├── base_planner.md      ← Scene planner system prompt
│   │       ├── slim_index.md        ← One-liner index of all entity types
│   │       ├── catalog/             ← Full schema per entity type (mermaid_viewer.md etc)
│   │       └── domains/             ← Domain-specific context (economics.md etc)
│   │
│   ├── research/
│   │   ├── search_provider.py   ← Tavily wrapper, SearchResult dataclass
│   │   ├── source_processor.py  ← rank_and_deduplicate, truncate_content
│   │   ├── research_service.py  ← source_summary, source_full formatters
│   │   ├── synthesiser.py       ← Streaming synthesis for video (Haiku)
│   │   ├── vector_store.py      ← ChromaDB upsert/retrieve
│   │   └── file_extractor.py    ← Uploaded file text extraction
│   │
│   └── generation_service.py    ← run_video_pipeline_from_intent, build_conversation_context
│
├── core/
│   ├── config.py                ← ALL constants (DEEP_SOURCES_IN_ANSWER=5, etc.)
│   └── database.py              ← SQLite helpers, migrations
│
└── outputs/
    └── {session_id}/
        ├── sources_raw.json     ← All ranked sources, full content, pre-truncation
        ├── scene_ir.json        ← Final interactive lesson layout
        └── activity_log.json    ← LLM call trace with tokens
```

---

## 6. Key Config Values

```python
# core/config.py
DEEP_SEARCH_SOURCES    = 10   # how many to rank/keep after dedup
DEEP_SOURCES_IN_ANSWER =  5   # how many go to the LLM (top-5 of 10)
DEEP_MAX_TOKENS_SOURCE = 1200 # chars budget per source = 1200 × 4 = 4800 chars
INSTANT_MAX_QUERIES    =  3   # Tavily queries in instant auto-search mode
DEEP_MAX_QUERIES       =  5   # Tavily queries in deep research mode
FOLLOWUP_CONTEXT_TURNS =  3   # how many prior turns to load synthesis_text from
FOLLOWUP_TOP_K_SOURCES =  8   # ChromaDB retrieval for follow-up turns
```

---

## 7. SSE Event Sequence (all modes)

```
{type:'init',       conversation_id}         ← fired immediately, URL updates
{type:'stage',      stage:'thinking'}
{type:'stage_done', stage:'thinking', duration_s}

[if search]
{type:'stage',      stage:'searching', queries:[...]}
{type:'source',     source:{title,url,snippet,domain}}  × all results found
{type:'stage_done', stage:'searching', sources_found:N}
{type:'stage',      stage:'reading',   label:'Reading 5 sources…'}
{type:'stage_done', stage:'reading',   duration_s}

[if video + search]
{type:'stage',      stage:'synthesising'}
{type:'token',      text:'...'}              × many (streaming synthesis)
{type:'stage_done', stage:'synthesising'}

[if interactive]
{type:'stage',      stage:'designing'}
{type:'meta',       title, follow_ups, learning_objective}
{type:'block',      block:{id,type,entity_type,props,...}}  × N blocks
{type:'stage_done', stage:'designing'}

[if video]
{type:'stage',      stage:'planning'}
{type:'stage',      stage:'generating_frames'}
{type:'frame',      index, image, caption}   × N frames
{type:'stage_done', ...}

{type:'done', session_id, conversation_id, render_path, ...}
```

---

## 8. Next Priority

**Fix `_build_sources_block` (Level 1)** — this is the highest ROI change:

Currently: `content[:800]` = navigation boilerplate for 8 out of 10 sources  
Fix: `snippet` (Tavily's query-relevant extract, 1,500–2,400 chars) as primary context

This change alone makes every cited lesson dramatically more accurate because the scene planner will finally read actual facts instead of `* [Advanced Searches]` links.
