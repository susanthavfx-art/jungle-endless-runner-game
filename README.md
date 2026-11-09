# Jungle Run — The Lost River

A browser-based 3D endless runner built with **HTML, CSS and JavaScript** (Three.js + Vite).
It uses the original `jungleBoy.glb` character and its baked **Run** animation, plus the
supplied `forest_pack.glb` and `stylized_rock.glb` environment models. The trail crosses an
abandoned rope bridge, a ruined stone arch bridge and ancient temple ruins beside a
crocodile-filled river. No AR, camera permission, backend or external asset CDN is required
at runtime.

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
- **Tall ruins / moai statues:** too high to jump — switch to a clear lane.
- **Broken bridge gaps:** missing planks or stone spans drop Kai into the river. Jump the gap
  early or move to an intact lane. Falling ends the run.
- **Crocodiles:** river crocs snap at the bridge. A bite ends the run — jump over them or
  change lanes.
- Every hazard row leaves at least one safe lane, with coins guiding the way.
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
src/game/engine.js      Pure runner simulation (lanes, jump, coins, gaps, crocs, collisions)
src/game/world.js       Three.js jungle, river, bridges, character, camera, particles
src/game/scenery.js     Bridge/temple/crocodile builders + imported GLB vegetation batching
src/game/input.js       Keyboard, swipe and touch-button input
src/game/audio.js       Lightweight WebAudio sound effects
src/game/storage.js     Safe localStorage preferences
tests/engine.test.js    Node unit tests
jungleBoy.glb           Original character model + animations (used)
assets/forest_pack.glb  Imported low-poly forest vegetation (used)
assets/stylized_rock.glb Imported stylized rocks (used)
jungleBoy.jpg/.mind     Original AR assets (kept untouched, not used by this game)
```

## Asset credits

The environment packs are used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
They are scaled, re-lit and batched into the game world; credits are also shown in the
in-game **How to play** dialog.

- **Low poly forest pack** by [Ragat Vdoo Kaf](https://sketchfab.com/mae_bul_01) —
  [source](https://sketchfab.com/3d-models/low-poly-forest-pack-low-poly-environment-pack-47b2cb567d1b437fb86d2897353079ab)
- **Stylized Rock Pack** by [hodaart](https://sketchfab.com/hodaart) —
  [source](https://sketchfab.com/3d-models/stylized-rock-pack-low-poly-game-ready-boulders-a45607a00e104a859a039e0e8a6974f8)
