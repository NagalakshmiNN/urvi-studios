# Testing

An automated check of the whole site — storefront, checkout, payments and
admin — that runs on every push to GitHub, so a change that breaks something
shows up before customers find it.

## What happens on every push

Pushing from GitHub Desktop starts a run automatically (see
`.github/workflows/tests.yml`). It typechecks the code, builds the site, and
runs every test below against a throwaway database.

- **Green tick next to the commit on GitHub** — everything passed.
- **Red cross** — something broke. Click it, open the failed run, and
  download the **playwright-report** artifact at the bottom of the page: it
  shows which test failed, a screenshot of the page at that moment, and a
  replayable trace of exactly what the browser did.

One thing worth knowing: **Netlify deploys from the same push at the same
time**, so a red cross doesn't automatically stop a deploy. To make it stop
one, turn on branch protection in GitHub → Settings → Branches → Add rule for
`main` → "Require status checks to pass before merging", and push changes
through pull requests instead of straight to `main`.

## Running it yourself

Needs Node 22 and a local Postgres (user `postgres`, password `devpassword`).

```bash
npm run verify      # typecheck + build + every test — the full gate
npm test            # just the tests (needs a build first)
npm run test:unit   # the fast pure-logic tests only, no database or browser
npm run test:report # open the last HTML report
```

Point the suite at a different database with `TEST_DATABASE_URL`, or run it on
another port with `TEST_PORT`.

## How it is set up

- **`tests/unit/`** — pure calculations, no database or browser. GST, the
  free-delivery threshold, rupee formatting, the rich-text helpers, phone
  normalization, and a check that every order status has customer-facing
  wording.
- **`tests/api/`** — calls the site's own endpoints directly: order creation,
  guest-checkout account rules, coupons, payment verification, the wishlist
  and contact endpoints, image serving, and that every admin-only endpoint
  refuses a stranger.
- **`tests/e2e/`** — drives a real browser through the real pages: the shop
  and its filters, product pages, cart, accounts, checkout, and the whole
  admin dashboard.

Each run **rebuilds a separate `urvi_test` database from scratch** by
replaying the migration files in `netlify/database/migrations/` in order —
the same SQL Netlify runs on deploy — and then running the normal seed. Your
own data is never touched, and a broken migration fails the tests instead of
surprising the live site.

Tests run one at a time on purpose. They share a catalog and stock counts, so
a deterministic result matters more here than shaving a minute off the run.

## Things the suite deliberately cannot check

- **A real Razorpay charge.** No live payment is ever made. What *is* tested
  is the verification step that decides whether a payment is genuine: the
  suite signs its own payloads, and checks that a correct signature confirms
  the order and takes the stock, a forged one changes nothing, and a repeated
  callback doesn't take the stock twice. An actual card payment still needs a
  small real test order.
- **Email delivery.** Mail is captured to a file instead of being sent, so
  tests can assert who would have been emailed and what it said. That proves
  the site *tries* to send the right thing, not that Gmail delivered it.
- **WhatsApp sending.** WhatsApp needs a person to tap Send. The suite checks
  the link is built correctly — right number, right message for the order's
  current status — which is everything the site controls.
- **How things look.** These tests check behaviour, not design. A page could
  pass every test and still look wrong.

## Adding a test

Copy the closest existing file. A few conventions worth keeping:

- Make fixtures with `createTestProduct()` from `tests/setup/db.ts` and clean
  them up in `afterAll`, so tests don't depend on the seeded catalog staying
  exactly as it is.
- Use `uniqueEmail()` for anything involving a customer — emails are unique in
  the database and tests share one.
- After clicking something that changes the page address, wait with
  `await expect(page).toHaveURL(...)` before reading `page.url()`; the site
  navigates client-side and the address bar updates a beat later.
- Assert against the database (`getOrderByNumber`, `getSizeStock`, …) as well
  as the screen when money or stock is involved.
