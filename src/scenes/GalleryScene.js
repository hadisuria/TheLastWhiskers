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
	}

	create() {
		this.activeItem = null;
		this.showHelpOverlays = false;
		this.isZoomed = false;

		// Room background
		const bg = this.add.image(400, 300, "gallery-room");
		bg.setDisplaySize(800, 600);

		// Boundaries & items
		this.createBoundaries();
		this.createInteractiveAreas();
		this.createGalleryCues();

		// Particle systems
		this.createParticleEffects();

		// Player
		this.setupPlayer();

		const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
		const bannerText = isTouch
			? "Tap screen / D-pad to move • Tap E or photos to inspect"
			: "Memorial Photo Gallery • E to inspect photos • Shoji door to return";
		this.setupUI(bannerText);

		// Audio
		this.initAudio(true);
	}

	update(time, delta) {
		if (this.isZoomed) {
			if (this.interactKey) Phaser.Input.Keyboard.JustDown(this.interactKey);
			this.tapInteractRequested = false;
			if (this.player && this.player.body) {
				this.player.body.setVelocity(0);
				this.player.body.setAcceleration(0, 0);
			}
			return;
		}

		this.handlePlayerMovement(time, delta);
		this.handlePlayerBoundaries(delta);
		this.updateCoordinatesDisplay();
		this.handleItemInteractions();

		if (Phaser.Input.Keyboard.JustDown(this.helpKey)) {
			this.showHelpOverlays = !this.showHelpOverlays;
			this.toggleHelpOverlays();
		}
	}

		// Exit indicator pill on the bottom tatami threshold (depth below player)
	createGalleryCues() {
		const exitHint = this.add
			.text(400, 492, "▼ Exit to Japanese Room", {
				fontSize: "12px",
				fontFamily: "Outfit, monospace",
				fill: "#F7E9D7",
				backgroundColor: "rgba(45, 26, 18, 0.82)",
				padding: { x: 10, y: 4 },
				stroke: "#d4af37",
				strokeThickness: 1,
			})
			.setOrigin(0.5)
			.setDepth(5);
		this.tweens.add({
			targets: exitHint,
			y: 496,
			alpha: { from: 0.85, to: 1 },
			duration: 1100,
			yoyo: true,
			repeat: -1,
			ease: "Sine.easeInOut",
		});

		// Subtle pulsing shimmer marker on each inspectable photo display
		if (this.interactableItems) {
			this.interactableItems.forEach((item, index) => {
				if (item.type !== "photo-display") return;

				const glow = this.add
					.circle(item.x, item.y, 16, 0xffd57e, 0.22)
					.setDepth(4);
				const sparkle = this.add
					.text(item.x, item.y - 2, "✦", {
						fontSize: "16px",
						color: "#ffe49e",
						stroke: "#2d1a12",
						strokeThickness: 3,
					})
					.setOrigin(0.5)
					.setDepth(5);

				this.tweens.add({
					targets: glow,
					scale: { from: 0.85, to: 1.35 },
					alpha: { from: 0.16, to: 0.36 },
					duration: 1300,
					delay: index * 220,
					yoyo: true,
					repeat: -1,
					ease: "Sine.easeInOut",
				});

				this.tweens.add({
					targets: sparkle,
					y: item.y - 6,
					alpha: { from: 0.65, to: 1 },
					duration: 1300,
					delay: index * 220,
					yoyo: true,
					repeat: -1,
					ease: "Sine.easeInOut",
				});
			});
		}
	}

	onItemInteract(item) {
		if (item.type === "room-exit") {
			this.returnToJapaneseRoom();
		} else {
			if (this.audio) this.audio.playInteract();
			this.zoomPhoto(item);
		}
	}

	returnToJapaneseRoom() {
		if (this.isTransitioning) return;
		this.isTransitioning = true;

		if (this.player && this.player.body) {
			this.player.body.setVelocity(0, 0);
			this.player.body.setAcceleration(0, 0);
		}

		if (this.audio) {
			this.audio.playDoorSlide();
			this.audio.stopAmbience(500);
			this.audio.stopBirds();
		}

		this.cameras.main.fadeOut(500, 0, 0, 0);
		this.cameras.main.once(
			Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
			() => {
				this.scene.start("JapaneseRoomScene");
			}
		);
	}

	zoomPhoto(item) {
		this.isZoomed = true;

		openModal(this, {
			overlayAlpha: 0.75,
			onCloseStart: () => {
				this.isZoomed = false;
			},
			onClose: () => {
				this.isZoomed = false;
			},
			buildContent: (container) => {
				// Ornate wooden frame
				const frame = this.add.graphics();
				frame.fillStyle(0x000000, 0.4);
				frame.fillRoundedRect(235, 75, 330, 450, 15);

				frame.fillStyle(0x4a3c31, 1);
				frame.fillRoundedRect(230, 70, 340, 460, 12);

				frame.lineStyle(4, 0xd4af37, 1);
				frame.strokeRoundedRect(244, 84, 312, 432, 8);

				frame.fillStyle(0xf4efe5, 1);
				frame.fillRoundedRect(248, 88, 304, 424, 6);
				container.add(frame);

				// Zoomed cat photo
				const catImage = this.add.image(400, 240, item.photoKey);
				catImage.setDisplaySize(260, 260);
				container.add(catImage);

				const photoBorder = this.add.graphics();
				photoBorder.lineStyle(2, 0x333333, 0.8);
				photoBorder.strokeRect(270, 110, 260, 260);
				container.add(photoBorder);

				// Description
				const descText = this.add
					.text(400, 420, item.description, {
						fontSize: "15px",
						fontFamily: "Outfit, monospace",
						fill: "#2A2015",
						align: "center",
						wordWrap: { width: 260 },
						lineSpacing: 4,
					})
					.setOrigin(0.5);
				container.add(descText);

				// Close tip
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
