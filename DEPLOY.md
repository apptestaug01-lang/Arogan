# Deploy and Test

One-shot automation: push to `main` → wait for Render deploy → run E2E test.

## First-time setup (one time only, 30 seconds)

1. **Create a fine-grained GitHub PAT**: https://github.com/settings/personal-access-tokens/new
   - Resource owner: `apptestaug01-lang`
   - Repository access: only `Arogan`
   - Permissions: `Contents` = **Read and write**
   - Expiration: 30 days (do not set "No expiration")

2. **Save it locally** (never paste it in chat):
   ```powershell
   "GITHUB_TOKEN=ghp_your_new_token" | Out-File -Encoding utf8 .env.local
   ```
   `.env.local` is in `.gitignore` and will not be committed.

3. **(Optional) Install npm at root**: not required — the script invokes `powershell` directly.

## Every day

```powershell
cd C:\Arogan\BusinessLoanApp
npm run deploy
```

That's it. The script will:
- Confirm the working tree is clean
- Show you the commits about to be pushed
- Push to `origin/main`
- Poll `https://arogan-mx0n.onrender.com/health` every 10 seconds until the new commit SHA is live (max 10 minutes)
- Run `e2e/test.js` against the live deployment
- Print a pass/fail summary

## Partial runs

```powershell
npm run deploy:skip-push      # already pushed, just wait + test
npm run deploy:skip-test      # push + wait, no e2e
npm run deploy:no-wait        # push + e2e, don't poll Render
```

You can also pass flags directly to the script for custom timeouts:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-and-test.ps1 -DeployTimeoutSec 180
```

## Token security

- The token is read from `.env.local` (gitignored) or the `GITHUB_TOKEN` env var
- It is only ever held in a local PowerShell variable `$token`
- During the push, the remote URL is temporarily swapped to `https://TOKEN@github.com/...`, then **restored to the clean form** before the script exits
- `$token = $null` and `[System.GC]::Collect()` run in the `finally` block to clear it from memory
- The token is **never** logged, printed, sent to a server other than GitHub, or written anywhere except the temp remote URL during push

## What if it fails

| Failure | What to do |
|---|---|
| "Working tree is dirty" | `git status`, then commit or stash |
| "Token does not match ghp_/ghs_ format" | Token was mistyped; re-edit `.env.local` |
| "git push failed" | Check the error. Common: token expired, branch protection, network |
| "Backend deploy did not become healthy in time" | Increase `-DeployTimeoutSec`. Render can take 5+ min for a clean rebuild. |
| "E2E test failed" | Check `e2e/shots/` for screenshots. The failure toast in the script tells you the exit code. |

## Files

- `scripts/deploy-and-test.ps1` — the script
- `.env.local` — your local token (gitignored, not committed)
- `e2e/test.js` — the Playwright E2E test the script runs
- `e2e/shots/` — screenshots from the last E2E run
- `e2e/test-fixtures/` — real PDFs used by the test (gitignored)
