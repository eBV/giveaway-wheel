# Giveaway Wheel

A live, customizable giveaway wheel built for Twitch streamers. No backend, no dependencies — single HTML file, runs entirely in the browser.

![Purple giveaway wheel](https://img.shields.io/badge/built%20with-Web%20Audio%20API%20%2B%20Canvas-a855f7?style=flat-square)

## Features

- **Twitch chat integration** — viewers type `!enter` and their name auto-populates on the wheel
- **Chatter name colors** — segments use each viewer's Twitch name color automatically
- **Custom colors via chat** — `!enter red`, `!enter blue`, `!enter #ff69b4`, etc.
- **6 spin soundtracks** — Classic, Afro Rock, Trap/Hip-Hop, Afrobeats Pop, Mariachi Salsa, Retro 8-bit (all synthesized via Web Audio API — no audio files)
- **Sound previews** — ▶ button next to each theme plays a snippet before you commit
- **Dramatic zoom animation** — zooms into the pointer at the end of every spin
- **Big winner celebration** — full-screen overlay with confetti, crown, and glowing name
- **Spin duration control** — Short / Medium / Long
- **Remove winner after spin** toggle
- **Hide/show controls** — clean OBS browser source with one click
- **Duplicate prevention** — chatters can only enter once (but can update their color)
- **Persists entries** — localStorage keeps the list across refreshes

## Usage

### As a browser source in OBS / Streamlabs
1. Open the deployed URL (or `index.html` locally)
2. Enter your Twitch channel name and click **Connect**
3. Click **Hide Controls** to hide the sidebar for a clean overlay
4. Add as a Browser Source in OBS at your preferred size

### Chat commands
| Command | Effect |
|---|---|
| `!enter` | Enter with your Twitch name color |
| `!enter blue` | Enter with a named color |
| `!enter #ff69b4` | Enter with a hex color |
| `!enter red` | (if already entered) updates your color |

### Supported color names
`red` `blue` `green` `yellow` `orange` `pink` `purple` `cyan` `lime` `teal` `gold` `coral` `salmon` `violet` `magenta` `indigo` `crimson` `turquoise` `lavender` `mint` `maroon` `navy` `olive` `hotpink` `skyblue` `tomato` `plum` `white`

### Nightbot tip
Add a Nightbot command `!enter` with response:
```
You've been entered into the giveaway! 🎉
```
This gives chat feedback while the wheel page handles the actual entry.

## Tech

- Pure HTML / CSS / JavaScript — zero dependencies, zero build step
- HTML5 Canvas for wheel rendering (2520×2520 buffer for crisp zoom)
- Web Audio API for all sound synthesis
- Twitch IRC over WebSocket (anonymous read-only — no OAuth needed)

## Local use

Just open `index.html` in any modern browser. No server needed.
