import Phaser from "phaser";
import { pointInPolygon, constrainToPolygonWithSlide } from "../utils/geometry.js";
import TouchControls from "../ui/TouchControls.js";
import AudioManager from "../AudioManager.js";
import Player from "../entities/Player.js";
import { CONFIG } from "../config.js";

/**
 * BaseRoomScene — shared base for JapaneseRoomScene and GalleryScene.
 * Provides unified Player instantiation, boundary collision, touch controls,
 * audio initialization, and bottom HUD interaction prompts.
 */
export default class BaseRoomScene extends Phaser.Scene {
	constructor(config) {
		super(config);
		this.roomPolygon = [];
		this.roomCenter = { x: 400, y: 370 };

		/** @type {Player|null} */
		this.player = null;

		/** @type {TouchControls|null} */
		this.touchControls = null;

		/** @type {AudioManager|null} */
		this.audio = null;

		this.activeItem = null;
		this.showHelpOverlays = false;
		this.isTransitioning = false;
	}

	// ---------------------------------------------------------------------------
	// Audio Initialisation
	// ---------------------------------------------------------------------------

	/**
	 * Creates the AudioManager and starts room ambience.
	 * @param {boolean} [startAmbience=true]
	 * @param {string} [ambienceKey]
	 */
	initAudio(startAmbience = true, ambienceKey = CONFIG.audio.roomAmbience.key) {
		this.audio = new AudioManager(this);
		if (startAmbience) {
			this.audio.startAmbience(ambienceKey);
			this.audio.startBirds();
		}
	}

	// ---------------------------------------------------------------------------
	// Player Lifecycle & Movement
	// ---------------------------------------------------------------------------

	/**
	 * Spawns the Player entity, registers physics colliders, and wires inputs.
	 */
	setupPlayer() {
		this.isTransitioning = false;
		if (this.input?.keyboard) {
			this.input.keyboard.enabled = true;
		}

		const [spawnX, spawnY] = this.playerSpawn || [400, 300];
		this.player = new Player(this, spawnX, spawnY);

		if (this.walkEmitter) {
			this.player.setDustEmitter(this.walkEmitter);
		}

		if (this.interactableItems) {
			this.physics.add.collider(this.player, this.interactableItems);
		}

		this.interactKey = this.input.keyboard.addKey("E");
		this.helpKey = this.input.keyboard.addKey("H");

		this.setupTouchControls();
	}

	/**
	 * Delegates movement and procedural animation to the Player entity.
	 * @param {number} time
	 * @param {number} delta
	 */
	handlePlayerMovement(time, delta) {
		if (this.player && this.player.update) {
			this.player.update(time, delta);
		}
	}

	/**
	 * Constrains player inside the room's isometric polygon boundary using smooth wall sliding.
	 * Never gets stuck on edges or corners.
	 * @param {number} delta
	 */
	handlePlayerBoundaries(delta) {
		if (!this.player || !this.player.body || this.isTransitioning) return;

		const currentPos = { x: this.player.x, y: this.player.y };
		const dt = delta / 1000;
		const nextPos = {
			x: this.player.x + this.player.body.velocity.x * dt,
			y: this.player.y + this.player.body.velocity.y * dt,
		};
		const velocity = { x: this.player.body.velocity.x, y: this.player.body.velocity.y };

		const res = constrainToPolygonWithSlide(
			currentPos,
			nextPos,
			velocity,
			this.roomPolygon,
			this.roomCenter
		);

		this.player.x = res.x;
		this.player.y = res.y;
		this.player.body.setVelocity(res.vx, res.vy);
	}

	// ---------------------------------------------------------------------------
	// Particle Effects
	// ---------------------------------------------------------------------------

	createParticleEffects() {
		this.particleManager = this.add.particles("particle");

		this.walkEmitter = this.particleManager.createEmitter({
			speed: { min: 8, max: 25 },
			angle: { min: 0, max: 360 },
			scale: { start: 0.14, end: 0.04 },
			alpha: { start: 0.45, end: 0 },
			lifespan: 250,
			tint: 0xeeddbb,
			frequency: -1, // Emitted manually by Player
		});

		if (this.player) {
			this.player.setDustEmitter(this.walkEmitter);
		}
	}

	// ---------------------------------------------------------------------------
	// Item Interactions & Proximity Detection (Bottom HUD only, no in-map clutter)
	// ---------------------------------------------------------------------------

	triggerItemFeedback(item) {
		this.tweens.add({
			targets: item,
			scaleX: 1.08,
			scaleY: 1.08,
			duration: 90,
			yoyo: true,
			ease: 'Quad.easeInOut',
		});
	}

	handleItemInteractions() {
		if (!this.player || !this.interactableItems || this.isTransitioning) return;

		let closestItem = null;
		let minScore = Infinity;
		let closestDist = Infinity;
		const interactRange = CONFIG.interaction.range;
		const portalTypes = new Set(["gallery-door", "exit-gate", "room-exit"]);

		for (let i = 0; i < this.interactableItems.length; i++) {
			const item = this.interactableItems[i];
			const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y);
			if (dist >= interactRange) continue;
			const score = portalTypes.has(item.type) ? dist - 18 : dist;
			if (score < minScore) {
				minScore = score;
				closestDist = dist;
				closestItem = item;
			}
		}

		if (closestItem && closestDist < interactRange) {
			this.activeItem = closestItem;

			// Bottom accessibility banner only (no in-map inspect overlays)
			if (this.interactText) {
				if (this.activeItem.type === "gallery-door" || this.activeItem.type === "exit-gate") {
					this.interactText.setText("Press E to open sliding shoji doors");
				} else if (this.activeItem.type === "room-exit") {
					this.interactText.setText("Press E to return to Japanese Room");
				} else if (this.activeItem.type === "album-trigger") {
					this.interactText.setText("Press E to open the memorial photo album");
				} else {
					this.interactText.setText(`Press E to examine the ${this.activeItem.name}`);
				}
				this.interactText.setVisible(true);
			}

			if (this.showHelpOverlays) {
				this.interactableItems.forEach((item) => {
					item.setAlpha(item === this.activeItem ? 0.45 : 0.2);
				});
			}

			// Check interaction trigger
			if (this.isInteractJustPressed()) {
				this.triggerItemFeedback(this.activeItem);
				if (this.onItemInteract) {
					this.onItemInteract(this.activeItem);
				}
			}
		} else {
			this.activeItem = null;
			if (this.interactText) this.interactText.setVisible(false);

			if (this.showHelpOverlays) {
				this.interactableItems.forEach((item) => {
					item.setAlpha(0.2);
				});
			}
		}
	}

	// ---------------------------------------------------------------------------
	// Input Helpers & Touch Setup
	// ---------------------------------------------------------------------------

	isInteractJustPressed() {
		const keyboard = Phaser.Input.Keyboard.JustDown(this.interactKey);
		const touch = this.touchControls ? this.touchControls.consumeInteract() : false;
		const tap = this.tapInteractRequested;
		this.tapInteractRequested = false;
		return keyboard || touch || tap;
	}

	setupTouchControls() {
		this.touchControls = new TouchControls(this, CONFIG.physics.walkSpeed);

		this.input.on('pointerdown', (pointer, currentlyOver) => {
			if (this.isAlbumOpen || this.isZoomed || this.isExitModalOpen || this.isTransitioning) return;
			if (currentlyOver && currentlyOver.length > 0) return;
			if (this._muteButton && this._muteButton.getBounds().contains(pointer.x, pointer.y)) return;

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
				if (currentDist < CONFIG.interaction.range) {
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
	// HUD UI & Boundaries
	// ---------------------------------------------------------------------------

	setupUI(bannerText = "") {
		this.interactText = this.add
			.text(400, 530, "", {
				fontSize: "15px",
				fontFamily: "Outfit, monospace",
				fill: "#F7E9D7",
				backgroundColor: "#3a2a1e",
				padding: { x: 12, y: 6 },
				stroke: "#1a0f08",
				strokeThickness: 2,
			})
			.setOrigin(0.5)
			.setDepth(150);
		this.interactText.setVisible(false);

		if (bannerText) {
			this.bannerText = this.add
				.text(400, 28, bannerText, {
					fontSize: "13px",
					fontFamily: "Outfit, monospace",
					fill: "#F7E9D7",
					backgroundColor: "rgba(42, 28, 18, 0.75)",
					padding: { x: 12, y: 5 },
					stroke: "#1a0f08",
					strokeThickness: 1.5,
				})
				.setOrigin(0.5)
				.setDepth(150);
		}

		this.coordText = this.add
			.text(12, 570, "Player: x=0, y=0", {
				fontSize: "12px",
				fontFamily: "monospace",
				fill: "#F7E9D7",
				backgroundColor: "rgba(26, 15, 8, 0.78)",
				padding: { x: 6, y: 3 },
			})
			.setDepth(150)
			.setVisible(false);

		this.createMuteButton();
		this.cameras.main.fadeIn(600, 0, 0, 0);
	}

	createMuteButton() {
		const isMuted = this.audio ? this.audio.isMuted : false;
		const btn = this.add
			.text(785, 12, isMuted ? '🔇' : '🔊', {
				fontSize: '20px',
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

	updateCoordinatesDisplay() {
		if (this.coordText && this.player) {
			this.coordText.setText(
				`Player: x=${Math.round(this.player.x)}, y=${Math.round(this.player.y)}`,
			);
		}
	}

	toggleHelpOverlays() {
		if (this.coordText) {
			this.coordText.setVisible(Boolean(this.showHelpOverlays));
		}

		if (this.interactableItems) {
			this.interactableItems.forEach((item) => {
				if (this.showHelpOverlays) {
					item.setAlpha(item === this.activeItem ? 0.45 : 0.2);
					if (item.label) item.label.setVisible(true);
				} else {
					item.setAlpha(0);
					if (item.label) item.label.setVisible(false);
				}
			});
		}

		if (this.boundaries) {
			this.boundaries.getChildren().forEach((wall) => {
				wall.setAlpha(this.showHelpOverlays ? 0.3 : 0);
			});
		}
	}

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
					fontFamily: "Outfit, Arial",
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
}
