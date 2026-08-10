# Game Improvement Plan - The Last Whiskers

## Progress Overview

- [x] **Phase 0: Build System & ES Module Setup** (Completed)
- [x] **Phase 1: De-duplicate & Restructure (Japanese Room / "The Last Whiskers")** (Completed)
  - [x] Extract `pointInPolygon(point, polygon)` to `src/utils/geometry.js`
  - [x] Create `src/scenes/BaseRoomScene.js` with shared player movement, boundaries handling, coordinates update, help overlay toggle, splash effect, and walk particle emitter configuration.
  - [x] Parameterize sprite flip direction (`this.flipOnLeft`) per scene.
  - [x] Update `JapaneseRoomScene` & `GalleryScene` to inherit from `BaseRoomScene`.
  - [x] Extract repeated modal lifecycle into `src/ui/Modal.js` (`openModal`).
  - [x] Note on optional step: Skipped `PhotoFrame.js` extraction as layout structures diverge significantly between album pages and gallery ornate frame.
- [x] **Phase 2: Bug Fixes (Japanese Room / "The Last Whiskers")** (Completed)
  - [x] **Flip-Direction Bug**: Visually inspected `assets/character/cat.png`. Standardized both `JapaneseRoomScene` and `GalleryScene` to `flipOnLeft = false` (moving left -> `setFlipX(false)` to face left; moving right -> `setFlipX(true)` to face right).
  - [x] **Chroma-Key Robustness**: Updated `createTransparentTexture()` to sample corner regions, compute mode color with distance clustering, and guarantee canvas texture registration under key `"cat"`.
  - [x] **Item-Behavior Type Field**: Added `type` field (`"display"`, `"gallery-door"`, `"album-trigger"`, `"room-door"`, `"photo-zoom"`) to interactive items and updated `handleItemInteractions()` to branch on `item.type`.
  - [x] **Description-Popup Cleanup**: Replaced per-frame polling in `cleanupMessages()` with `this.time.delayedCall(3000, ...)` inside `showItemDescription()`. Pointer clicks safely remove timer and destroy text early.
  - [x] **Modal Listener Cleanup**: Added safety net listeners in `src/ui/Modal.js` for Phaser scene `SHUTDOWN` and `SLEEP` events.
  - [x] **Phaser Upgrade**: Skipped as instructed; Phaser remains pinned at `3.55.2`.
- [x] **Phase 3: Data-Driven Content (Japanese Room / "The Last Whiskers")** (Completed)
  - [x] **Unified Item Schema**: Unified item schema across both scenes using explicit `type` values (`"display"`, `"gallery-door"`, `"album-trigger"`, `"photo-display"`, `"room-exit"`).
  - [x] **JSON Layout Data Files**: Created [`src/data/rooms/japanese-room.json`](file:///C:/Users/jordy/Documents/1Hadi/Documents/Fun Projects/TheLastWhiskers/src/data/rooms/japanese-room.json) and [`src/data/rooms/gallery.json`](file:///C:/Users/jordy/Documents/1Hadi/Documents/Fun Projects/TheLastWhiskers/src/data/rooms/gallery.json) storing `polygon`, `center`, `playerSpawn`, `boundaryColor`, and `items` with hex string colors (`"0xff0000"`).
  - [x] **Album Data File**: Created [`src/data/album.json`](file:///C:/Users/jordy/Documents/1Hadi/Documents/Fun Projects/TheLastWhiskers/src/data/album.json) holding page pair photo keys, titles, and descriptions.
  - [x] **Native ES Module JSON Imports**: Imported data directly in scene classes without async loader boilerplate.
  - [x] **Scene Integration**: `JapaneseRoomScene` and `GalleryScene` read layout, polygon, spawn points, and interactive items directly from JSON.
  - [x] **JSDoc Typedefs**: Created [`src/types/data.js`](file:///C:/Users/jordy/Documents/1Hadi/Documents/Fun Projects/TheLastWhiskers/src/types/data.js) defining JSDoc schema types for `RoomItem`, `RoomData`, `AlbumPhoto`, `AlbumPage`, and `AlbumData`.
  - [x] **Note on Preload Derivation (Optional Step 6)**: Kept explicit `preload()` image asset calls in scene files to maintain clear loading mechanics and avoid adding path resolution mapping logic.
- [x] **Phase 4: Features & Polish** (Completed)
  - [x] **4A — Touch / Mobile Controls**: Added `src/ui/TouchControls.js` — DOM-based D-pad + interact button that shows only when a touch device is detected. Touch velocity is merged into `BaseRoomScene.handlePlayerMovement()` alongside keyboard velocity; no movement code is duplicated. `isInteractJustPressed()` checks both keyboard E and the touch button. Desktop keyboard behaviour is completely unaffected.
  - [x] **4B — Audio**: Added `src/AudioManager.js` with `SOUND_CONFIG` data object (footstep, interact chime, page-turn, ambient loop). All sound file paths are in config — dropping in real audio files is a data change, not a code change. Missing files fail gracefully with `console.warn`. Added in-memory-only mute toggle button (🔊/🔇) to both scenes. Footstep fires on the same cadence as the splash puff. Ambience fades out on room transitions.
  - [x] **4C — Cat Animation**: Added `createCatAnimations()` and `_updateCatAnimation()` in `BaseRoomScene`. Animation config (`ANIM_CONFIG`) is at the top of the file — swap in a real spritesheet by setting `hasRealSpritesheet: true` and updating frame lists. With the current single-frame `cat.png`, behaviour is visually identical to before (graceful one-frame fallback).
  - [x] **4D — Loading Screen**: Added `src/scenes/PreloadScene.js` — warm progress bar with amber/gold aesthetic consistent with the game's cozy tone. Loads all shared assets (rooms, cat, particles, photos, audio). Progress bar tracks correctly; transitions to `JapaneseRoomScene` after a brief pause post-load. `PreloadScene` is now the first scene in `main.js`.
- [x] **Phase 6: Documentation & Wrap-Up** (Completed)
  - [x] Audit actual project status (Vite scripts, active Phase 4 features: 4A touch controls, 4B audio mute, 4C cat animations, 4D loading screen, no visited tracking).
  - [x] Rewrite `README.md` to reflect npm/Vite flow and correct relative paths.
  - [x] Update `index.html` sidebar with touch control details, audio mute details, and synchronized items list.
  - [x] Resolve three-way items list duplication by adding cross-reference comments across `README.md`, `index.html`, and `japanese-room.json`.
  - [x] Perform manual verification of interactive items, album, gallery, touch emulation, audio, and production build preview.
  - [x] Synchronize `GAME_IMPROVEMENT_PLAN.md`.
- [x] **Phase 5: Automated Testing, Linting & CI** (Skipped by Decision)
  - *Note: Automated testing, linting configurations (ESLint/Prettier), and continuous integration (CI) workflows were intentionally skipped for the current scope of this project.*

---

## 🛠️ Running the Project

Check the main [README.md](README.md) for full instructions. In short:
1. **Install dependencies**: `npm install`
2. **Development mode**: `npm run dev`
3. **Production build**: `npm run build && npm run preview`
