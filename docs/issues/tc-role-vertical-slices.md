# Technical Committee role — vertical slices (epic #8)

Parent: https://github.com/Kiryushin-Andrey/volley-game-central/issues/8  
PRD: `docs/prd/player-levels-and-game-format.md`  
Issue bodies: `.scratch/tc-slices/`

Create issues in order (23 → 26) so **Blocked by** can reference real numbers. Apply label **`ready-for-agent`** when publishing.

```bash
gh issue create --title "Slice: TC role foundation (steward access + routing)" --label "enhancement" --label "ready-for-agent" --body-file .scratch/tc-slices/23-tc-role-foundation.md
gh issue create --title "Slice: Level assignment audit (Set by + GET profile)" --label "enhancement" --label "ready-for-agent" --body-file .scratch/tc-slices/24-level-assignment-audit.md
gh issue create --title "Slice: Player levels page level filter" --label "enhancement" --label "ready-for-agent" --body-file .scratch/tc-slices/25-player-levels-filters.md
gh issue create --title "Slice: TC game details dialog (read-only level)" --label "enhancement" --label "ready-for-agent" --body-file .scratch/tc-slices/26-tc-game-dialog.md
```

After creation, edit **Blocked by** in #24–#26 to point at the actual parent issue numbers.

## Slice overview

| # | Title | Type | Blocked by | E2E |
|---|--------|------|------------|-----|
| 23 | TC role foundation | AFK | None | LEVELS-005, 006 |
| 24 | Level assignment audit | AFK | #23 | LEVELS-007 |
| 25 | Player levels level filter | AFK | #23 | LEVELS-008 |
| 26 | TC game details dialog | AFK | #23, #24 | LEVELS-009–011 |

#24 and #25 can run in parallel after #23. #26 needs #24 for `GET /player-levels/users/:userId`.
