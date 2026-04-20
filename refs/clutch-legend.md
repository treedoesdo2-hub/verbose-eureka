# Ref — Clutch Legend (direct competitor / negative example)

**What it is:** Italian solo-dev indie esports manager (CS career sim). Electron-wrapped web tech. React + bundled single HTML file. Steam app 4530610. Developer: Federico Mariotti (`@theclutchlegend`).

## Why it's in this repo

**CL is our direct competitor, not just a negative example.** We are targeting the same tier, the same market, and the same buyer. CL gets its buyers — those buyers exist, they're spending money, they want this kind of game. Our job is to be the one they buy next time by shipping the same thing done well.

- **Same tier:** Electron-wrapped web-tech, low-art, high-systems management game
- **Same buyer profile:** sim-mgmt players who settle for low production values to get depth, willing to tolerate indie rough edges
- **Same distribution model:** Steam direct-download, solo-dev / tiny-team marketing, no publisher

What makes it a "negative example" is *execution*, not positioning. The tier is valid. The execution is bad. The gap between "CL-tier game executed well" and "CL-tier game executed badly" is massive and commercially exploitable. **We don't need to be a masterpiece — we just need to be better than this, in a tier currently full of it.**

## Specific failures to avoid

Observed via Playwright-driven demo play, April 2026:

1. **Modal nesting hell** — new-career flow stacks 5 full-screen takeovers before reaching the hub. Each with its own "INIZIA" button.
2. **Dashboard aesthetic instead of game aesthetic** — dark slate gradient cards, monospace uppercase labels with letter-spacing, thin orange/cyan accents. Looks like a Linear/Stripe admin panel, not a game.
3. **Dicebear cartoon avatars** — API-generated circular SVG portraits. LinkedIn-style faces in a Counter-Strike game. Instant aesthetic-mismatch tell.
4. **Inconsistent icons** — three different visual languages for the three map icons on one screen (emoji fire / emoji radiation / pixel-art screenshot).
5. **Wasted real estate** — entire columns dedicated to "enable the Career Advisor" upsells. Empty placeholder states where actual data should be.
6. **Cryptic abbreviation soup** — top bar reads "NETTO /S +€150 · FORM 70 - · MIND FOCUSED · S.1/28 · CWL · #1 · AMT". No tooltips.
7. **Inconsistent color semantics** — green means three different things, orange means four different things across the UI.
8. **Tutorial layer hijacking screens** — first visit to each sidebar tab shows a full-page "GUIDA CONTESTUALE" explainer with HO CAPITO button instead of actual content.
9. **Placeholder rot** — "ULTIME 5 PARTITE" shows 5 gray dashes with no explanation. Disabled buttons styled identically to active ones.
10. **Trademarked feature names** — "CAREER PULSE™" on a UI widget. Classic indie overreach. Reads like a pitch deck.
11. **Pretentious flavor prose** — Personality blurbs read like horoscopes: *"T3sting ha una presenza forte nello spogliatoio, ma è difficile capire cosa pensa davvero..."*
12. **Fake-locked sidebar items** — "NAZIONI S2", "TRASFERIMENTI S2", "HALL OF FAME S2" with lock icons, cluttering the UI with unshipped features.
13. **The 30-round match trap** — CS matches are ~24–30 rounds. CL simulates each one. Skipping is a valid gameplay strategy = the primary visual draw is unplayable.
14. **Debug leftovers in production** — `[GODMODE] stato pannello developer` React state still accessible.
15. **Five typefaces in one view** — Orbitron + Rajdhani + Share Tech Mono + system + emoji.

## What CL gets RIGHT (worth learning from)

- **Map veto screen** — two candidate cards with your/opponent knowledge bars and a delta tag (PARI / RISCHIO). Tactical choice is immediately legible. Best screen in the game.
- **Pre-match lineup comparison** — 5v5 stat grid, your operator highlighted, win% at bottom. Clean.
- **Attribute bars with primary/secondary/base color coding** on the Stats page. Tells you which stats matter without reading docs.
- **Sidebar IA** — OPERAZIONI / GIOCATORE / ECONOMIA / CARRIERA sections is sensible grouping.

## Key takeaway

CL looks like what happens when a developer learns web UI patterns from 2020–2024 dashboards (Linear, Stripe, Vercel, modern SaaS) and applies them uncritically to a game. The failures are *aesthetic commitment* failures more than craft failures — some individual screens are competent. **We differentiate by committing to a game-first visual language.**
