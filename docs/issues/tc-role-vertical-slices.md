# Technical Committee role — vertical slices (epic #8)

Parent: https://github.com/Kiryushin-Andrey/volley-game-central/issues/8  
PRD: `docs/prd/player-levels-and-game-format.md`  
Issue bodies: `.scratch/tc-slices/`

**Created** via Actions workflow [`create-tc-slice-issues.yml`](https://github.com/Kiryushin-Andrey/volley-game-central/blob/main/.github/workflows/create-tc-slice-issues.yml) (run [26649045796](https://github.com/Kiryushin-Andrey/volley-game-central/actions/runs/26649045796)).

## Slice overview

| Issue | Title | Blocked by | E2E |
|-------|--------|------------|-----|
| [#42](https://github.com/Kiryushin-Andrey/volley-game-central/issues/42) | TC role foundation | None | LEVELS-005, 006 |
| [#43](https://github.com/Kiryushin-Andrey/volley-game-central/issues/43) | Level assignment audit | #42 | LEVELS-007 |
| [#44](https://github.com/Kiryushin-Andrey/volley-game-central/issues/44) | Player levels level filter | #42 | LEVELS-008 |
| [#45](https://github.com/Kiryushin-Andrey/volley-game-central/issues/45) | TC game details dialog | #42, #43 | LEVELS-009–011 |

#43 and #44 can run in parallel after #42. #45 needs #43 for `GET /player-levels/users/:userId`.

Labels on each issue: `enhancement`, `ready-for-agent`.
