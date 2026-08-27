import Phaser from "phaser";
import BaseRoomScene from "./BaseRoomScene.js";
import { openModal } from "../ui/Modal.js";
import galleryData from "../data/rooms/gallery.json";

export default class GalleryScene extends BaseRoomScene {
	constructor() {
		super({ key: "GalleryScene" });
		this.roomPolygon = galleryData.polygon;
		this.roomCenter = {
			x: galleryData.center[0],
			y: galleryData.center[1],
		};
		this.playerSpawn = galleryData.playerSpawn;
		this.boundaryColor = Number(galleryData.boundaryColor || "0x0000ff");
		this.roomItemsData = galleryData.items;
		this.flipOnLeft = false;
	}

	// preload() is intentionally omitted — all assets are loaded by PreloadScene
	// (Phase 4D). Adding new assets: add them to PreloadScene.preload() instead.

	create() {
		this.interactableItems = [];
		this.activeItem = null;
		this.showHelpOverlays = false;
		this.isZoomed = false;

		// Setup room bg
		const bg = this.add.image(400, 300, "gallery-room");
		bg.setDisplaySize(800, 600);

		// Boundaries
		this.createBoundaries();

		// Interactive areas: 3 photos + exit door
		this.createInteractiveAreas();

		// Setup Player
		this.setupPlayer();

		// 4C — Cat animations (GalleryScene reuses the 'cat' texture/anims from cache)
		this.createCatAnimations();

		// Setup UI
		this.setupUI();

		// Systems
		this.createParticleEffects();

		// Help toggle key
		this.helpKey = this.input.keyboard.addKey("H");

		// 4B — Audio
		this.initAudio(true);
	}

	createBoundaries() {
		this.boundaries = this.add.group();

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
			wall.setFillStyle(this.boundaryColor, 0.3);
			wall.setAlpha(0); // Invisible by default

			this.boundaries.add(wall);
		}
	}

	createInteractiveAreas() {
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
			graphics.type = item.type || "photo-display";
			graphics.description = item.description;
			graphics.photoKey = item.photoKey || null;
			graphics.isExit = item.type === "room-exit";
			graphics.color = colorNum;

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

	setupPlayer() {
		const [spawnX, spawnY] = this.playerSpawn;
		this.player = this.physics.add.sprite(spawnX, spawnY, "cat");
		this.player.setDisplaySize(40, 40);
		this.player.body.setSize(30, 30);
		this.player.body.setCollideWorldBounds(true);

		this.physics.add.collider(this.player, this.interactableItems);

		this.cursors = this.input.keyboard.createCursorKeys();
		this.wasd = this.input.keyboard.addKeys({
			up: Phaser.Input.Keyboard.KeyCodes.W,
			down: Phaser.Input.Keyboard.KeyCodes.S,
			left: Phaser.Input.Keyboard.KeyCodes.A,
			right: Phaser.Input.Keyboard.KeyCodes.D,
		});
		this.interactKey = this.input.keyboard.addKey("E");

		// 4A — Touch controls
		this.setupTouchControls();
	}

	setupUI() {
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

		const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
		const bannerText = isTouch
			? "Tap screen / D-pad to move • Tap E or photos to inspect"
			: "Memorial Photo Room. E to inspect photos. H to toggle help overlays.";

		this.add
			.text(
				400,
				45,
				bannerText,
				{
					fontSize: "15px",
					fontFamily: "monospace",
					fill: "#F7E9D7",
					backgroundColor: "#4A3C31",
					padding: { x: 10, y: 5 },
					stroke: "#000000",
					strokeThickness: 2,
				},
			)
			.setOrigin(0.5)
			.setDepth(150);

		this.coordText = this.add
			.text(10, 10, "Player: x=0, y=0", {
				fontSize: "14px",
				fontFamily: "Arial",
				fill: "#FFFFFF",
				backgroundColor: "#000000",
				padding: { x: 5, y: 2 },
			})
			.setDepth(150);

		// 4B — Mute toggle button
		this.createMuteButton();

		// Fade in camera when entering
		this.cameras.main.fadeIn(800, 0, 0, 0);
	}

	update(time, delta) {
		if (this.isZoomed) {
			this.player.body.setVelocity(0);
			return;
		}

		this.handlePlayerMovement();
		this.handlePlayerBoundaries(delta);
		this.updateCoordinatesDisplay();
		this.handleItemInteractions();

		if (Phaser.Input.Keyboard.JustDown(this.helpKey)) {
			this.showHelpOverlays = !this.showHelpOverlays;
			this.toggleHelpOverlays();
		}
	}

	handleItemInteractions() {
		this.activeItem = null;
		this.interactText.setVisible(false);

		const sortedItems = this.interactableItems
			.map((item) => {
				const distance = Phaser.Math.Distance.Between(
					this.player.x,
					this.player.y,
					item.x,
					item.y,
				);
				return { item, distance };
			})
			.sort((a, b) => a.distance - b.distance);

		if (sortedItems.length > 0 && sortedItems[0].distance < 80) {
			this.activeItem = sortedItems[0].item;
			if (this.activeItem.type === "room-exit") {
				this.interactText.setText(`Press E to return to Japanese Room`);
			} else {
				this.interactText.setText(`Press E to inspect ${this.activeItem.name}`);
			}
			this.interactText.setVisible(true);

			if (this.showHelpOverlays) {
				this.interactableItems.forEach((item) => {
					item.setAlpha(item === this.activeItem ? 0.4 : 0.2);
				});
			}
		} else if (this.showHelpOverlays) {
			this.interactableItems.forEach((item) => {
				item.setAlpha(0.2);
			});
		}

		// 4A: isInteractJustPressed() checks keyboard AND touch interact button
		if (this.isInteractJustPressed() && this.activeItem) {
			if (this.activeItem.type === "room-exit") {
				this.player.body.setVelocity(0);
				this.input.keyboard.enabled = false;
				// 4B — Stop ambience and birds before leaving
				if (this.audio) { this.audio.stopAmbience(400); this.audio.stopBirds(); }
				this.cameras.main.fadeOut(800, 0, 0, 0);
				this.cameras.main.once(
					Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
					() => {
						this.input.keyboard.enabled = true;
						this.scene.start("JapaneseRoomScene");
					},
				);
			} else {
				// 4B — Interact chime on photo zoom
				if (this.audio) this.audio.playInteract();
				this.zoomPhoto(this.activeItem);
			}
		}
	}

	zoomPhoto(item) {
		this.isZoomed = true;

		openModal(this, {
			overlayAlpha: 0.75,
			onClose: () => {
				this.isZoomed = false;
			},
			buildContent: (container) => {
				// Draw a beautiful ornate wooden frame
				const frame = this.add.graphics();
				// Shadow
				frame.fillStyle(0x000000, 0.4);
				frame.fillRoundedRect(235, 75, 330, 450, 15);
				// Outer frame
				frame.fillStyle(0x4a3c31, 1); // Dark walnut wood color
				frame.fillRoundedRect(230, 70, 340, 460, 12);
				// Inner border (gold bevel)
				frame.lineStyle(4, 0xd4af37, 1); // Gold lining
				frame.strokeRoundedRect(244, 84, 312, 432, 8);
				// Inner mounting board (cream color)
				frame.fillStyle(0xf4efe5, 1);
				frame.fillRoundedRect(248, 88, 304, 424, 6);

				container.add(frame);

				// The actual zoomed cat photo
				const catImage = this.add.image(400, 240, item.photoKey);
				catImage.setDisplaySize(260, 260);
				container.add(catImage);

				// Add a thin dark line around the photo to mount it visually
				const photoBorder = this.add.graphics();
				photoBorder.lineStyle(2, 0x333333, 0.8);
				photoBorder.strokeRect(270, 110, 260, 260);
				container.add(photoBorder);

				// Description text
				const descText = this.add
					.text(400, 420, item.description, {
						fontSize: "15px",
						fontFamily: "monospace",
						fill: "#2A2015",
						align: "center",
						wordWrap: { width: 260 },
						lineSpacing: 4,
					})
					.setOrigin(0.5);
				container.add(descText);

				// Prompt to close
				const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
				const closeStr = isTouch ? "Tap anywhere or Press E to Close" : "Click or Press E to Close";
				const closePrompt = this.add
					.text(400, 495, closeStr, {
						fontSize: "12px",
						fontFamily: "monospace",
						fill: "#7A6855",
						align: "center",
					})
					.setOrigin(0.5);
				container.add(closePrompt);
			}
		});
	}
}
