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
