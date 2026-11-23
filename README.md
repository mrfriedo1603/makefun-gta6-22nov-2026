# Solmar Bay — an open-world crime game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/mrfriedo1603/makefun-gta6-22nov-2026/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/mrfriedo1603/makefun-gta6-22nov-2026/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar Bay** is an original open-world crime game for the make.fun bounty
**"Make GTA 6"** (`gta6-01`). Everything in it — the city, the characters, the
vehicles, the story, the art and the sounds — is original. Nothing comes from
Rockstar Games or any other commercial game.

Explore the sun-soaked coastal city of Solmar Bay on foot or by car: steal
cars, outrun the police, take jobs from fixer Mara Solis, and climb from a
broke wheelman to the crew's top earner. Traffic, pedestrians, a wanted
system, five story missions, combat, a day/night cycle with weather, a HUD
with a minimap, and a save system.

## Play

Open `game/index.html` in a desktop browser (or serve `game/` with any
static server). No network, no build step, no install.

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk / drive |
| Shift | Run / handbrake |
| E | Enter or exit a car |
| Space | Punch (on foot) |
| Mouse click | Shoot (on foot, after the first mission) |
| P / Esc | Pause |
| M | Mute |

Progress, cash and completed missions save automatically to the browser
(`localStorage`); the start screen offers Continue.

## Layout

- `game/index.html` — page, canvas, HUD and menus
- `game/style.css` — all styling
- `game/src/main.js` — boot, game loop, input, state machine
- `game/src/city.js` — seeded city generation: roads, blocks, buildings, beach
- `game/src/rig.js` — procedural character rigs and walk cycles
- `game/src/vehicles.js` — car definitions, driving physics, traffic AI
- `game/src/peds.js` — pedestrians and police AI
- `game/src/missions.js` — story missions, objectives and rewards
- `game/src/hud.js` — HUD and minimap rendering
- `game/src/audio.js` — synthesized WebAudio sounds (no audio files)
- `game/src/save.js` — save / load
- `game/src/render.js` — world rendering, day/night and weather
- `main.ts` — the make.fun entry program: copies `game/` and `screenshots/`
  to `/output` and writes `dossier.json`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `screenshots/` — four real renders of the game

## Screenshots

The game stages its own screenshots with `?shot=`:
`?shot=start` (title), `?shot=drive` (driving downtown),
`?shot=chase` (police chase, 3 stars, rain at dusk),
`?shot=mission` (mission in progress). Each is a fixed-seed render.
