# Amanat Deal authentication (pilot)

## Current pilot model

- Email + password registration/login.
- Passwords are stored only as `scrypt` hashes with a random salt.
- Browser session uses an opaque random token in an `HttpOnly` cookie named `amanat_session`.
- Only SHA-256 of the session token is stored in PostgreSQL.
- Session lifetime defaults to 30 days and can be configured with `AUTH_SESSION_TTL_DAYS`.
- Logout revokes the server-side session and clears the cookie.

## API

- `POST /api/v1/auth/register` `{ email, password, name? }`
- `POST /api/v1/auth/login` `{ email, password }`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

The Next.js backend proxy forwards the auth cookie between the public web app and the NestJS API. No session token is stored in browser JavaScript or localStorage.

## Next step

Bind authenticated users to `Deal.sellerId` / `Deal.buyerId` when creating and claiming a deal invitation, then derive all participant permissions server-side instead of trusting UI-selected roles.
