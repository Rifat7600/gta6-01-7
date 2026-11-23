# Dustline — Open-World Crime Game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Rifat7600/gta6-01-7/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Rifat7600/gta6-01-7/reward.svg)](https://make.fun/bounty/gta6-01)

An original 2D top-down open-world crime game in the spirit of GTA 6, built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01). No Rockstar names, characters, maps or assets — everything here is our own: a dusty desert-edge city, a wheelwoman named Rae, and four jobs from a fixer named Mara.

## The game

You are Rae, a wheelwoman back in Dustline. Drive the avenues, steal cars, dodge the Dustline PD, and work through four story missions:

1. **Hot Start** — steal a car and bring it to Kestrel Garage.
2. **The Courier** — pick up a package at the gas station and run it to the Palm Motel before the clock runs out.
3. **Tail the Runner** — follow the blue sedan without being spotted.
4. **Heat Escape** — lose a three-star wanted level, then get to the garage.

The city is alive: traffic follows the road grid, pedestrians wander the sidewalks, police cars spawn, chase and ram you, and your wanted level (1–5 stars) decays when you break line of sight — twice as fast near the safehouse. Fight back with punches and a pistol (limited ammo, pickups around town), or just drive. Your progress saves automatically.

## Controls

- **WASD / arrows** — walk / drive (Space is the handbrake)
- **E** — steal or exit a car
- **F** — punch, **Click / G** — shoot
- **P** — pause, **M** — mute, **R** — restart after busted / wasted, **Enter** — start

## How it is built

Pure JavaScript and canvas — no libraries, no network requests, system fonts only. The world is a 3200×2400 grid city (avenues, streets, adobe blocks, a park, a gas station, a garage and a motel) with a seeded road graph for traffic. Sound is synthesized WebAudio (engine hum, sirens, blips). `?scene=cover|chase|mission|foot` stages deterministic moments for screenshots.

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's `buildDossier`. It never deletes the output directory — it only creates it and copies into it — so it runs cleanly in the grader's sandbox, and two runs write byte-identical output.
