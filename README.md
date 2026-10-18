# Great North Creative Arts Consultation Services

## What works
Responsive multi-section site, individual service modal windows, original Desert Letters cover, portfolio, validated pre-order form and consultation booking form. Workers server writes successful requests to Cloudflare D1 and returns unique confirmation references. No payment is taken. This is **a deployable MVP**, not a live site yet.

## Deploy to Cloudflare Workers
1. Set up a Cloudflare account and Node.js 20+ on your development computer.
2. In this directory run `npm install` and `npx wrangler login`.
3. Run `npx wrangler d1 create great-north-orders`; copy the database ID into `wrangler.toml`.
4. Run `npm run db:remote` to create tables on Cloudflare.
5. Run `npm run deploy`; Wrangler will provide a `workers.dev` URL.
6. Test pre-order and consultation forms. Validate rows with `npx wrangler d1 execute great-north-orders --remote --command='SELECT reference, created_at, status FROM preorders ORDER BY created_at DESC LIMIT 10'` and similar query for `bookings`.
7. Buy a domain via Cloudflare Registrar after checking the live cost and availability, then Workers > your Worker > Settings > Domains & Routes > Add Custom Domain. Set `SITE_ORIGIN` to your final HTTPS site origin for origin checks.
8. Update `public/robots.txt` with a `Sitemap:` URL, and add a sitemap.xml for your final chosen domain. Submit sitemap in Google Search Console, verify DNS ownership.
9. Connect a vetted payment processor (and webhooks) before taking payments. Define prices, cancellation policy, shipping/fulfilment, tax and privacy disclosures. Never collect card details directly in these forms.
10. Add email notification service, spam protection (Cloudflare Turnstile), availability calendar and secure staff dashboard before public promotion.

## Key limitations
- Consultation forms REQUEST a date; they do not reserve calendar slots or check availability.
- Book requests are unpaid reservations of interest, not guaranteed orders. Book price and stock are intentionally not invented.
- No payment, shipping, appointment confirmations or automated outbound email integration is activated.
- The D1 database stores personal contact details; create a privacy policy, retention policy, access controls, spam protections and backups before live operation.
- Portrait artwork used for the hero is a crop of the supplied promotional design, and the book cover is the image supplied by the user. No testimonial claims or fictional prices are added.
- The logo reference is packaged, and the site header implements a text + mountain motif. For exact production logo fidelity, supply a vector/transparent asset.
