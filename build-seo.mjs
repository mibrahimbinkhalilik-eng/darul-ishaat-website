#!/usr/bin/env node
/**
 * build-seo.mjs — Darul Ishaat SEO generator
 *
 * Reads the CATALOGUE array straight out of index.html and writes:
 *   • sitemap.xml            home page + one URL per book (with cover-image entries)
 *   • robots.txt             allows all crawlers and points to the sitemap
 *   • book/<slug>/index.html one lightweight landing page per book, carrying that
 *                            book's own Open Graph / Twitter tags + Book/Product
 *                            JSON-LD (link-preview crawlers such as WhatsApp,
 *                            Facebook and Telegram do not run JavaScript, so
 *                            per-book previews need real per-book pages).
 *
 * Usage (run from the folder that contains index.html and images/):
 *   node build-seo.mjs
 *   node build-seo.mjs --site https://www.example.com     # override the domain
 *   node build-seo.mjs --no-pages                         # sitemap + robots only
 *   node build-seo.mjs --root path/to/site                # site folder (default: this file's folder)
 *
 * Re-run it whenever you add or rename books, then commit/deploy the output.
 * The slug and JSON-LD rules live in index.html (DA_SEO block) and are reused
 * here, so the page and this script can never disagree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i > -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const flag = (name) => args.includes('--' + name);
const die = (msg) => { console.error('✗ ' + msg); process.exit(1); };

const root = path.resolve(opt('root', path.dirname(fileURLToPath(import.meta.url))));
const htmlPath = path.join(root, opt('html', 'index.html'));
if (!fs.existsSync(htmlPath)) die(`Cannot find ${htmlPath}`);
const html = fs.readFileSync(htmlPath, 'utf8');

// ── 1. Shared SEO helpers (slugs, JSON-LD) from index.html ───────────────────
const b0 = html.indexOf('/* DA_SEO_START');
const b1 = html.indexOf('/* DA_SEO_END */');
if (b0 < 0 || b1 < 0) die('DA_SEO block not found in index.html');
const DA_SEO = new Function(html.slice(b0, b1) + '\nreturn DA_SEO;')();
const SITE = (opt('site', process.env.SITE_URL || DA_SEO.site())).replace(/\/+$/, '');
DA_SEO.setSite(SITE);

// ── 2. The catalogue array ───────────────────────────────────────────────────
const c0 = html.indexOf('const CATALOGUE');
if (c0 < 0) die('CATALOGUE array not found in index.html');
const start = html.indexOf('[', c0);
const end = html.indexOf('\n  ];', start) + 4;
const consts = {};
for (const m of html.matchAll(/const ([A-Z][A-Z_]*) = (["'])(images\/[^"']+)\2/g)) consts[m[1]] = m[3];
const CATALOGUE = new Function(...Object.keys(consts), 'return ' + html.slice(start, end) + ';')(...Object.values(consts));
if (!Array.isArray(CATALOGUE) || !CATALOGUE.length) die('CATALOGUE is empty');
const slugs = DA_SEO.slugs(CATALOGUE);

// ── helpers ─────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonLd = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const today = new Date().toISOString().slice(0, 10);
const umami = (html.match(/<script defer src="https:\/\/cloud\.umami\.is\/script\.js"[^>]*><\/script>/) || [''])[0];

// Sniffs the REAL image format from the file's bytes (not its extension) and
// returns { w, h, type }. Some covers are WebP/PNG files named .jpg; social
// crawlers want an accurate og:image:type, so we read it from the data.
function imageInfo(file) {
  try {
    const buf = fs.readFileSync(file);
    if (buf[0] === 0xff && buf[1] === 0xd8) {                       // JPEG
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
          return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), type: 'image/jpeg' };
        i += 2 + buf.readUInt16BE(i + 2);
      }
    } else if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {   // WebP
      const kind = buf.toString('ascii', 12, 16);
      if (kind === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff, type: 'image/webp' };
      if (kind === 'VP8L') { const b0 = buf.readUInt32LE(21); return { w: (b0 & 0x3fff) + 1, h: ((b0 >> 14) & 0x3fff) + 1, type: 'image/webp' }; }
      if (kind === 'VP8X') return { w: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)), h: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)), type: 'image/webp' };
    } else if (buf.toString('ascii', 1, 4) === 'PNG') {                                              // PNG
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: 'image/png' };
    }
  } catch {}
  return null;
}

// ── 3. sitemap.xml ──────────────────────────────────────────────────────────
const urls = [];
urls.push(`  <url>
    <loc>${SITE}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`);
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
fs.writeFileSync(path.join(root, 'sitemap.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>
`);

// ── 4. robots.txt ───────────────────────────────────────────────────────────
fs.writeFileSync(path.join(root, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

// ── 5. Per-book landing pages ───────────────────────────────────────────────
let pages = 0;
if (!flag('no-pages')) {
  const bookDir = path.join(root, 'book');
  fs.rmSync(bookDir, { recursive: true, force: true });
  CATALOGUE.forEach((b, i) => {
    const slug = slugs[i];
    const url = DA_SEO.pageUrl(slug);
    const img = DA_SEO.absImg(b.img);
    const size = imageInfo(path.join(root, b.img));
    const desc = DA_SEO.shortDesc(b, 200);
    const title = `${b.title} — Darul Ishaat`;
    const author = DA_SEO.parseAuthor(b.author).names.join(' & ');
    const wa = `https://wa.me/923178223345?text=${encodeURIComponent(`Assalamu alaikum, I'd like to order: ${b.title}`)}`;
    const meta = DA_SEO.cleanMeta(b);
    const page = `<!DOCTYPE html>
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
<meta property="og:image:secure_url" content="${esc(img)}">
<meta property="og:image:type" content="${size ? size.type : 'image/jpeg'}">${size ? `
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
    const dir = path.join(bookDir, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), page);
    pages++;
  });
}

console.log(`✓ ${CATALOGUE.length} books read from ${path.basename(htmlPath)}`);
console.log(`✓ sitemap.xml  — ${CATALOGUE.length + 1} URLs (${SITE})`);
console.log('✓ robots.txt');
console.log(flag('no-pages') ? '– book pages skipped (--no-pages)' : `✓ ${pages} book pages in book/<slug>/index.html`);
