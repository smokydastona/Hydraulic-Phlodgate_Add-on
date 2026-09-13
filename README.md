# Phlodgate Add-On

Dual-mode Bedrock client-enhancement add-on and official companion pack for **[Hydraulic-Phlodgate](https://github.com/smokydastona/Hydraulic-Phlodgate)**:
JEI-style inventory tools, waypoints/compass, a rotating text-radar **Minimap HUD** with a Field Map item, AppleSkin-style food HUD,
durability HUD, an entity/item optimization engine, machine/container inspector, Render Dragon fog controls, and the **Hydraulic Control Room** settings menu.

This is a Bedrock Behavior Pack + Resource Pack pair designed to function seamlessly either as a **standalone client-enhancement pack** with zero dependencies or as an **integrated companion add-on** when connected to a server running Hydraulic-Phlodgate.

## Companion Contract

The add-on is intentionally Java-mod-agnostic. It must not add branches for Create, Mekanism,
Thermal, AE2, or any other Java mod. Hydraulic-Phlodgate determines compatibility and keeps the
Java server authoritative; this add-on presents generic client-local tools and consumes only
stable signals or typed runtime contracts that Hydraulic has actually delivered.

Geyser automatically delivers the companion resource pack, but it cannot install or execute this
behavior pack for a joining player. Behavior Pack features run only where the player has explicitly
installed and enabled the pack (for example, as a global resource). Therefore, this add-on cannot
by itself execute Java machine processing, automation, fluid simulation, energy transfer, or state
synchronization. Those operations require a concrete Java-side Phlodgate bridge and verified
Geyser transport path.

## Dual-Mode Operation

### 1. Standalone Mode (Zero External Dependencies)
- Runs locally on singleplayer worlds, Bedrock Dedicated Server (BDS), or Realms without requiring Hydraulic or a Java server.
- Full local feature suite: JEI-style inventory & recipe registry, Field Map / Minimap radar HUD, Waypoints & Compass HUD, Durability HUD & alerts, AppleSkin food/saturation HUD, Fog controller presets, and local Despawn/ItemMerge optimization engine.

### 2. Companion Mode (Hydraulic-Phlodgate Integrated)
- **Automatic & Configurable Detection**: Automatically detects the canonical Hydraulic-Phlodgate `phlodgate_bridge` scoreboard objective, with modded inventory namespaces as secondary evidence. The detector tolerates unavailable scoreboard and dynamic-property APIs.
- **Modded Item & Recipe Integration**: Extends the JEI recipe search, categories, and Mass-Crafting engine to index and recognize modded namespaces (`hydraulic:*`, `hydraulic_test_mod:*`, `create:*`, `techreborn:*`, etc.).
- **Optimizer Machine & Mod Protection**: Automatically protects non-vanilla modded entities, machine proxies, and automation markers from client/world-side culling and despawn policies.
- **Machine & Container Inspector**: In-game line-of-sight inspection tool that displays machine block identifiers, inventory slot contents, custom names, and capacity via interactive Bedrock forms.
- **Hydraulic Control Room Companion Bridge Menu**: Adds dedicated companion status diagnostics, detected namespace catalog, bridge settings, and inspection tools to the master control form.

## Build

```
npm install
npm run build      # compiles src/ -> BP/scripts/main.js
npm run typecheck   # tsc --noEmit against the real @minecraft/server types
npm test            # unit tests for all pure/testable logic
npm run package      # build + zip BP/RP/presets into dist/*.mcpack and *.mcaddon
```

## Install (manual, for testing)

1. Run `npm run package`.
2. Copy `dist/Phlodgate_Add-on_v<version>.mcaddon` to a device with Minecraft Bedrock installed and open it,
   **or** import `dist/Phlodgate_BP_v<version>.mcpack` and `dist/Phlodgate_RP_v<version>.mcpack` separately.
3. In your world's settings, enable both the "Phlodgate Add-On" Behavior Pack and Resource Pack.
4. Enable the **Beta APIs** experimental toggle (required for any Script API behavior pack).
5. Join the world. Every player receives a "Hydraulic Control Room" item and a "Phlodgate Field Map" item on
   first spawn. Use the Control Room item for settings, and the Field Map item to view the radar/waypoint
   list and quickly add a waypoint at your current position.
6. Optional: instead of the default Resource Pack, you may enable **Phlodgate Add-On (Aggressive Visuals)**
   or **(Extreme Visuals)** for a more performance-oriented preset. Only enable one resource pack variant at
   a time.

## Project layout

- `src/` — TypeScript source (bundled by esbuild into `BP/scripts/main.js`)
  - `settings/` — player/world settings schema, dynamic-property store, permission checks, Balanced/Aggressive/Extreme profiles
  - `features/durability`, `features/food`, `features/waypoints`, `features/minimap`, `features/inventory`, `features/optimization`, `features/fog`
  - `ui/` — Hydraulic Control Room forms, the Field Map form, and the combined HUD composer
- `BP/` — Behavior Pack (manifest, compiled scripts, custom item)
- `RP/` — default Resource Pack (fog definitions, biome fog assignment, lang files, HUD corner-overlay JSON UI)
- `RP_Aggressive/`, `RP_Extreme/` — optional static visual presets (manually selectable, not live-toggle)
- `scripts/` — Node build/package/clean scripts

## Minimap / Field Map

Bedrock's Script API does not expose a world-render or map-texture surface, so a pixel/terrain minimap
(like the Java-side Xaero's/JourneyMap-style CurseForge add-ons) cannot be built purely with `@minecraft/server`.
Instead, this add-on ships a **radar-style Minimap HUD**:

- A rotating text radar strip (`features/minimap/MinimapHud.ts`) showing the four cardinal directions and
  nearby waypoints as glyphs, positioned by bearing relative to your current facing, plus a distance-sorted
  list of the nearest waypoints.
- A **Phlodgate Field Map** item (given on spawn) that opens a full-screen form with the same radar, the
  10 nearest waypoints with bearing arrows and distances, a one-tap "add waypoint here", a minimap HUD
  on/off toggle, and a shortcut into the full Waypoint Manager.
- Configurable via Player Settings: minimap HUD on/off and radar radius (32–256 blocks).

## HUD corner overlay (JSON UI)

All HUD text (minimap radar, compass, food, durability) is written through `player.onScreenDisplay.setActionBar(...)`
in `ui/HudManager.ts`, which is the only per-tick text surface the Script API exposes (there is no custom/free-form
`ScreenDisplay` widget API in the current `@minecraft/server`). To get **visual parity with a persistent corner
minimap** instead of the vanilla bottom-center, auto-fading action bar text, each resource pack variant
(`RP/`, `RP_Aggressive/`, `RP_Extreme/`) ships a JSON UI override at `ui/hud_screen.json`:

- Re-anchors the vanilla `hud_actionbar_text` panel from bottom-center to the **top-left corner** (`anchor_from`/`anchor_to: top_left`, small pixel offset), and left-aligns the text instead of centering it.
- Forces `alpha: 1` on the panel and its text label, replacing the vanilla fade-in/fade-out animation bindings so the box stays fully opaque and **persistent** instead of fading out ~3 seconds after each update.
- Adds a `visible` binding that hides the panel whenever the action bar string is empty, so nothing is drawn before the HUD manager's first tick or while all HUD sections are disabled in Player Settings.
- Registered via `ui/_ui_defs.json` (`"ui_defs": ["ui/hud_screen.json"]`) in each pack.

Because `hud_actionbar_text` is a single shared vanilla control, this reposition/persistence applies to **any**
action bar message shown while this resource pack is active (including vanilla messages and other add-ons'
action bar text), not only this add-on's own HUD — that is an accepted trade-off of the only overlay mechanism
JSON UI/Script API expose for a "corner box" look. `HudManager.ts` continues to refresh the action bar every
`hudRefreshTicks` (default every 2 game-ticks via the interval, gated per player by the configured refresh rate)
so the corner panel's content stays current without re-triggering any fade.

## Known platform limitations (by design, not a bug)

This add-on intentionally does **not** attempt: true render-only culling (uses despawn+cleanup instead),
custom hotkey registration, auto-update/auto-install, a real terrain-rendered/pixel minimap, or runtime
particle/animation/lighting simplification — none of these are exposed by the current Bedrock Script API.
See the in-game "About / Unsupported Features" panel in the Hydraulic Control Room for the full list.
