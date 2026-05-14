# HTTP contracts: Player levels (global admin)

Base URL: same as existing backend (e.g. `/api`). All routes require authenticated global admin (`is_admin`).

## GET `/admin/users/levels` (indicative path)

Paginated directory for the player-levels admin page.

**Query**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | int | 100 | Page size (cap e.g. 200) |
| `cursor` or `page` | string/int | — | Cursor opaque token **or** 1-based page index |
| `q` | string | — | Optional case-insensitive search on `display_name`, `telegram_username` |

**200 Response body (example)**

```json
{
  "items": [
    {
      "id": 1,
      "displayName": "Ada",
      "telegramUsername": "ada_v",
      "avatarUrl": "https://…",
      "playerLevel": null
    }
  ],
  "nextCursor": "eyJpZCI6MTIzfQ=="
}
```

**Rules**

- `playerLevel`: `null` | `"beginner"` | `"intermediate"` | `"advanced"`.
- Items **sorted server-side** per spec P3 (bucket order + name).
- **401/403** for unauthenticated / non–global-admin.

## PATCH `/admin/users/:id/level` (indicative)

**Body**

```json
{ "playerLevel": "intermediate" }
```

Use `null` or explicit `"clear"` only if JSON schema allows—prefer **`null`** in JSON for clear.

**200** returns updated user subset (including `playerLevel`).

**400** invalid level string.

## GET/PUT `/admin/settings/five-one-level-restrictions` (indicative)

**GET 200**

```json
{ "enabled": false }
```

**PUT body**

```json
{ "enabled": true }
```

**403** if not global admin.

Exact paths should align with existing `usersAdmin` / new router naming during implementation.
