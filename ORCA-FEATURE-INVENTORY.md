# Orca Feature Inventory

Tick every feature to carry into girra. Leave unticked anything to drop.

Surveyed at `403b62a8d8` (upstream/main, 2026-09-12), Orca v1.4.197: 13,088 non-test source files across roughly 80 main-process modules. Six subagents covered one domain each. Size labels are rough file-count signals, not effort estimates.

## Strip candidates

Plumbing that serves the vendor rather than the user. These default to unticked unless you say otherwise.

- [ ] Anonymous product telemetry (PostHog) - `src/main/telemetry`
- [ ] Telemetry consent management - `src/main/telemetry/consent.ts`
- [ ] Anonymous install ID - `src/main/telemetry/install-id.ts`
- [ ] Crash report submission to Orca servers - `src/main/crash-reporting`
- [ ] Diagnostic bundle upload - `src/main/observability/diagnostic-bundle-upload.ts`
- [ ] GitHub-star nag prompt - `src/main/star-nag`, `src/renderer/src/components/star-nag`
- [ ] Auto-update nudge/campaign polling - `src/main/updater/updater-nudge.ts`
- [ ] Plugin kill-list (remote plugin disable) - `src/main/plugins/plugin-kill-list-service.ts`
- [ ] Feature wall / marketing showcase pages - `src/renderer/src/components/feature-wall`
- [ ] Orchestration/usage marketing pages - `src/renderer/src/components/feature-wall/agents-orchestration`

## Reading the overlaps

Domains overlap by design. The same capability often appears twice: once as a main-process engine and once as its UI surface. Keeping the engine without the surface is a real choice, so both are listed.

---

## Part 1. Agent providers and runtimes

### Claude Code Provider

- [x] **Claude Code agent runtime (Agent SDK)** - Launches and manages the Claude Code CLI/Agent SDK as an embedded agent: session lifecycle, structured turns, streaming. `src/main/claude` _(Large)_
- [x] **Claude subagent roster tracking** - Tracks and displays subagents spawned within a Claude session. `src/main/claude` (claude-subagent-*), `src/shared/claude-subagent-roster.ts` _(Medium)_
- [x] **Claude background task tracking** - Surfaces long-running background tasks a Claude session launched. `src/main/claude` (claude-background-task-*) _(Small)_
- [x] **Claude session resume / transcript branching** - Resumes prior Claude sessions and supports branching from an earlier transcript point. `src/main/claude` (claude-tui-resume-*, claude-transcript-branch-proof.ts) _(Medium)_
- [x] **Claude slash-command catalog** - Surfaces Claude's built-in slash commands for autocomplete. `src/main/claude/claude-slash-command-catalog.ts` _(Small)_
- [x] **Claude statusline integration** - Generates/installs a custom statusline script with live session info. `src/main/claude/statusline-script.ts` _(Medium)_
- [x] **Claude hook install & settings management** - Installs/manages Claude Code lifecycle hooks and settings files. `src/main/claude/hook-service.ts`, `hook-settings.ts` _(Medium)_

### Claude Accounts

- [x] **Claude account login & registration** - Add, register, and switch between multiple Claude accounts. `src/main/claude-accounts` _(Large)_
- [x] **Claude OAuth capture & token refresh** - Captures OAuth login and auto-refreshes access tokens. `claude-auth-capture.ts`, `oauth-refresh.ts` _(Medium)_
- [x] **Claude credential keychain storage** - Stores Claude auth in the OS keychain. `keychain.ts` _(Small)_
- [x] **Claude managed auth sync (runtime-auth)** - Keeps a managed copy of Claude auth state synced with the CLI's native storage across runs. `runtime-auth/` _(Large)_
- [x] **Duplicate Claude account detection** - Warns/prevents adding the same account twice. `claude-duplicate-account.ts` _(Small)_

### Claude Usage

- [x] **Claude token usage & cost reporting** - Parses transcripts into per-session/account token usage and $ cost. `src/main/claude-usage` _(Large)_
- [x] **Claude usage attribution by worktree/automation** - Attributes cost to the worktree or automation that generated it. `worktree-attribution.ts`, `claude-usage-automation-attribution.ts` _(Small)_
- [x] **Claude model pricing table** - Maintains per-model pricing for cost estimates. `claude-model-pricing.ts` _(Small)_

### Codex Provider

- [ ] **Codex agent runtime (app-server protocol)** - Runs the Codex CLI as an embedded agent over its JSON-RPC app-server protocol. `src/main/codex` (codex-app-server-*) _(Large)_
- [ ] **Codex session backfill & migration** - Migrates/backfills older Codex rollout files into Orca's index after format changes. `codex-session-backfill-*` _(Large)_
- [ ] **Codex hook install & trust management** - Installs Codex lifecycle hooks and manages its "trust this project" state. `codex-hook-*`, `codex-trust-*`, `config-toml-trust.ts` _(Large)_
- [ ] **Codex config.toml sync** - Reads/writes/reconciles Codex's `config.toml` without clobbering user edits. `config-toml-*`, `config-settings-*` _(Large)_
- [ ] **Codex subagent roster & activity** - Tracks Codex's own subagent executions. `codex-subagent-*` _(Small)_
- [ ] **Codex per-pane account registry** - Tracks which Codex account is active per terminal pane. `codex-pane-account-registry.ts` _(Small)_
- [ ] **Codex resume/rewind** - Resumes a Codex session or rewinds it to a prior turn. `codex-structured-rewind.ts` _(Medium)_
- [ ] **WSL bridge for Codex sessions** - Bridges Codex sessions in WSL back to the Windows host UI. `wsl-codex-session-bridge.ts` _(Medium)_

### Codex Accounts

- [ ] **Codex account login & registration** - Add, register, select between multiple Codex accounts. `src/main/codex-accounts` _(Large)_
- [ ] **Codex managed home isolation** - Gives each Codex account its own isolated `$CODEX_HOME`. `codex-managed-home-*` _(Large)_
- [ ] **Codex reset-credit tracking** - Tracks/ledgers Codex's "reset credit" grants per account. `codex-reset-credit-*` _(Medium)_
- [ ] **Legacy Codex WSL auth migration** - One-time migration draining old shared WSL Codex auth into the per-account model. `legacy-wsl-runtime-auth-*` _(Large)_

### Codex CLI / Usage

- [ ] **Codex CLI process lock** - Prevents concurrent Codex CLI invocations from corrupting shared state. `codex-cli/codex-home-process-lock.ts` _(Small)_
- [ ] **Codex token usage & cost reporting** - Parses Codex session files into usage/cost rollups. `src/main/codex-usage` _(Large)_

### Other Agent CLI Integrations

- [ ] **Amp agent status plugin** - Installs a plugin so Orca can read live Amp agent status. `src/main/amp` _(Small)_
- [ ] **Antigravity hook integration** - Installs lifecycle hooks for the Antigravity agent. `src/main/antigravity` _(Small)_
- [ ] **GitHub Copilot CLI hook integration** - Installs local/remote hooks for Copilot CLI sessions. `src/main/copilot` _(Small)_
- [ ] **Cursor CLI hook integration & trust bypass** - Installs hooks and pre-marks workspaces trusted so cursor-agent's trust prompt never intercepts automation. `src/main/cursor`, `src/main/agent-trust-presets.ts` _(Small)_
- [ ] **Devin CLI hook integration** - Installs lifecycle hooks/settings for Devin. `src/main/devin` _(Small)_
- [ ] **Droid (Factory) CLI hook integration** - Installs lifecycle hooks for Droid. `src/main/droid` _(Small)_
- [ ] **Gemini CLI hook integration** - Installs lifecycle hooks for Gemini CLI. `src/main/gemini` _(Small)_
- [ ] **Grok CLI hook integration** - Installs/cleans up Grok CLI hook config, incl. Windows variant and stale-symlink cleanup. `src/main/grok` _(Medium)_
- [ ] **Grok account status check** - Reports whether a Grok auth session exists and its token freshness. `src/main/grok-accounts` _(Small)_
- [ ] **Kimi CLI hook integration** - Installs hooks and resolves the runtime home dir for Kimi (incl. WSL). `src/main/kimi` _(Small)_
- [ ] **Mimo CLI hook integration** - Installs lifecycle hooks for Mimo. `src/main/mimo` _(Small)_
- [ ] **MiniMax credential storage** - Securely stores MiniMax API keys and session cookies. `src/main/minimax` _(Small)_
- [ ] **OpenClaude CLI hook integration** - Installs lifecycle hooks for OpenClaude. `src/main/openclaude` _(Small)_
- [x] **OpenCode status plugin** - Installs a status-reporting plugin (session lifecycle, message previews) into OpenCode. `src/main/opencode` _(Medium)_
- [x] **OpenCode usage tracking** - Reads OpenCode's local SQLite session DB for usage rollups. `src/main/opencode-usage` _(Medium)_
- [x] **Pi agent status/prefill extensions & custom titlebar** - Installs status-reporting and input-prefill extensions plus a custom titlebar into the Pi agent CLI. `src/main/pi` _(Medium)_
- [ ] **Command Code hook integration** - Installs lifecycle hooks for the "Command Code" CLI. `src/main/command-code` _(Small)_
- [ ] **Hermes hook & config integration** - Installs hooks and edits Hermes's YAML config/plugin registration. `src/main/hermes` _(Medium)_
- [x] **AI commit-message generation** - Runs a background agent to draft a commit message from the staged diff. `src/main/text-generation` (commit-message-*) _(Medium)_
- [x] **AI pull-request description generation** - Runs a background agent to draft a PR title/description from local or remote branch context. `src/main/text-generation` (pull-request-_, source-control-_) _(Large)_

### Rate Limits & Quota

- [x] **Per-provider rate-limit polling service** - Central service periodically polling usage/rate-limit endpoints for every connected account. `src/main/rate-limits/service*` _(Large)_
- [x] **Claude usage-window / rate-limit display** - Fetches and classifies Claude's 5-hour/weekly rate-limit windows. `rate-limits/claude-*` _(Medium)_
- [ ] **Codex rate-limit probing (RPC & PTY)** - Fetches Codex rate-limit windows via app-server RPC or a hidden PTY session. `rate-limits/codex-*` _(Medium)_
- [ ] **Codex reset-credit redemption** - Client for redeeming/checking Codex's bonus "reset credit". `codex-reset-credit-client.ts` _(Small)_
- [ ] **Gemini CLI usage/quota fetch** - Extracts OAuth tokens from Gemini CLI and fetches usage quota. `rate-limits/gemini-*` _(Small)_
- [ ] **Grok usage/rate-limit fetch** - Fetches Grok account usage/rate-limit status. `rate-limits/grok-*` _(Small)_
- [ ] **Kimi usage fetch** - Fetches Kimi account usage. `kimi-fetcher.ts` _(Small)_
- [ ] **MiniMax usage fetch** - Fetches MiniMax account usage/quota. `rate-limits/minimax` _(Small)_
- [x] **OpenCode (opencode.ai) usage scraping** - Scrapes the opencode.ai web dashboard for usage since it has no API. `rate-limits/opencode-go-*` _(Medium)_
- [x] **Hidden-PTY usage probing** - Spawns an invisible PTY purely to run a CLI's `usage`/`status` command and parse output. `rate-limits/hidden-*`, `claude-pty*`, `codex-pty*` _(Medium)_
- [x] **Rate-limit reset countdown formatting** - Formats "resets in Xh" countdowns for the UI. `src/shared/rate-limit-reset-format.ts` _(Small)_
- [x] **GitHub/GitLab API rate-limit display** - Shows remaining GitHub/GitLab REST API rate limit. `components/github`, `components/gitlab` _(Small)_

### Usage & Billing (cross-provider)

- [x] **Unified usage dashboard** - Combined page showing usage/cost across all connected agent accounts. `components/feature-wall/agents-orchestration/UsagePage.tsx` _(Medium)_
- [x] **Usage-by-account summary cards** - Per-account usage/cost cards on the dashboard. `UsageAccountsCard.tsx` _(Small)_
- [x] **Status-bar usage percentage indicator** - Live usage-percentage badge in the app status bar, configurable display mode. `src/shared/status-bar-usage-mode.ts` _(Small)_
- [x] **Automation usage summary** - Rolls up usage from unattended/automation runs separately from interactive sessions. `automation-usage-summary.ts` _(Small)_
- [x] **Generic usage-provider contract & store** - Shared interface/store all per-provider usage trackers plug into (scope filters, rollups, worktree refs). `src/main/usage` _(Medium)_

### Agent Trust & Hooks Infrastructure

- [x] **Agent trust presets (skip trust prompt)** - Pre-writes trust marker files cursor-agent/Copilot/Codex expect so their "trust this folder?" menu never intercepts an automated launch. `src/main/agent-trust-presets.ts` _(Small)_
- [x] **Universal agent-hook install/uninstall** - Shared installer writing/removing lifecycle-hook scripts and config for every supported agent CLI, local and remote. `src/main/agent-hooks` (installer-utils*, managed-hook-*) _(Large)_
- [x] **Agent-hook relay server** - Local server receiving lifecycle events (turn start/stop, tool calls) from every agent CLI and republishing live status. `agent-hooks/server` _(Large)_
- [x] **WSL hook relay** - Bridges agent lifecycle hooks from inside WSL back to the Windows host's relay server. `agent-hooks/wsl-hook-relay-*` _(Large)_
- [x] **First-turn workspace/branch auto-rename** - Renames the workspace tab/branch to reflect the agent's first response once real work context is known. `agent-hooks/first-work-*` _(Medium)_
- [x] **Agent-hook install telemetry** - Records install success/failure telemetry across providers. `install-telemetry.ts` _(Small)_ (internal?)
- [x] **Cross-provider agent-hook listener/dispatch** - Parses each provider's hook payload into a common event schema. `src/shared/agent-hook-listener` _(Large)_ (internal?)
- [x] **Agent status store** - Single source of truth for "running/idle/blocked" that every UI surface (sidebar, `worktree ps`, mobile, dashboard) reads from. `agent-hooks/agent-status-pane-index.ts` _(Large)_
- [x] **Orca YAML hook trust dialog** - Prompts the user to approve a repo-declared `orca.yaml` hook before it runs. `components/sidebar/OrcaYamlTrustDialog.tsx` _(Small)_

### AI Vault (session history)

- [x] **Cross-provider session history browser (AI Vault)** - Lists, searches, and reopens past sessions from every supported agent CLI, local and SSH-remote. `src/main/ai-vault`, `components/right-sidebar/AiVaultPanel.tsx` _(Large)_
- [x] **Per-provider session parsers** - Format-specific parsers turning each CLI's on-disk transcript format into a common session record. `ai-vault/session-scanner-*-parser.ts` _(Large)_
- [x] **Session resume / "resume in chat"** - Reopens a past session into a live agent pane, restoring its provider-native resume flag. `ai-vault-resume-*`, `ai-vault-session-resume*` _(Medium)_
- [x] **Session deletion** - Deletes a session's history file(s), local or remote. `ai-vault/session-delete*.ts` _(Small)_
- [x] **Session title resolution** - Derives a readable title from a session's first prompt or provider metadata. `session-title-*` _(Small)_
- [x] **Session subagent transcript viewing** - Shows nested subagent transcripts spawned inside a Claude/Codex session. `session-subagent-reader.ts`, `AiVaultSessionSubagents.tsx` _(Medium)_
- [x] **AI Vault full-text search** - Indexes and full-text-searches all scanned sessions, with typo tolerance and retention policy. `src/main/ai-vault-search` _(Large)_

### Skills

- [x] **Agent skills marketplace/install** - Discovers, downloads, and installs "skill" packages into an agent's config, local or SSH-relayed. `src/main/skills` (skill-install-_, skill-cloud-_) _(Large)_
- [x] **Skill bundle creation & sharing** - Packages a folder into a shareable skill bundle with a share link. `skill-bundle-creation.ts`, `src/shared/skill-share-link.ts` _(Medium)_
- [x] **Skill removal with recovery** - Uninstalls a skill via a staged, recoverable delete. `skills/skill-delete` _(Medium)_
- [x] **Skill freshness/update checking** - Detects when an installed skill is stale vs. its source and offers an update. `skill-freshness-*`, `skill-update-*` _(Medium)_
- [x] **Skill auto-selection for agent context** - Picks which installed skills to surface to an agent based on its task. `agent-skill-selection.ts` _(Small)_
- [x] **Skill setup panel (settings)** - Settings UI to manage installed skills per agent, incl. install-failure recheck. `components/settings/AgentSkillSetupPanel.tsx` _(Medium)_

### Memory

- [x] **Host & PTY resource telemetry** - Collects per-process CPU/memory metrics for running agent terminals (with a Windows collector) and rehydrates the active-PTY registry after restart. `src/main/memory` _(Medium)_

### Speech

- [x] **Speech-to-text dictation for agent input** - Local offline-model or OpenAI-API transcription for dictating prompts into an agent pane, with a securely stored API key for the cloud path. `src/main/speech` _(Large)_
- [x] **STT model download & management** - Downloads, caches, and deletes local offline speech-recognition models. `speech/model-*`, `speech-model-*` _(Medium)_

### Execution Providers (remote/local agent hosting)

- [x] **Local PTY execution provider** - Runs agent CLIs in a real local pseudo-terminal, with "shell ready" detection before injecting commands. `src/main/providers/local-pty-*` _(Large)_
- [x] **SSH remote execution provider (PTY/git/filesystem)** - Runs agents, git ops, and file access on a remote SSH host, so agents can work on remote machines. `src/main/providers/ssh-*` _(Large)_
- [x] **Foreground-process detection (per-OS)** - Detects what command is actually running in a pane vs. the shell, used to tell whether an agent is active. `providers/windows-*`, `macos-*`, `posix-pane-foreground-fingerprint.ts` _(Medium)_ (internal?)

---

## Part 2. Source control, forges and issue trackers

### Worktree Management

- [x] **Worktree-per-agent isolation** - creates an isolated git worktree per task/agent so parallel agents don't collide on files. `src/main/git/worktree.ts`, `src/main/git/worktree-add.ts` _(Large)_
- [x] **Sparse worktree checkout** - supports git sparse-checkout so a worktree only materializes a subset of files. `src/main/git/worktree-sparse-add.ts`, `worktree-sparse-checkout.ts` _(Medium)_
- [x] **Worktree listing & scan cache** - enumerates all worktrees for a repo with a cache to avoid repeated `git worktree list` calls. `src/main/git/worktree-listing.ts`, `worktree-scan-cache.ts` _(Medium)_
- [x] **Safe worktree removal** - removes a worktree with dirty-state and branch-cleanup preflight checks. `src/main/git/worktree-removal.ts`, `worktree-removal-preflight.ts` _(Medium)_
- [x] **Worktree move/rename** - relocates an existing worktree directory. `src/main/git/worktree-move.ts` _(Small)_
- [x] **Base-branch divergence detection** - shows how far a worktree's branch has drifted from its base branch. `src/main/git/worktree-base-divergence.ts`, `worktree-base-ref-probe.ts` _(Medium)_
- [x] **Shared/symlinked worktree directories** - shares directories like `node_modules` across worktrees via symlinks/git includes. `src/main/git/worktree-shared-directories.ts`, `worktree-include-file.ts` _(Medium)_
- [x] **WSL-aware worktree git routing** - routes worktree git commands correctly across Windows/WSL boundaries. `src/main/git/wsl-linked-worktree-git-routing.ts`, `wsl-direct-git-read-commands.ts` _(Large)_
- [x] **Worktree sidebar with drag/drop & pinning** - lists all worktrees with manual reordering, drag-drop, and pinning. `src/renderer/src/components/sidebar/WorktreeList.tsx`, `worktree-manual-order.ts` _(Large)_
- [x] **Worktree lineage visualization** - shows parent/child relationships for stacked-branch worktrees. `src/renderer/src/components/sidebar/worktree-lineage-projection.ts`, `AgentMapWorktreeRingNode.tsx` _(Medium)_
- [x] **Delete-worktree confirmation flow** - warns about dirty changes/lineage before deleting, with a force-delete option. `src/renderer/src/components/sidebar/DeleteWorktreeDialog.tsx`, `delete-worktree-flow.ts` _(Medium)_
- [x] **Worktree jump palette (Cmd-J)** - quick-switcher across worktrees, open tabs, and "create new worktree" actions. `src/renderer/src/components/WorktreeJumpPalette.tsx` _(Large)_
- [x] **New-worktree creation panel** - form to create a worktree from a repo, branch, and parent worktree. `src/renderer/src/components/worktree-creation/WorktreeCreationPanel.tsx` _(Medium)_
- [x] **Worktree visibility scopes** - per-repo and global settings for which worktrees appear in the sidebar. `src/renderer/src/components/sidebar/WorktreeVisibilityDialog.tsx` _(Medium)_
- [x] **Imported/external worktree detection** - detects worktrees made outside the app and offers to import them. `src/renderer/src/components/sidebar/imported-worktrees-card-actions.ts`, `new-external-worktrees-inbox-actions.ts` _(Medium)_
- [x] **Worktree context menu** - right-click actions: open in editor/terminal, delete, sleep, visibility. `src/renderer/src/components/sidebar/WorktreeContextMenu.tsx` _(Medium)_
- [x] **Sleeping/parking idle worktrees** - pauses idle worktrees to save resources, resumable later. `src/renderer/src/components/sidebar/sleep-worktree-flow.ts`, `src/renderer/src/lib/worktree-sleep-intent.ts` _(Medium)_

### Git Core / Source Control Engine

- [x] **Admission-controlled git command runner** - throttles/queues concurrent git subprocesses to avoid overload. `src/main/git/command-runner/git-subprocess-admission.ts` _(internal?)_ `(Large)`
- [x] **Git status polling & coalescing** - periodically polls `git status` per worktree, coalescing overlapping calls. `src/main/git/status.ts`, `src/renderer/src/components/right-sidebar/useGitStatusPolling.ts` _(Large)_
- [x] **Porcelain status parsing** - parses `git status --porcelain` including quoted/special paths. `src/main/git/porcelain-v1-records.ts` _(internal?)_ `(Medium)`
- [x] **Stage/unstage/discard changes** - stage, unstage, and discard individual or bulk file changes. `src/main/git/source-control/staging.ts`, `discard-changes.ts` _(Medium)_
- [x] **Commit creation** - commits staged (or all) changes with a message and author identity. `src/main/git/source-control/commit-changes.ts` _(Small)_
- [x] **Branch rename** - renames the current or a named branch. `src/main/git/branch-rename.ts` _(Small)_
- [x] **Remote push/pull with rebase** - syncs with remotes, including rebase-on-pull handling. `src/main/git/remote.ts`, `remote-rebase.ts` _(Medium)_
- [x] **Upstream ahead/behind tracking** - computes ahead/behind vs upstream with negative caching for speed. `src/main/git/upstream.ts`, `status-upstream-ref.ts` _(Medium)_
- [x] **Submodule status & diff** - detects and diffs git submodules inside a worktree. `src/main/git/source-control/submodule-status.ts`, `submodule-diff.ts` _(Medium)_
- [x] **Huge-repo handling & warnings** - special-cases very large repos/folders and warns the user in the UI. `src/main/git/huge-folder-ignore.ts`, `source-control-huge-repo-warning-dismissals.ts` _(Small)_
- [x] **Repo & default branch/remote detection** - detects whether a folder is a git repo and finds its default branch/remote. `src/main/git/repo-detection.ts`, `src/main/source-control/repo-default-branch.ts` _(Medium)_
- [x] **Merge conflict resolution** - surfaces conflicted files and lets the user resolve them (ours/theirs/manual). `src/main/git/source-control/git-conflict-operation.ts` _(Medium)_
- [x] **Git history/log viewer** - reads commit history for a branch or file. `src/main/git/history.ts`, `src/renderer/src/components/right-sidebar/GitHistoryPanel.test.tsx` _(Medium)_
- [x] **Nested repo / monorepo discovery** - scans a folder for nested git repos and offers to import each individually. `src/main/project-groups/nested-repo-discovery.ts`, `nested-repo-import.ts` _(Medium)_

### Diff Review & Commit UI

- [x] **Monaco-based inline diff viewer** - side-by-side/inline syntax-highlighted diff rendering. `src/renderer/src/components/editor/DiffViewer.tsx` _(Large)_
- [x] **Large-diff fallback / on-demand loading** - avoids eagerly rendering huge diffs, with a manual load prompt. `src/renderer/src/components/editor/LargeDiffFallback.tsx` _(Medium)_
- [x] **Image diff viewer** - before/after comparison for binary image changes. `src/renderer/src/components/editor/ImageDiffViewer.tsx` _(Small)_
- [x] **Inline diff comments** - threaded comments on specific diff lines, synced with PR review threads. `src/renderer/src/components/diff-comments/DiffCommentCard.tsx` _(Large)_
- [x] **AI-generated commit messages** - drafts a commit message from the staged diff via an AI provider. `src/renderer/src/store/slices/commit-message-generation.ts`, `CommitArea.generate.test.tsx` _(Medium)_
- [x] **Commit/PR AI settings** - per-repo and global controls for AI-generated commit messages and PR text. `src/renderer/src/components/settings/CommitMessageAiPane.tsx`, `AiCommitPrSettingsCard.tsx` _(Medium)_
- [x] **Source Control panel (staging tree)** - VS-Code-style panel of changed files, grouped/sortable, with staging actions. `src/renderer/src/components/right-sidebar/source-control-tree.ts` _(Large)_
- [x] **Branch/commit compare view** - diffs two branches or commits against each other. `src/main/git/source-control/branch-compare.ts`, `commit-compare.ts` _(Medium)_

### Pull/Merge Request Workflow

- [x] **Cross-forge hosted review abstraction** - unifies PR/MR creation and lookup across GitHub, GitLab, Bitbucket, Azure DevOps, and Gitea. `src/main/source-control/forge-provider.ts`, `hosted-review.ts` _(Large)_
- [x] **Create & push PR/MR from the app** - drafts title/description (with repo PR templates) and opens the review without leaving the IDE. `src/main/source-control/hosted-review-creation.ts`, `pull-request-template.ts` _(Large)_
- [x] **Stacked PR creation** - creates a chain of dependent PRs for stacked-branch workflows. `src/main/source-control/stacked-hosted-review-creation.ts`, `src/main/github/github-pr-stack.ts` _(Large)_
- [x] **Background PR/MR refresh coordinator** - polls PR state (checks, reviews, merge status) with rate-limit-aware pacing. `src/main/github/pr-refresh-coordinator.ts` _(Large)_
- [x] **PR checks/CI status panel** - shows CI check results with a "fix failing checks" prompt. `src/renderer/src/components/pr-check-counts.ts`, `pr-checks-fix-prompt.ts` _(Medium)_
- [x] **PR review comment threads** - lists review comment threads and lets the user reply or resolve them. `src/renderer/src/components/right-sidebar/pr-comment-thread-resolution.ts` _(Large)_
- [x] **Linked-issue detection on PR** - detects and displays the issue a PR closes or references. `src/main/source-control/pull-request-linked-issue.ts` _(Small)_
- [x] **Stacked-PR map visualization** - renders a visual map of a stacked-PR chain in the sidebar. `src/renderer/src/components/right-sidebar/GitHubPRStackMap.tsx` _(Medium)_
- [x] **Merge queue / auto-merge toggle** - enables GitHub merge queue or auto-merge on a PR. `src/main/github/client-merge-queue-auto-merge.test.ts` _(internal?)_ `(Small)`
- [x] **GitLab pipeline job graph & actions** - view/retry/cancel CI pipeline jobs for a merge request. `src/main/gitlab/pipeline-job-graph.ts`, `pipeline-job-mutations.ts` _(Medium)_
- [x] **PR conflict summary** - shows a summary of merge conflicts blocking a PR. `src/main/github/conflict-summary.ts` _(Small)_

### Forge Integrations

- [x] **GitHub issue browsing & creation** - lists, filters, and creates GitHub issues from the task page. `src/main/github/issues.ts`, `src/renderer/src/components/task-page/github` _(Large)_
- [x] **GitHub Projects (v2) board integration** - reads and mutates GitHub Projects fields and items. `src/main/github/project-view/` _(Large)_
- [x] **GitHub Enterprise support** - supports self-hosted GitHub Enterprise hosts alongside github.com. `src/main/github/github-enterprise-repository.ts` _(Small)_
- [x] **GitHub markdown composer with mentions** - rich editor for issue/PR bodies with @mention and preview. `src/renderer/src/components/github/GitHubMarkdownComposer.tsx` _(Medium)_
- [x] **GitLab merge request & issue lifecycle** - creates, lists, updates, and reviews GitLab MRs and issues. `src/main/gitlab/merge-request-creation.ts`, `issues.ts` _(Large)_
- [x] **GitLab item detail dialog** - tabbed dialog for pipelines, files, conversation, and description. `src/renderer/src/components/gitlab-item-dialog/` _(Large)_
- [x] **Self-hosted GitLab support** - known-host probing and preload args for self-managed GitLab instances. `src/main/gitlab/gitlab-known-host-probe.ts` _(Small)_
- [x] **Bitbucket PR creation & credential store** - app-password/OAuth credential storage plus PR creation for Bitbucket Cloud. `src/main/bitbucket/credential-store.ts`, `pull-request-creation.ts` _(Medium)_
- [x] **Azure DevOps PR creation** - creates and maps pull requests against Azure Repos. `src/main/azure-devops/pull-request-creation.ts` _(Medium)_
- [x] **Gitea PR creation** - creates and maps pull requests against a Gitea instance. `src/main/gitea/pull-request-creation.ts` _(Small)_

### Issue Trackers - Jira & Linear

- [x] **Jira issue browsing & creation** - searches, lists, and creates Jira issues tied to a workspace. `src/main/jira/issues.ts`, `src/renderer/src/components/JiraIssueWorkspace.tsx` _(Large)_
- [x] **Jira ADF ↔ markdown conversion** - converts Jira's Atlassian Document Format to/from markdown for editing. `src/main/jira/adf-markdown.ts` _(Medium)_
- [x] **Jira attachment/image caching** - fetches and caches images/attachments embedded in Jira issues. `src/main/jira/attachment-image-cache.ts` _(Medium)_
- [x] **Jira issue comments** - reads and posts comments on a Jira issue. `src/main/jira/jira-issue-comments.ts` _(Small)_
- [x] **Multi-site Jira credentials** - stores credentials per Jira site so multiple instances can be connected. `src/main/jira/site-credential-store.ts` _(Small)_
- [x] **Create worktree from a Jira issue URL** - pasting a Jira URL seeds a new worktree with that issue's context. `src/renderer/src/components/new-workspace/use-jira-url-source.ts` _(Medium)_
- [x] **Linear issue browsing & creation** - lists, filters, and creates Linear issues from the task page. `src/main/linear/issues.ts`, `src/renderer/src/components/task-page/linear` _(Large)_
- [x] **Linear issue detail drawer** - side drawer for editing a Linear issue's properties, comments, and sub-issues. `src/renderer/src/components/LinearItemDrawer.tsx` _(Large)_
- [x] **Linear projects & custom views** - browses Linear projects and saved custom views as boards/tables. `src/main/linear/projects.ts`, `linear-custom-view-queries.ts` _(Medium)_
- [x] **Linear "agent" skill setup** - connects Orca as a Linear agent so issues can be assigned directly to it. `src/renderer/src/components/settings/LinearAgentSkillGuide.tsx` _(Medium)_
- [x] **Multi-workspace Linear support** - connects to and switches between multiple Linear workspaces. `src/main/linear/linear-workspace-registry.ts` _(Small)_

### Project Groups, Folder Workspaces, Builds & Preflight

- [x] **Project groups (multi-repo grouping)** - groups related worktrees/repos under a named project group in the sidebar. `src/renderer/src/store/project-groups/` _(Large)_
- [x] **Folder workspaces (non-git folders)** - treats a plain folder without git as a workspace alongside git worktrees. `src/main/project-groups/folder-workspace-path-status.ts` _(Large)_
- [x] **Local build feed & switch** - serves/consumes locally built app updates and lets a user switch to a local dev build. `src/main/local-builds/local-build-feed-server.ts` _(internal?)_ `(Medium)`
- [x] **Startup preflight checks** - runs agent/CLI-availability checks before an agent runs, surfacing issues on the landing screen. `src/main/preflight/agent-detection.ts`, `src/renderer/src/components/landing-preflight-issues.ts` _(Medium)_

---

## Part 3. Terminal, remote access and infrastructure

### Terminal & Shell Environment

- [x] **Embedded PTY-backed terminal per session** - spawns a real shell process behind each terminal pane using node-pty. `src/main/daemon/pty-subprocess.ts`, `src/main/daemon/session.ts` _(Large)_
- [x] **Terminal scrollback history with disk persistence** - saves and restores terminal output across restarts, including checkpointed restore points. `src/main/daemon/history-manager.ts`, `terminal-history-*.ts` _(Large)_
- [x] **Cold/warm session restore after app or daemon restart** - reattaches to a still-running shell and replays buffered output instead of losing the session. `src/main/daemon/cold-restore-*.ts`, `terminal-mode-rehydrate-sequences.ts` _(Large)_
- [x] **Shell-ready detection** - waits for the shell prompt to actually be interactive before delivering startup commands. `src/main/daemon/shell-ready.ts`, `session-shell-ready-barrier.ts` _(Medium)_
- [x] **Headless/offscreen terminal emulator** - runs a full ANSI/VT emulator without a visible window, for mobile and background use. `src/main/daemon/headless-emulator.ts` _(Medium)_
- [x] **OSC-based cwd/title tracking** - reads shell escape sequences to know the terminal's current directory and title. `src/main/daemon/terminal-osc-cwd-title-scanner.ts`, `osc7-*.ts` _(Small)_
- [x] **Per-shell startup env injection (bash/zsh/PowerShell)** - customizes environment and RC files so agent tooling loads correctly in the user's shell. `src/main/pty/shell-startup-env.ts`, `daemon-bash-shell-ready-rcfile.ts` _(Medium)_
- [x] **Oh-My-Posh / Powerlevel10k prompt compatibility wrapper** - patches popular shell prompt themes so they don't break terminal state detection. `src/main/pty/omp-shell-wrapper.ts`, `powerlevel10k-wizard-env.ts` _(Medium)_
- [x] **Conda/venv activation environment handling** - ensures Python environment activation works correctly inside spawned shells. `src/main/pty/conda-activation-env.ts` _(Small)_
- [x] **AppImage/Linux terminal environment fixups** - corrects env vars broken by AppImage's runtime wrapping. `src/main/pty/appimage-terminal-env.ts` _(Small)_
- [x] **Codex CLI shell-launch preflight** - prepares shell state before launching the Codex CLI agent. `src/main/pty/codex-shell-launch-preflight.ts`, `codex-home-wsl-env.ts` _(Small)_
- [x] **Legacy terminal migration tombstones** - detects and cleans up terminal state left by older Orca versions. `src/main/pty/legacy-terminal-*.ts` _(Small)_
- [x] **Ghostty config import** - reads an existing Ghostty terminal config and theme, converting it into Orca settings. `src/main/ghostty` _(Medium)_
- [x] **Warp theme import** - discovers and imports Warp terminal color themes. `src/main/warp-themes` _(Medium)_
- [x] **Terminal color/appearance environment control** - manages `$TERM`, `$COLORTERM`, and related env for correct color rendering. `src/main/pty/terminal-color-env.ts` _(Small)_
- [x] **In-terminal search** - find text in terminal scrollback with match highlighting. `src/renderer/src/components/TerminalSearch.tsx` _(Medium)_
- [x] **Floating/detached terminal windows** - pop a terminal pane out into its own floating surface. `src/renderer/src/components/floating-terminal` _(Medium)_
- [x] **Terminal workbench with tabs and splits** - the main multi-pane, multi-tab terminal workspace UI. `src/renderer/src/components/TerminalWorkbenchContainer.tsx`, `terminal-pane` _(Large)_
- [x] **Clipboard copy of terminal selection** - copies selected terminal text to the OS clipboard. `src/renderer/src/web/web-clipboard-copy-terminal-selection.ts` _(Small)_

### Windows & WSL

- [x] **WSL distro execution support** - runs shells and agents inside a WSL distribution from Windows. `src/main/wsl` _(Medium)_
- [x] **Windows ConPTY job-object process management** - uses Windows job objects to reliably track and kill process trees under ConPTY. `src/main/windows/windows-pty-job.ts` _(Medium)_
- [x] **Windows process table inspection** - enumerates and inspects running processes via WMI/CIM for diagnostics and cleanup. `src/main/windows/windows-process-table*.ts` _(Medium)_
- [x] **Windows PATH/registry environment repair** - reads and fixes the Windows PATH registry entries used to find installed tools. `src/main/pty/windows-path-registry-*.ts` _(Medium)_
- [x] **Windows install-directory ACL repair** - detects and fixes broken folder permissions that block startup on Windows. `src/main/startup/windows-install-dir-acl-*.ts` _(Medium)_
- [x] **Windows shell path hydration** - restores the correct Windows shell binary path on startup. `src/main/startup/windows-shell-path-*.ts` _(Small)_
- [x] **Windows command-line recovery from truncated process info** - reconstructs the full command line when Windows APIs only return a partial one. `src/main/windows/windows-command-line-recovery-health.ts` _(Small)_

### SSH - Connections & Remote Access

- [x] **SSH into a remote host and run a terminal there** - full interactive SSH terminal sessions from within Orca. `src/main/ssh/ssh-connection.ts`, `ssh-connection-manager.ts` _(Large)_
- [x] **SSH config file parsing (`~/.ssh/config`)** - reads user's SSH config, including `Include` directives, to populate host list. `src/main/ssh/ssh-config-parser.ts`, `ssh-config-include-expander.ts` _(Medium)_
- [x] **SSH host picker / add remote host UI** - lets the user browse and select known SSH hosts to connect to. `src/main/ssh/ssh-config-host-picker.ts`, `src/renderer/src/components/sidebar/AddRemoteHostSshConfigPicker.tsx` _(Medium)_
- [x] **SSH known-hosts / host-key verification** - verifies and stores host keys, prompting the user on first connect or mismatch. `src/main/ssh/ssh-known-hosts.ts`, `ssh-host-key-verifier.ts` _(Medium)_
- [x] **SSH private key & multi-key authentication** - authenticates using private keys, including agent-forwarded identities. `src/main/ssh/ssh-private-key-authentication.ts`, `ssh-agent-identity-filter.ts` _(Medium)_
- [x] **SSH security key (FIDO2) authentication** - supports hardware security keys for SSH auth. `src/main/ssh/ssh-security-key-identity.ts` _(Small)_
- [x] **SSH proxy command / jump host support** - connects through a `ProxyCommand` or jump host chain. `src/main/ssh/ssh-proxy-command.ts` _(Small)_
- [x] **SSH reconnect with backoff ladder** - automatically retries a dropped SSH connection with increasing delay. `src/main/ssh/ssh-reconnect-ladder.ts`, `ssh-reconnect-error-classification.ts` _(Medium)_
- [x] **SSH connection status in status bar** - shows live connection health for each SSH target. `src/renderer/src/components/status-bar/SshStatusSegment.tsx` _(Small)_
- [x] **SFTP file upload/download over SSH** - transfers files to/from a remote host. `src/main/ssh/sftp-upload.ts`, `ssh-filesystem-stream-reader.ts` _(Medium)_
- [x] **SSH port scanning on remote hosts** - discovers open/listening ports on the remote machine. `src/main/ssh/ssh-port-scanner.ts` _(Small)_
- [x] **SSH local/remote port forwarding** - forwards TCP ports over the SSH tunnel, with a UI panel to manage them. `src/main/ssh/ssh-port-forward.ts`, `src/renderer/src/components/right-sidebar/ssh-ports-panel.tsx` _(Medium)_
- [x] **System SSH binary fallback** - falls back to the OS's own `ssh`/`sftp` binary when the bundled client can't be used. `src/main/ssh/system-ssh-binary.ts`, `system-ssh-command.ts` _(Medium)_
- [x] **VS Code Remote-SSH authority handoff** - hands a remote target off to VS Code's Remote-SSH extension. `src/main/ssh/vscode-ssh-authority.ts` _(Small)_
- [x] **Git-over-SSH passthrough for remote workspaces** - runs git commands against a repo over the SSH connection. `src/main/ssh/ssh-git-response-stream-reader.ts`, `ssh-g-config-resolution.ts` _(Medium)_
- [x] **Remote Linear CLI over SSH** - runs Linear issue-tracker CLI commands on the remote host and parses results. `src/main/ssh/ssh-remote-linear-*.ts` _(Medium)_
- [x] **Remote Orca CLI dispatch over SSH** - runs `orca` CLI subcommands against a remote host's daemon. `src/main/ssh/ssh-remote-orca-cli.ts`, `ssh-remote-cli-launcher.ts` _(Large)_
- [x] **Remote agent orchestration commands (ask/check/post/send)** - drives agent prompts and status on a remote SSH host. `src/main/ssh/ssh-remote-orchestration-*.ts` _(Medium)_
- [x] **Remote platform/Node toolchain detection** - probes the remote host's OS and Node.js install to decide how to deploy. `src/main/ssh/ssh-remote-platform*.ts`, `ssh-remote-node-*.ts` _(Medium)_
- [x] **Remote PowerShell execution** - runs commands via PowerShell on Windows SSH targets. `src/main/ssh/ssh-remote-powershell.ts` _(Small)_
- [x] **SSH-discovered port URLs surfaced in UI** - advertises URLs for dev servers detected on remote/forwarded ports. `src/main/ports/ssh-advertised-url-enrichment.ts` _(Small)_
- [x] **Forget/remove SSH workspace** - cleanly detaches a remote workspace and its SSH target. `src/renderer/src/components/sidebar/ForgetSshWorkspaceDialog.tsx` _(Small)_

### Remote Daemon Deployment (orcad)

- [x] **Auto-deploy Orca's remote agent (`orcad`) to a remote host** - uploads and installs the remote runtime binary over SSH so agents can run there. `src/main/ssh/orcad-remote-deploy.ts`, `orcad-remote-launch.ts` _(Large)_
- [x] **Versioned remote install with activation gate** - installs a new orcad version alongside the old one and only "activates" it after a health check passes. `src/main/ssh/orcad-activation-gate.ts`, `remote-install-model.ts` _(Large)_
- [x] **Remote install rollback** - reverts to the previous working orcad version if activation fails. `src/main/ssh/orcad-remote-rollback.ts` _(Medium)_
- [x] **Remote orcad process control (start/stop/restart)** - manages the lifecycle of the remote daemon process. `src/main/ssh/orcad-remote-process-control.ts` _(Medium)_
- [x] **Remote install garbage collection** - cleans up old/orphaned remote install directories and stale locks. `src/main/ssh/orcad-remote-gc.ts`, `remote-install-gc.ts` _(Small)_
- [x] **Native dependency (node-pty) cache & repair for remote installs** - caches prebuilt native modules per remote platform and repairs a broken install. `src/main/ssh/ssh-relay-native-deps-cache*.ts`, `ssh-relay-node-pty-repair.ts` _(Large)_
- [x] **Relay endpoint takeover between install versions** - safely hands the Unix-socket endpoint from an old relay/orcad instance to a new one. `src/main/ssh/ssh-relay-endpoint-takeover.ts`, `ssh-relay-endpoint-incumbent.ts` _(Medium)_
- [x] **`orcad` standalone server entry point** - the executable entry for the remote-side Orca daemon. `src/main/orcad/orcad-entry.ts`, `orcad-lifecycle.ts` _(Large)_
- [x] **orcad instance lock (single instance per host)** - prevents two orcad processes racing on the same remote host. `src/main/orcad/orcad-instance-lock.ts` _(Small)_
- [x] **orcad native preflight checks** - validates node-pty/ABI compatibility before orcad starts serving. `src/main/orcad/orcad-native-preflight.ts`, `node-pty-loader-diagnosis.ts` _(Medium)_
- [x] **orcad health endpoint** - reports orcad's health/version for local and remote checks. `src/main/orcad/orcad-health.ts` _(Small)_

### Terminal Daemon Core

- [x] **Background daemon that keeps terminal sessions alive** - a separate long-lived process hosts PTYs so sessions survive the app closing. `src/main/daemon/daemon-server.ts`, `daemon-main.ts` _(Large)_
- [x] **Daemon endpoint ownership protocol** - a strict handoff protocol (documented in AGENTS.md) so only a live daemon can claim the Unix-socket path, preventing terminal "zombie" states. `src/main/daemon/daemon-endpoint-ownership.ts` _(Large)_
- [x] **Daemon auto-respawn on crash** - detects a dead daemon and restarts it with throttling to avoid respawn storms. `src/main/daemon/daemon-respawn-throttle.ts`, `daemon-restart-state.ts` _(Medium)_
- [x] **Daemon client library (renderer/CLI to daemon RPC)** - the request/response and streaming protocol used to talk to the daemon. `src/main/daemon/client.ts`, `daemon-client-rpc-request.ts` _(Large)_
- [x] **Session ownership & multi-window adoption** - lets a session started in one window be "adopted"/viewed from another window or reconnect. `src/main/daemon/daemon-session-owner-resolution.ts`, `daemon-endpoint-adoption.ts` _(Medium)_
- [x] **Orphaned process reaping** - detects and cleans up terminal child processes left behind by crashed sessions. `src/main/runtime/agent-session-orphan-child-reaper.ts`, `ssh-orphan-relay-pty-sweep.ts` _(Medium)_
- [x] **Daemon self-diagnostic / stale-daemon detection** - probes whether an existing daemon is actually alive vs. wedged before acting on it. `src/main/daemon/daemon-health.ts`, `daemon-stale-kill.ts` _(Medium)_
- [x] **macOS login-session death watch** - detects when the user's macOS login session ends so terminals can be cleaned up. `src/main/daemon/macos-login-session-death-watch.ts` _(Small)_
- [x] **PTY buffer/checkpoint snapshotting** - periodically snapshots terminal buffer state to disk for fast cold restore. `src/main/daemon/daemon-pty-checkpoint-scheduler.ts`, `terminal-checkpoint-serializer.ts` _(Medium)_

### Application Startup & Lifecycle

- [x] **Single-instance app lock** - prevents multiple copies of Orca running at once, focusing the existing window instead. `src/main/startup/single-instance-lock.ts` _(Small)_
- [x] **GPU fallback / software rendering switch** - detects GPU crashes and falls back to software rendering automatically. `src/main/startup/gpu-fallback-*.ts`, `gpu-lifecycle.ts` _(Medium)_
- [x] **Headless "serve" mode** - runs Orca without a desktop window, as a server process (for remote/CI use). `src/main/startup/serve-*.ts`, `src/main/server` _(Large)_
- [x] **Main-thread hang watchdog** - a worker thread detects when the Electron main process stalls and reports/recovers. `src/main/hang-watchdog` _(Medium)_
- [x] **Startup diagnostics collection** - gathers environment/build info for troubleshooting startup failures. `src/main/startup/startup-diagnostics.ts` _(Small)_
- [x] **Dev-instance identity separation** - keeps a locally-built dev copy from colliding with an installed release copy. `src/main/startup/dev-instance-identity.ts` _(Small)_
- [x] **Login-shell environment hydration** - launches a login shell once at startup to capture the user's full PATH/env for spawned processes. `src/main/startup/login-shell-environment.ts`, `hydrate-shell-path.ts` _(Medium)_
- [x] **Virtual display bootstrap (Linux headless)** - starts a virtual X display so terminals/browsers work on headless Linux. `src/main/startup/ensure-virtual-display.ts` _(Small)_
- [x] **Skill share deep link handling** - opens an `orca://` deep link to import a shared skill. `src/main/startup/skill-share-deep-link-state.ts` _(Small)_
- [x] **Branch-rename git hook installer** - installs a git hook to keep terminal/session state in sync when a branch is renamed. `src/main/startup/branch-rename-hook.ts` _(Small)_
- [x] **OS "open with" markdown file handling** - lets the OS hand a `.md` file to Orca on open/double-click. `src/main/startup/os-opened-markdown-files.ts` _(Small)_

### Networking & Ports

- [x] **Local dev-server port scanning** - detects ports opened by processes in the user's workspace and lists them. `src/main/ports/local-workspace-port-scanner.ts` _(Medium)_
- [x] **Advertised URL detection/caching for dev servers** - watches terminal output for server URLs and surfaces them as clickable links. `src/main/ports/advertised-url-watcher.ts`, `advertised-url-parsing.ts` _(Medium)_
- [x] **Port ownership attribution** - attributes an open port back to the workspace/agent session that opened it. `src/main/ports/workspace-port-ownership.ts` _(Small)_
- [x] **Proxy settings support (HTTP/HTTPS proxy)** - routes Orca's outbound traffic through a configured proxy, with credential handling. `src/main/network/proxy-settings.ts`, `electron-proxy-credentials.ts` _(Medium)_
- [x] **macOS Tailscale DNS diagnostic** - detects and reports DNS resolution issues caused by Tailscale on macOS. `src/main/network/macos-tailscale-dns-diagnostic.ts` _(Small)_
- [x] **macOS system resolver health check** - verifies the OS DNS resolver is functioning before network operations. `src/main/network/macos-system-resolver-health.ts` _(Small)_
- [x] **Bounded default proxy application** - applies proxy config across Electron sessions/webviews consistently. `src/main/network/bounded-proxy-application.ts` _(Small)_

### Remote/Web Access & Mobile Companion

- [x] **Web UI served over the network** - serves Orca's UI over HTTP/WebSocket so it can be reached from another device/browser. `src/main/server`, `src/main/startup/serve-desktop-activation.ts` _(Large)_
- [ ] **Mobile companion pairing via QR code** - generates a QR code the mobile app scans to pair with the desktop. `src/main/runtime/mobile-pairing-qr.ts`, `mobile-pairing-files.ts` _(Medium)_
- [ ] **End-to-end encrypted mobile pairing** - encrypts the desktop↔mobile WebSocket channel using an ECDH keypair. `src/main/runtime/e2ee-keypair.ts` _(Medium)_
- [ ] **Per-device auth token registry** - issues and revokes a distinct auth token per paired device. `src/main/runtime/device-registry.ts` _(Medium)_
- [ ] **Mobile push notifications for agent status** - sends a push notification to paired mobile devices when an agent needs attention. `src/main/runtime/mobile-notification-*.ts` _(Medium)_
- [ ] **Mobile session tab/terminal mirroring** - projects desktop terminal/browser tabs into the mobile client's own tab model. `src/main/runtime/mobile-session-*.ts` _(Large)_
- [x] **Network exposure guidance / warnings** - warns the user about the security implications of exposing the server on the network. `src/main/runtime/network-exposure-guidance.ts` _(Small)_

### Remote Browser & Chromium Sidecar

- [x] **External Chromium sidecar process management** - launches and manages a separate Chromium process (for agent browser automation) independent of Electron's own browser. `src/main/orcad/external-chromium-browser-process.ts`, `external-chromium-tab-registry.ts` _(Large)_
- [x] **Electron-hosted browser sidecar (fallback)** - serves the same remote-browser role using Electron's own browser when standalone Chromium isn't available. `src/main/orcad/electron-serve-browser-process.ts` _(Medium)_
- [x] **Remote browser command routing over the sidecar** - dispatches browser automation commands (navigate, click, etc.) to whichever browser provider is active. `src/main/orcad/electron-sidecar-method-routing.ts`, `orcad-browser-provider.ts` _(Medium)_
- [x] **Browser download transfer to host** - streams a file downloaded in the remote/sidecar browser back to the local machine. `src/main/runtime/browser-client-download-transfers.ts` _(Medium)_
- [x] **Browser screencast streaming** - streams a live screen feed of the remote browser tab back to the UI. `src/main/runtime/browser-screencast-driver-scope.ts` _(Medium)_

### Agent Session & Process Management

- [x] **Agent session lifecycle (spawn, claim, lease, handoff)** - tracks the lifetime and ownership of each running coding-agent process, including takeover between windows. `src/main/runtime/agent-session-*.ts` _(Large)_
- [x] **Agent session record store (persisted to disk)** - durably records session metadata so sessions can be recovered after restart. `src/main/runtime/agent-session-record-store.ts` _(Medium)_
- [x] **Agent prompt submission verification** - confirms a prompt was actually delivered into the agent's terminal before reporting success. `src/main/runtime/agent-prompt-submission-verification.ts` _(Medium)_
- [x] **Claude Agent Teams - tmux-based multi-agent panes** - emulates a `tmux` interface so multiple agent "teammates" can run in split panes/windows under one team. `src/main/runtime/claude-agent-teams-tmux-dispatcher.ts`, `claude-agent-teams-service.ts` _(Large)_
- [x] **Managed git worktree activation per agent** - creates/activates an isolated git worktree so each agent session works in its own checkout. `src/main/runtime/orca-runtime-activate-managed-worktree.ts`, `orca-runtime-create-managed-worktree.ts` _(Large)_
- [x] **Terminal orphan adoption on relaunch** - reattaches abandoned terminal sessions found in the daemon's inventory back into the UI. `src/main/runtime/orca-runtime-adopt-terminal-orphans-from-inventory.ts` _(Medium)_
- [x] **File watcher host** - watches workspace files for changes and notifies the renderer. `src/main/runtime/file-watcher-host.ts` _(Medium)_
- [x] **Host secret store / secrets protection** - stores API keys and secrets in the OS keychain and audits for secrets leaking into logs. `src/main/host/electron-secret-store.ts`, `secret-protection-report.ts` _(Medium)_
- [x] **Electron speech services bridge** - exposes OS text-to-speech/dictation to the renderer. `src/main/host/electron-speech-services.ts` _(Small)_

### CLI (`orca` command)

- [x] **`orca` CLI for scripting terminals/agents** - a standalone command-line tool to create/list/control terminals and agent sessions from scripts. `src/cli/index.ts`, `src/cli/dispatch.ts` _(Large)_
- [x] **CLI worktree management commands** - create, list, and target git worktrees from the CLI. `src/cli/handlers` (worktree-*), `worktree-selector-recovery.ts` _(Medium)_
- [x] **CLI browser automation commands** - drive the browser sidecar (navigate, click, cookies, storage) from the CLI. `src/cli/browser-format.ts`, `browser-handler-groups.ts` _(Large)_
- [x] **CLI Linear issue commands** - read/write Linear issues from the CLI, formatted for scripting. `src/cli/linear-format.ts`, `linear-request-builders.ts` _(Medium)_
- [x] **CLI Android emulator control** - starts/manages an Android emulator and reads its logcat output. `src/cli/emulator-logcat-format.ts`, `emulator-permissions-args.ts` _(Medium)_
- [x] **CLI skill install/reference commands** - installs bundled agent "skills" and looks up skill docs from the CLI. `src/cli/bundled-skill-guides.ts`, `skills-command-flag-help.ts` _(Medium)_
- [x] **CLI remote/host execution flag** - routes a CLI command to run against a specific remote SSH host instead of local. `src/cli/execution-host-flag.ts`, `host-selector-alternatives.ts` _(Medium)_
- [x] **CLI automation scheduling** - schedules a recurring automated command run from the CLI. `src/cli/automation-format.ts`, `automation-owner-conflict-recovery.ts` _(Medium)_

### Relay / IPC Backend (internal?)

- [x] **Relay dispatcher (renderer↔main RPC transport)** - the framed request/response/notification protocol connecting the UI to filesystem, git, PTY, and browser backends. `src/relay/dispatcher.ts`, `relay.ts` _(Large)_ `(internal?)`
- [x] **Filesystem operations handler (read/list/watch files)** - serves file read, directory listing, and search (ripgrep) requests from the UI. `src/relay/fs-handler.ts`, `fs-handler-list-files.ts` _(Large)_
- [x] **Git operations handler** - runs and streams git commands (status, diff, worktree, branch, submodules) requested by the UI. `src/relay/git-handler.ts`, `git-handler-worktree-operations.ts` _(Large)_
- [x] **Agent hook server** - receives lifecycle hook callbacks (e.g. from Claude Code) about agent status/transcript. `src/relay/agent-hook-server.ts` _(Large)_
- [x] **AI Vault secret storage service** - a separate sandboxed service that stores and injects API keys for agents without exposing them to agent processes directly. `src/relay/ai-vault-service-*.ts` _(Large)_
- [x] **External automation providers execution** - runs registered third-party automation providers (e.g. scripted integrations) from the relay. `src/relay/external-automation-provider.ts`, `external-automations-handler.ts` _(Medium)_
- [x] **Managed git hook installer** - installs Orca's own git hooks (e.g. post-commit) into a workspace repo. `src/relay/managed-hook-installer.ts` _(Small)_
- [x] **node-pty native binding diagnosis** - detects and reports why the native PTY module failed to load (ABI mismatch, missing binary). `src/relay/node-pty-binding-survey.ts`, `node-pty-unavailable-diagnosis.ts` _(Medium)_
- [x] **Filesystem watch registry** - manages OS file-watcher subscriptions requested by the renderer, with per-root capacity limits. `src/relay/relay-filesystem-watch-registry.ts`, `relay-watcher-root-capacity.ts` _(Medium)_
- [x] **Workspace disk-space scan (`du`)** - reports on-disk size of a workspace/worktree. `src/relay/workspace-space-scan.ts` _(Small)_
- [x] **Windows port scan (relay-side)** - scans local listening ports on Windows for the relay's port features. `src/relay/windows-port-scan.ts` _(Small)_
- [x] **WSL hook/filesystem bridge** - bridges relay filesystem and agent-hook calls into a WSL guest. `src/relay/wsl-hook-fs-bridge.ts`, `wsl-agent-hook-relay.ts` _(Medium)_

### Preload Bridge (internal?)

- [x] **Secure IPC bridge (contextBridge API surface)** - the whitelisted API exposed from Electron's main process into the sandboxed renderer. `src/preload/index.ts`, `src/preload/api` _(Large)_ `(internal?)`
- [x] **In-app markdown/doc link preview** - intercepts clicked links to preview a document instead of opening a browser. `src/preload/doc-preview-link.ts` _(Small)_
- [x] **Renderer heap/memory diagnostics** - reports renderer process memory usage for performance monitoring. `src/preload/renderer-heap-statistics-reader.ts`, `renderer-process-memory-reader.ts` _(Small)_
- [x] **App restart with checkpoint routing** - restarts the Electron app while preserving in-flight terminal/session checkpoints. `src/preload/app-restart-checkpoint-routing.ts` _(Small)_

---

## Part 4. User interface and desktop shell

### Window, App Shell & Chrome

- [x] **Custom titlebar with window controls** - Frameless window chrome with app-drawn title bar, traffic lights/min-max-close, drag regions. `src/renderer/src/app-shell` _(Medium)_
- [x] **Split-pane multi-agent workspace shell** - Root layout hosting sidebar, tab groups, and panes so multiple agent sessions run side by side. `src/renderer/src/app-shell` _(Large)_
- [x] **Background services bootstrapper** - Wires up cross-cutting renderer services (sync, notifications, telemetry) at app start. `src/renderer/src/app-shell/AppBackgroundServices.tsx` _(Medium)_
- [x] **Workspace tab rename/delete commands** - In-app commands for renaming and deleting a workspace tab. `src/renderer/src/app-shell` _(Small)_
- [x] **Session/tab restore on relaunch** - Reconciles and rehydrates workspace tabs and shutdown checkpoints across app restarts. `src/renderer/src/app-shell` _(Medium)_
- [x] **System tray icon with status** - Tray icon reflecting attention/dev-build state, minimize-to-tray. `src/main/tray` _(Small)_
- [x] **Dock unread badge (macOS)** - Badges the Dock icon with unread/attention count. `src/main/dock` _(Small)_
- [x] **Native application menu** - Standard OS app menu (File/Edit/View/Window) with custom items and About panel GPU info. `src/main/menu` _(Small)_
- [x] **Remappable global keybindings** - User-editable keybinding file + service resolving shortcuts app-wide. `src/main/keybindings`, `src/renderer/src/lib/keyboard-layout` _(Medium)_
- [x] **Desktop notifications** - OS notification delivery with "away" detection to avoid over-notifying. `src/main/notifications` _(Small)_
- [x] **Renderer crash recovery** - Detects renderer crash/hang and reloads with a recovery prompt/watchdog. `src/main/window`, `src/renderer/src/components/crash-report`, `src/renderer/src/components/error-boundaries` _(Medium)_
- [x] **Clipboard integration (text/image/file)** - Copy/paste of text, images (with thumbnailing), and files, including remote-host staging. `src/main/window` (clipboard-*) _(Medium)_
- [x] **In-app auto-updater with progress card** - Checks for updates, downloads, shows progress/error card, restarts to apply. `src/main/updater`, `src/renderer/src/components/maintenance` _(Medium)_
- [x] **macOS Tahoe/Sequoia release-specific chrome tweaks** - Adjusts window chrome for newer macOS visual conventions. `src/main/window` _(internal?)_ _(Small)_
- [x] **Editable-field native context menu** - OS-native cut/copy/paste context menu in text fields. `src/main/window/editable-context-menu.ts` _(Small)_

### Command Palette & Quick Actions

- [x] **Cmd+J command palette** - Global fuzzy-searchable command palette for jumping to projects, agents, and actions. `src/renderer/src/components/cmd-j` _(Large)_
- [x] **Live status rows in palette** - Palette entries show live agent/host status badges while searching. `src/renderer/src/components/cmd-j` _(Small)_
- [x] **Terminal quick commands** - Saved, reusable terminal command snippets with scoping and toggle options, run from a dialog. `src/renderer/src/components/terminal-quick-commands` _(Medium)_
- [x] **Link action popover** - Popover offering actions (open, copy, send-to-agent) on detected links. `src/renderer/src/components/link-actions` _(Small)_

### Dashboards & Agent Monitoring

- [x] **Agent dashboard drawer** - Slide-out drawer listing all running/finished agents with status and settings. `src/renderer/src/components/dashboard` _(Large)_
- [x] **Dashboard pop-out window** - Detaches the agent dashboard into its own OS window. `src/renderer/src/components/dashboard-popout`, `src/main/window/dashboard-popout-window.ts` _(Medium)_
- [x] **Agent map / board view with lineage** - Visual canvas showing agent relationships, lineage chevrons, zoom/pan, filtering. `src/renderer/src/components/dashboard-popout` (agent-map-*) _(Large)_
- [x] **Dashboard bucket/status counts** - Aggregated counts of agents by status shown in dashboard summary. `src/renderer/src/components/dashboard` _(Small)_
- [x] **Orchestration/usage overview pages** - Marketing-style in-app pages summarizing orchestration and per-account usage. `src/renderer/src/components/feature-wall/agents-orchestration` _(Medium)_
- [x] **Activity feed / notification center** - Chronological feed of agent events with auto-mark-read, filtering, caching. `src/renderer/src/components/activity` _(Large)_
- [x] **Status bar with provider usage** - Bottom/top status bar segment showing inline usage bars, caffeinate state, pet, ports popover. `src/renderer/src/components/status-bar` _(Medium)_
- [x] **Provider account switcher menus** - Quick-switch menus for Claude/Codex accounts from the status bar. `src/renderer/src/components/status-bar` _(Small)_
- [x] **Usage stats panes (Claude/Codex/OpenCode/Grok)** - Per-provider daily usage charts and detail panels. `src/renderer/src/components/stats` _(Medium)_
- [x] **Shareable usage card** - Generates a shareable image/card of usage stats. `src/renderer/src/components/stats/ShareUsageCard.tsx` _(Small)_
- [x] **Desktop pet overlay** - Animated on-screen "pet" companion reflecting agent activity state. `src/renderer/src/components/pet` _(Medium)_

### Agent Interaction Surfaces

- [x] **Native in-app agent chat pane** - Chat-style composer/thread UI for talking to an agent (vs raw terminal). `src/renderer/src/components/native-chat`, `src/main/native-chat` _(Large)_
- [x] **Agent combobox / picker** - Searchable dropdown for choosing which agent/CLI to run. `src/renderer/src/components/agent` _(Small)_
- [x] **Per-agent settings dialog** - Dialog for configuring an individual agent's options. `src/renderer/src/components/agent/AgentSettingsDialog.tsx` _(Small)_
- [x] **Agent session continuation dialog** - Prompts to resume/continue a prior agent session. `src/renderer/src/components/agent-session-continuation` _(Small)_
- [x] **Composer with attachments/dictation/drag-drop** - Rich prompt composer supporting file/image attachments, autogrow, drop targets. `src/renderer/src/hooks/composer-state` _(Large)_
- [ ] **Voice dictation** - Press-and-hold mic dictation with audio meter and insertion into composer. `src/renderer/src/components/dictation` _(Medium)_
- [x] **Background/detached agent tasks** - Runs and tracks agent tasks not tied to a visible foreground pane. `src/renderer/src/components/native-chat` (background-task-*) _(Medium)_
- [x] **Skill catalog & install management** - Browse, install, delete, and check freshness of agent skills. `src/renderer/src/components/skills` _(Medium)_
- [x] **Plugin catalog** - Browse and manage installed plugin bundles for agents. `src/renderer/src/components/plugin-catalog` _(Small)_
- [x] **New workspace composer** - Guided form to start a new agent workspace (project, agent, run target, worktree). `src/renderer/src/components/new-workspace` _(Large)_
- [x] **Worktree creation panel** - Panel for creating a new git worktree as part of workspace setup. `src/renderer/src/components/worktree-creation` _(Small)_
- [x] **Parent worktree picker** - Choose which existing worktree/branch to branch a new session from. `src/renderer/src/components/new-workspace/ComposerParentWorktreePicker.tsx` _(Small)_

### Terminal

- [ ] **Multi-pane terminal with splits** - xterm-based terminal supporting infinite splits, tabs, and background mounting. `src/renderer/src/components/terminal`, `src/renderer/src/components/terminal-pane` _(Large)_
- [ ] **Floating/detachable terminal panel** - A terminal window that floats above the app, draggable/resizable. `src/renderer/src/components/floating-terminal` _(Medium)_
- [ ] **Agent completion detection in terminal** - Watches terminal output/hooks to detect when an agent turn finished, for notifications. `src/renderer/src/components/terminal-pane` (agent-completion-*) _(Large)_
- [ ] **Terminal themes** - Selectable color themes for the terminal. `src/renderer/src/lib/terminal-themes` _(Small)_
- [ ] **Terminal quick-command palette in tab bar** - Search/run saved terminal commands from the tab strip. `src/renderer/src/components/tab-bar` (hosted-terminal-quick-command-search.ts) _(Small)_

### Editor & Diff/Review

- [ ] **In-app Monaco code editor tabs** - Multi-tab code editing surface with file tabs. `src/renderer/src/components/editor`, `src/renderer/src/components/tab-bar` (EditorFileTab*) _(Large)_
- [ ] **Changes/diff mode view** - Git-changes-focused view mode for reviewing modified files. `src/renderer/src/components/editor/ChangesModeView.tsx` _(Medium)_
- [ ] **Inline diff comments** - Add/view threaded comments anchored to diff lines, like a PR review. `src/renderer/src/components/diff-comments` _(Medium)_
- [ ] **CI check run details & annotations panel** - Shows CI job/check status, logs, annotations, and a "Fix with AI" action. `src/renderer/src/components/editor` (CheckRun*) _(Medium)_
- [ ] **Monaco language support bundle** - Configures/extends language services for the embedded editor. `src/renderer/src/lib/monaco-languages` _(Small)_
- [ ] **Source-control action variable chips** - Templated variable chips for git/source-control custom actions. `src/renderer/src/components/source-control` _(Small)_
- [ ] **Sparse checkout presets** - UI to select/save sparse-checkout presets for large repos. `src/renderer/src/components/sparse` _(Small)_

### GitHub / GitLab / Linear / Jira Integration

- [ ] **Unified task page (multi-provider issue/PR list)** - Cross-provider list/board of GitHub, GitLab, Jira, and Linear items with filters. `src/renderer/src/components/task-page` _(Large)_
- [ ] **GitHub PR/issue detail dialog** - Rich dialog for viewing/discussing/editing a GitHub issue or PR (conversation, checks, files, reviewers). `src/renderer/src/components/github-item-dialog` _(Large)_
- [ ] **Full GitHub PR review page** - Dedicated page for reviewing a PR: files diff, checks, comments, reviewers, merge actions. `src/renderer/src/components/pull-request-page` _(Large)_
- [ ] **GitHub markdown composer with preview** - Tabbed write/preview markdown editor for GitHub comments/descriptions with mentions and image paste. `src/renderer/src/components/github` _(Medium)_
- [ ] **GitHub Projects board view** - In-app view of a GitHub Projects (v2) board with column resize, grouping. `src/renderer/src/components/github-project` _(Large)_
- [ ] **GitHub duplicate-issue detection** - Suggests likely duplicate issues while filing a new one. `src/renderer/src/components/github/github-duplicate-issue-candidates.ts` _(Small)_
- [ ] **GitHub rate-limit indicator** - Shows remaining API rate limit for the connected GitHub account. `src/renderer/src/components/github/github-rate-limit-display.tsx` _(Small)_
- [ ] **GitLab issue/MR dialog** - Tabbed dialog (conversation, description, files, pipeline) for GitLab items. `src/renderer/src/components/gitlab-item-dialog` _(Medium)_
- [ ] **GitLab rate-limit indicator** - Shows remaining GitLab API quota. `src/renderer/src/components/gitlab/gitlab-rate-limit-display.tsx` _(Small)_
- [ ] **Jira issue browsing & connect flow** - Connect a Jira account and browse/filter issues, open issue dialog. `src/renderer/src/components/task-page/jira` _(Medium)_
- [ ] **Linear issue board & project views** - Kanban board, list, and project overview for Linear issues/projects with connect flow. `src/renderer/src/components/task-page/linear` _(Large)_

### Onboarding, Tips & Guidance

- [ ] **First-run onboarding flow** - Multi-step wizard (agent pick, integrations, notifications) shown to new users. `src/renderer/src/components/onboarding` _(Large)_
- [ ] **Setup guide modal with progress ring** - Persistent checklist modal tracking setup completion (browser, agents, etc.) with telemetry. `src/renderer/src/components/setup-guide` _(Medium)_
- [ ] **Contextual product tours** - Step-by-step overlay tours pointing at specific UI elements. `src/renderer/src/components/contextual-tours` _(Medium)_
- [ ] **Feature tip modals** - One-off dialogs introducing a feature (CLI install, Cmd+J palette, dictation) at the right moment. `src/renderer/src/components/feature-tips` _(Medium)_
- [ ] **Feature wall / capability showcase pages** - In-app marketing pages showcasing browser, mobile, and integration features with animated visuals. `src/renderer/src/components/feature-wall` _(Large)_
- [ ] **"Star the repo" nag toast** - Occasional toast nudging engaged users to star the GitHub repo. `src/renderer/src/components/star-nag` _(Small)_

### Browser Pane & Design Mode

- [ ] **Embedded Chromium browser pane** - Full in-app browser tab with address bar, navigation, find-in-page, tabs. `src/renderer/src/components/browser-pane` _(Large)_
- [ ] **Browser annotate/markup tool** - Draw shapes/markup on a captured page screenshot and send to an agent. `src/renderer/src/components/browser-pane/annotate` _(Large)_
- [ ] **"Grab" element capture (Design Mode)** - Click a page element to capture its HTML/CSS/screenshot into an agent prompt. `src/renderer/src/components/browser-pane` (grab-*) _(Medium)_
- [ ] **Browser download/permission/popup notices** - In-pane banners for download, permission-request, and popup events. `src/renderer/src/components/browser-pane` (browser-client-hosted-*) _(Small)_
- [ ] **Custom address/host picker** - Address bar with suggestions and a picker for custom hosts/ports. `src/renderer/src/components/network` _(Small)_
- [ ] **Workspace port scanner** - Detects and lists locally listening ports for a workspace, for quick open. `src/renderer/src/components/ports` _(Small)_

### Mobile Emulator & Companion

- [ ] **Android emulator pane** - Embedded Android device emulator with hardware buttons, keyboard paste, gestures. `src/renderer/src/components/emulator-pane`, `src/main/emulator` _(Large)_
- [ ] **Mobile companion pairing page** - In-app hero/help page for pairing the Orca mobile app (QR/network interface picker, Android APK help). `src/renderer/src/components/mobile` _(Medium)_

### Settings & Accounts

- [ ] **Settings pane (multi-section)** - Central settings surface covering accounts, network, advanced options. `src/renderer/src/components/settings` _(Large)_
- [ ] **Multi-provider account management** - Connect/sign-in/sign-out flows per AI provider (Claude, Codex, MiniMax, etc.) with removal confirmation dialogs. `src/renderer/src/components/settings` (accounts-pane-*) _(Large)_
- [ ] **Unexpected sign-out recovery card** - Notifies and helps re-auth when a provider account is unexpectedly signed out. `src/renderer/src/components/unexpected-signout` _(Small)_
- [ ] **Orca profile sign-out confirmation** - Confirms before signing out of an Orca account profile. `src/renderer/src/components/orca-profiles` _(Small)_
- [ ] **Advanced network settings search** - Searchable settings list for network/proxy configuration. `src/renderer/src/components/settings/advanced-network-search.ts` _(Small)_

### Sidebar, Workspaces & Repos

- [ ] **Project/repo sidebar tree** - Primary navigation tree of projects, repos, and worktree workspaces. `src/renderer/src/components/sidebar` _(Large)_
- [ ] **Add repo / remote host dialog** - Dialog to add a local or SSH remote repo, browse folders/hosts. `src/renderer/src/components/sidebar` (AddRepo/AddRemoteHost) _(Large)_
- [ ] **Nested-repo detection checklist** - Warns about and lets users select nested git repos when adding a folder. `src/renderer/src/components/repo/NestedRepoChecklist.tsx` _(Small)_
- [ ] **Repo combobox with fork indicator** - Repo picker showing icon, fork badge, and multi-select. `src/renderer/src/components/repo`, `src/renderer/src/components/ui/repo-multi-combobox` _(Small)_
- [ ] **Workspace emoji picker** - Assign an emoji (with shortcode autocomplete) to a workspace/project. `src/renderer/src/components/workspace-emoji` _(Small)_
- [ ] **Workspace cleanup wizard** - Scans for inactive/stale worktree workspaces and helps bulk-remove them with facets and git evidence. `src/renderer/src/components/workspace-cleanup` _(Large)_
- [ ] **Workspace "space" overview page** - Landing page for a project/workspace grouping. `src/renderer/src/components/workspace-space` _(Small)_
- [ ] **Right sidebar activity/AI-vault bar** - Secondary sidebar with activity bar buttons, position menu, and AI-vault pane access. `src/renderer/src/components/right-sidebar` _(Large)_
- [ ] **AI Vault credential/secrets pane** - Original-pane UI for scanning and managing secret/credential findings ("AI vault"). `src/renderer/src/components/right-sidebar` (ai-vault-*), `src/main/ai-vault`, `src/main/ai-vault-search` _(Large)_

### Tabs & Panes

- [ ] **Draggable tab groups with drop zones** - Tabs can be dragged between groups/panes with hover previews and drop indicators. `src/renderer/src/components/tab-group` _(Large)_
- [ ] **Editor/browser/terminal tab bar** - Unified tab strip for editor files, browser tabs, and hosted terminals, with context menus. `src/renderer/src/components/tab-bar` _(Large)_
- [ ] **Retained-pane host (keep-alive panes)** - Keeps certain panes (browser/AI-vault) mounted in the background across tab switches. `src/renderer/src/components/tab-group/RetainedPaneHost.tsx` _(Medium)_

### Artifacts

- [ ] **Artifact collection/gallery view** - Table/list view of published Claude Artifacts with search, sort, toolbar. `src/renderer/src/components/artifacts` _(Large)_
- [ ] **Artifact preview & detail drawer** - Inline preview and a detail drawer with header/actions for a single artifact. `src/renderer/src/components/artifacts` _(Medium)_
- [ ] **Artifact publish flow** - Publishes/updates an artifact and manages its published link and cloud sync. `src/renderer/src/components/artifacts` (artifact-publish-flow.ts), `src/main/artifacts` _(Medium)_

### Automations

- [ ] **Automation editor (scheduled/triggered agent runs)** - Create/edit automations that launch agents on a schedule or external trigger, with destination and project targeting. `src/renderer/src/components/automations` _(Large)_
- [ ] **Automation delete confirmation preference** - Remembers user's choice to skip delete confirmations for automations. `src/renderer/src/components/automations/automation-delete-confirm-preference.ts` _(Small)_

### Localization

- [ ] **Multi-language UI (6 locales)** - Full renderer UI translated into English, Spanish, French, Japanese, Korean, and Chinese (README also references pt/zh-CN docs). `src/renderer/src/i18n/locales`, `src/main/i18n` _(Large)_
- [ ] **Main-process lazy locale loading** - Loads locale bundles for main-process UI (menus, notifications) on demand. `src/main/i18n/main-i18n.ts` _(Small)_
- [ ] **Localized contextual-tour/dictation copy** - Ensures overlay and indicator copy respects locale (dedicated localization tests). `src/renderer/src/components/contextual-tours`, `src/renderer/src/components/dictation` _(internal?)_ _(Small)_

### UI Foundation & Theming

- [ ] **Shared shadcn-style UI kit** - Design-system primitives (button, dialog, dropdown, popover, command, accordion, etc.) used app-wide. `src/renderer/src/components/ui` _(Large)_
- [ ] **Dark/light theming via CSS tokens** - Token-based theme system (monochrome-first, git-decoration colors) switching light/dark. `src/renderer/src/assets/main.css`, `docs/STYLEGUIDE.md` _(Medium)_
- [ ] **Color picker component** - Custom color-swatch picker used in settings/workspace customization. `src/renderer/src/components/ui/color-picker.tsx` _(Small)_
- [ ] **Palette/theme matching for terminal & UI** - Matches terminal/OS color schemes to app palette. `src/renderer/src/lib/palette-match` _(Small)_

### Startup & Session Sync

- [ ] **Startup action restoration** - Determines and replays what should reopen/run when the app launches. `src/renderer/src/startup`, `src/renderer/src/app-shell/startup-actions-selector.ts` _(Medium)_
- [ ] **Cross-device session tab sync (local & web)** - Syncs open session tabs between local app instances and a web/mobile client. `src/renderer/src/runtime/local-structured-session-tabs-sync`, `src/renderer/src/runtime/web-session-tabs-sync` _(Large)_
- [ ] **Web/mobile companion renderer** - A separate lightweight web build of the renderer for the mobile companion app. `src/renderer/src/web` _(Large)_

### Misc Utility Surfaces

- [ ] **Sound/typing-latency instrumentation** - Measures and reports input latency (perf-focused, likely internal). `src/renderer/src/lib/typing-latency` _(internal?)_ _(Small)_
- [ ] **SSH host UI helpers** - Renderer-side SSH connection status glyphs and remote host forms. `src/renderer/src/ssh`, `src/renderer/src/components/sidebar/AddRemoteHostServerFormPanel.tsx` _(Medium)_
- [ ] **Linux package-install recovery card** - Helps Linux users recover from a failed native package install. `src/renderer/src/components/LinuxPackageInstallRecoveryCard.tsx` _(Small)_

---

## Part 5. Automation, storage and platform services

### Automations

- [ ] **In-app scheduled automations** - define automations that run agent prompts on a schedule/trigger against a workspace. `src/main/automations`, `src/main/persistence/scheduling-automations` _(Large)_
- [ ] **Automation dispatch & precheck** - validates and launches an automation run (target resolution, precheck, refusal handling). `src/main/automations/service.ts`, `precheck-runner.ts`, `dispatch-refusal.ts` _(Medium)_
- [ ] **Automation run history & output snapshots** - persists run outcomes, terminal output, and reconciles retained runs. `src/main/automations/automation-run-writer.ts`, `retained-run-reconciliation.ts` _(Medium)_
- [ ] **Headless automation dispatch** - run automations without an open terminal/window, capturing output snapshots. `src/main/automations/headless-dispatch*.ts` _(Medium)_
- [ ] **External automation manager integration (Hermes/OpenClaw cron)** - discovers and relays jobs from external cron-style automation managers over SSH. `src/main/automations/external-manager*.ts`, `hermes-cron-*.ts` _(Large)_
- [ ] **Automation ownership/host fencing & migration** - reassigns/migrates automation ownership across hosts/workspaces safely. `src/main/automations/automation-owner-migration.ts`, `automations/workspace-provenance.ts` _(Medium)_
- [ ] **Run usage collection** - aggregates token/usage stats per automation run. `src/main/automations/run-usage-collection.ts` _(internal?)_ _(Small)_

### Plugin system

- [ ] **Third-party plugin platform** - install, run, and manage extensions in an isolated worker process with a host-call API. `src/main/plugins` _(Large)_
- [ ] **Plugin marketplace (incl. official + private marketplaces)** - browse/install plugins from Git-based marketplaces, including private SSH-hosted ones. `src/main/plugins/plugin-marketplace-*.ts`, `plugin-private-marketplace-ssh-shim.cjs` _(Large)_
- [ ] **Plugin sandboxed worker process pool** - spawns/supervises/restarts plugin workers with slot pooling and idle reaping. `src/main/plugins/plugin-worker-*.ts`, `plugin-supervisor.ts` _(Large)_
- [ ] **Plugin consent & activation policy** - per-plugin enable/disable and consent list tracking shown to the user. `src/main/plugins/plugin-activation-policy.ts`, `plugin-enablement.ts` _(Medium)_
- [ ] **Plugin panels (UI surface for plugins)** - plugins can render an in-app panel; controller manages lifecycle/navigation/sessions. `src/main/plugins/plugin-panel-*.ts` _(Medium)_
- [ ] **Plugin secrets vault** - OS-keychain-backed secret storage scoped per plugin. `src/main/plugins/plugin-secrets-store.ts` _(Small)_
- [ ] **Plugin key-value storage** - persistent storage API plugins can use. `src/main/plugins/plugin-storage-store.ts` _(Small)_
- [ ] **Plugin content integrity/hash verification** - verifies installed plugin trees against content hashes to detect tampering. `src/main/plugins/plugin-content-hash.ts`, `plugin-content-integrity.ts`, `plugin-instructional-content-integrity.ts` _(Medium)_
- [ ] **Plugin install provenance & lockfile** - tracks where an installed plugin came from and locks versions. `src/main/plugins/plugin-install-provenance.ts`, `plugin-install-lockfile-store.ts` _(Medium)_
- [ ] **PHONE-HOME: Plugin kill-list (remote plugin disable)** - fetches a remote JSON list from `onorca.dev` and force-disables listed plugins/versions. `src/main/plugins/plugin-kill-list-service.ts`, `plugin-kill-list-store.ts` _(Small)_
- [ ] **Plugin audit log** - append-only local JSONL log of host-API mutations performed on a user's behalf by plugins. `src/main/plugins/plugin-audit-log.ts` _(Small)_ (local-only, not phone-home)
- [ ] **Plugin VM recipe registry** - plugins can register approved VM/ephemeral-environment recipes. `src/main/plugins/plugin-approved-vm-recipes.ts`, `plugin-vm-recipe-registry.ts` _(Small)_
- [ ] **Plugin language pack registry** - plugins can ship localization/language packs. `src/main/plugins/plugin-language-pack-registry.ts` _(Small)_
- [ ] **Plugin dev-mode hot reload** - watches a plugin's dev folder and reloads it live. `src/main/plugins/plugin-dev-watcher.ts`, `plugin-bundled-bootstrap*.ts` _(Small)_
- [ ] **Plugin event bus** - pub/sub dispatch of app events into plugin listeners. `src/main/plugins/plugin-event-bus.ts`, `plugin-event-delivery.ts` _(Medium)_
- [ ] **Plugin command palette integration** - plugins can register invokable commands. `src/main/plugins/plugin-command-registry.ts`, `plugin-command-invocation.ts` _(Small)_

### Skills library (shareable agent skills)

- [ ] **Local skill discovery** - scans repos/known roots for agent "skill" files and summarizes them. `src/main/skills/discovery.ts`, `skill-discovery-sources.ts` _(Medium)_
- [ ] **Skill install/uninstall pipeline** - transactional install, placement, recovery, and removal of skill packages onto disk (incl. WSL). `src/main/skills/skill-install-*.ts`, `skill-placement-*.ts`, `skill-remove-*.ts`, `skills/skill-delete` _(Large)_
- [ ] **Skill packaging (tar/gzip archives)** - creates/extracts deterministic skill package archives with content hashing. `src/main/skills/skill-package-*.ts`, `skill-bundle-*.ts` _(Medium)_
- [ ] **Skill cloud sharing/publishing** - publish a local skill to Orca's cloud, generate shareable links, manage owned shares. `src/main/skills/skill-cloud-*.ts`, `skill-share-preparation-service.ts` _(Large)_
- [ ] **Skill remote/cross-host install** - install a skill onto a remote SSH-connected host via relay. `src/main/skills/skill-remote-install-service.ts`, `skill-ssh-relay-*.ts`, `skill-client-mediated-transfer.ts` _(Large)_
- [ ] **Skill freshness/update tracking** - checks installed skills against upstream versions and reports what can be updated. `src/main/skills/skill-freshness-*.ts`, `skill-update-*.ts` _(Medium)_
- [ ] **Skill install locking & crash recovery** - prevents concurrent installs and recovers/rolls back interrupted install transactions on startup. `src/main/skills/skill-install-lock*.ts`, `skill-transaction-startup-recovery.ts`, `skill-extraction-recovery.ts` _(Medium)_
- [ ] **Agent-driven skill selection** - logic for an agent to pick which installed skill to invoke. `src/main/skills/agent-skill-selection.ts` _(internal?)_ _(Small)_

### Persistence & storage

- [ ] **Local JSON app-state store with migrations** - the core persisted store (settings, sessions, repos, automations, ptys) with versioned schema migrations, backups, and crash-safe writes. `src/main/persistence/loading-store` _(Large)_
- [ ] **Session/workspace restore on relaunch** - restores terminal panes, tabs, and floating workspaces from the last session. `src/main/persistence/restoring-sessions` _(Large)_
- [ ] **Settings persistence & migrations** - applies and migrates user settings (source control, terminal, onboarding, UI state). `src/main/persistence/applying-settings` _(Medium)_
- [ ] **Repo/project tracking store** - tracks registered repos, project groups, and worktree metadata with pruning of stale entries. `src/main/persistence/tracking-repos` _(Large)_
- [ ] **SSH PTY lease persistence** - persists which remote PTYs are leased/bound to which panes for reconnection after restart. `src/main/persistence/leasing-ssh-ptys` _(Medium)_
- [ ] **Local SQLite storage layer** - wraps Node's built-in SQLite for structured local data, with file permission hardening. `src/main/sqlite` _(Small)_
- [ ] **Secret redaction at rest** - substitutes secrets with sentinels before writing state to disk. `src/main/persistence/loading-store/secret-sentinel-substitution.ts`, `state-serialization-secret-handling.ts` _(Small)_ (security, not really "droppable")

### Stats

- [ ] **Local usage stats collector** - counts local product-usage events (e.g., PRs created) capped in size, written to a local stats file. `src/main/stats` _(Medium)_
- [ ] **Agent session transition recorder** - records agent session state transitions for stats purposes. `src/main/stats/agent-session-transition-recorder.ts` _(internal?)_ _(Small)_

### PHONE-HOME / TELEMETRY

- [ ] **PHONE-HOME/TELEMETRY: Anonymous product telemetry (PostHog)** - opt-in/opt-out analytics client sending named events (with per-event/session burst caps, cohort classification) to PostHog. `src/main/telemetry` _(Large)_
- [ ] **PHONE-HOME/TELEMETRY: Telemetry consent management** - resolves and stores the user's telemetry opt-in/out state, incl. env/CI overrides. `src/main/telemetry/consent.ts` _(Small)_
- [ ] **PHONE-HOME/TELEMETRY: Anonymous install ID** - generates/persists a random per-install identifier used to key telemetry (not tied to identity). `src/main/telemetry/install-id.ts` _(Small)_
- [ ] **PHONE-HOME: Diagnostic bundle upload** - user-initiated upload of a redacted local log/trace bundle to Orca's servers for support. `src/main/observability/diagnostic-bundle-upload.ts`, `diagnostic-upload-endpoint.ts`, `diagnostic-upload-http.ts` _(Medium)_ (explicitly user-initiated, not passive)
- [ ] **PHONE-HOME/NAG: GitHub-star nag prompt** - detects "value moments" and usage thresholds, then nags the user in-app to star the GitHub repo (checks star status via GitHub API). `src/main/star-nag` _(Large)_
- [ ] **PHONE-HOME: Auto-update nudge/campaign polling** - polls a remote "nudge" feed to show update campaign banners the user can dismiss. `src/main/updater/updater-nudge.ts` _(Small)_

### Observability & crash reporting

- [ ] **Local structured tracing/spans** - in-process span recorder (NDJSON) for IPC, agent sessions, git ops, PTY, updater, etc., written to local diagnostic files. `src/main/observability/tracer.ts`, `instrumentation.ts` _(Medium)_
- [ ] **Local rotating log sink** - writes app logs to rotated local files. `src/main/observability/local-file-sink.ts`, `logs-directory.ts` _(Small)_
- [ ] **Log/trace redaction** - scrubs secrets/PII from logs and diagnostic bundles before they're stored or uploaded. `src/main/observability/redactor.ts` _(Small)_
- [ ] **Crash breadcrumb trail** - durable local ring-buffer of recent app events used to explain a crash after the fact. `src/main/crash-reporting/crash-breadcrumb-store.ts`, `durable-crash-breadcrumb.ts`, `suppressed-process-gone-breadcrumb.ts` _(Medium)_
- [ ] **Local crash report store & user feedback** - stores native crash reports (Crashpad minidumps) locally and lets user attach a feedback note/diagnostic bundle. `src/main/crash-reporting/crash-report-store.ts`, `crash-feedback-diagnostic-bundle.ts`, `crash-report-copy-text.ts` _(Large)_
- [ ] **PHONE-HOME: Crash report submission** - sends crash reports to Orca's crash-ingestion service (via `ipc/crash-reporting-submission.ts`). `src/main/crash-reporting`, `src/main/ipc/crash-reporting*.ts` _(Medium)_
- [ ] **GPU crash detection & software-rendering fallback** - detects repeated GPU-process crashes and offers/auto-applies a software rendering fallback with restart prompt. `src/main/crash-reporting/gpu-*.ts` _(Medium)_
- [ ] **Renderer crash recovery circuit breaker** - auto-restarts a crashed renderer process with backoff, avoiding crash loops. `src/main/crash-reporting/renderer-recovery-circuit-breaker.ts` _(Medium)_
- [ ] **Process-exit diagnostics (sibling correlation)** - classifies why a child process died and correlates it with sibling process deaths for better crash context. `src/main/crash-reporting/process-gone-*.ts` _(Medium)_ _(internal?)_
- [ ] **Main-thread stall/churn diagnostics probe** - opt-in env-flag diagnostic that detects main-thread blocking (macOS "Performance Diagnostics" style). `src/main/diagnostics/main-thread-churn-probe.ts` _(Small)_ _(internal?)_

### Auto-update

- [ ] **Auto-update with release channels** - checks for, downloads, and installs app updates across stable/beta/dev channels. `src/main/updater` _(Large)_
- [ ] **Update scheduling & retry backoff** - periodic background update checks with retry/backoff timers. `src/main/updater/updater-scheduling.ts` _(Small)_
- [ ] **Prerelease/rollback-safe release feed pinning** - pins to a release feed and falls back once if a prerelease manifest is missing. `src/main/updater/updater-release-feed.ts` _(Medium)_
- [ ] **Remote/server update status & install (headless hosts)** - surfaces and drives updates for Orca running on a remote/server host, not just local. `src/main/updater/updater-remote-status.ts`, `updater-download-install.ts` _(Medium)_
- [ ] **Update package recovery** - recovers from a corrupted/partial downloaded update package. `src/main/updater/updater-package-recovery.ts` _(Small)_
- [ ] **Update menu integration** - "Check for Updates" app-menu wiring and status. `src/main/updater/updater-menu-checks.ts` _(Small)_

### Orca cloud profiles / accounts

- [ ] **Orca cloud account sign-in (OAuth/PKCE)** - sign in to an Orca cloud account, linking a local profile to a cloud identity. `src/main/orca-profiles/profile-cloud-auth-*.ts`, `profile-cloud-pkce.ts`, `profile-cloud-session-*.ts` _(Large)_
- [ ] **Multiple local profiles + cloud linking** - supports multiple local Orca profiles, each optionally linked to a cloud org. `src/main/orca-profiles/profile-index-store.ts`, `profile-cloud-index.ts` _(Medium)_
- [ ] **Org selection & membership management** - pick active org, invite/remove members, change roles. `src/main/orca-profiles/profile-cloud-org-*.ts` _(Large)_
- [ ] **Project transfer between profiles/orgs** - move a project's local state (sessions, worktrees) when reassigning it to a different profile/org. `src/main/orca-profiles/profile-project-transfer*.ts` _(Medium)_
- [ ] **Cloud capability refresh** - periodically refreshes what cloud features/entitlements the signed-in account has. `src/main/orca-profiles/profile-cloud-capability-refresh.ts` _(Small)_

### Notifications

- [ ] **Desktop idle/away detection for mobile notifications** - detects the desktop app is idle/locked so notifications get routed to the paired mobile app instead. `src/main/notifications/desktop-away-state.ts` _(Small)_
- [ ] **Native OS notifications** - sends native desktop notifications for agent/automation events, with sound and burst-cooldown control. `src/main/ipc/native-notification-*.ts`, `notification-burst-cooldown.ts`, `notification-sound-*.ts` _(Medium)_

### Computer use / desktop automation

- [ ] **AI computer-use (screen control) provider** - lets an agent take screenshots and control mouse/keyboard on the user's desktop, via a macOS-native helper or a cross-platform script sidecar. `src/main/computer` _(Large)_
- [ ] **macOS native computer-use permission handling** - checks/prompts for macOS Accessibility/Screen Recording permission needed for computer use. `src/main/computer/macos-computer-use-permission*.ts`, `src/main/ipc/computer-use-permissions.ts` _(Small)_
- [ ] **Computer-use sidecar diagnostics** - health/diagnostic checks for the desktop-control helper process. `src/main/computer/computer-sidecar-diagnostics.ts` _(Small)_ _(internal?)_

### Mobile emulator / simulator control

- [ ] **Android emulator control (AVD)** - boot/list Android virtual devices, run adb input/app/permission commands, stream video via scrcpy. `src/main/emulator/android`, `emulator/backends/android-emulator-backend.ts` _(Large)_
- [ ] **iOS simulator control** - list/boot iOS simulators (simctl) and drive them as an emulator backend. `src/main/emulator/backends/ios-emulator-backend.ts`, `simctl-simulator-devices.ts`, `simulator-app-visibility.ts` _(Medium)_
- [ ] **Emulator screen streaming (MJPEG/video)** - streams emulator/simulator video frames into the app UI. `src/main/emulator/mjpeg-frame-*.ts`, `scrcpy-video-registry.ts`, `src/main/ipc/emulator-frame-stream.ts`, `emulator-video-stream.ts` _(Medium)_
- [ ] **Accessibility-tree inspection for simulators** - reads/normalizes the iOS simulator accessibility tree for agent-driven UI testing. `src/main/emulator/serve-sim-accessibility-tree.ts`, `serve-sim-ax-normalization.ts` _(Medium)_

### Misc IPC-hosted features (small, standalone)

- [ ] **Custom desktop pet/companion import** - lets a user import a custom animated "pet" sprite bundle into the app. `src/main/ipc/pet*.ts` _(Small)_
- [ ] **Worktree git hooks management** - install/inspect/run custom git hooks scoped to a worktree. `src/main/ipc/hooks` _(Medium)_
- [ ] **Feedback with image attachments** - in-app feedback form supporting screenshot/image attachments. `src/main/ipc/feedback.ts`, `feedback-image-attachments.ts` _(Small)_

---

## Part 6. Mobile, browser and computer use

### Mobile Companion Apps (`mobile/`)

#### Connectivity & pairing

- [ ] **Host pairing & device tokens** - Pair the phone to a desktop Orca install and hold the paired host's auth token. `mobile/transport` _(Large)_
- [ ] **Relay-to-direct connection upgrade** - Start over the cloud relay for reachability, then silently upgrade to a direct LAN/local connection when possible. `mobile/transport` _(Medium)_
- [ ] **Background reconnect grace period** - Keep a connection alive briefly when the app backgrounds instead of dropping immediately. `mobile/transport` _(Small)_
- [ ] **Connection diagnostics & troubleshooting** - Run reachability checks and produce a shareable diagnostic report when pairing or sync fails. `mobile/diagnostics` _(Medium)_
- [ ] **Multi-host home screen** - List every paired desktop host with live connection state and a resume-last-session card. `mobile/home` _(Medium)_

#### Agent & task management

- [ ] **Tasks list (GitHub/Linear projects)** - Browse linked GitHub/Linear project items and spin up work from the phone. `mobile/tasks` _(Large)_
- [ ] **PR review sidebar & file diffs** - View a pull request's file list and diffs inline on mobile. `mobile/tasks`, `mobile/components/pr-sidebar` _(Medium)_
- [ ] **Agent session history & resume** - Browse past agent sessions per worktree and resume one from the phone. `mobile/agent-history` _(Medium)_
- [ ] **Worktree list & lifecycle actions** - View, create, activate, and sleep/wake worktrees under a host. `mobile/worktree` _(Large)_
- [ ] **New workspace / worktree creation dialog** - Pick a repo and agent, then create a new worktree remotely. `mobile/components` (NewWorktreeModal, NewWorkspaceSshConnectionField) _(Medium)_
- [ ] **AI diff review controller** - Step through an agent's diff and approve/comment from mobile. `mobile/session` (use-mobile-diff-review-controller) _(Small)_
- [ ] **Commit message generation** - Generate a commit message for staged changes from the phone. `mobile/source-control` (use-mobile-commit-message-generation) _(Small)_
- [ ] **Source control hub (history, PR creation)** - Git history browsing and PR creation flows scoped to a worktree. `mobile/source-control` _(Large)_
- [ ] **Codex account reset/credit action** - Trigger a Codex usage reset/credit action from a session. `mobile/components`, `mobile/session` (codex-reset-credit) _(Small)_

#### Terminal, files & voice

- [ ] **Mobile terminal webview** - Render the desktop's PTY output in a touch-friendly xterm webview with keyboard/dictation input. `mobile/terminal` _(Large)_
- [ ] **Live dictation / voice input** - Dictate agent prompts and terminal input, with keep-awake handling while recording. `mobile/dictation`, `mobile/hooks` _(Medium)_
- [ ] **File explorer & file preview** - Browse the repo tree and preview/edit files (with syntax highlighting) remotely. `mobile/files` _(Large)_
- [ ] **Native chat transcript view** - Structured chat-style view over an agent's terminal turns, distinct from raw scrollback. `mobile/session` (native-chat*) _(Medium)_
- [ ] **Embedded remote browser pane** - View and interact with the desktop's per-worktree browser via a streamed screencast. `mobile/browser` _(Medium)_
- [ ] **Push notifications for agent events** - Native push delivery, dismissal sync, and notification routing back into the right session. `mobile/notifications` _(Large)_
- [ ] **In-app settings (notifications, voice, browser, chat)** - Per-feature settings screens plus an about/diagnostics screen. `mobile/settings` _(Medium)_
- [ ] **Onboarding flow** - First-run walkthrough for pairing and permissions. `mobile/onboarding` _(Small)_
- [ ] **Account switcher** - Switch which linked agent/provider account a session uses. `mobile/accounts` _(Small)_
- [ ] **Home usage/stats totals** - Aggregate usage numbers shown on the home screen. `mobile/stats` _(Small)_
- [ ] **Per-host workspace screen** - Dedicated screen listing a single host's worktrees/repos with view settings. `mobile/host-screen` _(Medium)_

### Browser Automation & Computer Use

#### Browser (`src/main/browser`)

- [ ] **Cross-browser cookie import** - Import cookies from Chrome/Edge/Brave (via OS keychain decryption) and Safari into an Orca browser session. `src/main/browser/browser-cookie-*` _(Large)_
- [ ] **Chromium cookie decryption** - Decrypt OS-keychain-protected Chromium cookie stores for import. `src/main/browser/browser-cookie-decryption.ts` _(Small)_
- [ ] **WebAuthn/passkey account picker** - Surface a native-style account picker for WebAuthn flows inside the embedded browser. `src/main/browser/browser-webauthn-*` _(Small)_
- [ ] **Print to PDF** - Convert the active browser tab to a PDF via CDP. `src/main/browser/cdp-print-to-pdf.ts` _(Small)_
- [ ] **Accessibility-tree snapshot & ref resolution (agent targeting)** - Build a stable ref-based accessibility snapshot so agents can click/fill by ref instead of coordinates. `src/main/browser/snapshot-engine.ts`, `cdp-ref-resolution.ts` _(Medium)_
- [ ] **Design Mode element grabbing** - Overlay/click-to-select script that extracts DOM, computed styles, and a cropped screenshot of a clicked element. `src/main/browser/grab-guest-*` _(Medium)_ (internal engine behind the documented Design Mode feature)
- [ ] **In-browser document preview protocol** - Custom protocol handler for previewing docs (PDF-like) inside the browser pane. `src/main/browser/doc-preview-*` _(Small)_
- [ ] **Popup / new-tab window handling with origin bar** - Manage `window.open` popups with their own origin-indicating chrome. `src/main/browser/popup-origin-bar-window.ts`, `browser-popup-new-tab-intent.ts` _(Small)_
- [ ] **SSH-remote browser session partitions** - Scope browser cookie/storage partitions per SSH execution host. `src/main/browser/local-ssh-browser-partitions.ts` _(Medium)_
- [ ] **Self-signed certificate trust prompts** - Interactive trust decision for local/self-signed HTTPS certs hit in the embedded browser. `src/main/browser/browser-certificate-trust-controller.ts` _(Small)_
- [ ] **WSL/remote network tunneling for the browser** - Tunnel browser network traffic through WSL or a remote host's network stack. `src/main/browser/wsl-browser-network-*`, `browser-network-tunnel-*` _(Large)_
- [ ] **Browser tab screencast streaming** - Stream live frames of a browser tab (used for remote/mobile viewing). `src/main/browser/browser-screencast-*` _(Medium)_
- [ ] **Agent browser command bridge (click/fill/snapshot/tabs)** - The command surface agents and the `orca` CLI use to drive the embedded browser. `src/main/browser/agent-browser-bridge*.ts` _(Large)_
- [ ] **Paired-runtime remote browser host** - Run the browser on a paired remote host and control it from the local client UI. `src/main/browser/paired-runtime-browser-client-host*.ts` _(Large)_
- [ ] **Browser session persistence across restarts** - Registry that restores open tabs/sessions when Orca relaunches. `src/main/browser/browser-session-registry.ts` _(Medium)_
- [ ] **Raw CDP command passthrough** - Bridge for forwarding arbitrary Chrome DevTools Protocol commands. `src/main/browser/cdp-bridge-command-*.ts` _(Medium)_
- [ ] **Browser file-upload staging** - Stage files supplied by an agent/CLI so a page's `<input type=file>` can pick them up. `src/main/browser/browser-client-upload-staging.ts` _(Small)_
- [ ] **Programmatic text insertion into page fields** - Fill form fields from agent commands, bypassing OS-level keystroke simulation. `src/main/browser/browser-text-insertion.ts` _(Small)_

#### Computer use (`src/main/computer`)

- [ ] **macOS native computer-use provider** - Native helper for screenshots, clicks, and accessibility-tree reads/writes against any macOS app. `src/main/computer/macos-native-provider-*.ts` _(Large)_
- [ ] **macOS computer-use permission management** - Check/request/reset Screen Recording and Accessibility permissions needed for computer use. `src/main/computer/macos-computer-use-permission*.ts` _(Small)_
- [ ] **Windows desktop-script computer-use provider** - PowerShell-driven runtime for desktop automation on Windows, with execution-policy fallback handling. `src/main/computer/desktop-script-*.ts`, `windows-powershell-execution-policy.ts` _(Large)_
- [ ] **Clipboard paste size/content validation** - Guard oversized or unsafe clipboard writes during computer-use paste actions. `src/main/computer/computer-clipboard-paste-validation.ts`, `computer-sidecar-paste-validation.ts` _(Small)_
- [ ] **Sidecar process isolation for computer use** - Run OS automation in an isolated child process with its own IPC protocol. `src/main/computer/sidecar-entry.ts`, `sidecar-client.ts` _(Medium)_

#### Emulator / mobile device control (`src/main/emulator`)

- [ ] **iOS Simulator control** - Boot, screenshot, tap, and read the accessibility tree of an iOS Simulator instance. `src/main/emulator/backends/ios-emulator-backend.ts`, `simctl-simulator-devices.ts`, `serve-sim-*.ts` _(Large)_
- [ ] **Android device/emulator control via ADB** - Install/launch apps, send input, and read logs on a connected Android device or emulator. `src/main/emulator/backends/android-emulator-backend.ts`, `android/*.ts` _(Large)_
- [ ] **scrcpy-based Android screen mirroring** - Stream a live video feed of an Android device/emulator screen into Orca. `src/main/emulator/android/scrcpy-*.ts`, `mjpeg-frame-*.ts` _(Medium)_
- [ ] **Android Virtual Device (AVD) management** - Create and boot Android emulator images from within Orca. `src/main/emulator/android/avd-manager.ts`, `android-avd-boot.ts` _(Medium)_
- [ ] **Cross-platform emulator gesture abstraction** - Normalize tap/swipe gestures across iOS Simulator and Android targets. `src/main/emulator/emulator-gesture-sender.ts` _(Small)_
- [ ] **Emulator/device inventory discovery** - Enumerate available iOS/Android emulators and physical devices. `src/main/emulator/emulator-device-inventory.ts`, `android/android-device-inventory.ts` _(Small)_

### Documented Feature Set (README, AGENTS.md, docs/site)

- [ ] **Mobile Companion** - "Monitor and steer your agents from your phone." `README.md`, `docs/site/content/docs/mobile.mdx` _(Large)_
- [ ] **Parallel Worktrees** - "Fan one prompt across five agents, each in its own isolated git worktree." `docs/site/content/docs/model/worktrees.mdx` _(Large)_
- [ ] **Terminal Splits** - "Ghostty-class terminals with WebGL rendering, infinite splits." `docs/site/content/docs/terminal.mdx` _(Large)_
- [ ] **Design Mode** - "Click any UI element ... send its HTML, CSS, and a cropped screenshot straight into your agent's prompt." `docs/site/content/docs/browser/design-mode.mdx` _(Medium)_
- [ ] **GitHub & Linear, Native** - "Browse PRs, issues, and project boards in-app." `docs/site/content/docs/review/github.mdx`, `linear.mdx` _(Large)_
- [ ] **SSH Worktrees** - "Run agents on a beefy remote box ... auto-reconnect and port forwarding." `docs/site/content/docs/ssh.mdx` _(Large)_
- [ ] **Annotate AI Diffs** - "Drop comments on any diff line and ship them back to the agent." `docs/site/content/docs/review/annotate-ai-diff.mdx` _(Medium)_
- [ ] **Drag Files to Agents** - "VS Code's editor with autosave everywhere - drag files or images straight into an agent prompt." `docs/site/content/docs/editing/file-explorer.mdx` _(Medium)_
- [ ] **Orca CLI** - "Script every workflow with `orca worktree create`, `snapshot`, `click`, and `fill`." `docs/site/content/docs/cli/overview.mdx`, `cli/reference.mdx` _(Large)_
- [ ] **Quick Open & Jump Palette** - "Search across worktrees, files, agents, commands, and repo context." `docs/site/content/docs/model/quick-open.mdx` _(Medium)_
- [ ] **Account switcher & usage tracking** - "See Claude and Codex usage and rate-limit resets, and hot-swap accounts." `docs/site/content/docs/agents/usage-tracking.mdx` _(Medium)_
- [ ] **Rich repo previews (Markdown/PDF/image/Mermaid viewers)** - Built-in viewers for common repo file formats. `docs/site/content/docs/editing/viewers.mdx`, `editing/markdown.mdx` _(Medium)_
- [ ] **Computer Use** - "Let agents operate desktop apps and visible UI." `docs/site/content/docs/cli/computer-use.mdx` _(Large)_
- [ ] **Notifications & unread Inbox** - "Know when an agent finishes or needs attention." `docs/site/content/docs/notifications.mdx` _(Medium)_
- [ ] **Remote Orca Servers** - "Keep Orca running on another computer and connect from your laptop." `docs/site/content/docs/remote-servers.mdx` _(Medium)_
- [ ] **Ephemeral per-workspace cloud VMs** - On-demand VM compute per worktree, one of several "ways to run Orca." `docs/site/content/docs/ways-to-run.mdx` _(Medium)_
- [ ] **Agents feed (Activity)** - "Threaded feed of agent completions, blocking states ... across every worktree." `docs/site/content/docs/activity.mdx` _(Medium)_
- [ ] **Chat UI (native chat)** - "Structured transcript + composer" layered over Claude/Codex/Grok/OMP terminals. `docs/site/content/docs/agents/native-chat.mdx` _(Medium)_
- [ ] **Agent hooks & memory integration** - Reads/respects Claude Code and Codex hook/memory conventions with a UI. `docs/site/content/docs/agents/hooks-memory.mdx` _(Medium)_
- [ ] **Codex/Claude account hot-swap** - "Hot-swap the active account in one click, with no re-login." `docs/site/content/docs/agents/codex-hot-swap.mdx` _(Small)_
- [ ] **Agent session history** - "Browse and resume past Claude, Codex, Cursor, Gemini ... sessions." `docs/site/content/docs/agents/session-history.mdx` _(Medium)_
- [ ] **Agent hibernation** - "Pause idle background agent terminals and auto-resume them." `docs/site/content/docs/agents/hibernation.mdx` _(Medium)_
- [ ] **Broad supported-agent roster** - Preconfigured one-click launch for 20+ CLI agents (Claude Code, Codex, Grok, Cursor, Copilot, OpenCode, Amp, Devin, Goose, etc.). `docs/site/content/docs/agents/supported.mdx`, `README.md` _(Large)_
- [ ] **Orchestration (Runs, Tasks, Dispatches, gates)** - "Structured multi-agent layer: a Run ... Tasks, Dispatches, supervised workers, messages, and decision gates." `docs/site/content/docs/cli/orchestration.mdx` _(Large)_
- [ ] **Worktree checkpoints (status comment field)** - Free-text status field on a worktree, updatable from the CLI by agents. `docs/site/content/docs/cli/worktree-checkpoints.mdx` _(Small)_
- [ ] **Scheduled automations** - "Run a prompt on a schedule from the CLI." `docs/site/content/docs/cli/automations.mdx` _(Medium)_
- [ ] **Orca skills registry & MCP** - "Install Orca agent skills with `npx skills add`." `docs/site/content/docs/cli/skills.mdx` _(Medium)_
- [ ] **Browser-use profiles** - "Run the Orca browser with a specific identity - a logged-in user, a particular cookie jar, a custom user-agent." `docs/site/content/docs/browser/profiles.mdx` _(Medium)_
- [ ] **Per-worktree embedded browser** - "A real Chromium window ... embedded in a pane," scoped per worktree. `docs/site/content/docs/browser/overview.mdx` _(Large)_
- [ ] **Monaco editor & autosave** - VS Code's editor with Orca-specific autosave tweaks. `docs/site/content/docs/editing/monaco.mdx` _(Medium)_
- [ ] **Jira items drawer** - "Browse, edit, and link Jira Cloud or self-hosted Server/Data Center issues to worktrees." `docs/site/content/docs/review/jira.mdx` _(Medium)_
- [ ] **Diff viewer** - "Built-in diff against its start-from ref," designed for serious AI-code review. `docs/site/content/docs/review/diff-viewer.mdx` _(Medium)_
- [ ] **Commit & push from Orca** - Commit panel next to the diff viewer for stage/commit/push. `docs/site/content/docs/review/commit-push.mdx` _(Small)_
- [ ] **Attribution (human vs AI line tracking)** - "Tracks provenance on every line it sees an agent touch." `docs/site/content/docs/review/attribution.mdx` _(Medium)_
- [ ] **Session restore** - "Reopen it, and pick up exactly where you left off - worktrees, splits, scrollback, focused tab." `docs/site/content/docs/model/session-restore.mdx` _(Medium)_
- [ ] **Tabs, panes & split layouts** - Drag-to-split panes, tab groups, pinned boundaries. `docs/site/content/docs/model/tabs-panes-splits.mdx` _(Medium)_
- [ ] **Privacy & Telemetry opt-out** - Anonymous usage-data collection with a documented opt-out. `docs/site/content/docs/telemetry.mdx` _(Small)_

---

## Coverage gaps

Two areas the survey did not exhaust. Neither is likely to hide a distinct feature, but neither is proven clean.

- `src/renderer/src/store`, `src/renderer/src/lib` (150+ files) and `src/renderer/src/hooks` got a top-level listing and spot checks only. These back the surfaces already listed rather than adding their own.
- `config/` is build and CI tooling: linting, benchmarks, packaging for mac/win/linux, code signing, notarization, the localization pipeline. No user-facing feature beyond auto-update channels, already listed.
