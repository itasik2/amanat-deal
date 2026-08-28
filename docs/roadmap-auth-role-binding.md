# MVP-8: Auth and role binding

## Goal

Replace pilot role switching with authenticated participant identity.

## Scope

1. Email/password registration and login.
2. Opaque server-side sessions in HttpOnly cookies.
3. Bind deal creator to `sellerId` or `buyerId` according to `creatorRole`.
4. Invitation claim binds the authenticated counterparty to the opposite slot.
5. Deal list/get returns only deals where the authenticated user is a participant.
6. Participant commands derive role from `sellerId` / `buyerId` on the server.
7. Remove public role switching from production UI; retain dev/test role tools only behind an explicit development flag.
8. Move admin access to a separate protected `/admin` phase.

## Security notes

- Never trust `?role=`, `actorRole`, or `uploaderRole` from the browser as authorization.
- Never store raw session tokens in PostgreSQL.
- Invitation preview remains public and limited to safe deal terms.
- Invitation claim requires authentication and is one-time/atomic.
