# 06 — AI Architecture

> Ships in **Phase 3** (curated-first). Phases 1–2 use the deterministic engine only. This
> document specifies the six layers requested: Knowledge, Retrieval, Personalization, Safety,
> Memory, Recommendation.

## 0. Principles
- **Grounded only.** The assistant answers *from retrieved, curated content*. No free-floating
  medical claims. If nothing relevant is retrieved, it says so and offers to save the question.
- **Child-aware, always.** Every prompt carries the specific child's age/stage/history.
- **Safety first.** A safety layer runs *before* and *after* generation; red-flag inputs
  bypass normal answering and route to "seek care" guidance.
- **Calm, sourced, humble.** Cites sources; never diagnoses; defers to pediatricians.

## 1. Knowledge Layer
The curated parenting content database = the migrated `content_items` table (the old
Knowledge sheet, cleaned — see [07-DATABASE-DESIGN.md](07-DATABASE-DESIGN.md)). Each item:
insight, action, reassurance, signs-of-healthy-development, when-to-consult-doctor, age range,
stage, category, difficulty, sources/citations, and `embedding vector(1536)` (pgvector).

Authoring pipeline (offline, replaces `knowledge_generator.js`):
1. LLM-assisted drafting (Claude) from a topic/age brief.
2. **Human expert review** + sourcing (the gate — nothing ships unreviewed).
3. Embedding generation on publish.
4. Versioned; `active` flag; review date + reviewer recorded (fields already exist).

## 2. Retrieval Layer (RAG)
```
Query (parent question)
  → augment with child context (age days, stage, recent categories)
  → embed (Claude/embeddings) 
  → pgvector similarity search over content_items WHERE age range overlaps child age
      AND active, top-k (k≈6), category-boosted
  → rerank (recency of review, difficulty fit, prior-helpful signals)
  → assemble grounded context block
```
Hybrid search: vector similarity + structured filters (age window, category) + keyword
fallback (preserves the old `findKnowledgeByQuestion` behavior as a backstop). Retrieval is
**age-gated** so a newborn question never returns toddler content.

## 3. Personalization Layer (child-aware context engine)
Builds the per-request context object:
- Child: name, exact age (days), stage, leap phase, recorded milestones.
- History: recent tip categories/ids (cooldown + novelty), helpful/not-helpful signals.
- Parent: focus area (onboarding choice), prefs, plan.
- Family: siblings (so advice can acknowledge multiple children).

This is the same data the deterministic engine uses — the personalization layer is the engine's
context, reused for the assistant. Output is injected into the system prompt + used to filter retrieval.

## 4. Safety Layer (medical & parenting controls)
Two-stage, deterministic-first:
1. **Pre-generation classifier** (fast model + rules) on the inbound question. Red-flag
   categories → **bypass RAG** and return a vetted "seek care now / call your pediatrician /
   emergency" response. Examples: newborn fever, breathing difficulty, dehydration,
   unresponsiveness, ingestion/poisoning, self-harm, abuse disclosure, severe allergic reaction.
2. **Post-generation validator** on the draft answer: blocks diagnoses, dosing, and
   unsourced medical claims; enforces "not medical advice" framing; requires that claims map
   to retrieved content. Fails closed (regenerate or fall back to a safe template).

Maintained as a **red-team eval set**; the assistant cannot launch until precision/recall
thresholds are met. Every safety intercept is logged for review.

## 5. Memory Layer (family context memory)
- **Short-term:** the conversation thread (per child) — prior turns in context.
- **Long-term:** durable, structured family memory: stated preferences (e.g., "we co-sleep",
  "dairy allergy"), ongoing concerns, milestones, what advice helped. Stored as typed
  `family_memory` rows (not a vector dump), surfaced into the personalization context.
- **Boundaries:** memory is per-family, never cross-family; parent can view/edit/delete it
  (privacy + trust). Medical-sensitive memory flagged and handled conservatively.

## 6. Recommendation Engine (personalized guidance)
Two modes, one content base:
- **Deterministic (Phases 1–2, always-on):** the ported scoring algorithm picks the daily
  card — stage/leap boost, novelty, cooldown, rotation, difficulty. Predictable, cheap, offline-able.
- **AI-augmented (Phase 3+):** reranks/curates daily picks using helpful/not-helpful signals
  and family memory; suggests next-best content and "what's coming." Always bounded by the
  deterministic engine's safety/cooldown rules — AI tunes ordering, it doesn't invent content.

## 7. Models & cost control
| Use | Model | Notes |
|-----|-------|-------|
| Assistant reasoning | `claude-opus-4-8` (or `claude-sonnet-4-6` for cost) | Grounded answers, citations |
| Safety classifier / quick paths | `claude-haiku-4-5` | Low latency, cheap |
| Content authoring (offline) | `claude-opus-4-8` | Human-reviewed |
| Embeddings | embeddings model → `vector(1536)` | pgvector |
- Prompt-cache the curated context blocks (KB) — same pattern Highmark uses for voice.
- Per-user rate limits; Premium gating on assistant usage (also a cost control).

## 8. Evaluation
- **Groundedness:** % of answers fully supported by retrieved content (target high; track hallucinations).
- **Safety:** intercept precision/recall on the red-team set (launch gate).
- **Helpfulness:** thumbs-up rate, follow-up rate, resolution.
- **Latency:** p50/p95 per answer; safety-path latency separately.
