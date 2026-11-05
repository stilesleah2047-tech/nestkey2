// Server-side SEO: real HTML for listing pages + a live sitemap.
//
// The site is a client-rendered app, so Google, WhatsApp, Facebook and TikTok
// link previews used to see empty pages ("Loading property…", "0 listings").
// These routes put the important content into the HTML itself.
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('./db');
const config = require('./config');

const router = express.Router();
const FRONT = path.join(__dirname, '..', '..', 'frontend');
// Use SITE_URL; never fall back to PUBLIC_URL, which is often http://localhost.
const SITE = String(process.env.SITE_URL || 'https://nestkey.co.ke').replace(/\/+$/, '');
const OG_DEFAULT = SITE + '/assets/og-image.png';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
const abs = (u) => (!u ? OG_DEFAULT : /^https?:\/\//.test(u) ? u : SITE + (u.startsWith('/') ? '' : '/') + u);
const dealLabel = (d) => (d === 'sale' ? 'For sale' : d === 'land' ? 'Land for sale' : 'For rent');
const money = (n) => 'KSh ' + Number(n || 0).toLocaleString('en-KE');

function listingUrl(l) { return SITE + '/property/' + l.id + (slug(l.title) ? '-' + slug(l.title) : ''); }

let template = null;
function propertyTemplate() {
  if (!template || process.env.NODE_ENV !== 'production') template = fs.readFileSync(path.join(FRONT, 'property.html'), 'utf8');
  return template;
}

function headFor(l) {
  const place = [l.location || l.region, l.county].filter(Boolean).join(', ');
  const title = `${l.title} — ${dealLabel(l.deal)}${place ? ' in ' + place : ''} | NestKey`;
  const bits = [money(l.price) + (l.deal === 'rent' ? '/month' : ''), l.beds ? l.beds + ' bed' : '', l.baths ? l.baths + ' bath' : '', place].filter(Boolean).join(' · ');
  const desc = (bits + '. ' + String(l.description || '').replace(/\s+/g, ' ')).slice(0, 300);
  const img = abs((l.photos || [])[0]);
  const url = listingUrl(l);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: l.title,
    url,
    description: desc,
    image: (l.photos || []).slice(0, 6).map(abs),
    datePosted: l.createdAt ? new Date(l.createdAt).toISOString() : undefined,
    offers: { '@type': 'Offer', price: Number(l.price) || 0, priceCurrency: 'KES', availability: 'https://schema.org/InStock', businessFunction: l.deal === 'rent' ? 'http://purl.org/goodrelations/v1#LeaseOut' : 'http://purl.org/goodrelations/v1#Sell' },
    address: { '@type': 'PostalAddress', addressLocality: l.location || l.region || undefined, addressRegion: l.county || undefined, addressCountry: 'KE' },
  };
  if (l.lat != null && l.lng != null) ld.geo = { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lng };
  return {
    title,
    head: [
      `<meta name="description" content="${esc(desc)}">`,
      `<link rel="canonical" href="${esc(url)}">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="NestKey">`,
      `<meta property="og:title" content="${esc(title)}">`,
      `<meta property="og:description" content="${esc(desc)}">`,
      `<meta property="og:url" content="${esc(url)}">`,
      `<meta property="og:image" content="${esc(img)}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${esc(title)}">`,
      `<meta name="twitter:description" content="${esc(desc)}">`,
      `<meta name="twitter:image" content="${esc(img)}">`,
      `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
      `<script>window.NESTKEY_LISTING_ID=${JSON.stringify(String(l.id))};</script>`,
    ].join('\n  '),
    // Plain HTML summary that crawlers read; the app replaces it once JS runs.
    body: `<div class="pad seo-summary">` +
      (l.photos && l.photos[0] ? `<img class="hero-img" src="${esc(l.photos[0])}" alt="${esc(l.title)}">` : '') +
      `<div class="price" style="font-size:1.5rem;font-weight:800">${esc(money(l.price))}</div>` +
      `<h1 style="font-size:1.4rem">${esc(l.title)}</h1>` +
      `<p class="loc">${esc(place)} · ${esc(dealLabel(l.deal))}</p>` +
      `<p style="white-space:pre-line">${esc(l.description || '')}</p></div>`,
  };
}

async function renderProperty(req, res, next) {
  try {
    const id = String(req.params.id || req.query.id || '').split('-')[0];
    if (!id) return next();
    const l = await db.getById(id);
    let html = propertyTemplate();
    if (!l || !l.paid || l.status !== 'published') {
      res.status(404);
      html = html.replace('</head>', '  <meta name="robots" content="noindex">\n</head>');
      return res.type('html').send(html);
    }
    // Old ?id= links → one clean, shareable URL.
    if (!req.params.id) return res.redirect(301, listingUrl(l).replace(SITE, ''));
    db.incrementViews && db.incrementViews(l.id).catch(() => {});
    const h = headFor(l);
    html = html
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(h.title)}</title>`)
      .replace('</head>', '  ' + h.head + '\n</head>')
      .replace(/<p class="dc-sub" style="padding:50px;text-align:center">Loading property…<\/p>/, h.body);
    res.set('Cache-Control', 'public, max-age=300').type('html').send(html);
  } catch (e) {
    next(e);
  }
}

router.get('/property/:id', renderProperty);
router.get('/property.html', (req, res, next) => (req.query.id ? renderProperty(req, res, next) : next()));

// Live sitemap: every public page + every published listing.
const STATIC_PAGES = [
  ['/', 'daily', '1.0'], ['/browse.html', 'daily', '0.9'], ['/services.html', 'monthly', '0.7'],
  ['/post.html', 'monthly', '0.7'], ['/verify.html', 'monthly', '0.6'], ['/about.html', 'monthly', '0.6'],
  ['/contact.html', 'yearly', '0.5'], ['/blog.html', 'weekly', '0.7'],
  ['/blog-renting-house-nairobi.html', 'monthly', '0.6'], ['/blog-buying-land-kenya.html', 'monthly', '0.6'],
  ['/blog-avoid-rental-scams-kenya.html', 'monthly', '0.6'], ['/blog-best-nairobi-neighbourhoods.html', 'monthly', '0.6'],
  ['/terms.html', 'yearly', '0.2'], ['/privacy.html', 'yearly', '0.2'], ['/cookies.html', 'yearly', '0.2'],
];
router.get('/sitemap.xml', async (_req, res) => {
  const urls = STATIC_PAGES.map(([p, f, pr]) => `<url><loc>${SITE}${p}</loc><changefreq>${f}</changefreq><priority>${pr}</priority></url>`);
  try {
    for (let page = 1; page <= 50; page++) {
      const r = await db.list({ sort: 'newest', page, limit: 60 });
      const items = (r && (r.items || r.listings)) || (Array.isArray(r) ? r : []);
      items.forEach((l) => {
        const lm = l.updatedAt || l.createdAt;
        urls.push(`<url><loc>${esc(listingUrl(l))}</loc>${lm ? `<lastmod>${new Date(lm).toISOString().slice(0, 10)}</lastmod>` : ''}<changefreq>weekly</changefreq><priority>0.8</priority></url>`);
      });
      if (items.length < 60) break;
    }
  } catch (e) { console.error('[sitemap]', e.message); }
  res.set('Cache-Control', 'public, max-age=3600').type('application/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`);
});

module.exports = { router, listingUrl, slug };
