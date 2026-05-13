# Test Plan

## Scope

This plan covers the current UMA daily gift domain:

- Login with saved cookies, with password login fallback.
- CAPTCHA solving and manual fallback.
- Daily check-in status detection and reward claim.
- Points reading from current-year and expiring points.
- Lottery eligibility when total points are at least 100.
- Grand-prize stock detection before drawing.
- Lottery result capture.
- Windows notification on intervention or failure.
- Activity log and daily summary log output.

## Current Coverage

`test_report.md` is a historical report from 2026-02-04. It confirms cookie login and check-in behavior at that time, but it is not a repeatable test plan.

Current executable coverage:

- `test_lottery_feature.js` performs a live website check for login state, points, prize stock, lottery button presence, and draw eligibility.
- `test_notification.js` manually exercises Windows MessageBox notifications.

## Gaps

- No fast unit tests for points parsing.
- No fast unit tests for prize stock parsing, including sold-out and grand-prize cases.
- No fast unit tests for the lottery decision rule: total points >= 100 and grand-prize stock available.
- No fast unit tests for lottery result parsing, especially no-win and marquee exclusion cases.
- Check-in status parsing is only exercised through the live flow.
- CAPTCHA retry and manual fallback are not covered by automated tests.
- Cookie parse errors and missing cookie file behavior are not covered by automated tests.
- Daily summary formatting and missing-section behavior are not covered by automated tests.
- Notification behavior is duplicated in a manual script rather than behind a shared Module.
- `npm test` does not run project tests.

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

### Live Smoke

Run manually with `node test_lottery_feature.js`.

- Loads saved cookies.
- Opens the UMA daily gift page.
- Reads login state.
- Reads points through the same UMA Page Adapter used by production.
- Reads prize stock through the same UMA Page Adapter used by production.
- Confirms whether the lottery button is present and visible.
- Reports whether the current page state would draw.

### Manual

Run manually with `node test_notification.js`.

- Shows warning notification.
- Shows error notification.

## Not Covered Yet

The following should be added after the first architecture extraction:

- Session Store tests for `cookies.json`.
- CAPTCHA Module tests with fake model adapters.
- Check-in parser tests with static DOM snapshots.
- Daily summary formatter tests.
- Notifier Module tests with a fake adapter.
