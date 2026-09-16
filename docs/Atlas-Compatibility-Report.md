# Atlas Compatibility and Implementation Report

## Scope

This report compares `AmethystAPI/Atlas` at the supplied archive/repository state with this Bedrock Behavior Pack + Resource Pack project. Atlas targets Minecraft Bedrock `1.21.0.3` through the native AmethystAPI C++ modding platform. This project targets the public `@minecraft/server` Script API and JSON UI.

The implementation was also compared with these Bedrock minimap projects:

- `renzonox-ux/XaeroLiteMinimap.mcpack`: a small function/waypoint pack whose repository contains
	command-oriented assets rather than a reusable renderer.
- `Silvaxxxuuuu/minecraft-bedrock-minimap`: a TypeScript starter-style project that generates static
	textures and glyph sheets and deploys through Microsoft starter tooling.
- `Halo333X/Simple-Minimap-MCBE`: a native client HUD module that loads PNG textures, writes local files,
	and draws through client graphics APIs.

These repositories were used for behavior and compatibility research only. No source code, textures, glyph
sheets, or generated assets were copied into this project.

## Additional linked-project review

| Project | Useful finding | Compatibility decision |
|---|---|---|
| `mods-pemc/Mods-pemc` | Local browser IndexedDB import, manifest metadata extraction, pack-icon discovery, and explicit no-backend publication boundary | Not imported. This add-on has no filesystem, browser storage, upload, download, or public content-hosting boundary |
| `YusufOruu/OruuCreations` | Content catalog concept for Bedrock skins, maps, packs, and add-ons | Documentation reference only; no marketplace assets or remote catalog were added |
| `RacherMaykii/Block-Workbench` | Safe-save workflow, snapshots, bounded caches, structured operation logs, and explicit backup requirements | Applied to report/release policy. LevelDB, NBT, save editing, and desktop filesystem operations are outside a behavior pack |
| `Flammbu/MCVault` | Cross-edition content discovery hub | Not imported; no network catalog or external content trust model is present in this pack |
| `Jom-er/Bedrock-Nexus` | Static resource hub and download-oriented organization | Not imported; distribution remains the existing local `.mcpack`/`.mcaddon` packaging workflow |
| `8Crafter-Studios/Ore-UI-Types` | Large native Ore UI command/facet surface and version-sensitive typed references | Rejected for runtime use. Ore UI internals, native commands, and undocumented facets are not public Script API contracts |
| `TheNINJALLO/endstone-remote-workstations` | Capability catalogs, protected inventory menus, real source containers, permissions, and release scope matrices | Implemented only where public API permits: existing machine inspection, container quick transfer, operator gates, and recipe workbench; native Endstone screens are not portable |
| `xRookieFight/jsonforge` | Typed element schemas, hierarchy, property validation, undo/redo, and export boundaries | Applied as architecture guidance to typed form validation and bounded pagination; no editor or Electron runtime was added |
| `smell-of-curry/mcbe-ts-ui` | TypeScript JSON UI builders, namespaced controls, bindings, generated UI definitions, and safe organization | Existing JSON UI remains hand-authored and intentionally minimal; the shared HUD/actionbar contract does not require a new generator dependency |
| `subwaystudio-s/Server-Properties-Editor-For-Calagopus` | GUI editing of server properties with restart-required changes | Not portable: this pack cannot access host files or server properties. Operator world settings remain dynamic-property based |
| `XxVoidicxX/mcbe-ui-codex` | Verified texture/API references and warnings against invented or deprecated UI calls | Applied as a research constraint; only declared `@minecraft/server`, `@minecraft/server-ui`, and existing JSON UI surfaces are used |
| `wisp-ts/forms-plus` | Validation, builders, bounded `UserBusy` retry, structured cancellation, and predictable form lifecycle | Implemented locally in `src/ui/FormRuntime.ts` and `src/ui/FormValidation.ts`, integrated with Control Room and Inventory/Recipes |

## Newly implemented UI/workbench behavior

- `FormRuntime.ts` retries transient busy forms at most three times with bounded tick delays and logs terminal failures.
- `FormValidation.ts` rejects canceled, short, negative, and non-integer responses before workflow actions run.
- Control Room and Inventory/Recipes use the shared form runtime instead of direct unguarded display calls.
- Recipe browsing now supports categories and twelve-item pages, preventing oversized modded registries from overflowing action forms.
- `RecipeRegistry.resetRecipesToDefault()` preserves the exported `RECIPES` alias identity, preventing stale menus after companion recipe resets.
- Recipe search input is trimmed and bounded before querying the registry; craft quantities are clamped to the supported slider range.

## Explicit non-claims

This add-on does not provide native workstation packet screens, Ender Chest remoting, LevelDB/NBT world editing,
browser content uploads, marketplace synchronization, Ore UI command invocation, host `server.properties` editing,
or a remote content download service. Those capabilities require a native client/server plugin, desktop host
application, or network backend with separate permissions, version qualification, and licensing.

## Atlas source disposition

| Atlas surface | Purpose | Add-on disposition |
|---|---|---|
| `src/minimap/Minimap.cpp` | Native minimap lifecycle, texture loading, clipping, mesh rendering, player marker, dimension reset | Behavior preserved where Script API permits; native renderer cannot be ported |
| `src/minimap/Minimap.hpp` | `LevelListener`, chunk mesh cache, deferred chunk work, render settings | Converted to a bounded runtime terrain cache; no native listener or mesh type exists |
| `GetColor` and `countBlockNeighbors` | Top-block lookup, map-color lookup, height shading | Replaced with deterministic type-id terrain glyph classification; map-color API is unavailable |
| `TessellateChunkMesh` | 16x16 sampling and greedy quad meshing | Not applicable to forms/actionbar; sampling is represented as a fixed text grid |
| `Render` | UI clipping, camera transforms, mesh/material rendering, border and player icon | Not available through `@minecraft/server`; existing JSON UI actionbar remains the supported HUD surface |
| `onBlockChanged`, `onChunkLoaded`, `onSubChunkLoaded`, `onChunkUnloaded` | Cache invalidation and deferred rebuild | Block break/place events invalidate the Script API terrain cache |
| `mRenderDistance`, `mMaxChunksToGeneratePerFrame` | Work and memory bounds | Replaced with a 9x9 grid, 4-block sampling cells, and a 100-tick TTL cache |
| README `+`/`-` controls | Runtime zoom | No custom keyboard hook exists; existing player radius setting remains the supported control |
| `data/packs/RP/textures/ui/*` | Native minimap border and position icon | Not copied; these assets have no usable rendering surface in the Script API |
| `data/packs/RP/textures/*_texture.ts` | Native resource-pack texture metadata | Not required by the text-grid implementation |
| `xmake.lua`, `mod.json`, `src/dllmain.*` | Amethyst native module build/bootstrap | Incompatible with the add-on build and intentionally not imported |

## Implemented behavior

- `TerrainMap.ts` provides pure terrain glyph classification, fixed-grid formatting, center-marker rendering, and cache-key normalization.
- `TerrainSampler.ts` samples the highest non-air block through `Dimension.getBlock`, enforces bounded odd grid sizes and cell sizes, catches unloaded/unsupported access at the caller boundary, and caches snapped terrain regions for 100 ticks.
- `MinimapHud.ts` renders a real 5x5 sampled terrain grid in the persistent HUD instead of a deterministic preview pattern; the Field Map retains the larger 9x9 grid.
- `MinimapForms.ts` adds the terrain grid to the existing Field Map while retaining waypoint bearings and actions.
- `main.ts` invalidates cached terrain after player block-break and block-place events.
- `TerrainMap.test.ts` covers water/lava/vegetation/solid/air classification, centered rendering, and cache-key snapping.

## Compatibility result

The implementation is complete for the public Script API surface: it adds the strongest truthful Atlas-derived terrain feature available in this project without native hooks, copied code, or unsupported claims. It is not a native pixel minimap and cannot reproduce Atlas's map colors, greedy mesh renderer, arbitrary zoom keys, camera clipping, or chunk listener fidelity from a behavior pack alone.

## Upstream Feature Matrix

| Upstream capability | Public Script API equivalent | Result |
|---|---|---|
| Waypoint creation and named markers | Dynamic properties, forms, radar bearings | Implemented locally with dimension-aware waypoints and companion markers |
| Static minimap texture/glyph sheet | Resource-pack JSON UI only; no live texture-pixel API | Not imported; live terrain uses colored text glyphs |
| Native client HUD drawing | `setActionBar` plus JSON UI re-anchoring | Implemented as the supported persistent corner HUD |
| Local file position exchange | No pack file-system API | Rejected as unsupported for a distributable add-on |
| World terrain sampling | `Dimension.getBlock` | Implemented with bounded 5x5 HUD and 9x9 Field Map grids |
| Arbitrary keyboard zoom and drag positioning | No custom input hook | Replaced by radius settings and fixed JSON UI placement |

## Security and Performance Review

- Terrain sampling accepts no paths, commands, network data, or user-controlled dimensions. Grid width and cell
	size are clamped before any world reads.
- Companion marker JSON is parsed defensively; invalid, disabled, non-finite, and out-of-range entries are
	discarded before HUD rendering.
- Sampling remains bounded and cached for 100 ticks. Block break/place events clear the cache to avoid stale
	maps. The HUD uses a 5x5 grid to keep recurring actionbar work below the Field Map's on-demand 9x9 grid.
- No native code, secrets, external executable, copied third-party asset, or new runtime dependency was introduced.

## Verification

- `npm run typecheck`: passed.
- `npm test`: passed for the complete test suite.
- `npm run build`: passed.
- `npm run package`: passed.
- Physical Minecraft client rendering and device-matrix verification require a Bedrock runtime and are not executable in this workspace.

## Security and performance notes

The sampler performs bounded reads only when the Field Map is opened, never accepts user-provided paths or commands, and isolates runtime block-read failures. The cache key is dimension-scoped and position-snapped; block changes clear the cache to prevent stale terrain display. The implementation does not introduce network access, native code, secrets, or new dependencies.

## HUD reference compatibility report

### BedrockTools archive

The archive is a LeviLamina/native C++ client project. Its useful HUD surfaces are coordinates, compass,
armor, arrows, potions, ping, speed, reach, world time, and keystrokes. Its implementation depends on
native client classes, UI offsets, renderer hooks, and keyboard/input state, so its source cannot be
linked into a Behavior Pack. The portable feature selected here is coordinate display: `CoordinatesMath.ts`
provides deterministic formatting, while `CoordinatesHud.ts` reads only documented player location and
dimension APIs. No BedrockTools source or assets were copied.

### Bedrock Wiki JSON UI guidance

The Wiki's `root_panel` `modifications` and namespaced-control pattern is now used by every resource
pack variant. `phlodgate_hud_badge` is inserted with `insert_front`, is gated by `$actionbar_text`, and
the existing actionbar control is offset below it. This is a layout enhancement only; Script API still
has no arbitrary per-player JSON UI variable channel, so live HUD values remain one composed actionbar string.

### bedrock-core/ui

`@bedrock-core/ui` is MIT licensed and provides a JSX runtime, serialization protocol, hooks, forms,
navigation, and a required decoder/render pack. It is beta software with breaking changes before 1.0.
It was evaluated but not added as a dependency because this add-on already has stable native forms, its
HUD surface is JSON UI/actionbar rather than a custom decoder runtime, and importing the package would
require shipping and version-locking an additional render pack. No bedrock-core code or assets were copied.

### Additional verification

- `npm test`: complete suite passed.
- `npm run typecheck`: passed.
- All pack and manifest JSON files parsed successfully.
