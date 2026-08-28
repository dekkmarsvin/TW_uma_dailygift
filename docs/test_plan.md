# Test Plan

## Scope

This plan covers the current UMA daily gift and umamatch automation domains:

- Login with saved cookies, with password login fallback.
- CAPTCHA solving and manual fallback.
- Daily check-in status detection and reward claim.
- Points reading from current-year and expiring points.
- Lottery eligibility when total points are at least 100.
- Grand-prize stock detection before drawing.
- Lottery result capture.
- Windows notification on intervention or failure.
- Activity log and daily summary log output.
- Windows scheduler wrapper behavior for running the dailygift step (umamatch is past its sunset and is no longer scheduled).
- Single root entrypoint enforcement: `run_automation.ps1` is the only executable script file in the project root.
- PowerShell setup wizard behavior for `.env` creation and Windows Task Scheduler registration.
- Automatic `.env` setup trigger when neither `.env` nor process environment variables provide required configuration.
- 4週年自訂配對大賽 task discovery, daily share completion, reward claiming, lottery window parsing, ticket drawing, and sunset behavior.

## Current Coverage

- `npm test` runs fast unit tests for check-in parsing, points parsing, prize stock parsing, lottery decision rules, lottery result parsing, root entrypoint enforcement, scheduler wrapper/setup behavior, umamatch task policy/client/runner behavior, umamatch lottery behavior, sunset policy, and documentation guidance.
- `npm run diagnostics:lottery` performs a live website check for login state, points, prize stock, lottery button presence, and draw eligibility using the same UMA Page Adapter as production.
- `npm run umamatch:dry-run` performs a read-only live umamatch state check using the saved KOMOE cookies without completing tasks, claiming rewards, or drawing lottery tickets.
- `npm run diagnostics:notification` manually exercises Windows MessageBox notifications.

## Required Test Layers

### Unit

Run with `npm test`.

- Points parser:
  - Reads current-year and expiring points from visible text items.
  - Falls back to body text regex.
  - Computes total when no total is shown.
  - Preserves explicit total when present.
- Prize stock parser:
  - Reads remaining counts from `剩餘1份`, `剩餘: 10`, and `剩餘：5`.
  - Treats `已抽完` as zero stock.
  - Marks the prize whose context includes `特等獎` as grand prize.
  - Falls back to the first prize as grand prize when no label is found.
- Lottery policy:
  - Skips when total points are below 100.
  - Skips when grand-prize stock is unavailable.
  - Allows drawing only when total points are at least 100 and grand-prize stock is available.
- Lottery result parser:
  - Reads no-win text.
  - Reads winning result patterns.
  - Ignores check-in reward text.
- Scheduler wrapper (`test/schedulerScript.test.js`):
  - Runs the dailygift automation step and no longer spawns the sunset umamatch step.
  - Accumulates step exit codes before deciding the final failure state.
  - Keeps child process output out of automation step result objects.
  - Exposes `-Setup`, `-ConfigureEnv`, and `-InstallScheduler` paths that use PowerShell UI prompts for `.env` and Scheduled Tasks setup.
  - Auto-launches `.env` setup when `login_username`, `login_password`, or `GEMINI_API_KEY` is missing from both `.env` and process environment variables.
- Root entrypoint (`test/rootEntrypoint.test.js`):
  - Keeps `run_automation.ps1` as the only executable script file in the repository root.
  - Requires manual diagnostics to live under `scripts/` instead of root-level executable files.
- Umamatch automation:
  - `test/umamatchFramework.test.js` covers cookie loading, browser page requests, CLI parsing, and daily share completion.
  - `test/umamatchTasks.test.js` covers task eligibility, section summaries, task API endpoints, reward claiming, report-share fallback, and multi-round claim refresh.
  - `test/umamatchLottery.test.js` covers lottery window parsing, ticket reads, dry-run behavior, and draw loops.
  - `test/umamatchSunsetPolicy.test.js` covers default and environment-overridden sunset cutoffs.
  - `test/umamatchAutomation.test.js` covers overall orchestration when task or full umamatch sunset has been reached.
- Documentation guidance (`test/documentationGuidance.test.js`):
  - Keeps README runtime requirements, clone URL, `.env.example` model, package metadata, scheduler guidance, test plan, and GitHub Actions aligned with the current codebase.

### Live Smoke

Run manually with `npm run diagnostics:lottery`.

- Loads saved cookies.
- Opens the UMA daily gift page.
- Reads login state.
- Reads points through the same UMA Page Adapter used by production.
- Reads prize stock through the same UMA Page Adapter used by production.
- Confirms whether the lottery button is present and visible.
- Reports whether the current page state would draw.

Run manually with `npm run umamatch:dry-run`.

- Loads saved KOMOE cookies from `cookies.json`.
- Opens the umamatch event page for authenticated browser context.
- Reads daily, milestone, and one-time task sections from the task APIs.
- Reports currently claimable rewards without calling claim APIs.
- Reads the published lottery window and ticket state without drawing.

### Manual

Run manually with `npm run diagnostics:notification`.

- Shows warning notification.
- Shows error notification.
