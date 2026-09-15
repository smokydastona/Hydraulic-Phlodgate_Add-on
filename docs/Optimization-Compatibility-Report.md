# Optimization Compatibility and Implementation Report

## Scope

This report evaluates `Furzide/MCBE-Tweaks`, `JaylyDev/ScriptAPI`, and `LiteLDev/LeviOptimize` against the Phlodgate Behavior Pack + Resource Pack runtime.

## Source disposition

| Source | Useful material | Compatibility and implementation decision |
|---|---|---|
| `Furzide/MCBE-Tweaks` | Operator guidance for V-Sync, fullscreen, paper doll, animations, render distance, antialiasing, RTX settings, and clean HUD packs | Documentation-only reference. These are client settings or external renderer changes, not Script API features. No external executable, shader, options file, or third-party asset was imported. |
| `JaylyDev/ScriptAPI` | Stable-branch Script API examples, module boundaries, ESBuild bundling guidance, and runtime warnings for BDS-only modules | API/process reference. The add-on keeps its existing ESBuild pipeline and uses only declared `@minecraft/server` and `@minecraft/server-ui` modules. No sample source was copied. |
| `LiteLDev/LeviOptimize` | Bounded server work, timing awareness, entity-push safeguards, chunk-leak awareness, and explicit configuration | Native LeviLamina GPL-3.0-or-later C++ implementation. It cannot be linked or copied into this add-on. Its portable performance principle was implemented independently in the item merge planner and distance math. |

## Implemented behavior

- `ItemMergePlan.ts` uses dimensionless spatial buckets and neighboring-cell checks instead of the previous quadratic all-pairs scan.
- The planner is pure and deterministic, caps output without consuming a stack that would overflow the cap, and returns explicit merge groups for the runtime adapter.
- `ItemMerge.ts` adapts those groups to real item entities while preserving the existing profile radius, stack cap, audit settings, and safe exception handling.
- `OptimizationEngine.ts` compares squared nearest-player distances and performs one square root only after selecting the minimum.
- Existing protection rules remain authoritative: players, named entities, pets, bosses, armor stands, villagers/traders, modded entities, active-combat entities, valuable items, and recent drops remain protected according to settings.

## Security and safety review

- No native code, memory offsets, command execution, network access, secrets, or new dependencies were introduced.
- The planner consumes bounded in-memory snapshots and has no file/path input.
- A merge group removes entities only after a complete capped group is planned; candidate stacks too large for the remaining cap are left untouched.
- Runtime removal/spawn operations remain inside the existing exception boundary and continue logging failures.
- LeviOptimize's GPL source was not copied or linked; JaylyDev's MIT repository was used as documentation/reference only.

## Verification gates

- Focused spatial merge tests pass.
- Full Vitest suite, TypeScript typecheck, build, packaging, JSON validation, and dependency audit must pass before release.
- Physical BDS/client load testing is required to measure real TPS and item-entity behavior; source-level tests cannot prove engine-level performance improvements.

## Explicit non-claims

This add-on does not implement LeviLamina hooks, native entity-push interception, BDS ECS timing instrumentation, chunk unload internals, GPU driver settings, V-Sync control, renderer shader replacement, or client options-file mutation. Those require native/server installation boundaries outside a standard behavior pack.
