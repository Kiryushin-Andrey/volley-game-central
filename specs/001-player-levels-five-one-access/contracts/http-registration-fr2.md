# HTTP contracts: Registration FR-2 errors

Applies to `POST /games/:gameId/register` when global toggle **enabled**, game `play_mode === 'with_positions'`, and FR-2 blocks the attempt.

## Error envelope (403)

Align with existing early-registration JSON in `games.ts`:

```json
{
  "error": "Human-readable message without internal level names.",
  "code": "FIVE_ONE_LEVEL_NOT_ELIGIBLE",
  "gameDateTime": "2026-06-01T18:00:00.000Z",
  "registrationOpensAt": "2026-05-29T18:00:00.000Z"
}
```

| `code` | When |
|--------|------|
| `FIVE_ONE_LEVEL_NOT_ELIGIBLE` | Beginner (or policy “not eligible”) — **omit** `registrationOpensAt` if N/A |
| `FIVE_ONE_LEVEL_WINDOW` | Intermediate (or similar) **before** allowed instant — **include** `registrationOpensAt` |

**Telegram:** Same human text as `error` (or templated variant) via `notifyUser`, subject to **60s dedupe** per user/game/code.

**Note:** Field names (`gameDateTime`, etc.) should match existing registration denial payloads for client reuse.
