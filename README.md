# SINAI Coach

Live at https://sinaicoach.app (GitHub Pages, custom domain).

- `/` — marketing site (`index.html`, `assets/`). `/#site` always shows the site; signed-in users are sent to `/app/`.
- `/app/` — the coach / family app (PWA). Its service worker `app/sw.js` has scope `/app/`; bump `V` there when app files change.
- `/sw.js` — leftover root worker from before the move; it unregisters itself and sends old app windows to `/app/`.
- `supabase/functions/coach-auth` — Edge Function. Backend settings live in `app/config.js`.

Brand: palette "כחול קבוצה" (#0D1F4F, #1E45B0, #4D7CF0, lime #B9EE3E for main CTAs only), logo `assets/icon.svg`.
