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

- `npm test` runs fast unit tests for check-in parsing, points parsing, prize stock parsing, lottery decision rules, and lottery result parsing.
- `test_lottery_feature.js` performs a live website check for login state, points, prize stock, lottery button presence, and draw eligibility using the same UMA Page Adapter as production.
- `test_notification.js` manually exercises Windows MessageBox notifications.

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
