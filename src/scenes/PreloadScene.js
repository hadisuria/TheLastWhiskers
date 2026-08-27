import Phaser from 'phaser';
import { preloadAudio } from '../AudioManager.js';
import { createTransparentTexture } from '../utils/textures.js';

/**
 * PreloadScene — Phase 4D Loading Screen
 *
 * Runs before JapaneseRoomScene. Loads ALL shared assets (room background,
 * cat sprite, particles, album photos, gallery photos, audio) and displays
 * a warm progress bar consistent with the game's cozy aesthetic.
 *
 * After loading completes, fades out and starts JapaneseRoomScene.
 *
 * Adding new assets: add them in preload() here. No changes needed elsewhere.
 */
export default class PreloadScene extends Phaser.Scene {
	constructor() {
		super({ key: 'PreloadScene' });
	}

	preload() {
		// ---- Progress bar UI ------------------------------------------------
		this._createLoadingUI();

		// Wire Phaser loader events to the progress bar
		this.load.on('progress', (value) => this._updateProgress(value));
		this.load.on('fileprogress', (file) => this._updateFileLabel(file));
		this.load.on('complete', () => this._onLoadComplete());

		// ---- Room backgrounds -----------------------------------------------
		this.load.image('japanese-room', '../assets/room/room.jpeg');
		this.load.image('gallery-room',  '../assets/room/gallery.png');

		// ---- Character ------------------------------------------------------
		this.load.image('cat-raw', '../assets/character/cat.png');

		// ---- Particles ------------------------------------------------------
		this.load.spritesheet('particle', '../assets/particles/particles.png', {
			frameWidth: 16,
			frameHeight: 16,
		});

		// ---- Album photos ---------------------------------------------------
		this.load.image('album-kitten',   '../assets/objects/cat_kitten.png');
		this.load.image('album-milo',     '../assets/objects/cat_milo.png');
		this.load.image('album-sleeping', '../assets/objects/cat_sleeping.png');
		this.load.image('album-luna',     '../assets/objects/cat_luna.png');
		this.load.image('album-window',   '../assets/objects/cat_window.png');
		this.load.image('album-oliver',   '../assets/objects/cat_oliver.png');

		// ---- Gallery photos -------------------------------------------------
		this.load.image('photo-sleeping', '../assets/objects/cat_sleeping.png');
		this.load.image('photo-kitten',   '../assets/objects/cat_kitten.png');
		this.load.image('photo-window',   '../assets/objects/cat_window.png');

		// ---- Audio (graceful: missing files warn and continue) --------------
		preloadAudio(this);

		// Graceful error logging — never crash on a missing asset
		this.load.on('loaderror', (file) => {
			if (file.type !== 'audio') {
				// Audio errors are already handled in preloadAudio
				console.warn(`[PreloadScene] Asset failed to load: ${file.src}`);
			}
		});
	}

	create() {
		// create() fires after complete; transition handled in _onLoadComplete
	}

	// ---------------------------------------------------------------------------
	// Loading UI
	// ---------------------------------------------------------------------------

	_createLoadingUI() {
		const CX = 400;
		const CY = 300;
		const W  = 800;
		const H  = 600;

		// Warm dark background
		this.add.rectangle(CX, CY, W, H, 0x1a0f08);

		// Decorative vignette via gradient rectangle (approx)
		const vignette = this.add.graphics();
		vignette.fillStyle(0x000000, 0.35);
		vignette.fillRect(0, 0, W, H);

		// Paw-print emoji title
		const title = this.add.text(CX, CY - 110, '🐾  The Last Whiskers  🐾', {
			fontSize: '28px',
			fontFamily: '"Georgia", "Playfair Display", serif',
			color: '#F7E9D7',
			stroke: '#2d1a0e',
			strokeThickness: 4,
		}).setOrigin(0.5);

		// Subtle tagline
		this.add.text(CX, CY - 68, 'a quiet room, a warm memory', {
			fontSize: '14px',
			fontFamily: 'monospace',
			color: '#c2a880',
		}).setOrigin(0.5);

		// Progress bar track
		const barW = 400;
		const barH = 16;
		const barX = CX - barW / 2;
		const barY = CY + 30;

		// Track background
		const track = this.add.graphics();
		track.fillStyle(0x3d2515, 1);
		track.fillRoundedRect(barX - 2, barY - 2, barW + 4, barH + 4, barH / 2 + 2);

		// Gold outline
		track.lineStyle(1.5, 0xd4af37, 0.6);
		track.strokeRoundedRect(barX - 2, barY - 2, barW + 4, barH + 4, barH / 2 + 2);

		// Fill bar (drawn as a separate graphics so we can update width each frame)
		this._progressBar = this.add.graphics();
		this._barX = barX;
		this._barY = barY;
		this._barW = barW;
		this._barH = barH;
		this._drawBar(0);

		// Percentage text
		this._percentText = this.add.text(CX, barY + barH + 18, 'Loading… 0%', {
			fontSize: '13px',
			fontFamily: 'monospace',
			color: '#c2a880',
		}).setOrigin(0.5);

		// File name label
		this._fileLabel = this.add.text(CX, barY + barH + 40, '', {
			fontSize: '11px',
			fontFamily: 'monospace',
			color: '#7a6855',
		}).setOrigin(0.5);

		// Decorative divider below bar
		const div = this.add.graphics();
		div.lineStyle(1, 0xd4af37, 0.25);
		div.lineBetween(CX - 200, CY + 90, CX + 200, CY + 90);

		// Small helper text
		this.add.text(CX, CY + 108, 'Arrow Keys / WASD to move  •  E to interact', {
			fontSize: '11px',
			fontFamily: 'monospace',
			color: '#5a4030',
		}).setOrigin(0.5);

		// Animated dots
		this._dotIndex = 0;
		this.time.addEvent({
			delay: 500,
			repeat: -1,
			callback: () => {
				const dots = ['·', '· ·', '· · ·'];
				this._dotIndex = (this._dotIndex + 1) % dots.length;
				if (this._percentText && this._percentText.active) {
					const pct = Math.round((this._lastProgress || 0) * 100);
					this._percentText.setText(`Loading ${dots[this._dotIndex]} ${pct}%`);
				}
			},
		});
	}

	_drawBar(value) {
		if (!this._progressBar || !this._progressBar.active) return;
		this._progressBar.clear();
		const fillW = Math.max(0, Math.floor(this._barW * value));
		if (fillW < 2) return;

		// Warm amber gradient via two overlapping rects (Phaser 3.55 has no native gradient fill)
		this._progressBar.fillStyle(0xd4af37, 1);
		this._progressBar.fillRoundedRect(
			this._barX,
			this._barY,
			fillW,
			this._barH,
			this._barH / 2
		);
		// Lighter highlight strip
		this._progressBar.fillStyle(0xffe082, 0.4);
		this._progressBar.fillRoundedRect(
			this._barX,
			this._barY,
			fillW,
			this._barH / 2,
			{ tl: this._barH / 2, tr: this._barH / 2, bl: 0, br: 0 }
		);
	}

	_updateProgress(value) {
		this._lastProgress = value;
		this._drawBar(value);
		const pct = Math.round(value * 100);
		if (this._percentText && this._percentText.active) {
			this._percentText.setText(`Loading… ${pct}%`);
		}
	}

	_updateFileLabel(file) {
		if (this._fileLabel && this._fileLabel.active) {
			// Show just the filename, not the full path
			const name = (file.key || '').replace('sfx-', '');
			this._fileLabel.setText(name);
		}
	}

	_onLoadComplete() {
		this._drawBar(1);
		if (this._percentText && this._percentText.active) {
			this._percentText.setText('Ready! ✦');
		}
		if (this._fileLabel && this._fileLabel.active) {
			this._fileLabel.setText('');
		}

		createTransparentTexture(this, 'cat', 'cat-raw');

		// Brief pause, then fade to black and start the room
		this.time.delayedCall(600, () => {
			this.cameras.main.fadeOut(500, 0, 0, 0);
			this.cameras.main.once(
				Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
				() => this.scene.start('JapaneseRoomScene')
			);
		});
	}
}
