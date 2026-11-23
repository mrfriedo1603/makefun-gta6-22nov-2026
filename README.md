# Solmar Bay — an open-world crime game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/mrfriedo1603/makefun-gta6-22nov-2026/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/mrfriedo1603/makefun-gta6-22nov-2026/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar Bay** is my entry for the make.fun bounty **"Make GTA 6"**
(`gta6-01`): a top-down 2D open-world crime game set in a sun-soaked coastal
city of my own invention. The city, the people, the cars, the story, the art
and the sounds are all original — nothing in it comes from Rockstar Games or
any other commercial game.

You play Danny Reyes, a broke wheelman back in town. Fixer Mara Solis has
five jobs for him: pickups, fares, a hot getaway, a delivery across a city
full of cops, and one last big score at Bay Bank. Between jobs, steal any car
on the street, outrun the patrol cars, and watch the wanted stars climb.

## Play

Open `game/index.html` in a desktop browser, or serve `game/` with any
static file server. No network, no build step, nothing to install.

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk / drive |
| Shift | Run / handbrake |
| E | Get in or out of a car |
| Space | Punch (on foot) |
| Mouse click | Shoot (on foot, once you have the pistol) |
| P / Esc | Pause |
| M | Mute |

Cash, completed jobs and the pistol save automatically to the browser
(`localStorage`); the title screen offers Continue when a save exists.

## What's inside

- A seeded coastal city: gridded roads, blocks of buildings, a park, a
  beach and the sea to the south; Downtown, Old Port, Marina and the docks.
- Traffic that drives the road graph, pedestrians strolling the sidewalks
  (and fleeing when things get loud), foot cops and patrol cars.
- A wanted system from 1 to 5 stars: heat rises with every crime and cools
  when you stay clean and out of sight.
- Five story missions with dialogue, objectives and cash rewards; the first
  job earns you a pistol.
- Punch and pistol combat, car stealing and arcade driving physics.
- A day/night cycle with dawn, dusk and night, plus sunny, rain and fog
  weather; synthesized WebAudio sounds, no audio files.
- A HUD with cash, wanted stars, the current objective and a live minimap;
  title, pause, busted, wasted and job-complete screens.

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
