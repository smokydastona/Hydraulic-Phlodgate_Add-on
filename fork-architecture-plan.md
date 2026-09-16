# Add-on Fork Architecture Plan

## Decision

Phlodgate keeps a public Bedrock Behavior Pack + Resource Pack architecture. The linked projects are reference
inputs, not code or asset dependencies:

- `renzonox-ux/XaeroLiteMinimap.mcpack` contributes the waypoint-oriented user workflow.
- `Silvaxxxuuuu/minecraft-bedrock-minimap` confirms the TypeScript build/deploy shape and demonstrates static
  texture and font-sheet generation, which cannot carry live world state inside this pack.
- `Halo333X/Simple-Minimap-MCBE` demonstrates the visual result possible with native client graphics and file
  I/O; those APIs are outside `@minecraft/server` and are intentionally not a dependency.
- `wisp-ts/forms-plus` supplies the validation/retry lifecycle now represented by local `FormRuntime` and
  `FormValidation` modules.
- `TheNINJALLO/endstone-remote-workstations` supplies the capability/permission model now reflected by the
  existing operator gates, machine inspector, quick transfer, and recipe workbench.
- `jsonforge`, `mcbe-ts-ui`, `mcbe-ui-codex`, and `Ore-UI-Types` inform UI schema and version discipline without
  introducing undocumented Ore UI commands or a second UI runtime.
- `LeGend077/json-ui-examples`, `GoldRush-developpement/EasyUIBuilder`, and `depressed-pho/bedrock-ui-tweaks`
  confirm the documented `"modifications"` array (`array_name`/`operation`/`value`) is real and safe for
  appending or relocating vanilla `pause_screen.json`/`inventory_screen.json` controls. None of them, nor
  `mojang/bedrock-samples`, expose a way for a JSON UI button press to invoke `@minecraft/server` script code:
  the Script API has no event for an arbitrary custom UI button click. A button injected into those vanilla
  screens can therefore only be wired to an **existing** vanilla button ID (e.g. `button.menu_settings`), never
  to this add-on's mass-craft, quick-transfer, inspector, or optimization logic. The add-on ships one small,
  genuinely functional shortcut button of that kind (a `pause_screen.json` top-right button that reuses the
  real `button.menu_settings` action and the real `menu.settings` label) and otherwise keeps its actual feature
  surface behind the Hydraulic Control Room and Field Map items, which are real server-initiated
  `ActionFormData`/`ModalFormData` forms rather than vanilla-screen button hacks.
- `Block-Workbench`, `Mods-pemc`, `MCVault`, `Bedrock-Nexus`, `OruuCreations`, and the Calagopus editor establish
  desktop/network/file-system product boundaries that are explicitly excluded from this behavior-pack runtime.
- `BetterBedrockMenus`, `Bedrock-Java-ChibiArtAssets`, `assets-plus`, `MiniX`, `pixel-asset-master-skills`,
  `PixelSRPG-Forge`, `ClawLibrary`, and `pixel-asset-gen` establish the menu/catalog, provenance, and
  deterministic-asset boundaries recorded in `docs/Asset-Compatibility-Report.md`.

## Companion pet research findings

Eight repositories were reviewed as reference input for the bound companion pet feature (a per-player pet that
sits/stays like a vanilla tamed mob and shift-click opens the Hydraulic Control Room):

| Repository | Platform | Applicability |
|---|---|---|
| `Shynixn/PetBlocks` | Bukkit/Paper Java plugin | Not portable: entirely different server platform/API (Bukkit `Entity`/`NBT`/packet layer), no Bedrock Script API equivalent. Reviewed only for the general "per-player bound pet + GUI" concept, which this feature reimplements natively. |
| `TaqdeesHigh/Pets` | Bukkit/Paper Java plugin | Same as above — Java server plugin, not applicable to a Bedrock Behavior Pack. |
| `fish2lab/tlm-codex-pet` | Bukkit/Paper Java plugin | Same as above. |
| `billeyzambie/PracticalPets` | Bukkit/Paper Java plugin | Same as above. |
| `Nocsy-Workshop/mcpets` | Bukkit/Paper Java plugin | Same as above. |
| `CuteMobModels-Team/CuteMobModels-BE` | Bedrock resource pack (fan mob models) | Right platform, but its models/textures are original third-party art assets with their own license terms; not vendored. Confirms custom Bedrock entities are the correct mechanism, which this feature already uses. |
| `kirbycope/Minecraft-Earth-Mobs-Bedrock` | Bedrock resource pack (fan recreation) | Recreates character designs from Mojang's Minecraft Earth; provenance/license of the derived designs is not clear enough to vendor. Not used. |
| `kirbycope/Minecraft-Legends-Mobs-Bedrock` | Bedrock resource pack (fan recreation) | Recreates character designs from Mojang's Minecraft Legends; same provenance concern as above. Not used. |

**None of the five Java plugins are portable in any form**: Bukkit/Paper's `org.bukkit.entity.Entity`,
NBT access, and packet APIs have no counterpart in `@minecraft/server`, and the runtime (a Java server JVM
process) is a different product entirely from a Bedrock Behavior Pack. Their *concepts* (bind a tamed mob to a
player, invulnerable, right-click opens a menu) are exactly what this feature implements, just built from
scratch against the real Bedrock APIs verified in `node_modules/@minecraft/server/index.d.ts` for this project's
pinned `@minecraft/server@2.9.0`.

**The three Bedrock-specific repositories** confirmed custom entity definitions are the right mechanism, but
their actual model/texture assets were not used: fan-made recreations of Mojang's Minecraft Earth/Legends
character designs carry unclear redistribution rights for those specific derived designs, and this project's
asset policy (`docs/Asset-Compatibility-Report.md`) already excludes extracted/mixed-license art. Instead, the
shipped companion entities (`phlodgate:companion_wolf/cat/fox`) reference the **existing vanilla**
wolf/cat/fox geometry, textures, and animation/render controllers by identifier only — the same technique
`mojang/bedrock-samples` itself uses — which needs no new art assets and carries no licensing ambiguity.

**Implementation delivered**: custom, fully neutral, invulnerable, owner-bound companion entities for eleven
species — Wolf, Cat, Fox, Snow Fox, Creaking, Rabbit, Cave Spider, and Copper Golem (walking, native
`minecraft:tameable`/`minecraft:sittable` sit/stand toggle), plus Spider, Sniffer, and Ravager (rideable via
`minecraft:rideable` + `minecraft:behavior.controlled_by_player`, no saddle/item requirement); a first-spawn
species-choice form; shift-click routing to `openHydraulicControlRoom()`; layered invulnerability
(`minecraft:damage_sensor` + `minecraft:fire_immune` + a script-side `entityHurt` cancellation); and an
`entityDie` respawn safety net. The Creaking and Copper Golem entities additionally declare the same
client-synced entity properties (`minecraft:creaking_state`, `minecraft:oxidation_level`, etc.) their reused
vanilla render controllers read, pinned to fixed neutral/unoxidized defaults, since none of those two mobs'
original hostile/statue/chest-transport logic is included. See the README's "Bound companion pet" section for
the full behavior breakdown and `src/features/companion/CompanionPetPlan.ts`/`CompanionPetRuntime.ts` for the
implementation.

## Current architecture

1. `MinimapMath.ts` owns deterministic radar bearings, cardinal rotation, nearest-marker ordering, and radius filtering.
2. `TerrainMap.ts` owns type-id classification, colored text glyphs, safe companion-vector parsing, and pure grid formatting.
3. `TerrainSampler.ts` owns bounded `Dimension.getBlock` sampling and a dimension/position/scale/width cache.
4. `MinimapHud.ts` composes real 5x5 terrain, radar markers, and nearest destinations into the shared HUD actionbar.
5. `MinimapForms.ts` provides the on-demand 9x9 Field Map and waypoint actions.
6. `HudManager.ts` remains the single actionbar writer, preventing minimap, food, durability, coordinate, and compass features from overwriting each other.
7. `FormRuntime.ts` owns bounded busy-form retry and terminal error logging; `FormValidation.ts` owns pure response validation.
8. `RecipeRegistry.ts` owns the stable recipe catalog; `RecipeForms.ts` provides category navigation, bounded pages, search, and mass-craft entry points.
9. `MenuCatalog.ts` owns Control Room route metadata, operator visibility, validation, and action-form bounds.
10. `CompanionPetPlan.ts` owns the companion species catalog, interaction-decision logic, and spawn-placement
    math (pure/unit-tested); `CompanionPetRuntime.ts` wires it to spawning, taming, interaction routing,
    damage cancellation, and the death-safety-net respawn.

## Fork boundaries

The fork must not add native DLL hooks, client file writes, external processes, network transport, browser storage,
LevelDB/NBT editing, host `server.properties` access, undocumented Ore UI commands, or copied third-party
renderer/assets. Those require separate products with their own distribution, permissions, and licensing models.

The add-on may extend the current implementation with additional pure block classifications, companion marker
contracts, or bounded sampling policies. Any new runtime surface must remain dimension-scoped, cache-bounded,
exception-safe, and covered by unit tests.

Asset additions must have explicit provenance, a compatible redistribution license, a bounded texture size, and
a validation path. Extracted or mixed-license art is not accepted into the shipped resource packs.

## Release gates

- `npm test` passes all pure logic tests.
- `npm run typecheck` passes against the declared Minecraft API versions.
- `npm run build` produces `BP/scripts/main.js` without bundling runtime modules.
- `npm run validate:release` parses every pack JSON file, verifies manifest/module UUID uniqueness and
  versions, checks the balanced resource-pack dependency, validates UI definition references, and requires
  the compiled script entry point.
- `npm run package` produces the Behavior Pack, Resource Pack, and add-on archives.
- Every JSON pack file parses successfully and manifests retain unique UUIDs.
- Forms reject malformed responses and retry transient busy states within bounded limits.
- Recipe catalogs remain usable with companion registrations through category navigation and pagination.
- A physical Bedrock client test confirms HUD placement, terrain refresh after block edits, waypoint markers,
  Field Map opening, and all three resource-pack variants.

The automated release gates are implemented by `scripts/release-validation.mjs` and run both directly and
before packaging. Physical client/device validation remains a separate release activity because this workspace
does not contain a Bedrock client or BDS runtime.

## Known runtime boundary

The shipped add-on is a truthful Script API enhancement suite: sampled terrain/radar HUD, validated forms,
operator-gated settings, machine/container inspection, quick transfer, and a paginated recipe workbench. It is
not a native camera-rendered Xaero/Atlas clone, a native workstation plugin, a save editor, or a content hub.
The public Script API does not expose world render textures, arbitrary screen widgets, player input hooks, or
filesystem access. The implementation therefore prioritizes correct live data, bounded cost, and graceful
unavailability over an unsupported visual claim.
