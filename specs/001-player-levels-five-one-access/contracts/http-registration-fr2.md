# HTTP contracts: Registration FR-2 errors

Applies to `POST /games/:gameId/register` when **enforcement is on** (hardcoded default + optional `FIVE_ONE_LEVEL_RESTRICTIONS_ENABLED` env per FR-3), game `play_mode === 'with_positions'`, and FR-2 blocks the attempt.

**No Telegram** (or other push) is sent for this failure—only the HTTP response below and mini-app handling.

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

**Note:** Field names (`gameDateTime`, etc.) should match existing registration denial payloads for client reuse.
