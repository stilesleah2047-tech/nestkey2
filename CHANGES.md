# NestKey — security, SEO & consistency update

## Critical fixes
- **Photo uploads were broken.** `/api/uploads` requires sign-in, but the post page and dashboard never sent the token, so every upload failed with 401 and listings were saved with no photos. Uploads now send the token; the post page asks people to sign in (free) before uploading and shows real error messages.
- **Stored XSS through photo URLs.** Listings accepted any string as a "photo" and the site inserted it into `<img src="…">` unescaped, so one malicious listing could run script for every visitor (and steal sign-in tokens, including admin ones). The server now only accepts NestKey upload URLs (`src/media.js`) and the frontend escapes all media URLs.
- **Free listings via a fake payment notice.** The old M-Pesa callback trusted whatever was posted to it. M-Pesa Daraja has been removed completely (see Payments below); every payment is confirmed with Pesapal's GetTransactionStatus.
- **Anyone could put a landlord into commission debt.** `POST /api/rent/:id` (no login) created an 8% commission invoice. Reported sales now start as *unconfirmed* and only become owed after the seller taps **Confirm sale** in the dashboard (or **Not mine** to reject).
- **Any signed-in user could replace photos on any listing** (`POST /api/uploads/:listingId`). Now owner/admin only.

## Security hardening
- Upgraded `multer` and `qs` (2 high + 1 moderate known vulnerabilities; `npm audit` now reports 0).
- Uploads: the file's real contents are checked (a web page renamed to .png is rejected), max 30MB per file (was 60MB × 12 in memory, enough to crash a small server), and max 40 uploads per account per 15 minutes.
- Passwords: minimum 8 characters, common passwords refused (existing accounts unaffected).
- **Admin takeover:** admin rights come from `ADMIN_EMAILS`, and sign-up never checks email ownership, so anyone could register an admin address first and open the admin panel. Admin emails can no longer be registered with a password (use Google sign-in).
- Stored XSS in the homepage "areas" chips (area names weren't escaped).
- CORS limited to `CORS_ORIGINS` (was open to every site; the setting existed but wasn't used).
- Rate limits on login, register, Google sign-in, enquiries, contact, ratings, payments, listing creation and sale reports.
- Security headers (nosniff, frame, referrer, HSTS in production); `x-powered-by` removed; `trust proxy` for correct IPs.
- Public listing API no longer exposes the lister's email, M-Pesa checkout id, receipt or amount paid.
- Enquiries only on published listings, phone required; `limit` capped at 60.
- Duplicate `/api/auth` mount removed.

## SEO & sharing
- Listing pages are now real HTML at clean URLs: `/property/123-2br-apartment-roysambu`, with title, description, Open Graph/Twitter image, canonical and `RealEstateListing` structured data. Old `property.html?id=` links 301-redirect.
- Live `/sitemap.xml` from the database (all published listings + all pages). Static sitemap removed.
- Description, canonical and share image on every public page; Organization data on the homepage; new `assets/og-image.png` (1200×630).
- Listing cards contain real links so Google can follow them.
- The n8n social-video webhook now sends the clean `/property/…` link (with preview) instead of `property.html?id=`.

## Business / consistency
- Bug: Pro & Agency subscribers were still charged the showcase fee (code checked for a plan id `landlord` that doesn't exist).
- Listings posted while signed in are linked to the account (they show in the dashboard).
- Phone / WhatsApp number is required when posting.
- Same navigation (incl. **Verify a deed**) on every public page; hamburger menu up to 1080px so 8 links don't wrap.
- Pricing copy now matches the code: one-off fee from KSh 100/room **or** monthly plans; 8% commission on sales only.
- Post page theme colour fixed (#0B1B2B).
- Service worker: pages are network-first, so visitors get updates without a cache-version bump.
- `package-lock.json` re-synced with `package.json` (`npm ci` was failing).

## Payments — Pesapal only
- Removed M-Pesa Daraja completely: `services/mpesa.js`, `/api/payments/stk`, `/api/payments/callback`, `/api/subscriptions/subscribe`, the M-Pesa commission option, `MPESA_*` settings. Customers still pay with M-Pesa *through Pesapal*.
- New `src/billing.js`: one place that decides "paid", always from Pesapal's own status answer, used by status polling, the IPN and the return page.
- **Bug: subscriptions could be extended for free.** `activateSub` adds 30/365 days each time it runs, and it ran on every status check / IPN for the same payment. Now it runs exactly once.
- **Bug: "Pay again" failed.** Pesapal needs a unique merchant reference per order; `HOUSE12` was reused. References are now unique (`HOUSE12-lx3abc`), and a payment on an older order is still matched to its listing.
- **Bug: the payment window showed a 404 after paying.** `PESAPAL_CALLBACK_URL` pointed to `/api/payments/pesapal-return`, which didn't exist. It now shows a "Payment received" page and closes the window immediately.
- An old, abandoned order failing later no longer takes down a listing that was paid with a newer order; reversals (refunds/chargebacks) do unpublish.
- Paid amount and currency are checked against what we charged; mismatches are flagged in the admin feed instead of being accepted.
- IPN replies `status: 500` on errors so Pesapal retries.
- The customer's name is sent to Pesapal instead of "NestKey Customer".
- Closing the payment window now re-enables the Pay button on the plans page (it stayed disabled).

## After deploying
1. Set `SITE_URL=https://nestkey.co.ke`. Check `PESAPAL_IPN_URL` = `https://nestkey.co.ke/api/payments/ipn` and `PESAPAL_CALLBACK_URL` = `https://nestkey.co.ke/api/payments/pesapal-return`. You can delete all `MPESA_*` settings.
2. Submit `https://nestkey.co.ke/sitemap.xml` in Google Search Console.
3. Test a share: paste a `/property/…` link into WhatsApp — it should show the photo, title and price.
