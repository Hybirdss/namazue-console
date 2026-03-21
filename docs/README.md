# Documentation Map

## `docs/current/`

Single source of truth for the current `namazue.dev` direction.

- **`docs/current/DESIGN.md`** — The authoritative design document
- **`docs/current/BACKEND.md`** — Backend architecture companion to the design
- **`docs/current/BACKLOG.md`** — Active backend execution order
- **`docs/current/IMPLEMENTATION_PLAN.md`** — Detailed full-stack implementation order

This defines the approved product direction:

- Japan-wide spatial operations console (not Tokyo-only)
- MapLibre GL JS + Deck.gl (not CesiumJS)
- Fullscreen dark map + floating operator panels
- Viewport-driven data loading (not metro selection)
- Plugin-based layer architecture
- Real-time infrastructure: AIS ships, rail, power grid, PLATEAU 3D buildings

## `docs/technical/`

Still valid technical reference:

- `technical/GMPE_ENGINE.md` — GMPE engine documentation
- `technical/DATA_SOURCES.md` — Data source reference

## `docs/reference/`

Still valid reference material:

- `reference/EQUATIONS.md` — Seismological equations
- `reference/HISTORICAL_PRESETS.md` — Historical earthquake presets
- `reference/JMA_INTENSITY_COLORS.md` — JMA intensity color scale

## `docs/screenshots/`

Screenshots used in the project README.

## Rule of Thumb

If it defines what `namazue.dev` should become now: `docs/current/DESIGN.md`.

If it defines how backend contracts and execution should follow that design: `docs/current/BACKEND.md`, `docs/current/BACKLOG.md`, and `docs/current/IMPLEMENTATION_PLAN.md`.

Everything else is either reference material or legacy.
