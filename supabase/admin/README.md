# Admin role

UniSchedule has no `role` column. An admin is a user whose
`auth.users.raw_app_meta_data` carries `"role": "admin"`. This claim:

- **cannot be set or edited by the user** — only the service role (or the
  dashboard) can write `app_metadata`;
- **flows into the JWT automatically**, so it is readable in the browser
  (`session.user.app_metadata.role`) and enforceable server-side inside the
  `admin` Edge Function and in RLS (`auth.jwt() -> 'app_metadata' ->> 'role'`).

The UI gate (`AdminRoute`, the "Admin" nav link) is UX only. The security
boundary is the `admin` Edge Function, which re-checks the claim on every call.

## Grant admin to a user

Run with the service role (SQL editor, or the Management API SQL endpoint):

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where id = '<USER_UUID>';        -- or:  where email = '<email>'
```

The user must sign out and back in (or let their token refresh) for a new JWT
to carry the claim.

## Revoke admin

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data - 'role'
where id = '<USER_UUID>';
```

In practice both operations are done from the in-app **Admin → Users** screen,
which calls the `admin` Edge Function (`user.setRole`) — this SQL is the manual
fallback and how the *first* admin is bootstrapped.

## First admin (bootstrapped)

- `f5f1c602-70cc-46dc-8134-536c809f2d14` (it2022110@hua.gr)
