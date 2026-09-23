# Amanat Deal authentication (pilot)

## Current pilot model

The primary account identifier is a Kazakhstan phone number. The account itself has no permanent buyer/seller role; the role is assigned per deal.

- User enters a phone number and requests a six-digit OTP.
- OTP challenges are hashed, expire after a short TTL and allow a limited number of attempts.
- Successful OTP verification finds or creates the `User` bound to that phone.
- Browser session uses an opaque random token in an `HttpOnly` cookie named `amanat_session`.
- Only SHA-256 of the session token is stored in PostgreSQL.
- Session lifetime defaults to 30 days and can be configured with `AUTH_SESSION_TTL_DAYS`.
- Logout revokes the server-side session and clears the cookie.
- Legacy email/password endpoints remain temporarily available for existing pilot test accounts only when enabled. They are disabled by default in production unless `LEGACY_EMAIL_AUTH_ENABLED=true` is set explicitly.

## Phone OTP API

- `POST /api/v1/auth/phone/request-code` `{ phone }`
- `POST /api/v1/auth/phone/verify` `{ phone, code, name? }`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

The pilot can expose the generated OTP only when `OTP_DEBUG_CODE_ENABLED=true`. This is strictly for local/test use.

When debug mode is disabled, the API now requires an explicit OTP delivery transport. Configure:

- `OTP_DELIVERY_WEBHOOK_URL` — HTTPS endpoint that receives the SMS delivery request.
- `OTP_DELIVERY_WEBHOOK_TOKEN` — optional bearer token for that endpoint.
- `OTP_DELIVERY_TIMEOUT_MS` — delivery timeout, default 8000 ms.

The webhook receives `{ channel: "sms", to, purpose: "login_otp", message, expiresAt }`. This deliberately keeps Amanat Deal independent from a specific SMS vendor and allows the endpoint to be backed by a direct provider adapter or by Notify-KZ.

If debug mode is off and no delivery webhook is configured, the API returns a service-unavailable error instead of falsely reporting that an SMS was sent. A failed webhook delivery also invalidates that OTP challenge immediately so the user can retry instead of waiting for the resend cooldown.

Production must set `OTP_DEBUG_CODE_ENABLED=false` and configure a strong `OTP_HASH_SECRET`.

## Legacy pilot API

- `POST /api/v1/auth/register` `{ email, password, name? }`
- `POST /api/v1/auth/login` `{ email, password }`

These endpoints are enabled by default only outside production. Production requires the explicit flag `LEGACY_EMAIL_AUTH_ENABLED=true`; otherwise they return 404. Passwords for legacy accounts are stored only as `scrypt` hashes with a random salt.

## Deal identity and invitations

- Creating a new deal requires an authenticated phone account.
- The creator is bound to `Deal.sellerId` or `Deal.buyerId` according to the role chosen for that deal.
- The invitation is addressed to one normalized `recipientPhone`.
- Public invitation preview reveals only the deal public code, invited role, expiry and a masked recipient phone.
- Full deal terms and invitation claim require an authenticated session whose verified phone equals `recipientPhone`.
- Claim records `claimedByUserId` and binds the counterparty to the remaining `sellerId` / `buyerId` slot.
- Before claim, the creator can revoke the invitation or replace an incorrect phone. Reissue revokes the previous token and short code.
- After claim, the counterparty cannot be silently replaced.

The Next.js backend proxy forwards the auth cookie between the public web app and the NestJS API. No session token is stored in browser JavaScript or localStorage.
