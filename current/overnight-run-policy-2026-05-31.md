# ixi-O Agent Overnight Run Policy - 2026-05-31

## Master Plan

Use `current/agent-task-queue.md` as the ordered master plan.

## Goal For This Run

Work as long as practical on the highest-value remaining path while the user is away:

1. Harden the demo flow so the current MVP is easy to present and trust.
2. Improve reproducibility for another Apple Silicon Mac.
3. Strengthen agent handoff docs so a later Codex/OpenCode worker can continue without re-asking context.

## In Scope

- T2 Demo Flow Hardening.
- T3 Reproducibility And Black-Box Test Pass if T2 reaches a stable checkpoint.
- Local docs, README, demo guide, status/task queue updates.
- UI improvements inside the existing Next.js app.
- Local tests, typecheck, build, smoke tests.
- Commits and pushes to `origin/main` after coherent verified chunks.

## Out Of Scope

- Production deployment.
- Public/customer-facing messages.
- New real Channel Talk messages beyond synthetic proof data unless a later test clearly needs it.
- Secret rotation or editing `.env.local` values.
- Destructive cleanup of generated local data.
- Large architecture changes that redefine the product without user review.

## Permission Boundary

- Code/docs/test changes: allowed.
- Package installation: avoid unless strongly justified; prefer existing stack.
- External authenticated reads for verification: allowed when credentials already work locally.
- External authenticated writes: avoid for this run except GitHub push and already-proven safe synthetic Channel Talk testing if needed.
- Destructive actions: stop and ask.

## Verification Targets

Minimum per coherent chunk:

```bash
pnpm typecheck
```

When UI/routes change:

```bash
pnpm build
curl -fsS http://localhost:3000/api/sessions
```

When frontend is materially changed, verify in a browser against `http://localhost:3000`.

## Reporting

- First report: after creating this run policy and choosing the first work unit.
- Then report after each major completed stage or on blocker.
- Keep detailed progress in local docs so the next agent can resume.

## Stop Conditions

- An action requires new user credentials or a new external approval.
- Repeated test/build failures point to a risky or unclear architecture decision.
- Further progress would require deleting or rewriting substantial unrelated work.
- All in-scope tasks reach a stable checkpoint.
