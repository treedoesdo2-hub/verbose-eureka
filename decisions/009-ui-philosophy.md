# ADR 009 — UI philosophy: extreme approachability, no diegetic chrome

**Status:** Accepted (overturns earlier in-conversation exploration)
**Date:** 2026-04-20

## Context

Early design exploration in this project drifted toward a **diegetic UI** approach — "material metaphor" commitment inspired by Never Second in Rome's carved-wood-and-parchment aesthetic and a proposed "commander's console" theme (scuffed metal, olive-drab panels, phosphor-amber, tactical-kit texture).

User explicitly rejected this:

> "We're trying to do what CL did but better. We DO NOT want a diegetic UI. That's some folk wisdom trash — it doesn't make things better. We want an *extremely* approachable UI."

This corrects a sustained misreading. NSiR's lesson is not "adopt wood-and-parchment chrome"; NSiR's lesson is "consistency, density, clear information hierarchy, visible panel borders." Those principles transfer cleanly to a flat web-app aesthetic. The material metaphor was always optional.

Clutch Legend's failure is not that it uses a web-dashboard aesthetic. Its failure is that it uses the web-dashboard aesthetic *badly* — inconsistent colors, unreadable abbreviations, empty space, tutorial-modal hell, mixed icon languages, five typefaces. A properly-executed web-dashboard UI is the target.

## Decision

**Flat, web-app aesthetic. Extreme approachability. No game-cosplay chrome.**

### What we are doing

- Clean, modern web-application UI. Reference quality: Linear, Vercel, Notion, Stripe dashboard, Raycast.
- Approachability is the primary design axis. Not density, not aesthetic distinctiveness, not thematic immersion — **approachability**.
- One consistent visual language across every screen.
- Readability and keyboard-navigability as first-class concerns.

### What we are NOT doing

- **No wood frames.** No parchment panels. No cobblestone backgrounds.
- **No scanlines, no CRT overlays, no phosphor glow.** Not even subtle.
- **No "worn military kit" textures.** No scuffed metal. No olive drab as a UI chrome.
- **No hand-drawn paper/notebook skeuomorphism.**
- **No retro-terminal ASCII art chrome around actual readable data.**
- **No game-HUD cosplay** (no crosshair reticle borders, no ammo-counter frames around non-ammo data).

Diegetic flavor, if any, lives in **content** (the prose in event text, the names of gear, the look of in-world documents when you read them as artifacts) — not in **chrome**.

### Concrete commitments

1. **Component library first.** Build a unified set of primitives (Button, Table, Modal, Tabs, Tooltip, Panel, Form, SelectList) and reuse them everywhere. No bespoke per-screen rendering.

2. **Typography pair, enforced:**
   - Humanist sans-serif for UI (Inter, Geist, or similar) — 14–16px body, tabular figures disabled for prose
   - Monospace for numbers/code (JetBrains Mono, Berkeley Mono, or similar) — **tabular figures always** when aligning in columns
   - That's it. Two fonts. No display fonts, no decorative headers, no Orbitron.

3. **Semantic color system:**
   - Neutral grayscale (8–10 steps) for most UI
   - One accent color for primary actions (pick once, never change)
   - Semantic red/yellow/green ONLY for state indication, never for decoration
   - Faction colors exist but are confined to faction-badge contexts, never hijacked for UI chrome

4. **Progressive disclosure for depth:** default view shows BT-level loadout; advanced toggle reveals MWO-tier (per ADR 002).

5. **Tooltips on every abbreviation, every icon, every stat.** Hover = definition. No guessing.

6. **Keyboard-first navigation:** every action has a hotkey, hotkey shown on hover, tab order functional, escape closes modals.

7. **Inline tutorial annotations, never blocking modals.** "What's this?" pins next to unfamiliar UI, player dismisses each individually.

8. **Density modes:** compact / normal / spacious, user-selectable. Power users pack more info on screen; newcomers get breathing room.

9. **Dark theme by default, light theme available** — both must be fully supported, not afterthoughts.

10. **No emoji in UI chrome.** Icons are monochrome line-SVG with text backup. Emoji in player-authored content (call signs, unit names) is fine.

### On marketing risk

This decision accepts a tradeoff: **our Steam screenshots will look more like an admin panel than like a game**. This is deliberate. Our buyer is the person who wanted Clutch Legend to be better, not the person browsing Steam for the most evocative thumbnail. The combat screen is our "game-looking" screenshot; every other screen competes on readability and depth of information, not on evocative chrome.

Mitigation: the combat view (per ADR 006, with the Firefight-tier visual ref in `refs/firefight.md`) carries all the "game looks" marketing weight. UI screens are the credibility-with-hardcore-mgmt-players weight.

## Consequences

**Positive:**
- Far lower UI-art budget (no bespoke frames, no hand-painted panels, no texture work)
- Component-library reuse means new screens are cheap after the initial build-out
- Accessibility and colorblind-compatibility are natural consequences, not add-ons
- Sets the game apart from every other indie mgmt-sim that defaults to diegetic chrome
- Resilient under localization (flat UI translates cleanly; diegetic UIs often don't)

**Negative:**
- Screenshot marketing loses the "look at this gorgeous parchment map" hook
- Some niche of players will find it "cold" or "soulless" — this is a real constituency
- Requires design discipline that most indie devs don't actually have — we need to not slip into "just one scanline, just one texture"

**Cascades into:**
- All future UI work follows this brief — no exceptions without explicit ADR
- `refs/never-second-in-rome.md` must be updated to clarify what we steal from NSiR and what we explicitly don't
- `refs/firefight.md` stays as-is (combat view reference) but NSiR no longer serves as material-metaphor reference
- Combat-view UI chrome (the overlay atop the tactical view) follows this same flat philosophy — no worn-tablet frames around the minimap

## Related

- ADR 002 — progressive disclosure for customization depth (same philosophy)
- Future spec: `spec/04-ui-philosophy.md` — expands this into concrete component-library design
