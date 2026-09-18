# NestKey

A standalone listings marketplace — find and post houses/rooms for rent or sale, grouped by area, with M-Pesa (Daraja) listing payments. Built to run on **PostgreSQL _or_ MongoDB** (your choice), with an installable web app (PWA).

## Quickstart (Docker — one command)
With Docker Desktop, from the `househunt-app` folder:
```bash
docker compose up --build
```
Open **http://localhost:4000**. This boots PostgreSQL + the app together and creates tables
automatically. Add M-Pesa/Pesapal keys to the `app` service in `docker-compose.yml` when
you're ready to test payments. No Docker? Use **Manual setup** below.

```
househunt-app/
├── backend/     Node.js + Express API (Postgres or Mongo, M-Pesa, uploads)
└── frontend/    Installable web app (browse + post + pay) — plain HTML/JS PWA
```

## What works today
- Browse listings by **area/region** with search, price, beds, deal-type filters and sorting.
- **Post a house** with photo uploads and a fee that scales per room (KSh 100/room by default).
- **M-Pesa STK Push** payment; listing auto-publishes once paid.
- One data layer, **two databases** — switch with a single env var.
- Web app is a **PWA**: installable on Android/iOS home screens; native app can wrap the same API later.

## 1. Prerequisites
- Node.js 18+
- Either PostgreSQL 13+ **or** MongoDB 6+

## 2. Configure
```bash
cd backend
cp .env.example .env
# edit .env — pick DB_DRIVER=postgres or mongo, set the matching URL,
# and add your Safaricom Daraja credentials when ready.
npm install
```

### Choose your database
- **PostgreSQL:** set `DB_DRIVER=postgres` and `DATABASE_URL`. The table is created automatically on first run (see `src/db/schema.sql`).
- **MongoDB:** set `DB_DRIVER=mongo` and `MONGO_URI`. Collections/indexes are created automatically.

## 3. Run
```bash
npm start
# API + web app on http://localhost:4000
```
Open http://localhost:4000 to browse, and http://localhost:4000/post.html to post a house.

## 4. M-Pesa (Daraja)
1. Create an app at the Safaricom Developer Portal and get Consumer Key, Secret, Passkey, Shortcode.
2. Put them in `.env` (`MPESA_*`). Start with `MPESA_ENV=sandbox`.
3. Set `MPESA_CALLBACK_URL` to a **public HTTPS** URL that reaches `POST /api/payments/callback` (use a tunnel like ngrok in development).
4. Test a payment end-to-end in sandbox before going live.

## API
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/listings` | Search: `q, region, deal, minBeds, minPrice, maxPrice, sort, page, limit` |
| GET | `/api/listings/regions` | Region list + counts |
| GET | `/api/listings/:id` | One listing |
| POST | `/api/listings` | Create a pending listing |
| POST | `/api/uploads/:id` | Upload photos (`multipart/form-data`, field `photos`) |
| POST | `/api/payments/stk` | Start M-Pesa STK push |
| POST | `/api/payments/callback` | Safaricom result callback |
| GET | `/api/payments/status/:id` | Poll payment status |

## Swapping the database
`src/db/index.js` picks `mongo.js` or `postgres.js` by `DB_DRIVER`. Both expose the same repository
methods (`create`, `getById`, `list`, `regions`, `setCheckout`, `findByCheckout`, `markPaid`,
`markFailed`, `addPhotos`), so the routes never change.

## Suggested next steps
- **Accounts** for posters (JWT auth) so people manage their own listings.
- **Cloud storage** for photos (S3/Cloudflare R2) instead of local disk.
- **Native mobile app** (React Native / Expo) consuming this same API.
- **Notifications** — WhatsApp/email/SMS alerts when a house is posted in a saved area.
- **Moderation dashboard** for reviewing listings.

## Notes on the two databases
Postgres is the safer default for structured data, payments and reporting (relational integrity, SQL).
Mongo suits very flexible/rapidly-changing listing shapes. This project supports either so you can pick
per your team's comfort; you don't need both at once.

## Services & subscriptions (monetization)
NestKey includes a subscription layer paid by M-Pesa, based on how Kenyan
property platforms actually earn:

| Plan | For | Price |
|------|-----|-------|
| **Hunter Plus** | House hunters | KSh 299/mo (or 2,990/yr) — instant area alerts, early access, verified-only listings |
| **Landlord Pro** | Property owners | KSh 1,500/mo — featured placement, verified badge, analytics, rent tools |
| **Agency** | Agents & agencies | KSh 4,500/mo — unlimited listings, top priority, agency profile, team access |

Plus one-off add-ons (boost a listing, verified badge). Edit plans/prices in
`backend/src/plans.js`. The pricing page is `/services.html` with a monthly/annual
toggle and a "manage subscription" lookup by phone.

Subscription endpoints:
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/subscriptions/plans` | Plan catalogue |
| POST | `/api/subscriptions/subscribe` | Start a plan → M-Pesa STK |
| GET | `/api/subscriptions/status/:id` | Poll activation |
| GET | `/api/subscriptions/me?phone=` | Look up an active subscription |

Listing and subscription payments share **one** M-Pesa callback URL; the callback
resolves whichever it belongs to.

> Note: M-Pesa STK Push is one prompt per payment, so monthly renewal is a manual
> re-subscribe (the norm for M-Pesa consumer billing). True auto-recurring needs
> M-Pesa Ratiba (standing order) — a good next step.

## Branding
NestKey has its own identity — a house-with-magnifier mark and a teal/gold
palette, separate from any other brand. See `frontend/assets/logo.svg` and the
generated `icon-192/512.png`.

## Video Showcase listings (rich, room-by-room pages)
Posters can build a listing with **multiple photos + videos + a description per room**.
The app **auto-arranges the rooms** into a natural walk-through — Exterior → Living →
Kitchen → Dining → Bedrooms → Bathrooms → Balcony → Compound → Other — so every
showcase reads like a proper property page without the poster ordering anything.

Two listing types on the Post page:
- **Standard** — photos + description, KSh 100/room.
- **Video Showcase** — the room-by-room page with videos. One-off upgrade
  (`SHOWCASE_FEE`, default **KSh 500**), **waived automatically for Landlord Pro /
  Agency subscribers** (checked by their M-Pesa number at payment time).

Media flow: files upload to `POST /api/uploads` (images + video, ≤60MB each) and come
back as URLs; the listing is then created with a `rooms` array and a `tier`. Room order
is enforced server-side in `backend/src/rooms.js`. For production, move uploads to
S3/R2 and transcode videos.

## Payments: M-Pesa + Pesapal (on-site, no redirect)
Every payment (listing fee, showcase upgrade, subscription) can be paid two ways,
chosen with a "Pay with" toggle:

- **M-Pesa (STK Push)** — prompt straight to the phone.
- **Card / Pesapal** — cards, Airtel Money and more, shown in an **iframe on our own
  page** (Pesapal API v3 `SubmitOrderRequest` → `redirect_url` loaded in a frame). The
  user never leaves NestKey; we poll `GetTransactionStatus` and also settle via IPN.

Configure Pesapal in `.env` (`PESAPAL_*`). Set `PESAPAL_IPN_URL` and
`PESAPAL_CALLBACK_URL` to public HTTPS URLs; the server auto-registers the IPN on first
use if `PESAPAL_IPN_ID` is blank. One IPN endpoint (`/api/payments/ipn`) settles both
listings and subscriptions.

New endpoints:
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/payments/pesapal` | Start a card payment for a listing → iframe URL |
| GET | `/api/payments/pesapal/status/:otid` | Poll Pesapal status |
| GET/POST | `/api/payments/ipn` | Pesapal IPN (settles listing or subscription) |
| POST | `/api/subscriptions/pesapal` | Subscribe via card → iframe URL |

## Real, live data only
No sample/placeholder images ship in the app. Listings render only real uploaded
media; when a listing has no photo yet, a local inline "No photo yet" tile is shown
(no external example images). The browse page **auto-refreshes every 30s** so newly
posted (paid) homes appear without a manual reload — a foundation for going fully
realtime (WebSockets/SSE) later.

## Agent & landlord accounts (subscription-based publishing)
Agents, landlords and individuals create an account and manage their own portfolio
from a dashboard. Instead of paying per listing, they subscribe monthly and publish
**within a quota tied to how many houses they list**:

| Plan | Publishes | Price |
|------|-----------|-------|
| Starter | up to 5 properties | KSh 1,000/mo |
| Pro | up to 20 properties | KSh 2,500/mo |
| Agency | unlimited | KSh 4,500/mo |

Flow: register/sign in → add properties as drafts → **Publish** (gated by the plan's
`maxListings`; over-quota or no-plan prompts an upgrade) → live listings appear on the
public site in real time.

The dashboard shows published/draft counts, a quota bar, a leads inbox, and per-listing
views. Auth is JWT (30-day) with bcrypt-hashed passwords.

### Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/register` / `/api/auth/login` | Create account / sign in → `{ token, user }` |
| GET | `/api/auth/me` | Current user |
| GET | `/api/agent/summary` | Counts, quota, plan, leads |
| GET/POST | `/api/agent/listings` | List mine / create draft |
| POST | `/api/agent/listings/:id/publish` | Publish (quota-gated: 402 needPlan / 403 quota) |
| POST | `/api/agent/listings/:id/unpublish` · DELETE `/:id` · PUT `/:id` | Manage |
| GET | `/api/agent/leads` | Enquiries inbox |
| POST | `/api/listings/:id/enquire` | Public enquiry → lead for the owner |

## Real-time (production-ready foundation)
- **Server-Sent Events** at `/api/stream` push `listing.published` to everyone (the
  browse page updates the instant an agent publishes) and `lead.created` privately to the
  owner (`?token=` binds the stream to a user). The dashboard toasts new enquiries live.
- Views increment on each listing open; leads captured on enquiry; WhatsApp click-to-chat
  links generated from the owner's number.

### Outside-the-box / recommended next integrations
- **M-Pesa Ratiba** (standing order) for true auto-recurring subscriptions.
- **Cloud media** (S3/R2) + video posters/transcoding for fast showcase playback.
- **SMS/email** (Africa's Talking / nodemailer) for lead + renewal notifications.
- **Verified agent badge** tied to ID/KRA checks; **team seats** for agencies.
- **Map search** (Google Places) and saved-search **area alerts** for Hunter Plus.

## Front page: search by county → town
The landing page (`/`) leads with a **County → Town** finder. A visitor picks a county,
then a town/area (or "any town"), optionally rent/sale, and hits **Find houses** — they
land on `/browse.html?county=…&town=…` showing exactly the houses in that area. If they
don't choose anything (or click **browse all listed houses**), they see **every listing**.
Popular counties are shown as quick cards.

- Locations come from `GET /api/locations` (`backend/src/locations.js`, counties → towns) —
  edit that one file to add areas.
- Listings now store a `county` (chosen on the post/dashboard forms, or derived from the
  town) so search works by county, by town, or both.
- `/browse.html` reads the query params, scopes results, shows an area heading and a
  **Clear area** button; with no params it lists everything. Real-time SSE + 30s refresh
  still apply.

## Pricing model: subscription for rentals, subscription + 8% for sales
**Rentals → subscription-only.** Landlords pay a monthly plan to publish within their
quota; no commission on rent. Renting is arranged directly with the landlord (enquiry /
WhatsApp).

**Sales → hybrid.** Sellers still need a plan to list, **and** NestKey earns **8%** when
the property is paid for. A buyer taps **Buy / pay for this property**, sees the seller's
own payment details, pays the seller **directly**, then taps **I’ve paid** — we record
the sale and invoice the seller 8% (shown as commission owed in their dashboard, settled
via M-Pesa/Pesapal). We never hold funds. `COMMISSION_RATE` sets the rate.

The **Buy / pay** button only appears on **for-sale (and land)** listings; rentals show
only enquiry + WhatsApp. After any payment, a **rating pop-up** asks for 1–5 stars.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/rent/:id/payinfo` | Seller pay-to details (sale/land only) |
| POST | `/api/rent/:id` | Record a sale payment (+ our 8%) |
| GET | `/api/agent/transactions` | Seller’s recorded sales + commission summary |
| POST | `/api/agent/commission/pay` | Seller settles the invoiced commission |
| GET/PUT | `/api/agent/profile` | Payment / payout / KYC details |
| POST | `/api/ratings` | Star ratings |

## Ideas to further improve the customer experience
- **Saved favourites & area alerts** for hunters (heart a listing; get notified when a match is posted).
- **On-listing reviews/ratings of landlords** (trust before you pay).
- **Map view** of results (Google Places) and distance-to-work search.
- **Verified badge** after ID/KRA checks; show it on cards.
- **Auto-invoicing + statements** (monthly commission statement emailed/SMS via Africa's Talking).
- **In-app receipts** and a shareable listing link with rich preview.

## Map view of search results
The Browse page has a **List / Map** toggle. Map view plots the current (filtered) results
on an interactive map using **Leaflet + OpenStreetMap — no API key required**, so it works
out of the box. Each pin shows a photo, price and title; "View details" opens the full
listing. Listings are positioned from a **county/town gazetteer** in
`backend/src/locations.js` (county centre + per-town coordinates, with slight jitter so
listings in the same area don't overlap). Add coordinates there to cover more areas, or
later store a precise lat/lng per listing for exact pins.
