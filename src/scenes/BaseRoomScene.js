import Phaser from "phaser";
import { pointInPolygon } from "../utils/geometry.js";
import TouchControls from "../ui/TouchControls.js";
import AudioManager from "../AudioManager.js";

/**
 * BaseRoomScene — shared base for JapaneseRoomScene and GalleryScene.
 *
 * Phase 4 additions:
 *  - 4A: Touch controls via TouchControls.js; touchVelocity merged here in
 *         handlePlayerMovement() — no movement code duplicated.
 *  - 4B: AudioManager instance created here so subclasses can call
 *         this.audio.playFootstep() etc.  Subclasses call startAmbience()
 *         in their own create() after calling super setup.
 *  - 4C: Cat animation plumbing (anims.create for idle/walk).  Works as a
 *         graceful one-frame fallback when only cat.png is present.  When a
 *         real spritesheet is dropped in, only ANIM_CONFIG needs updating.
 */

// ---------------------------------------------------------------------------
// 4C — Animation config
// Changing these values (or providing a real spritesheet) requires NO other
// code changes — the animation system reads everything from here.
// ---------------------------------------------------------------------------
const ANIM_CONFIG = {
	/**
	 * Set to true once a real multi-frame walk-cycle spritesheet is provided.
	 * When false, both idle and walk play a single frame (= current behaviour).
	 */
	hasRealSpritesheet: false,

	idle: {
		key: 'cat-idle',
		frames: [0],       // single frame fallback; replace with [0,1] etc.
		frameRate: 4,
		repeat: -1,
	},
	walk: {
		key: 'cat-walk',
		frames: [0],       // single frame fallback; replace with [0,1,2,3] etc.
		frameRate: 8,
		repeat: -1,
	},
};

export default class BaseRoomScene extends Phaser.Scene {
	constructor(config) {
		super(config);
		this.roomPolygon = [];
		this.roomCenter = { x: 400, y: 370 };

		// FLIP DIRECTION STANDARDIZATION:
		// Cat sprite (cat.png) naturally faces LEFT (un-flipped / flipX = false).
		// Moving left (vx < 0) -> setFlipX(false) -> sprite faces left.
		// Moving right (vx > 0) -> setFlipX(true) -> sprite faces right.
		this.flipOnLeft = false;

		/** @type {TouchControls|null} Initialised in setupPlayer() */
		this.touchControls = null;

		/** @type {AudioManager|null} Initialised in initAudio() */
		this.audio = null;
	}

	// ---------------------------------------------------------------------------
	// 4B — Audio initialisation (called by subclass create() after preload done)
	// ---------------------------------------------------------------------------

	/**
	 * Creates the AudioManager and (optionally) starts ambience.
	 * Subclasses call this inside create() after scene setup.
	 * @param {boolean} [startAmbience=true]
	 */
	initAudio(startAmbience = true) {
		this.audio = new AudioManager(this);
		if (startAmbience) {
			this.audio.startAmbience();
			this.audio.startBirds();
		}
	}

	// ---------------------------------------------------------------------------
	// 4C — Animation creation
	// Call once after the 'cat' texture is registered (after createTransparentTexture)
	// ---------------------------------------------------------------------------

	/**
	 * Registers idle and walk animations on the 'cat' texture.
	 * Works correctly with a single-frame texture (no visual regression).
	 */
	createCatAnimations() {
		const cfg = ANIM_CONFIG;

		// generateFrameNumbers requires the texture to have been loaded as a
		// spritesheet. With the current single cat.png (loaded as a canvas
		// texture via createTransparentTexture), we build frames manually using
		// frame index 0.  When a real spritesheet is provided (hasRealSpritesheet
		// = true), generateFrameNumbers works normally.
		const makeFrames = (frameIndices) => {
			if (cfg.hasRealSpritesheet) {
				return this.anims.generateFrameNumbers('cat', { frames: frameIndices });
			}
			// Single-frame fallback: one frame object per entry (deduped to just one)
			return [{ key: 'cat', frame: 0 }];
		};

		try {
			this.anims.create({
				key: cfg.idle.key,
				frames: makeFrames(cfg.idle.frames),
				frameRate: cfg.idle.frameRate,
				repeat: cfg.idle.repeat,
			});

			this.anims.create({
				key: cfg.walk.key,
				frames: makeFrames(cfg.walk.frames),
				frameRate: cfg.walk.frameRate,
				repeat: cfg.walk.repeat,
			});
		} catch (e) {
			console.warn('[BaseRoomScene] Could not create cat animations:', e.message);
		}
	}

	/**
	 * Transitions the player sprite between idle and walk animations based on
	 * current velocity. Safe to call every frame — Phaser ignores play() calls
	 * for the already-playing animation.
	 * @param {number} vx
	 * @param {number} vy
	 */
	_updateCatAnimation(vx, vy) {
		if (!this.player || !this.player.anims) return;
		const isMoving = vx !== 0 || vy !== 0;
		const targetAnim = isMoving ? ANIM_CONFIG.walk.key : ANIM_CONFIG.idle.key;

		// Check if animation exists in cache before playing, or fallback to texture
		if (!this.anims.exists(targetAnim)) {
			// Fallback: If animations are somehow missing/unregistered, use static frame 0 (if texture exists)
			if (this.player.texture) {
				this.player.setFrame(0);
			}
			return;
		}

		// Ensure the sprite's animation controller is bound to the texture data correctly
		if (!this.player.anims.isPlaying || this.player.anims.currentAnim?.key !== targetAnim) {
			try {
				if (this.player.texture) {
					this.player.play(targetAnim, true);
				}
			} catch (e) {
				console.warn('[BaseRoomScene] Failed to play animation:', e.message);
				if (this.player.texture) {
					this.player.setFrame(0);
				}
			}
		}
	}

	// ---------------------------------------------------------------------------
	// 4A — Movement: keyboard + touch velocity merged here
	// ---------------------------------------------------------------------------

	handlePlayerMovement() {
		const playerBody = this.player.body;
		playerBody.setVelocity(0);

		const speed = 150;
		let vx = 0;
		let vy = 0;

		// --- Keyboard input --------------------------------------------------
		if (this.cursors.left.isDown || this.wasd.left.isDown) {
			vx = -speed;
		} else if (this.cursors.right.isDown || this.wasd.right.isDown) {
			vx = speed;
		}

		if (this.cursors.up.isDown || this.wasd.up.isDown) {
			vy = -speed;
		} else if (this.cursors.down.isDown || this.wasd.down.isDown) {
			vy = speed;
		}

		// Normalize diagonal (keyboard)
		if (vx !== 0 && vy !== 0) {
			vx *= 0.7071;
			vy *= 0.7071;
		}

		// --- Touch D-pad input (4A) ------------------------------------------
		if (this.touchControls) {
			this.touchControls.update();
			const tv = this.touchControls.touchVelocity;
			// Merge: touch overrides keyboard on the axes it supplies
			if (tv.x !== 0 || tv.y !== 0) {
				vx = tv.x;
				vy = tv.y;
				this.moveTarget = null; // Manual D-pad cancels tap destination
			}
		}

		if (vx !== 0 || vy !== 0) {
			this.moveTarget = null; // Manual keyboard cancels tap destination
		} else if (this.moveTarget) {
			// Tap-to-move destination navigation
			const dx = this.moveTarget.x - this.player.x;
			const dy = this.moveTarget.y - this.player.y;
			const dist = Math.sqrt(dx * dx + dy * dy);

			if (dist < 10) {
				this.moveTarget = null;
				if (this.pendingItemInteraction) {
					this.tapInteractRequested = true;
					this.pendingItemInteraction = null;
				}
			} else {
				vx = (dx / dist) * speed;
				vy = (dy / dist) * speed;
			}
		}

		playerBody.setVelocity(vx, vy);

		// --- Sprite flip -----------------------------------------------------
		if (vx < 0) {
			this.player.setFlipX(this.flipOnLeft);
		} else if (vx > 0) {
			this.player.setFlipX(!this.flipOnLeft);
		}

		// --- 4C: Animation state machine ------------------------------------
		this._updateCatAnimation(vx, vy);

		// --- Visual splash puff (unchanged cadence) --------------------------
		if (vx !== 0 || vy !== 0) {
			const now = this.time.now;
			if (now > (this.lastSplashTime || 0) + 150) {
				this.createPlayerSplashEffect();
				this.lastSplashTime = now;
			}
		}

		// --- 4B: Footstep sound — independent timer, fires on first frame ----
		// _footstepTime is reset to 0 when the player stops so the NEXT
		// movement always gets an immediate first step.
		const isMoving = vx !== 0 || vy !== 0;
		if (isMoving) {
			const now = this.time.now;
			const minInterval = 180; // ms — should match SOUND_CONFIG.footstep.minInterval
			if (now > (this._footstepTime || 0) + minInterval) {
				if (this.audio) this.audio.playFootstep();
				this._footstepTime = now;
			}
		} else {
			// Reset so next movement starts a step immediately
			this._footstepTime = 0;
		}
	}

	handlePlayerBoundaries(delta) {
		const prevX = this.player.x;
		const prevY = this.player.y;

		const dt = delta / 1000;
		const nextX = this.player.x + this.player.body.velocity.x * dt;
		const nextY = this.player.y + this.player.body.velocity.y * dt;
		const nextPosition = { x: nextX, y: nextY };

		if (pointInPolygon(nextPosition, this.roomPolygon)) {
			return;
		}

		const currentPosition = { x: prevX, y: prevY };
		const isCurrentlyInside = pointInPolygon(currentPosition, this.roomPolygon);

		if (!isCurrentlyInside) {
			const distPrev = Phaser.Math.Distance.Between(prevX, prevY, this.roomCenter.x, this.roomCenter.y);
			const distNext = Phaser.Math.Distance.Between(nextX, nextY, this.roomCenter.x, this.roomCenter.y);
			if (distNext < distPrev) {
				return;
			}
		}

		const testX = { x: nextX, y: prevY };
		if (!pointInPolygon(testX, this.roomPolygon)) {
			this.player.x = prevX;
			this.player.body.setVelocityX(0);
			if (this.moveTarget) this.moveTarget = null;
		}

		const testY = { x: prevX, y: nextY };
		if (!pointInPolygon(testY, this.roomPolygon)) {
			this.player.y = prevY;
			this.player.body.setVelocityY(0);
			if (this.moveTarget) this.moveTarget = null;
		}
	}

	updateCoordinatesDisplay() {
		this.coordText.setText(
			`Player: x=${Math.round(this.player.x)}, y=${Math.round(this.player.y)}`,
		);
	}

	toggleHelpOverlays() {
		this.interactableItems.forEach((item) => {
			if (this.showHelpOverlays) {
				item.setAlpha(item === this.activeItem ? 0.4 : 0.2);
				if (item.label) item.label.setVisible(true);
			} else {
				item.setAlpha(0);
				if (item.label) item.label.setVisible(false);
			}
		});

		this.boundaries.getChildren().forEach((wall) => {
			wall.setAlpha(this.showHelpOverlays ? 0.3 : 0);
		});
	}

	createPlayerSplashEffect() {
		if (this.walkEmitter) {
			this.walkEmitter.explode(2, this.player.x, this.player.y + 10);
		}
	}

	createParticleEffects() {
		this.particleManager = this.add.particles("particle");

		this.walkEmitter = this.particleManager.createEmitter({
			speed: { min: 10, max: 30 },
			angle: { min: 0, max: 360 },
			scale: { start: 0.15, end: 0.05 },
			alpha: { start: 0.5, end: 0 },
			lifespan: 300,
			tint: 0xeeddbb,
			frequency: -1, // Emit manually
		});
	}

	// ---------------------------------------------------------------------------
	// 4A — Touch interact detection (used by subclass handleItemInteractions)
	// ---------------------------------------------------------------------------

	/**
	 * Returns true if the E key was just pressed OR the touch interact button
	 * was tapped OR a tap-to-move destination near an item was reached.
	 * @returns {boolean}
	 */
	isInteractJustPressed() {
		const keyboard = Phaser.Input.Keyboard.JustDown(this.interactKey);
		const touch = this.touchControls ? this.touchControls.consumeInteract() : false;
		const tap = this.tapInteractRequested;
		this.tapInteractRequested = false;
		return keyboard || touch || tap;
	}

	// ---------------------------------------------------------------------------
	// 4A — Touch controls setup (call from subclass setupPlayer())
	// ---------------------------------------------------------------------------

	/**
	 * Creates the TouchControls instance and attaches it to this scene.
	 * Also sets up tap-to-move canvas pointer listener.
	 */
	setupTouchControls() {
		this.touchControls = new TouchControls(this, 150);

		// Pointer listener for tap-to-move on mobile/touch & desktop click
		this.input.on('pointerdown', (pointer) => {
			if (this.isAlbumOpen || this.isZoomed) return;

			// Don't set move target if tapping top-right mute button
			if (this._muteButton && this._muteButton.getBounds().contains(pointer.x, pointer.y)) {
				return;
			}

			// Check if tapping on or near an interactable item
			let tappedItem = null;
			if (this.interactableItems) {
				for (const item of this.interactableItems) {
					const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, item.x, item.y);
					if (dist < 45 || (pointer.x >= item.x - item.width/2 && pointer.x <= item.x + item.width/2 &&
					                  pointer.y >= item.y - item.height/2 && pointer.y <= item.y + item.height/2)) {
						tappedItem = item;
						break;
					}
				}
			}

			if (tappedItem) {
				const currentDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, tappedItem.x, tappedItem.y);
				if (currentDist < 80) {
					this.tapInteractRequested = true;
					this.moveTarget = null;
				} else {
					this.moveTarget = { x: tappedItem.x, y: tappedItem.y };
					this.pendingItemInteraction = tappedItem;
				}
			} else {
				this.moveTarget = { x: pointer.x, y: pointer.y };
				this.pendingItemInteraction = null;
			}
		});
	}

	// ---------------------------------------------------------------------------
	// Shared Scene Setup Methods
	// ---------------------------------------------------------------------------

	/**
	 * Creates invisible boundary walls along roomPolygon for visual debug display.
	 */
	createBoundaries() {
		this.boundaries = this.add.group();
		if (!this.roomPolygon || this.roomPolygon.length === 0) return;

		const len = this.roomPolygon.length;
		for (let i = 0; i < len; i++) {
			const [x1, y1] = this.roomPolygon[i];
			const [x2, y2] = this.roomPolygon[(i + 1) % len];

			const centerX = (x1 + x2) / 2;
			const centerY = (y1 + y2) / 2;
			const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
			const angle = Math.atan2(y2 - y1, x2 - x1);

			const wall = this.add.rectangle(centerX, centerY, length, 10);
			wall.setRotation(angle);
			wall.setFillStyle(this.boundaryColor || 0xff0000, 0.3);
			wall.setAlpha(0);

			this.boundaries.add(wall);
		}
	}

	/**
	 * Creates interactive physics rectangles and hidden text labels from roomItemsData.
	 */
	createInteractiveAreas() {
		this.interactableItems = [];
		if (!this.roomItemsData) return;

		this.roomItemsData.forEach((item) => {
			const colorNum = Number(item.color);
			const graphics = this.add.rectangle(
				item.x,
				item.y,
				item.width,
				item.height,
				colorNum,
				0.5,
			);
			graphics.setAlpha(0);

			this.physics.add.existing(graphics, true);

			graphics.name = item.name;
			graphics.type = item.type || "display";
			graphics.description = item.description;
			graphics.color = colorNum;
			if (item.photoKey) graphics.photoKey = item.photoKey;
			if (item.type === "room-exit") graphics.isExit = true;

			const label = this.add
				.text(item.x, item.y, item.name, {
					fontSize: "12px",
					fontFamily: "Arial",
					color: "#FFFFFF",
					backgroundColor: "#000000",
					padding: { x: 3, y: 3 },
				})
				.setOrigin(0.5)
				.setVisible(false);

			graphics.label = label;
			this.interactableItems.push(graphics);
		});
	}

	/**
	 * Spawns player sprite, configures physics body, inputs, and touch controls.
	 */
	setupPlayer() {
		const [spawnX, spawnY] = this.playerSpawn || [400, 300];
		this.player = this.physics.add.sprite(spawnX, spawnY, "cat");
		this.player.setDisplaySize(40, 40);
		this.player.body.setSize(30, 30);
		this.player.body.setCollideWorldBounds(true);

		if (this.interactableItems) {
			this.physics.add.collider(this.player, this.interactableItems);
		}

		this.cursors = this.input.keyboard.createCursorKeys();
		this.wasd = this.input.keyboard.addKeys({
			up: Phaser.Input.Keyboard.KeyCodes.W,
			down: Phaser.Input.Keyboard.KeyCodes.S,
			left: Phaser.Input.Keyboard.KeyCodes.A,
			right: Phaser.Input.Keyboard.KeyCodes.D,
		});
		this.interactKey = this.input.keyboard.addKey("E");
		this.helpKey = this.input.keyboard.addKey("H");

		this.setupTouchControls();
	}

	/**
	 * Configures standard room HUD elements (interaction prompt, top banner, coordinates, mute button).
	 * @param {string} bannerText
	 */
	setupUI(bannerText = "") {
		this.interactText = this.add
			.text(400, 530, "", {
				fontSize: "16px",
				fontFamily: "monospace",
				fill: "#F7E9D7",
				backgroundColor: "#4A3C31",
				padding: { x: 10, y: 5 },
				stroke: "#000000",
				strokeThickness: 2,
			})
			.setOrigin(0.5)
			.setDepth(150);
		this.interactText.setVisible(false);

		if (bannerText) {
			this.add
				.text(400, 45, bannerText, {
					fontSize: "15px",
					fontFamily: "monospace",
					fill: "#F7E9D7",
					backgroundColor: "#4A3C31",
					padding: { x: 10, y: 5 },
					stroke: "#000000",
					strokeThickness: 2,
				})
				.setOrigin(0.5)
				.setDepth(150);
		}

		this.coordText = this.add
			.text(10, 10, "Player: x=0, y=0", {
				fontSize: "14px",
				fontFamily: "Arial",
				fill: "#FFFFFF",
				backgroundColor: "#000000",
				padding: { x: 5, y: 2 },
			})
			.setDepth(150);

		this.createMuteButton();
		this.cameras.main.fadeIn(800, 0, 0, 0);
	}

	// ---------------------------------------------------------------------------
	// 4B — Mute toggle UI button
	// Creates a small on-screen 🔊/🔇 button rendered in the Phaser canvas.
	// ---------------------------------------------------------------------------

	/**
	 * Adds a mute/unmute toggle button to the top-right corner of the scene.
	 * Call from subclass setupUI() after initAudio().
	 */
	createMuteButton() {
		const btn = this.add
			.text(785, 12, '🔊', {
				fontSize: '22px',
				fontFamily: 'monospace',
				backgroundColor: '#2d1a0e',
				padding: { x: 10, y: 6 },
			})
			.setOrigin(1, 0)
			.setDepth(300)
			.setInteractive({ useHandCursor: true })
			.on('pointerdown', (pointer, localX, localY, event) => {
				if (event && event.stopPropagation) event.stopPropagation();
				if (!this.audio) return;
				const muted = this.audio.toggleMute();
				btn.setText(muted ? '🔇' : '🔊');
			})
			.on('pointerover', () => btn.setAlpha(0.8))
			.on('pointerout', () => btn.setAlpha(1));

		this._muteButton = btn;
	}
}
