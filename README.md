# Jungle Run — The Lost River

A browser-based 3D endless runner built with **HTML, CSS and JavaScript** (Three.js + Vite).
It uses the original `jungleBoy.glb` character and its baked **Run** animation. No AR, camera
permission, backend or external asset CDN is required at runtime.

## Play locally

```bash
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

```bash
npm test        # game-logic unit tests
npm run build   # production files in dist/
npm run preview # serve the production build locally
```

## Controls

| Action | Keyboard | Phone / tablet |
| --- | --- | --- |
| Switch lane | `←` / `→` or `A` / `D` | Swipe left / right, or use the on-screen buttons |
| Jump | `↑`, `W` or `Space` | Swipe up, tap the trail, or use the JUMP button |
| Pause / resume | `P` or `Esc` | Pause button |

- **Coins:** +25 points each. Distance also adds points.
- **Fallen logs & rocks:** jump over them.
- **Tall ruins:** too high to jump — switch to a clear lane.
- The run speeds up gradually. Your best score and sound preference are saved in this browser.
- The game automatically pauses when the tab loses focus.

## Deploy

Upload the contents of `dist/` to any static host (GitHub Pages, Netlify, Cloudflare Pages,
Vercel, etc.). The build uses relative asset URLs, so it also works from a repository subpath.
Serve over HTTPS in production. The original 15 MB GLB is included in the build; keep it with
the rest of `dist/`.

## Project layout

```text
index.html              Start UI, HUD, pause/results/help dialogs
src/style.css           Responsive game UI
src/main.js             UI state, loop, score, persistence
src/game/engine.js      Pure runner simulation (lanes, jump, coins, collisions)
src/game/world.js       Three.js jungle, river, rafts, character, camera, particles
src/game/input.js       Keyboard, swipe and touch-button input
src/game/audio.js       Lightweight WebAudio sound effects
src/game/storage.js     Safe localStorage preferences
tests/engine.test.js    Node unit tests
jungleBoy.glb           Original character model + animations (used)
jungleBoy.jpg/.mind     Original AR assets (kept untouched, not used by this game)
```
