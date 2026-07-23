# 🐾 The Last Whiskers

A cozy interactive memorial space built with Phaser 3. Explore a traditional Japanese room and a Memorial Gallery dedicated to beloved kitties.

## 📸 Demo Preview

You can see the visual assets and screenshot in the [docs](file:///c:/Users/jordy/Documents/1Hadi/Documents/Fun%20Projects/TheLastWhiskers/docs/image.png) directory.

---

## 🚀 How to Run Locally

Since this is a static client-side web application, browser security policies (CORS) prevent loading local assets (like images and spritesheets) directly from a local file path (`file://`). You **must** run a local web server from the project root directory.

Here are the easiest ways to start the server:

### Option 1: Python (Recommended & Built-in)

If you have Python installed, you can start the built-in HTTP server:

1. Open a terminal/command prompt at the project root directory:
   `c:\Users\jordy\Documents\1Hadi\Documents\Fun Projects\TheLastWhiskers`
2. Run the server command:
   ```bash
   python -m http.server 8000
   ```
3. Open your browser and navigate to:
   [http://localhost:8000/](http://localhost:8000/) (if you have the root `index.html`) or directly to the game:
   [http://localhost:8000/japan-room/japan-room.html](http://localhost:8000/japan-room/japan-room.html)

---

### Option 2: Node.js (npx)

If you have Node.js installed, you can use the `http-server` package via `npx` without installing it globally:

1. Open your terminal at the project root directory.
2. Run the server command:
   ```bash
   npx http-server -p 8000
   ```
3. Open your browser and navigate to:
   [http://localhost:8000/japan-room/japan-room.html](http://localhost:8000/japan-room/japan-room.html)

---

### Option 3: VS Code Live Server Extension

If you use VS Code:

1. Install the **Live Server** extension by Ritwick Dey.
2. Right-click on [japan-room.html](file:///c:/Users/jordy/Documents/1Hadi/Documents/Fun%20Projects/TheLastWhiskers/japan-room/japan-room.html) in the file explorer.
3. Click **"Open with Live Server"**.

---

## 🎮 Game Controls

- **Move**: Use `WASD` keys or `Arrow Keys` to move the cute kitty around the room.
- **Interact**: Press `E` when standing close to interactive items to inspect them and read their stories.
- **Help Overlays**: Press `H` to toggle debug outlines and see where the physical room boundaries and interactive items are located.

---

## 🗺️ Interactive Elements

Explore these objects in the Japanese room by moving close to them and pressing `E`:
* **Kotatsu**: A traditional Japanese heated table with a warm blanket.
* **Teapot**: A ceramic teapot with freshly brewed green tea.
* **Bookshelf**: A wooden bookshelf filled with scrolls, books, and mementos.
* **Bonsai**: A miniature tree representing harmony.
* **Cabinet**: A wooden cabinet containing traditional tea ceremony utensils.
* **Sliding Door**: Traditional shoji doors. Stand near them and press `E` to enter the **Memorial Gallery Room**.

---

## 📁 Project Structure

* [japan-room/](file:///c:/Users/jordy/Documents/1Hadi/Documents/Fun%20Projects/TheLastWhiskers/japan-room) - Contains the entrypoint [japan-room.html](file:///c:/Users/jordy/Documents/1Hadi/Documents/Fun%20Projects/TheLastWhiskers/japan-room/japan-room.html) and game engine logic [japan-room.js](file:///c:/Users/jordy/Documents/1Hadi/Documents/Fun%20Projects/TheLastWhiskers/japan-room/japan-room.js).
* [assets/](file:///c:/Users/jordy/Documents/1Hadi/Documents/Fun%20Projects/TheLastWhiskers/assets) - Contains room backgrounds, player sprites, and particle effects.
* [docs/](file:///c:/Users/jordy/Documents/1Hadi/Documents/Fun%20Projects/TheLastWhiskers/docs) - Preview screenshots and developer notes.
* [_supporting files/](file:///c:/Users/jordy/Documents/1Hadi/Documents/Fun%20Projects/TheLastWhiskers/_supporting%20files) - Palettes, pixel guides, and raw artwork references.
