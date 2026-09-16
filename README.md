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
npm run build      # regenerates pet textures and compiles src/ -> BP/scripts/main.js
npm run typecheck   # tsc --noEmit against the real @minecraft/server types
npm test            # unit tests for all pure/testable logic
npm run validate:release # validates pack JSON, UUIDs, UI references, and build output
npm run package      # build + zip BP/RP/presets into dist/*.mcpack and *.mcaddon
```

## Install (manual, for testing)

1. Run `npm run package`.
2. Copy `dist/Phlodgate_Add-on_v<version>.mcaddon` to a device with Minecraft Bedrock installed and open it,
   **or** import `dist/Phlodgate_BP_v<version>.mcpack` and `dist/Phlodgate_RP_v<version>.mcpack` separately.
3. In your world's settings, enable both the "Phlodgate Add-On" Behavior Pack and Resource Pack.
4. Use Minecraft Bedrock 1.26.0 or newer. The manifests require the stable `@minecraft/server` 2.9.0 and
  `@minecraft/server-ui` 2.1.0 modules used by the companion and HUD runtime.
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

## Menu and asset compatibility

The Control Room uses a validated catalog of named routes with descriptions and operator-only filtering. This
borrows the portable workflow from BetterBedrockMenus while staying inside Bedrock's native forms and the
existing permission model. The add-on intentionally ships no third-party pixel-art textures: linked asset
repositories contain extracted game art, external credits, or mixed licensing. Existing custom items use
vanilla texture identifiers, and the compatibility decisions are recorded in
`docs/Asset-Compatibility-Report.md`.

### UI and workbench reliability

The high-traffic Control Room and Inventory/Recipes workflows use a local validated form runtime. It handles
transient Bedrock `UserBusy` display failures with bounded retries, normalizes cancellation, rejects malformed
selections/modal values, trims search input, and keeps recipe catalogs usable through category navigation and
12-item pagination. The recipe registry preserves its exported catalog alias when companion recipes are reset.
The remaining specialized forms retain their existing local error boundaries and are documented in the
compatibility report.

Release packaging runs the same structural validation before creating archives. It parses every pack JSON
file, checks manifest and module UUID uniqueness, verifies three-part versions, confirms the Behavior Pack
depends on the balanced Resource Pack, validates `_ui_defs.json` references, and requires the compiled script
entry point. This catches malformed or incomplete distributions before they reach a device.

## Minimap / Field Map

Bedrock's Script API does not expose a world-render or map-texture surface, so a pixel/terrain minimap
(like the Java-side Xaero's/JourneyMap-style CurseForge add-ons) cannot be built purely with `@minecraft/server`.
Instead, this add-on ships a **Script API Minimap HUD**:

- A rotating text radar strip (`features/minimap/MinimapHud.ts`) showing the four cardinal directions and
  nearby waypoints as glyphs, positioned by bearing relative to your current facing, plus a distance-sorted
  list of the nearest waypoints.
- A live sampled 5x5 terrain grid in the persistent HUD, using colored glyphs for surface block classes and a
  centered player marker.
- A **Phlodgate Field Map** item (given on spawn) that opens a full-screen form with the same radar, the
  10 nearest waypoints with bearing arrows and distances, an Atlas-inspired sampled terrain grid, a
  one-tap "add waypoint here", a minimap HUD on/off toggle, and a shortcut into the full Waypoint Manager.
- Configurable via Player Settings: minimap HUD on/off and radar radius (32–256 blocks).

The terrain grids are bounded Script API implementations: the HUD samples a 5x5 grid and the Field Map
samples a 9x9 grid, each finding the highest non-air block, classifying common surfaces into stable colors,
caching regions briefly, and invalidating them after block edits. They do not reproduce Atlas's native C++
pixel renderer, map-color lookup, mesh rendering, camera clipping, or keyboard zoom hooks; see
`docs/Atlas-Compatibility-Report.md` and `fork-architecture-plan.md` for the complete compatibility analysis.

## Bound companion pet (Control Room access point)

On a player's first spawn, movement is locked and a required two-stage form presents **40 choices**: special
companions and the complete supported passive/breedable baby-animal set. The special list includes Wolf, Cat,
Fox, Snow Fox, Creaking, Rabbit, Cave Spider, Copper Golem, Zoglin, Axolotl, and a zombification-immune Baby
Piglin. Spider, Sniffer, and Ravager are rideable without a saddle. The baby-animal category includes
Armadillo, Axolotl, Bee, Camel, Cat, Chicken, Cow, Donkey, Fox, Goat, Hoglin, Horse, Llama, Mooshroom, Mule,
Ocelot, Panda, Pig, Polar Bear, Rabbit, Sheep, Sniffer, Strider, Turtle, Wolf, and Tadpole. Closing either form
reopens it; movement is restored and the choice is persisted only after the selected entity actually spawns.

- **Invulnerable**: a custom entity `minecraft:damage_sensor` rule (`cause: "all"`, `deals_damage: "no"`) plus
  `minecraft:fire_immune` block essentially all damage at the entity-definition level, and
  `world.beforeEvents.entityHurt` additionally cancels any hurt event targeting it as a script-side backstop.
- **Completely neutral**: it has no attack, target-acquisition, or owner-defense behaviors of any kind — only
  following (and, for the rideable species, being steered) and looking at the player, so it can never become
  hostile. This applies even to species that are hostile mobs in vanilla (Creaking, Ravager) or that natively
  aren't tameable at all (Fox, Snow Fox, Rabbit, Spider, Cave Spider, Sniffer, Copper Golem) — the custom
  entity definition simply never includes any attack/target-acquisition components.
- **Bound to the player**: `minecraft:tameable` invokes a real tame event which adds `minecraft:is_tamed` only
  after `tame(player)` assigns ownership. The entity and selected species IDs are persisted on the player, and
  only that owner can interact with it
  (`world.beforeEvents.playerInteractWithEntity` cancels the interaction for anyone else, including mounting a
  rideable one).
- **Sits/stays exactly like a vanilla dog/cat, or rides like a saddle-free mount**: the eight walking species
  keep the real `minecraft:tameable` + `minecraft:sittable` + `minecraft:behavior.stay_while_sitting`
  components, so a plain click toggles sit/stand through the same native engine interaction vanilla tamed mobs
  use. The three rideable species (Spider, Sniffer, Ravager) instead carry `minecraft:rideable` +
  `minecraft:behavior.controlled_by_player` with no saddle/item requirement of any kind — exactly like a boat
  or minecart, a plain click mounts and the owner steers it directly. Nothing here is reimplemented or faked;
  every interaction is the engine's own native tamed-mob or rideable-mob behavior.
- **Opens the Hydraulic Control Room on shift+click**: the owner's sneak-click is detected and cancels the
  default interaction (so it doesn't also toggle sit/mount) before calling the same `openHydraulicControlRoom()`
  used by the Control Room Remote item.
- **Immortal in practice**: even if something removes it outside of normal damage (e.g. an operator command),
  `world.afterEvents.entityDie` respawns an identical companion near its owner a couple seconds later.

Each species (`BP/entities/companion_*.json`) is a **custom** Phlodgate entity, not an overridden
vanilla mob — overriding e.g. `minecraft:wolf` or `minecraft:ravager` directly would also change every wild
instance of that mob in the world. Its client-side model and animations (`RP*/entity/companion_*.json`) reuse
the corresponding vanilla geometry/animation identifiers. Every species instead uses its own deterministic,
original hydraulic-circuit texture under `textures/entity/phlodgate/`, generated by
`scripts/generate-pet-textures.mjs` at build time and validated for presence, reference integrity, and uniqueness
across all three resource packs. For the two newest mobs (Creaking, Copper
Golem), the custom entity also declares the same client-synced properties the reused vanilla render
controllers read (`minecraft:creaking_state`, `minecraft:oxidation_level`, etc.) with fixed, always-neutral
default values, so those reused visuals resolve correctly without needing any of the vanilla mobs' oxidation,
statue, or chest-transport logic.

See the "Companion pet research findings" section of `fork-architecture-plan.md` for the full compatibility
report against the eight external repositories reviewed for this feature.

## Pause menu quick-settings shortcut (JSON UI)

Each resource pack variant also ships a `ui/pause_screen.json` override that appends one small, self-contained
top-right shortcut button to the vanilla pause menu, using the documented JSON UI `"modifications"` array
(`array_name: "controls"`, `operation: "insert_back"`) to append rather than replace vanilla content. The
button reuses the real vanilla `button.menu_settings` action ID and the real vanilla `menu.settings` localized
label, so it opens the actual Settings screen — it does not invent new behavior. Registered via `ui/_ui_defs.json`
(`"ui_defs": ["ui/hud_screen.json", "ui/pause_screen.json"]`) in each pack.

**Why not more (custom action buttons in the Inventory/Pause screens)**: JSON UI's `"modifications"`
mechanism can insert, move, or delete vanilla UI controls, and community tools such as `jsonforge`,
`EasyUIBuilder`, and `json-ui-examples` help author that markup. None of them expose a way for a JSON UI
button press to invoke `@minecraft/server` script code — the Script API has no event for an arbitrary custom
UI button click. A button wired into `inventory_screen.json`/`pause_screen.json` can therefore only trigger an
**existing** vanilla action (as `bedrock-ui-tweaks` demonstrates by relocating/deleting vanilla buttons), never
our mass-craft, quick-transfer, or optimization logic. Shipping a button labeled for one of those features that
silently does nothing (or silently does something else) would violate this project's no-fake-behavior policy,
so the add-on continues to expose those features through the Hydraulic Control Room item and the Field Map item
instead, both of which are genuine server-initiated `ActionFormData`/`ModalFormData` forms.

## HUD overlays (JSON UI)

The HUD now uses two independent public display channels instead of mixing every feature into one box:

- The **compass** uses the title/subtitle channel and is centered in a translucent box directly above the
  vanilla health/armor/hunger row. It always shows rotating cardinal directions and adds active-waypoint
  direction/distance when one is selected.
- The **minimap** alone uses the actionbar channel. It renders a color-coded sampled terrain grid plus nearby
  destination labels in its own translucent box. Player Settings exposes Square/Circle shape and Top left,
  Top right, Bottom left, or Bottom right position presets. Invisible formatting markers select one of four
  JSON UI anchors and are stripped before display; unmarked vanilla/third-party actionbar messages retain a
  bottom-center fallback.
- Custom hunger/saturation/exhaustion text is no longer rendered. Vanilla health, armor, and hunger remain
  untouched. Existing settings are migrated with coordinates and durability overlays disabled by default.

Each resource pack variant ships the same minimal `ui/hud_screen.json` override and registers it through
`ui/_ui_defs.json`. JSON UI is unversioned, so physical client verification remains required after Minecraft UI
updates.

## Known platform limitations (by design, not a bug)

This add-on intentionally does **not** attempt: true render-only culling (uses despawn+cleanup instead),
custom hotkey registration, auto-update/auto-install, a real terrain-rendered/pixel minimap, or runtime
particle/animation/lighting simplification — none of these are exposed by the current Bedrock Script API.
See the in-game "About / Unsupported Features" panel in the Hydraulic Control Room for the full list.

## Optimization implementation boundary

The optimizer uses public Script API entity queries, conservative protection rules, spatially bucketed
item merge planning, and audit mode. The merge planner avoids quadratic item comparisons and never
consumes a complete stack that would overflow the configured cap. MCBE-Tweaks, JaylyDev/ScriptAPI, and
LeviOptimize were reviewed as compatibility references; native LeviLamina hooks, BDS engine patches,
GPU/driver settings, shader replacement, and client options-file mutation are outside a standard add-on.
See `docs/Optimization-Compatibility-Report.md` for the complete source and license disposition.
