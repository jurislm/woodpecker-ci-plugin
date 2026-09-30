# Unified Plugin Architecture Implementation Plan

**Goal:** align four independent plugins and configure local Codex without
changing existing tool contracts or moving secrets into repositories.

**Spec:** ../../plugin-architecture.md

**Execution:** one isolated worktree and PR per repository; parent implements
Woodpecker and local setup, workers own Hetzner, Coolify and Higgsfield. Complete
full checks and one complete Codex/CodeRabbit PR review before merge. No second
complete review requests after fixes; inspect the reviewed delta and rerun
affected checks. Release Please manages releases. Pull clean root checkouts
with --ff-only after merge.

- [ ] Woodpecker: native env_vars, semantic manifest validation, desktop
  launcher and offline boundary tests, launcher shipping, lint and guide.
- [ ] Hetzner: native env_vars, semantic/schema manifest validation, preserve
  launcher/SSH, safe retained-tool error handling without output changes.
- [ ] Coolify: recognized env_vars, desktop launcher, offline boundary tests,
  lint, preserve atomic credentials and composite results.
- [ ] Higgsfield: portable/Codex/Cursor packaging, retain Claude/remote/CLI,
  private check package, source hashes, Woodpecker/Git release automation.
- [ ] Review, merge, read CI and release results, pull all clean roots.
- [ ] Install local launchers; update only related Codex MCP registrations,
  preserve existing URL settings, disable selected bundled stdio servers.
- [ ] Direct stdio initialize/version/tools/list/authenticated reads.
- [ ] Fresh ordinary chat native reads; record unavailable host provenance or
  pending OAuth separately, without equating direct calls to native acceptance.

## Decisions

- Keep @latest and verify resolved versions; no shared runtime package.
- Keep public tool contracts and existing host install identities.
- Keep Higgsfield's remote MCP/OAuth and separate CLI auth.
- Existing JUR-401 tracks Woodpecker/native acceptance. Issue creation quota
  was exhausted; record missing tracking rather than inventing issue IDs.

## Execution ledger

- Planning approved by user on 2026-09-30. Source audit completed for all four
  repositories; no provider writes or paid generation authorized for tests.
- Ruling: worker thread creation limit requires serial provider tasks on one
  worker; parent handles Woodpecker/Higgsfield. Cost: longer elapsed execution,
  with no source-scope reduction.
- Ruling: scripts/tests use no-emit Bundler type resolution for Bun's supported
  TypeScript imports; production build retains NodeNext. Cost if wrong: adjust
  the check configuration, without changing shipped module behavior.
