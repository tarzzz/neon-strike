# NEON STRIKE

A browser-based 2D run-and-gun shooter inspired by **Contra** and **Duke Nukem**.

Neon-soaked streets, double jumps, weapon pickups, flying drones, turrets, and two boss fights — all in pure HTML5 Canvas (no build step, no assets pack).

## Play

ES modules need a local server (opening `index.html` via `file://` will not work).

```bash
cd neon-strike
./serve.sh deps           # check / install dependencies (python3, curl, lsof)
./serve.sh start          # ALWAYS installs/checks deps first, then serves http://127.0.0.1:8080
./serve.sh open           # start (if needed) + open browser
./serve.sh status
./serve.sh stop
./serve.sh restart
```

`start` / `open` / `restart` call the dependency installer automatically (Homebrew on macOS, apt/dnf/pacman on Linux). Skip with `SKIP_DEPS=1`.

Custom port:

```bash
PORT=9090 ./serve.sh start
```

Or manually:

```bash
python3 -m http.server 8080
```

## Controls

| Action | Keys |
|--------|------|
| Move | `←` `→` / `A` `D` |
| Jump / Double jump | `Space` / `W` / `↑` |
| Drop through platform | `↓` / `S` (on platform) |
| Aim up / down | `↑` / `↓` while firing |
| Fire | `Z` / `J` / Mouse |
| Special (energy) | `X` / `K` |
| Pause | `P` / `Esc` |

## Gameplay

- **3 lives**, **5 HP**, regenerating **energy** for special shots  
- **Controls**: **J** fire forward · **E** fire ↗ · **X** fire ↘ · **K** switch · **C** special
- **Save / Load**: **F5** save · **F9** load · pause menu · **Continue** on title (localStorage)
- **Arsenal**: Unlock guns by picking them up; they stay for the whole run with ammo
- **Switch**: **K** (cycle), `1`–`9`, `Q`/`E`, or scroll
- **Guns**: Blaster · Rapid · Spread · Shotgun · Laser · Plasma · Bazooka
- **Heavy (anti-tank)**: **Railgun** (pierce armor) · **Tank-Buster** (huge rocket) — bonus damage to bosses/turrets  
- **Pickups**: Health, Energy, Rapid, Spread  
- **Hazards**: lava pits, spikes, enemy bullets  
- **Checkpoints** within each level  

### Levels (difficulty ramp)

| # | Name | Focus |
|---|------|--------|
| 1 | **Rookie Strip** | Easy ground run, few grunts, light APC |
| 2 | **Dockyard** | Gaps + rifle shooters |
| 3 | **Neon Skyline** | Turrets + denser patrols |
| 4 | **Reactor Approach** | Hazards + gun nests |
| 5 | **Sentinel Core** | Final defense grid + Sentinel boss |

No flying enemies. Stairs use wide, gentle steps.

## Project layout

```
neon-strike/
  index.html
  css/style.css
  js/
    main.js       # boot + game loop
    game.js       # gameplay, combat, rendering
    levels.js     # level data (add more here)
    input.js
    audio.js      # Web Audio SFX
    particles.js
    utils.js
```

## Adding a level

Edit `js/levels.js` and append another object to the `LEVELS` array (platforms, enemies, pickups, boss). The game auto-advances until no next level exists, then shows victory.

## Stack

- Vanilla JS (ES modules)
- Canvas 2D
- Web Audio API (procedural SFX)
- Google Fonts: Orbitron + Share Tech Mono
