import Phaser from "phaser";
import PreloadScene from "./scenes/PreloadScene.js";
import JapaneseRoomScene from "./scenes/JapaneseRoomScene.js";
import GalleryScene from "./scenes/GalleryScene.js";

// Game configuration
const config = {
	type: Phaser.AUTO,
	width: 800,
	height: 600,
	backgroundColor: "#16100c",
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH,
	},
	// Phase 4D: PreloadScene runs first, shows progress bar, then starts JapaneseRoomScene
	scene: [PreloadScene, JapaneseRoomScene, GalleryScene],
	physics: {
		default: "arcade",
		arcade: {
			debug: false,
		},
	},
};

// Game instance
const game = new Phaser.Game(config);

if (import.meta.env.DEV) {
	window.game = game;
	window.__debug = window.__debug || {};
	window.__debug.game = game;
}
