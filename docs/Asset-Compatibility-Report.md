# Menu and Pixel Asset Compatibility Report

## Scope

This report evaluates the linked menu, asset-library, pixel-generation, and game-project repositories against
the Phlodgate Bedrock Behavior Pack + Resource Pack runtime.

Research snapshot: 2026-09-15. Repository READMEs, top-level licenses, and current project boundaries were
reviewed for all linked sources. The findings below separate reusable engineering patterns from code/assets
that cannot be redistributed or executed inside a public Bedrock behavior/resource pack.

## Source findings

| Source | Portable pattern | Release decision |
|---|---|---|
| `ISBP/BetterBedrockMenus` | Named menus, explicit actions, permission-gated routes, and mobile-friendly built-in forms | Implemented locally as `src/ui/MenuCatalog.ts`; Java/Paper, Geyser, Floodgate, PlaceholderAPI, and Skript integrations are not part of this pack |
| `Langtanium/Bedrock-Java-ChibiArtAssets` | Separate source assets from derived assets and preserve source/asset provenance | No textures copied; vanilla texture IDs remain the only shipped UI icon dependency |
| `lpsmods/assets-plus` | Stable resource-pack asset contracts and explicit behavior-pack dependency/versioning | Applied as documentation discipline; no external pack dependency was added, preventing UUID/version conflicts |
| `iffahaafreen/MiniX` | Pixel-art UI/game asset organization and explicit creator credits | Godot project assets are not compatible with Bedrock JSON UI and were not imported |
| `424431185/pixel-asset-master-skills` | Locked style specs, deterministic generation, manifests, palette/format validation, and export boundaries | Applied to the release process and documentation; no generated or unlicensed art was copied |
| `Huu-Yuu/PixelSRPG-Forge` | Category organization, sprite-sheet packing, and license provenance warnings | Not imported because its README warns that individual assets may have separate or unknown rights |
| `youtuan6688-sys/ClawLibrary` | Manifest-driven asset rooms, replaceable art layer, locale/theme separation, and local-only configuration | Applied conceptually to the catalog boundary; browser telemetry and pixel scene assets are outside a Bedrock pack |
| `MozeeB/pixel-asset-gen` | Seeded procedural assets, nearest-neighbor scaling, metadata, atlases, and quality profiles | No runtime generator dependency added; the add-on has no Python/Pillow build requirement and no need for a texture atlas |

## Implemented behavior

- `MenuCatalog.ts` defines stable route IDs, user-facing labels, descriptions, operator-only metadata, and a
  bounded action-form budget.
- `validateMenuCatalog()` detects empty IDs/text, duplicate route IDs, empty catalogs, and oversized menus.
- `visibleMenuEntries()` removes operator-only routes before the form is constructed, preventing unauthorized
  routes from being reachable through selection-index manipulation.
- `HydraulicControlRoom.ts` uses the catalog for descriptions, button construction, and action dispatch.
- `MenuCatalog.test.ts` covers catalog validity, permission filtering, and malformed/duplicate entries.

## Asset boundary

The pack ships exactly one third-party art set: the 14 minimap icons vendored from
[`tstamborski/pixelart-icons`](https://github.com/tstamborski/pixelart-icons) under **CC0-1.0** (public domain
dedication, single author, single license, attribution not required). They are pinned to upstream commit
`5e3810b968e6f0c8507a78807e32ade7e9db2372`, recorded with a per-file source path and SHA-256 in
`assets/minimap-icon-provenance.json`, and re-verified on every `validate:release` run — a byte of drift in any
resource-pack variant fails the release. `scripts/vendor-minimap-icons.mjs` re-syncs them offline from the
committed copies; only an explicit `--download` run touches the network.

Textures from the other linked projects were still not copied, because those repositories contain extracted game
assets, credited external packs, or explicit mixed-license warnings. Minimap frames remain locally generated,
existing item icons use the validator-resolved vanilla resource-pack texture identifier (`map_filled`), and the
HUD uses JSON UI labels and formatting codes. This keeps the pack compatible with the public Bedrock runtime and
avoids hidden asset licenses, oversized atlases, texture override collisions, and unnecessary pack dependencies.

## Security and performance

- Menu entries are static code data; no user-provided route names, file paths, URLs, commands, or dynamic code are executed.
- Operator filtering happens before form display and again at the destination's existing permission boundary.
- The catalog is bounded to 12 entries, below practical action-form limits, and adds no per-tick work.
- No network access, browser storage, external process, native renderer, generated binary, or new runtime dependency was introduced.

## Verification boundary

Automated tests can verify catalog structure, routing metadata, and permission filtering. Physical Bedrock testing
is still required to qualify touch/controller selection, localized text layout, and visual appearance on target
client versions. The repository does not claim compatibility with Java/Paper plugin APIs, Ore UI internals,
Godot runtime APIs, or external pixel-asset generation tools.

## Release verification

The portable provenance and boundary decisions are backed by `npm run validate:release`, which parses every
pack JSON file, verifies manifest/module UUID uniqueness and version tuples, checks the Behavior Pack's balanced
Resource Pack dependency, validates every `_ui_defs.json` file reference, and requires the compiled script entry
point. `npm run package` invokes this gate before writing any archive. No linked repository is installed as a
runtime dependency and no extracted, mixed-license, or externally hosted art is shipped.