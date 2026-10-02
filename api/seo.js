/**
 * api/seo.js — ONE file that serves, on demand (Vercel serverless function):
 *   /book/<slug>    BOTS (WhatsApp, Facebook, Telegram, X, LinkedIn, Googlebot ...):
 *                   a small page for that book carrying its own Open Graph +
 *                   Twitter tags and Book/Product JSON-LD, so link previews show
 *                   the right cover & title.
 *                   PEOPLE: the full website (index.html), where the book's
 *                   details popup opens automatically over the catalogue.
 *                   (vercel.json already sends people straight to the static
 *                   index.html; the check in this file is a safety net.)
 *   /sitemap.xml    the full sitemap (home page + every book)
 *
 * It reads the CATALOGUE array straight out of index.html on each cold start,
 * so adding or renaming a book in index.html is all you ever need to do —
 * no generated files, nothing to re-run. Pages are cached at Vercel's edge
 * for a day, so they are fast and cost almost nothing.
 *
 * Needs vercel.json (rewrites + includeFiles) next to index.html.
 */
const fs = require('fs');
const path = require('path');

const SITE_ENV = process.env.SITE_URL;   // optional: override the domain in Vercel settings
let CACHE = null;

function load() {
  if (CACHE) return CACHE;
  const candidates = [
    path.join(process.cwd(), 'index.html'),
    path.join(__dirname, '..', 'index.html'),
    path.join(__dirname, 'index.html')
  ];
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) throw new Error('index.html not found next to /api');
  const html = fs.readFileSync(file, 'utf8');
  // The full site is also served at /book/<slug>, so relative URLs
  // (images/, icons/, manifest.json, sw.js) must resolve from the site root.
  const siteHtml = /<base\s/i.test(html) ? html : html.replace(/<head>/i, '<head>\n<base href="/">');

  // Shared slug + JSON-LD helpers live in index.html (DA_SEO block).
  const b0 = html.indexOf('/* DA_SEO_START');
  const b1 = html.indexOf('/* DA_SEO_END */');
  if (b0 < 0 || b1 < 0) throw new Error('DA_SEO block missing from index.html');
  const DA_SEO = new Function(html.slice(b0, b1) + '\nreturn DA_SEO;')();
  if (SITE_ENV) DA_SEO.setSite(SITE_ENV);

  // The catalogue array (plus the few named cover constants it refers to).
  const c0 = html.indexOf('const CATALOGUE');
  const start = html.indexOf('[', c0);
  const end = html.indexOf('\n  ];', start) + 4;
  const consts = {};
  for (const m of html.matchAll(/const ([A-Z][A-Z_]*) = (["'])(images\/[^"']+)\2/g)) consts[m[1]] = m[3];
  const CATALOGUE = new Function(...Object.keys(consts), 'return ' + html.slice(start, end) + ';')(...Object.values(consts));

  // Cover sizes come from the IMG_ASPECT map already inside index.html ("w / h").
  let ASPECT = {};
  try { ASPECT = JSON.parse(html.match(/const IMG_ASPECT = (\{.*?\});/s)[1]); } catch (e) {}

  const umami = (html.match(/<script defer src="https:\/\/cloud\.umami\.is\/script\.js"[^>]*><\/script>/) || [''])[0];
  const slugs = DA_SEO.slugs(CATALOGUE);
  const bySlug = new Map(slugs.map((s, i) => [s, i]));
  CACHE = { DA_SEO, CATALOGUE, ASPECT, slugs, bySlug, umami, siteHtml };
  return CACHE;
}

// Link-preview / search crawlers. Mirrors the user-agent rule in vercel.json.
const BOT_RE = /bot[\/;\-) ]?$|bot[\/;\-)]|crawl|spider|facebookexternalhit|facebot|whatsapp|pinterest|embedly|iframely|vkshare|skypeuripreview|viber|bluesky|mastodon|google-|googleother|mediapartners|meta-external|applebot|inspectiontool/i;
const isBot = (ua) => BOT_RE.test(String(ua || ''));

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonLd = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

function dims(ASPECT, img) {
  const m = String(ASPECT[img] || '').match(/(\d+)\s*\/\s*(\d+)/);
  return m ? { w: +m[1], h: +m[2] } : null;
}

function sitemap(S) {
  const { DA_SEO, CATALOGUE, slugs } = S;
  const SITE = DA_SEO.site();
  const today = new Date().toISOString().slice(0, 10);
  const urls = [`  <url>
    <loc>${SITE}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`];
  CATALOGUE.forEach((b, i) => {
    urls.push(`  <url>
    <loc>${esc(DA_SEO.pageUrl(slugs[i]))}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
    <image:image>
      <image:loc>${esc(DA_SEO.absImg(b.img))}</image:loc>
      <image:title>${esc(b.title)}</image:title>
    </image:image>
  </url>`);
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>
`;
}

function bookPage(S, i) {
  const { DA_SEO, CATALOGUE, ASPECT, slugs, umami } = S;
  const b = CATALOGUE[i], slug = slugs[i];
  const url = DA_SEO.pageUrl(slug);
  const img = DA_SEO.absImg(b.img);
  const size = dims(ASPECT, b.img);
  const desc = DA_SEO.shortDesc(b, 200);
  const title = `${b.title} — Darul Ishaat`;
  const author = DA_SEO.parseAuthor(b.author).names.join(' & ');
  const wa = `https://wa.me/923178223345?text=${encodeURIComponent(`Assalamu alaikum, I'd like to order: ${b.title}`)}`;
  const meta = DA_SEO.cleanMeta(b);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${umami}
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${esc(url)}">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
<meta name="theme-color" content="#065f1d">

<meta property="og:type" content="book">
<meta property="og:site_name" content="Darul Ishaat">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:secure_url" content="${esc(img)}">${size ? `
<meta property="og:image:width" content="${size.w}">
<meta property="og:image:height" content="${size.h}">` : ''}
<meta property="og:image:alt" content="Cover of ${esc(b.title)}">
<meta property="book:author" content="${esc(author)}">

<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<meta name="twitter:image:alt" content="Cover of ${esc(b.title)}">

<script type="application/ld+json">${jsonLd(DA_SEO.bookPageGraph(b, slug))}</script>
<style>
  :root{ --green:#065f1d; --ink:#1d2a21; --soft:#5b6b60; --bg:#f7f5ef; }
  *{ box-sizing:border-box; }
  body{ margin:0; font-family:Georgia,'Times New Roman',serif; color:var(--ink); background:var(--bg); line-height:1.55; }
  header{ background:var(--green); color:#fff; padding:14px 20px; }
  header a{ color:#fff; text-decoration:none; font-weight:700; letter-spacing:.02em; }
  main{ max-width:880px; margin:0 auto; padding:28px 20px 48px; display:grid; gap:28px; grid-template-columns:minmax(0,260px) minmax(0,1fr); align-items:start; }
  img.cover{ width:100%; height:auto; border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,.18); background:#e8e4d8; }
  h1{ margin:0 0 6px; font-size:1.7rem; line-height:1.25; }
  .urdu{ font-size:1.4rem; margin:0 0 10px; color:var(--soft); }
  dl{ margin:18px 0; display:grid; grid-template-columns:auto 1fr; gap:6px 14px; }
  dt{ color:var(--soft); } dd{ margin:0; }
  .btns{ display:flex; flex-wrap:wrap; gap:10px; margin-top:22px; }
  .btn{ display:inline-block; padding:11px 18px; border-radius:6px; text-decoration:none; font-weight:700; border:2px solid var(--green); color:var(--green); }
  .btn.solid{ background:var(--green); color:#fff; }
  footer{ text-align:center; color:var(--soft); font-size:.9rem; padding:0 20px 28px; }
  @media (max-width:640px){ main{ grid-template-columns:1fr; } img.cover{ max-width:260px; } }
</style>
</head>
<body>
<header><a href="/">Darul Ishaat — Publishers of Islamic Books, Karachi, Est. 1950</a></header>
<main>
  <img class="cover" src="/${esc(encodeURI(b.img))}" alt="Cover of ${esc(b.title)}"${size ? ` width="${size.w}" height="${size.h}"` : ''}>
  <div>
    <h1>${esc(b.title)}</h1>${b.urdu ? `
    <p class="urdu" dir="rtl" lang="ur">${esc(b.urdu)}</p>` : ''}
    <dl>
      <dt>Author</dt><dd>${esc(b.author)}</dd>
      <dt>Category</dt><dd>${esc(b.cat)}</dd>${meta ? `
      <dt>Details</dt><dd>${esc(meta)}</dd>` : ''}
      <dt>Publisher</dt><dd>Darul Ishaat, Urdu Bazar, Karachi</dd>
    </dl>
    <div class="btns">
      <a class="btn solid" href="${esc(wa)}" rel="noopener">Order on WhatsApp</a>
      <a class="btn" href="/?book=${esc(encodeURIComponent(slug))}#catalogue">View in catalogue</a>
    </div>
  </div>
</main>
<footer>© Darul Ishaat, Karachi · Nationwide delivery · <a href="/">Browse all books</a></footer>
</body>
</html>
`;
}

function notFound() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex"><title>Book not found — Darul Ishaat</title></head><body style="font-family:Georgia,serif;text-align:center;padding:60px 20px"><h1>Book not found</h1><p><a href="/">Browse the Darul Ishaat catalogue</a></p></body></html>`;
}

module.exports = function handler(req, res) {
  try {
    const S = load();
    const u = new URL(req.url, 'http://localhost');
    const q = req.query || {};
    const pick = (v) => (Array.isArray(v) ? v[0] : v);
    const slug = pick(q.slug) || u.searchParams.get('slug');
    const wantSitemap = pick(q.sitemap) || u.searchParams.get('sitemap');

    if (wantSitemap) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      return res.end(sitemap(S));
    }
    const ua = (req.headers && req.headers['user-agent']) || '';
    // The reply depends on who is asking, so it must never be shared between
    // visitors by an edge/browser cache.
    res.setHeader('Vary', 'User-Agent');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, max-age=0');

    if (!isBot(ua)) {
      // A person: give them the whole website. index.html opens this book's
      // details popup by itself because the address is /book/<slug>.
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(S.siteHtml);
    }

    const i = slug ? S.bySlug.get(String(slug).toLowerCase().replace(/\/+$/, '')) : undefined;
    if (i === undefined) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(notFound());
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(bookPage(S, i));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('SEO function error: ' + err.message);
  }
};
