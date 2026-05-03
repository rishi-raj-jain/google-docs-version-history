# Demo script: Google Docs–style history with serverless + branching

**Audience:** developers  
**Target length:** ~1–2 minutes (adjust pacing; skip optional beats if short on time)  
**Tone:** concrete wins, minimal theater

---

## 0:00 — Hook (~15s)

“Everyone knows **version history** in Google Docs — pick a revision, see what changed, roll back. The hard part isn’t the textarea; it’s **storing every revision** in a way that’s **cheap to read**, **safe to preview**, and **doesn’t turn your main database into a junk drawer**.”

---

## 0:15 — Why serverless fits (~25s)

“This app’s API is **plain Next.js route handlers** talking to Neon with the **serverless driver** — no long-lived pool to babysit. Each request gets a **thin connection** to Postgres; you think in **HTTP + SQL**, not in **servers you patch at midnight**. That’s the same mental model as the product: **bursty writes** when someone saves, **quiet** when they don’t.”

*Optional one-liner if pressed for time:* “Serverless here means **the glue is boring** — which is exactly what you want.”

---

## 0:40 — The branching punchline (~35s)

“Where it gets interesting is **Neon branches**. On **save**, we don’t just append a row — we **fork the database** into a new branch and pin that revision to it. Copy-on-write storage means you’re not **duplicating gigabytes** for every keystroke; you’re getting **isolation** almost for free.”

“That’s the same **idea** as ‘named snapshots’ in docs: each version is its **own slice of state**. Preview or restore can hit **that branch’s connection** without **risking** the live schema or the latest draft.”

---

## 1:15 — Live demo beats (~30s)

1. Change the title and body, hit **Save** — “new row in history, **new branch** behind it.”  
2. Open the **version list** — “each line is a **point-in-time** with metadata.”  
3. Select an older version — “editor loads **that snapshot**.”  
4. If you show diff / restore — “we’re not guessing; we’re **rehydrating** from the revision we stored.”

*If something fails:* “That’s why **branch-per-save** is nice in a demo — the failure surface is **one revision**, not the whole prod DB.”

---

## 1:45 — Close (~10s)

“So: **serverless** for **simple, scalable glue**; **branching** for **Docs-style history** without building a custom snapshot engine from scratch. Same UX people expect — **less infrastructure** you have to own.”

---

## Cheat sheet (speaker notes)

| Beat            | Say in one phrase                                      |
|-----------------|--------------------------------------------------------|
| Problem         | History is easy in the UI, hard to do **safely** in DB |
| Serverless      | **HTTP handlers + serverless SQL**, no pool drama      |
| Branching       | **Fork on save** = snapshot isolation, not full copies |
| Demo            | Save → list → open old → (diff / restore)              |
| Takeaway        | **Familiar product**, **boring ops**                   |

---

## Timing trims

- **~60s version:** Hook → branching punchline (short) → demo only → one-line close.  
- **~90s version:** Full script as written, skip optional lines.
