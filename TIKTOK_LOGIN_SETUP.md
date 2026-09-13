# TikTok Login Kit setup for MotoFix

This patch adds customer-only TikTok Login Kit using TikTok OAuth 2.0 v2.

## 1. Rotate the old TikTok client secret

The previous ZIP contained a client secret. Treat it as compromised and generate a new one in the TikTok Developer Portal. Do not commit the new secret to GitHub.

## 2. Configure `.env`

Set:

```env
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_new_client_secret
TIKTOK_REDIRECT_URI=https://YOUR-NGROK-DOMAIN.ngrok-free.app/api/auth/tiktok/callback
```

For TikTok Login Kit Web, the redirect URI must be an absolute HTTPS static URI and must exactly match the URI registered in your TikTok app.

## 3. Start MotoFix and ngrok

Terminal 1:

```powershell
cd "C:\Users\shizu\OneDrive\Documents\Ampps\www\motofix_fixed"
node server.js
```

Terminal 2:

```powershell
ngrok http 3000
```

Copy the HTTPS `ngrok-free.app` URL into `TIKTOK_REDIRECT_URI` and into TikTok Developer Portal > your app > Login Kit > Web redirect URI.

## 4. Restart MotoFix

Restart `node server.js` after changing `.env`. On startup, the server automatically creates:

- `users.tiktok_open_id`
- `tiktok_accounts` for server-side access/refresh tokens

You can also run `TIKTOK_LOGIN_MIGRATION.sql` manually if preferred.

## 5. Test

Open MotoMarket and click **Continue with TikTok**. The flow is:

1. `/api/auth/tiktok` creates a random CSRF state and redirects to TikTok.
2. TikTok redirects to `/api/auth/tiktok/callback`.
3. The server validates state and exchanges the authorization code server-side.
4. The server gets `open_id`, `display_name`, and `avatar_url`.
5. A customer account is created/updated.
6. OAuth tokens remain server-side in `tiktok_accounts`.
7. MotoMarket receives the same `mf_user`/session token format used by the existing login flow.

TikTok login is intentionally customer-only; admin accounts must continue using Admin Login.
