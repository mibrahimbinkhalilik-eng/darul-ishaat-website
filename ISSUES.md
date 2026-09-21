# Darul Ishaat Website — Issues Tracker

Last updated: 2026-09-19 · Catalogue: 622 entries

This file tracks known open issues and gaps so they're easy to find and fix
later, instead of buried in chat history. Update it whenever something new
is found or something here gets fixed (move it to Resolved with the date).

## Open

### Catalogue data
- [ ] **Missing image file**: `images/book-045-front.jpg` is referenced in
  the catalogue but the file doesn't exist. Needs a fresh photo.
- [ ] **Duplicate entry**: "Takmeel-ul-Amani" is listed twice —
  book-112 ("Sharh Urdu Mukhtasar al-Ma'ani", Maulana Jameel Ahmad
  Sikrodwi) and book-403 ("ma' Sharh Urdu Mukhtasar-ul-Ma'ani", Maulana
  Jameel Ahmad Sakarodhwi). Likely the same book with a title/author
  spelling variant — needs a decision on whether to merge (keep one) or
  confirm they're genuinely distinct editions.

### Analytics (Umami)
- [ ] **Social icon clicks not tracked** — Facebook/YouTube/Instagram
  icons (header, mobile nav, footer) have no `trackEvent`, so there's no
  visibility into whether people use them.
- [ ] **"Load more" pagination not tracked** — tapping Load More within a
  category tab doesn't fire an event, so `category_browse_depth` alone
  can't show how many times someone paged further into a category.

## Resolved (recent)

- [x] 2026-09-20 — Fixed 2 self-introduced bugs from the colour-print
  tagging batches: (1) 7 entries had "Two-colour print" duplicated in
  their meta text from appearing in two separate batch requests; (2) all
  82 tagged entries (67 two-colour, 15 four-colour) were missing the
  `twoColor`/`fourColor` boolean flags that actually drive the site's
  styled badge — the text was there but the real badge never rendered.
  Both fixed; every tagged title now shows the proper badge.

- [x] 2026-09-20 — Fixed `cart_abandoned` false positives: it was firing on
  every tab/app switch (visibilitychange) and on ordinary page refresh
  (pagehide fires for both a reload and truly leaving) — both wrongly
  counted as an abandoned cart. Removed visibilitychange as a trigger and
  added reload detection (sessionStorage + Navigation Timing API) that
  logs a `cart_abandoned_correction` event when a "leaving" turns out to
  have just been a refresh. True abandonment = cart_abandoned minus
  cart_abandoned_correction. Verified end-to-end with a headless browser.

- [x] 2026-09-20 — Hardened auto-update against HTTP-level caching: added
  `cache:'no-store'` to every fetch inside the service worker and
  `updateViaCache:'none'` on registration, so a Cache-Control header from
  the host can never quietly serve a stale response underneath the
  already-correct network-first logic.
- [x] 2026-09-20 — Install-app banner now nags every visit (sessionStorage,
  not a 14-day localStorage cooldown) until the customer installs.

- [x] 2026-09-19 — Fixed stale images in the PWA/service worker: image
  caching was cache-first-forever (never re-checked the network once a URL
  was cached), so any future cover-photo swap at an existing path would
  silently stay stale for returning visitors. Switched to
  stale-while-revalidate and bumped the cache version to force a one-time
  cleanup. This is the reason "Habib-ul-Fatawa" still looked like the old
  cover after the swap — the catalogue was actually updated correctly, the
  browser just never went back to check.
- [x] 2026-09-19 — Improved accent/name-variant matching (search + voice):
  added single-vowel (e/i, o/u) and v/w interchange to normalization.
  Now matches Muhammad/Mohammad, Yunus/Younus, Gangohi/Ganguhi, Ehsanullah/
  Ihsanullah, and the very common Deobandi-scholar "-wi/-vi" name suffix
  (Thanvi/Thanwi, Nadwi/Nadvi, Kandhlawi/Kandhlavi, Seoharwi/Seoharvi).
  Verified against the full catalogue before shipping — no false-positive
  merges of unrelated words.
- [x] 2026-09-19 — Fixed voice search: "dictionary"/"lexicon" voice commands
  pointed to a category name that no longer exists (silently returned 0
  results); added missing voice routes for English Books, Arabic Books,
  and Sets tabs; added "hadees"/"namaaz" spelling variants; fixed a
  leftover-text bug that would've broken multi-word voice phrases like
  "arabic books".
- [x] 2026-09-19 — Cart/reading-list drawer open now fires `view_cart`
  (completes the open → checkout/abandon funnel).
- [x] 2026-09-19 — Umami Domain field updated from stale Netlify URL to
  darulishaatglobal.com.
- [x] 2026-09-19 — Renamed category "Grammar & Language Studies" →
  "Dictionaries / Grammar & Language Studies" everywhere.
- [x] 2026-09-19 — Added "Arabic Books" tab (purely Arabic-only titles,
  excludes anything also tagged Urdu or English).
- [x] 2026-09-19 — Fixed letterbox padding on cart/suggestion cover
  thumbnails (object-fit contain → cover).
- [x] 2026-09-19 — Fixed category chips not clearing leftover search text
  (typed search term stayed applied after switching tabs, zeroing results).
- [x] 2026-09-19 — Fixed "You may also like" recommendations being
  crowded out by the cart's largest category (now every category in the
  cart gets at least one suggestion slot).
- [x] 2026-09-18 — Deployment moved from manual Netlify Drop to GitHub →
  Vercel auto-deploy on push to main.
