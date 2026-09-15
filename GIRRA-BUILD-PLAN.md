# Girra Build Plan

Fork Orca and delete what you rejected. Do not rebuild.

You kept 432 of 535 features, 81%. At that ratio a rebuild re-derives code you already decided to keep, and the 103 rejections are mostly whole directories. The work is subtraction.

The 535 counts real decisions. An earlier draft said 575, which double-counted 37 entries scraped from Orca's docs site and three features listed twice under different names. Removing them changed no decision and no line of code.

Source: Orca `403b62a8d8` (upstream/main, 2026-09-12), v1.4.197, MIT licensed. Selections in `GIRRA-FEATURE-TREE.md`.

## What comes out

226,348 lines across 27 modules. Ordered by inbound coupling, which is what actually sets the difficulty:

| Module | LoC | Inbound refs | Difficulty |
|---|---|---|---|
| `mobile/` | 137,454 | 0 from `src/` | Free |
| `cloud/` | 28,365 | 0 from `src/` | Free |
| `src/main/star-nag` | 817 | 3 | Trivial |
| `src/main/speech` | 2,971 | 10 | Easy |
| `src/main/updater` | 2,465 | 13 | Easy |
| `src/main/orca-profiles` | 4,836 | 27 | Moderate |
| `src/main/crash-reporting` | 4,185 | 39 | Moderate |
| `src/main/telemetry` | 1,030 | 45 | Wide but mechanical |
| Artifacts + skill sharing | 3,467 | Self-contained | Easy |
| 13 minor agent CLIs | 5,525 | 1 choke point | Easy |
| `src/main/codex*` | 35,233 | **125** | Hard |

Mobile and `cloud/` are 73% of the deletion and cost nothing. Codex is 16% and costs the most.

`cloud/` holds Orca's server-side push and relay apps, which serve the mobile companion and Orca cloud. The first survey missed it; the Phase 0 test run found it.

## Phases

### Phase 0. Baseline

Fork to a girra repo. Run `pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm lint` and record the results before changing a line. Every later phase verifies against this baseline, so a red test here must be fixed or documented first.

Done 2026-09-14. The baseline, with its ten known test failures, lives in `handover.md`.

### Phase 1. Mobile and cloud

Remove `mobile/`, `cloud/`, and everything that names them: CI workflows, lint scripts, the gate manifest, and docs. Nothing in `src/` imports either tree, so this is one change and the largest single win.

Leave `src/renderer/src/web` and the pairing code. An earlier draft deleted them as mobile-only, but serve mode serves the web client built from `src/renderer/src/web`, and the runtime RPC layer uses the device registry and end-to-end encryption for every remote client. "Web renderer and pairing" in `handover.md` holds the decision.

Done 2026-09-14: 2,222 files deleted, 380,483 lines removed.

### Phase 2. Cheap strips

Take star-nag, then speech, then updater, in that order. Each is the same loop: delete the directory, fix the named call sites, run typecheck and tests. Ascending coupling means you learn the loop on the 3-reference case, not the 45.

Done 2026-09-14: 245 files deleted, 45,450 lines removed. The updater took remote server updates and the macOS serve update handoff with it, since nothing else used them.

### Phase 3. Instrumented strips

orca-profiles, then crash-reporting, then telemetry. Telemetry has 45 call sites because it is instrumented through the app rather than concentrated. Expect wide, shallow edits. Delete each call site outright; do not leave no-op stubs (decided 2026-09-14).

Keep `src/main/observability`. It writes local logs and traces, phones nothing home, and you kept it.

Split into pull requests, since orca-profiles reaches far wider than its 27 direct references. Phase 3a took everything that talks to Orca cloud: artifacts, skill sharing, the cloud relay, push, mobile pairing, and profiles and accounts, keeping the profile storage layout per ADR 0003. 486 files deleted, 77,388 lines removed. Phase 3b took crash reporting (108 files, 23,966 lines), keeping GPU fallback and renderer crash recovery. Phase 3c took telemetry (135 files, 23,837 lines), with the PostHog dependency, the first-launch banner, the persisted consent and interaction buckets, telemetry-only RPC params, and the hang watchdog that only fed an event. Done 2026-09-15.

### Phase 4. Minor agent CLIs

`src/main/agent-hooks/managed-agent-hook-registry.ts` imports every provider's hook service. Cut the 13 imports there, then delete the directories: amp, antigravity, copilot, cursor, devin, droid, gemini, grok, grok-accounts, kimi, mimo, openclaude, command-code, hermes.

Split into pull requests. Phase 4a took the hook integrations (94 files, 20,455 lines). `remote-managed-hook-installers.ts`, the shared hook listener parsers, the relay retry scheduler and MiMo's PTY env overlay also imported them. `grok-accounts` and `kimi/kimi-runtime-home.ts` are not hook code: they serve Grok and Kimi usage, which Phase 4b removed with the Gemini fetcher, the Antigravity usage mirror and the Grok stats pane (30 files, 6,923 lines). The agents stay launchable pending the roster decision. Done 2026-09-15.

### Phase 5. Codex

Last, when you know the codebase. 125 files reference it, `src/shared` carries Codex-shaped types, and the rate-limit and AI Vault code branch on provider. Budget more time here than for phases 1 to 4 combined.

Measured 2026-09-15: 1,086 production and 1,465 test files mention Codex. `src/main/codex-accounts/runtime-home-service*` is the hub most other Codex code imports. Sub-phases, in order: 5a accounts, managed homes, reset credits, rate-limit probing, usage, CLI lock and per-pane account registry; 5b hooks, trust, config.toml sync and the shell-launch preflight (the tree still ticks the preflight); 5c session backfill, migration, index heal and state-DB recovery; 5d app-server runtime, structured sessions, rewind, subagents, native chat and AI Vault scanners; 5e launch roster entries, after the roster decision.

Phase 5a done 2026-09-15: 254 files deleted, 58,851 lines removed.

### Phase 6. Relocation

Move `Unified usage dashboard` out of `components/feature-wall/`. You cut the marketing directory but kept the dashboard, and it is the only real feature in there.

Done 2026-09-15, differently: `UsagePage.tsx` was a marketing animation, so it went with the feature wall, contextual tours and first-run onboarding, which no earlier phase had covered (189 files deleted, 27,662 lines removed). The setup guide checklist and feature tips visuals moved out.

### Phase 7. Strip the Orca identity

Split the work by who sees it. Internal identifiers stay; anything a person reads changes.

**Displayed text.** 4,559 Orca mentions across six locale files: `en` 895, `fr` 826, `ko` 723, `zh` 713, `es` 705, `ja` 697. This is the bulk of the job and it is mechanical, because the renderer routes almost everything through i18n. Only two hardcoded strings escaped into TSX. CLI help text is the other half: 86 non-test files under `src/cli` carry `summary`, `usage` and `notes` strings that print on `--help`.

**Identity and packaging.** `package.json` name, description, homepage and author. In `config/electron-builder.config.cjs`: `appId` (`com.stablyai.orca`), `productName`, and the `protocols` entry registering the `orca` scheme. Replace the icons in `resources/build`.

**Deep links.** The `orca://` scheme has 136 references and `orca-preview://` another 5. Changing the scheme breaks any saved link, which for a solo build means nothing.

**Paths you will see every day.** Girra writes `.orca/` into every repo it touches, 239 references. Agent hooks read 20-odd `ORCA_*` environment variables, including `ORCA_PANE_KEY`, `ORCA_USER_DATA_PATH` and `ORCA_AGENT_HOOK_TOKEN`. You see these whenever you write a hook or debug one, so decide deliberately rather than by default.

**Live Orca services inside features you kept.** One survives:

| Endpoint | Feature | Action |
|---|---|---|
| `www.onorca.dev/docs/*` | Sidebar help menu | 17 links into docs that will not describe girra. Remove the menu or repoint it. |

Fifteen files reference `onorca.dev`. Fourteen belong to features you dropped: `login.onorca.dev` with orca-profiles, `push` and `relay` with mobile, the nudge and changelog feeds with the updater, `plugins/kill-list.json` with the kill-list, `share.onorca.dev` with artifacts and skill sharing, `v1/feedback` with the feedback form. Confirm each one leaves rather than assuming it did.

**Leave alone.** The 359 `orca*` TypeScript identifiers and the module paths under `src/main`. Renaming them touches nearly every file, breaks any upstream patch you later want to pull, and changes nothing visible.

**Verify.** No Orca string should survive in a place a person reads:

```
grep -ri orca src/renderer/src/i18n/locales/
grep -ri orca src/cli/specs src/cli/handlers | grep -v '\.test\.'
grep -rn 'onorca\.dev' src | grep -v '\.test\.'
```

Test fixtures are noise here. Roughly half the Orca mentions under `src/` live in `.test.` files, along with invented URLs like `github.com/acme/orca`. Filter them out or the count never reaches zero.

### Phase 8. Gates

Orca's CI enforces a max-lines ratchet, a reliability-gates file, and ts-nocheck limits. Deleting 12% of the source lines invalidates all three baselines. Regenerate them rather than suppressing them, or the first real change fails for unrelated reasons.

The reliability-gates file cannot wait for this phase. `pnpm lint` fails when a gate lists a test file that no longer exists, so every deletion phase edits `config/reliability-gates.jsonc` as it goes.

## Verification

Run after every phase, not at the end:

```
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

A phase is finished when all four match the Phase 0 baseline. Deleting code that something still imports fails typecheck immediately, which is why the order above matters more than the speed.

## Progress

The next stories are in `prompt.md` under "Start Here". Open decisions and the baseline are in `handover.md`.
