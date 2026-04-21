# ADR 010 — Tech Stack

**Status:** Accepted
**Date:** 2026-04-21

## Context

Round 6 clarify (Q25) locked the technology foundation for the game. Decision cascades: affects every future engineering choice, determines hiring surface if we grow, sets scale ceiling for the combat sim, and determines how modular the game's data pipeline is.

Positioning constraint (ADR 009 + CL competitor ref): Electron/web-tech tier. We are deliberately NOT in the Unity/Unreal/Godot/native-C++ tier. The cost ceiling of the entire project assumes web-tech shipping economics.

## Decision

### Desktop wrapper
**Electron.**

- Mature, ubiquitous, well-documented
- Large community / hireable surface if project grows
- Matches CL-tier positioning
- Rejected: Tauri (Rust-based, lighter install, but less mature ecosystem and adds Rust learning surface for a project that otherwise uses only TypeScript)

### UI framework
**React.**

- Ubiquitous, largest ecosystem, data-grid / keyboard-nav / accessibility libs mature
- Matches React devs hireable surface
- Rejected: Svelte (smaller bundle, better perf — but smaller community; loses on ecosystem when we need complex data surfaces like the armory screens)
- Rejected: Solid (great perf, too new)

### Simulation language
**TypeScript, executed in a Worker thread** off the UI thread.

- Starting assumption — not a permanent commitment. If combat sim profiling shows it's the bottleneck at battalion scale, we port the hot path to **Rust → WASM** in the same Worker.
- Rust/WASM as default starting point is rejected as premature optimization.
- Worker thread isolation keeps UI responsive regardless of sim load.

### State management
**Zustand + Immer.**

- Zustand for cross-cutting app state (settings, campaign state, stockpile, roster)
- Immer for immutable updates without boilerplate
- Per-component local state uses React's built-in `useState`
- Rejected: Redux (verbose, more boilerplate than value at this scale)
- Rejected: Jotai (atomic, but Zustand's single-store is simpler for a campaign-savable game)
- Rejected: Valtio (proxy-based; harder to debug when something goes wrong)

### Combat rendering
**Pixi.js (WebGL-backed).**

- Sprite-batched, handles 1000s of sprites per frame
- Canvas 2D falls over past ~200 moving sprites; unacceptable at our target scale (battalion)
- Mature, well-documented, huge Stack Overflow surface
- Rejected: bespoke WebGL (max perf, but wildly higher build cost for marginal gain at our scope)

### Save format
**JSON.**

- Human-readable → easy bug reports, player modding, debugging
- Versionable via a `schemaVersion` field at root; migrations are plain JS
- Rejected: binary (MessagePack, Protobuf) — premature optimization; save size will not be the bottleneck
- Rejected: SQLite via `better-sqlite3` — structural power is nice, but adds native dep and complicates Electron packaging; revisit only if save-state queries become a real concern (e.g., complex campaign-history analytics)
- Saves will be pretty-printed JSON with stable key order for diffability

### Data files (game content, not saves)
**JSON** with strict schema validation via Zod (or equivalent) at load time.

- Units, gear, chassis, weapons, factions, events, contracts — all stored as JSON
- Schema files checked into the repo alongside the data; CI validates on every commit
- Players can mod the JSON directly (modding culture as ADR 006 implies via readable saves)
- Rejected: YAML (prettier, but adds parser; JSON is universal)
- Rejected: custom XML-ish (Firefight's approach; not worth the parser burden)

### Build tooling
**Vite.**

- Fastest HMR in the market as of now
- Good Electron integration via `electron-vite` wrapper
- TypeScript native support
- Rejected: Webpack (slower, more config)
- Rejected: esbuild-direct (faster, but thinner dev experience)

### Package manager
**pnpm.**

- Faster installs, lower disk use, strict dependency resolution
- Works fine with Electron's native-module quirks in our experience
- Rejected: npm (slower, messier)
- Rejected: yarn v4 (fine, but pnpm has the lead on perf)

### Testing
**Vitest + Playwright.**

- Vitest for unit tests of sim logic, loadout math, economy math
- Playwright for end-to-end UI tests (already using it in this project for CL investigation — familiar)
- Sim logic is pure TypeScript and easily unit-testable (determinism + seeded RNG is the enabler)

### Linting / formatting
**Biome** (formerly Rome) — one tool, both jobs, fast.

- Rejected: ESLint + Prettier (two tools, slower, more config)

## Consequences

**Positive:**
- Entire stack uses TypeScript as the one language across sim, UI, data schemas, build scripts
- Zero native compilation in the Electron package (keeps cross-platform simple)
- Fast iteration loop (Vite HMR + Vitest)
- Modding-friendly from day one (JSON data, JSON saves)
- Ecosystem is hiring-friendly if project grows

**Negative / accepted:**
- TypeScript sim has a perf ceiling. If we hit it, porting the hot loop to Rust/WASM is the escape hatch. That port is ~2–4 weeks of focused work if needed.
- Pixi.js is a dependency with its own learning curve (canvas-only devs need to pick up WebGL thinking)
- Zod schema validation adds load-time cost (negligible for JSON files under a few MB)

**Explicitly not in scope:**
- No separate scripting language (no Lua, no AngelScript). AI behavior, events, and scripted sequences all authored in TypeScript. Simpler, type-safe.
- No native code in the shipped product unless the Rust/WASM escape hatch is exercised.
- No networking. Single-player only for foreseeable future (leaderboards possible but deferred).

## Open implementation decisions

- Icon library (Lucide vs Phosphor vs commissioned custom)
- Font license + hosting (self-host vs CDN)
- Save file encryption for anti-cheat (probably skip — single-player, no competitive integrity concern)
- Auto-update mechanism (electron-updater vs manual) — defer until after MVP

## Related

- ADR 001 — autobattler purity (informed by sim-only-in-Worker decision)
- ADR 002 — progressive disclosure (TypeScript + JSON data pipeline supports advanced-mode toggle cleanly)
- ADR 009 — UI philosophy (flat web UI, React-ecosystem heavy)
- spec/07 — combat sim architecture (defines how the sim is structured inside the Worker)
