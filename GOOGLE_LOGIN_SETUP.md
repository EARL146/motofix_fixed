# MotoFix — Google-only Login Setup

The customer login UI now uses **Continue with Google**. Google authentication is verified by the Node/Express backend, then the user is created/found in MySQL and the existing MotoFix session is returned. Existing admin users keep their `role = admin`, so an approved Google account can be sent to `admin.html`.

## 1. Install the Google verification package

From the MotoFix project folder:

```powershell
npm install
```

If `google-auth-library` is not installed yet, run:

```powershell
npm install google-auth-library
```

## 2. Configure the Google Web OAuth client

Create a Google OAuth 2.0 **Web application** client in Google Cloud Console. Use the web client ID in the project `.env` file:

```env
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

Do not put the client secret in frontend files. The Google client ID is public; the secret, if Google provides one for the flow you choose, must remain server-side.

For local development, make sure the exact origin you use for MotoFix is allowed in the Google OAuth configuration (for example `http://localhost:3000`).

## 3. Start MotoFix

```powershell
npm start
```

The backend exposes:

- `GET /api/auth/google/config` — returns the public Google client ID to the browser.
- `POST /api/auth/google` — verifies the Google ID token, finds/creates the user, writes `login_logs`, and returns the existing MotoFix session token.

## 4. Database behavior

A fresh database gets a `google_id` column from `motofix_database.sql`. Existing databases get the same column automatically from the startup migration in `server.js`.

New Google users are created with:

- `role = customer`
- `google_id = Google subject ID`
- `phone_number = ''` until a phone number is added later
- no local password required

If a verified Google email already exists in `users`, the Google account is linked to that existing user, preserving its current role.

## 5. Login flow

```text
Continue with Google
        ↓
Google account authentication
        ↓
Node/Express verifies ID token
        ↓
MySQL find/create user
        ↓
login_logs record
        ↓
customer → index.html
admin → admin.html
```
