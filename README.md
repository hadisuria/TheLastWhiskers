# 🐾 The Last Whiskers

A cozy interactive memorial space built with Phaser 3 and Vite. Explore a traditional Japanese room and a Memorial Gallery dedicated to beloved kitties.

## 📸 Demo Preview

You can see the visual assets and screenshot in the [docs/image.png](docs/image.png) directory.

---

## 🚀 How to Run Locally

### Prerequisites
* **Node.js**: Recommended version 18 or higher (tested and built with Node 18+).

### 1. Install Dependencies
Ensure Node.js is installed, then install project dependencies:
```bash
npm install
```

### 2. Run in Development Mode
Start the Vite local development server:
```bash
npm run dev
```
Open your browser and navigate to the address shown in your terminal (typically `http://localhost:5173/`).

### 3. Build & Preview Production
To build the static bundle for production and preview it locally:
```bash
# Build the production bundle
npm run build

# Preview the build output locally
npm run preview
```

---

## 🎮 Game Controls

| Control | Action | Keyboard / Mouse | Touch Devices (4A) |
|---|---|---|---|
| **Move** | Walk around the room | `WASD` or `Arrow Keys` | On-screen D-pad (automatic detection) |
| **Interact** | Inspect items, flip pages, zoom photos, or use doors | `E` or Click/Tap target | On-screen `E` button |
| **Help Overlays** | Toggle physical boundary outlines | `H` | *N/A (Keyboard-only)* |
| **Toggle Mute** | Mute/unmute game audio (4B) | Click audio button (🔊/🔇) | Tap audio button (🔊/🔇) |

---

## 🗺️ Interactive Elements

Explore these objects in the Japanese room (defined as the source of truth in [src/data/rooms/japanese-room.json](src/data/rooms/japanese-room.json) and summarized in index.html):
* **Kotatsu**: A traditional Japanese heated table with a warm blanket.
* **Teapot**: A ceramic teapot with freshly brewed green tea.
* **Bookshelf**: A wooden bookshelf filled with scrolls, books, and mementos (opens the photo album).
* **Bonsai**: A miniature tree representing harmony with nature.
* **Cabinet**: A wooden cabinet containing traditional tea ceremony utensils.
* **Sliding Door**: Traditional shoji doors. Stand near them and press `E` to enter the **Memorial Gallery Room**.
* **Lantern**: A paper lantern casting a warm, gentle light.
* **Plant**: A small potted plant adding a touch of green.

---

## 📁 Project Structure

* [src/main.js](src/main.js) - Primary game engine bootstrap config and Phaser scene definitions.
* [src/scenes/](src/scenes/) - Phaser scenes (`PreloadScene`, `BaseRoomScene`, `JapaneseRoomScene`, `GalleryScene`).
* [src/data/](src/data/) - Unified JSON layout and data files (`rooms/japanese-room.json`, `rooms/gallery.json`, `album.json`).
* [src/ui/](src/ui/) - Custom UI controllers, modals, and mobile touch pads (`Modal.js`, `TouchControls.js`).
* [src/utils/](src/utils/) - Shared utility functions (`geometry.js`, `textures.js`).
* [src/AudioManager.js](src/AudioManager.js) - Sound loading, playback, rate-limiting, and mute state.
* [japan-room/japan-room.html](japan-room/japan-room.html) - Dedicated Phaser canvas container loaded inside the parent landing page.
* [index.html](index.html) - Main dashboard landing page with CSS styling, instructions, and iframe wrapper.
* [assets/](assets/) - Room backgrounds, spritesheets, photos, and audio files.
* [docs/](docs/) - Preview screenshots.

---

## 📝 Status Note
Automated testing, linting configurations, and continuous integration (CI) workflows were intentionally omitted from the current project scope by decision. Manual validation is used to test features.
