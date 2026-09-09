import Phaser from "phaser";
import BaseRoomScene from "./BaseRoomScene.js";
import { openModal } from "../ui/Modal.js";
import japaneseRoomData from "../data/rooms/japanese-room.json";
import albumData from "../data/album.json";

export default class JapaneseRoomScene extends BaseRoomScene {
	constructor() {
		super({ key: "JapaneseRoomScene" });
		this.roomPolygon = japaneseRoomData.polygon;
		this.roomCenter = {
			x: japaneseRoomData.center[0],
			y: japaneseRoomData.center[1],
		};
		this.playerSpawn = japaneseRoomData.playerSpawn;
		this.boundaryColor = Number(japaneseRoomData.boundaryColor || "0xff0000");
		this.roomItemsData = japaneseRoomData.items;
		this.flipOnLeft = false;
	}

	// preload() is intentionally omitted — all assets are loaded by PreloadScene
	// (Phase 4D). Adding new assets: add them to PreloadScene.preload() instead.

	create() {
		// Initialize state properties
		this.activeItem = null;
		this.showHelpOverlays = false;
		this.isAlbumOpen = false;

		// Build scene components
		this.setupRoom();
		this.createBoundaries();
		this.createInteractiveAreas();
		this.setupPlayer();

		// 4C — Register cat animations
		this.createCatAnimations();

		const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
		const bannerText = isTouch
			? "Tap screen / D-pad to move • Tap E or items to interact"
			: "Arrow keys / WASD to move. E to interact. H to toggle help overlays.";
		this.setupUI(bannerText);

		// Systems
		this.createParticleEffects();

		// 4B — Audio (after scene is set up)
		this.initAudio(true);
	}

	setupRoom() {
		const roomBg = this.add.image(400, 300, "japanese-room");
		roomBg.setDisplaySize(800, 600);
	}

	update(time, delta) {
		if (this.isAlbumOpen) {
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

		// Manage proximity feedback
		if (sortedItems.length > 0 && sortedItems[0].distance < 80) {
			this.activeItem = sortedItems[0].item;
			if (this.activeItem.type === "gallery-door") {
				this.interactText.setText(`Press E to enter the Memorial Gallery`);
			} else {
				this.interactText.setText(
					`Press E to examine the ${this.activeItem.name}`,
				);
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
			if (this.activeItem.type === "gallery-door") {
				// Transition to gallery scene
				this.player.body.setVelocity(0);
				this.input.keyboard.enabled = false;
				// 4B — Stop ambience and birds before leaving
				if (this.audio) {
					this.audio.stopAmbience(400);
					this.audio.stopBirds();
				}
				this.cameras.main.fadeOut(800, 0, 0, 0);
				this.cameras.main.once(
					Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
					() => {
						this.input.keyboard.enabled = true;
						this.scene.start("GalleryScene");
					},
				);
				return;
			}
			if (this.activeItem.type === "album-trigger") {
				// 4B — Interact chime
				if (this.audio) this.audio.playInteract();
				this.openPhotoAlbum();
				return;
			}

			// 4B — Interact chime for display items
			if (this.audio) this.audio.playInteract();
			this.showItemDescription(this.activeItem);
			this.triggerItemEffect(this.activeItem);
		}
	}

	showItemDescription(item) {
		if (this.activeDescription && this.activeDescription.active) {
			const prevTimer = this.activeDescription.getData("timerEvent");
			if (prevTimer) prevTimer.remove();
			this.activeDescription.destroy();
			this.activeDescription = null;
		}

		const description = this.add
			.text(400, 350, item.description, {
				fontSize: "18px",
				fontFamily: "monospace",
				fill: "#F7E9D7",
				backgroundColor: "#4A3C31",
				padding: { x: 15, y: 10 },
				wordWrap: { width: 500 },
				stroke: "#000000",
				strokeThickness: 2,
			})
			.setOrigin(0.5)
			.setDepth(100)
			.setAlpha(0)
			.setInteractive()
			.on("pointerdown", () => {
				const timer = description.getData("timerEvent");
				if (timer) timer.remove();
				if (this.activeDescription === description) {
					this.activeDescription = null;
				}
				if (description && description.active) {
					description.destroy();
				}
			});

		this.tweens.add({
			targets: description,
			alpha: 1,
			duration: 200,
		});

		const timerEvent = this.time.delayedCall(3000, () => {
			if (!description || !description.active) return;
			this.tweens.add({
				targets: description,
				alpha: 0,
				duration: 200,
				onComplete: () => {
					if (this.activeDescription === description) {
						this.activeDescription = null;
					}
					if (description && description.active) {
						description.destroy();
					}
				},
			});
		});

		description.setData("timerEvent", timerEvent);
		this.activeDescription = description;
	}

	openPhotoAlbum() {
		this.isAlbumOpen = true;
		this.albumCurrentPage = 0;

		let touchStartX = 0;
		let touchStartY = 0;

		const onPointerDown = (pointer) => {
			touchStartX = pointer.x;
			touchStartY = pointer.y;
		};

		const onPointerUp = (pointer) => {
			const dx = pointer.x - touchStartX;
			const dy = pointer.y - touchStartY;
			if (Math.abs(dx) > 40 && Math.abs(dy) < 60) {
				if (dx < 0) {
					this.flipPage(1);
				} else {
					this.flipPage(-1);
				}
			}
		};

		this.input.on('pointerdown', onPointerDown);
		this.input.on('pointerup', onPointerUp);

		openModal(this, {
			overlayAlpha: 0.8,
			onClose: () => {
				this.isAlbumOpen = false;
				this.input.off('pointerdown', onPointerDown);
				this.input.off('pointerup', onPointerUp);
			},
			onKeyDown: (event) => {
				if (
					event.key === "ArrowLeft" ||
					event.key === "a" ||
					event.key === "A"
				) {
					this.flipPage(-1);
				} else if (
					event.key === "ArrowRight" ||
					event.key === "d" ||
					event.key === "D"
				) {
					this.flipPage(1);
				}
			},
			buildContent: (container) => {
				this.albumContainer = container;

				// Book cover/base graphics
				const bookBg = this.add.graphics();

				// 1. Draw shadow
				bookBg.fillStyle(0x000000, 0.4);
				bookBg.fillRoundedRect(65, 55, 670, 480, 16);

				// 2. Draw outer cover (dark leather wood)
				bookBg.fillStyle(0x2d1a12, 1);
				bookBg.fillRoundedRect(60, 50, 680, 490, 12);

				// 3. Gold outline trim on cover
				bookBg.lineStyle(4, 0xd4af37, 1);
				bookBg.strokeRoundedRect(68, 58, 664, 474, 8);

				// 4. Left page base
				bookBg.fillStyle(0xfaf6ec, 1);
				bookBg.fillRoundedRect(80, 70, 310, 450, 6);

				// 5. Right page base
				bookBg.fillStyle(0xfaf6ec, 1);
				bookBg.fillRoundedRect(410, 70, 310, 450, 6);

				// 6. Center binding fold shadows
				bookBg.fillStyle(0x000000, 0.12);
				bookBg.fillRect(380, 70, 10, 450);
				bookBg.fillRect(410, 70, 10, 450);

				// 7. Spine crease line
				bookBg.fillStyle(0x130a07, 1);
				bookBg.fillRect(397, 60, 6, 470);

				container.add(bookBg);

				// Nested container to hold the page elements that change
				this.albumPageContentContainer = this.add.container(0, 0);
				container.add(this.albumPageContentContainer);

				// Read pages data from imported album.json
				this.albumPagesData = albumData;

				// Render the first page
				this.renderAlbumPage(this.albumCurrentPage);
			},
		});
	}

	renderAlbumPage(pageIndex) {
		// Clear old page contents
		this.albumPageContentContainer.removeAll(true);

		const page = this.albumPagesData[pageIndex];

		// 1. Album Title / Header
		const headerText = this.add
			.text(400, 32, "🐾 Photo Album 🐾", {
				fontSize: "18px",
				fontFamily: "Playfair Display",
				color: "#F7E9D7",
				fontStyle: "bold",
				stroke: "#000000",
				strokeThickness: 1,
			})
			.setOrigin(0.5);
		this.albumPageContentContainer.add(headerText);

		// Interactive tap zones for turning pages by clicking/tapping left or right page
		if (pageIndex > 0) {
			const leftZone = this.add.rectangle(235, 295, 310, 450, 0x000000, 0)
				.setInteractive({ useHandCursor: true })
				.on("pointerdown", () => this.flipPage(-1));
			this.albumPageContentContainer.add(leftZone);
		}
		if (pageIndex < this.albumPagesData.length - 1) {
			const rightZone = this.add.rectangle(565, 295, 310, 450, 0x000000, 0)
				.setInteractive({ useHandCursor: true })
				.on("pointerdown", () => this.flipPage(1));
			this.albumPageContentContainer.add(rightZone);
		}

		// --- LEFT PAGE CONTENT ---
		// Polaroid Frame (rotated slightly counter-clockwise)
		const leftPolaroid = this.add.graphics();
		leftPolaroid.fillStyle(0xffffff, 1);
		leftPolaroid.fillRoundedRect(110, 95, 250, 260, 4);
		leftPolaroid.lineStyle(1, 0xe0d6c5, 1);
		leftPolaroid.strokeRoundedRect(110, 95, 250, 260, 4);
		leftPolaroid.setRotation(-0.02);
		this.albumPageContentContainer.add(leftPolaroid);

		// Tape effect
		const leftTape = this.add
			.rectangle(235, 95, 55, 16, 0xddccbb, 0.45)
			.setRotation(-0.05);
		this.albumPageContentContainer.add(leftTape);

		// Left Image
		const leftImage = this.add.image(235, 210, page.left.key);
		leftImage.setDisplaySize(220, 170);
		leftImage.setRotation(-0.02);
		this.albumPageContentContainer.add(leftImage);

		// Inner thin border for picture mounting look
		const leftImgBorder = this.add.graphics();
		leftImgBorder.lineStyle(1.5, 0x888070, 0.7);
		leftImgBorder.strokeRect(125, 125, 220, 170);
		leftImgBorder.setRotation(-0.02);
		this.albumPageContentContainer.add(leftImgBorder);

		// Left Polaroid Title (handwritten font style)
		const leftTitle = this.add
			.text(235, 320, page.left.title, {
				fontSize: "15px",
				fontFamily: "Playfair Display",
				color: "#3e2723",
				fontStyle: "bold italic",
			})
			.setOrigin(0.5)
			.setRotation(-0.02);
		this.albumPageContentContainer.add(leftTitle);

		// Left Page Description (handwritten note look)
		const leftDesc = this.add
			.text(235, 410, page.left.desc, {
				fontSize: "13px",
				fontFamily: "monospace",
				color: "#5d4037",
				wordWrap: { width: 250 },
				align: "center",
				lineSpacing: 3,
			})
			.setOrigin(0.5);
		this.albumPageContentContainer.add(leftDesc);

		// --- RIGHT PAGE CONTENT ---
		// Polaroid Frame (rotated slightly clockwise)
		const rightPolaroid = this.add.graphics();
		rightPolaroid.fillStyle(0xffffff, 1);
		rightPolaroid.fillRoundedRect(440, 95, 250, 260, 4);
		rightPolaroid.lineStyle(1, 0xe0d6c5, 1);
		rightPolaroid.strokeRoundedRect(440, 95, 250, 260, 4);
		rightPolaroid.setRotation(0.02);
		this.albumPageContentContainer.add(rightPolaroid);

		// Tape effect
		const rightTape = this.add
			.rectangle(565, 95, 55, 16, 0xddccbb, 0.45)
			.setRotation(0.05);
		this.albumPageContentContainer.add(rightTape);

		// Right Image
		const rightImage = this.add.image(565, 210, page.right.key);
		rightImage.setDisplaySize(220, 170);
		rightImage.setRotation(0.02);
		this.albumPageContentContainer.add(rightImage);

		// Inner thin border for picture mounting look
		const rightImgBorder = this.add.graphics();
		rightImgBorder.lineStyle(1.5, 0x888070, 0.7);
		rightImgBorder.strokeRect(455, 125, 220, 170);
		rightImgBorder.setRotation(0.02);
		this.albumPageContentContainer.add(rightImgBorder);

		// Right Polaroid Title
		const rightTitle = this.add
			.text(565, 320, page.right.title, {
				fontSize: "15px",
				fontFamily: "Playfair Display",
				color: "#3e2723",
				fontStyle: "bold italic",
			})
			.setOrigin(0.5)
			.setRotation(0.02);
		this.albumPageContentContainer.add(rightTitle);

		// Right Page Description
		const rightDesc = this.add
			.text(565, 410, page.right.desc, {
				fontSize: "13px",
				fontFamily: "monospace",
				color: "#5d4037",
				wordWrap: { width: 250 },
				align: "center",
				lineSpacing: 3,
			})
			.setOrigin(0.5);
		this.albumPageContentContainer.add(rightDesc);

		// --- NAVIGATION ELEMENTS ---
		// Page Numbers
		const leftPageNum = this.add
			.text(95, 500, (pageIndex * 2 + 1).toString(), {
				fontSize: "12px",
				fontFamily: "monospace",
				color: "#8d6e63",
			})
			.setOrigin(0.5);
		this.albumPageContentContainer.add(leftPageNum);

		const rightPageNum = this.add
			.text(705, 500, (pageIndex * 2 + 2).toString(), {
				fontSize: "12px",
				fontFamily: "monospace",
				color: "#8d6e63",
			})
			.setOrigin(0.5);
		this.albumPageContentContainer.add(rightPageNum);

		// Previous Page Arrow Button
		if (pageIndex > 0) {
			const prevBtn = this.add
				.text(35, 290, "◀", {
					fontSize: "40px",
					fontFamily: "Arial",
					color: "#d4a373",
					stroke: "#1a0f0d",
					strokeThickness: 3,
					padding: { x: 15, y: 15 },
				})
				.setOrigin(0.5)
				.setInteractive({ useHandCursor: true })
				.on("pointerdown", () => this.flipPage(-1))
				.on("pointerover", () => prevBtn.setColor("#e9c46a"))
				.on("pointerout", () => prevBtn.setColor("#d4a373"));
			this.albumPageContentContainer.add(prevBtn);
		}

		// Next Page Arrow Button
		if (pageIndex < this.albumPagesData.length - 1) {
			const nextBtn = this.add
				.text(765, 290, "▶", {
					fontSize: "40px",
					fontFamily: "Arial",
					color: "#d4a373",
					stroke: "#1a0f0d",
					strokeThickness: 3,
					padding: { x: 15, y: 15 },
				})
				.setOrigin(0.5)
				.setInteractive({ useHandCursor: true })
				.on("pointerdown", () => this.flipPage(1))
				.on("pointerover", () => nextBtn.setColor("#e9c46a"))
				.on("pointerout", () => nextBtn.setColor("#d4a373"));
			this.albumPageContentContainer.add(nextBtn);
		}

		// Bottom Close Help Tip
		const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
		const promptStr = isTouch
			? "Tap outside or ESC to Close • Tap pages, ◀ ▶ or Swipe to turn pages"
			: "Click outside or Press E / ESC to Close • Use A/D or Left/Right arrows to turn pages";

		const closePrompt = this.add
			.text(
				400,
				560,
				promptStr,
				{
					fontSize: "12px",
					fontFamily: "monospace",
					color: "#b5a89e",
				},
			)
			.setOrigin(0.5);
		this.albumPageContentContainer.add(closePrompt);
	}

	flipPage(direction) {
		const nextPageIndex = this.albumCurrentPage + direction;
		if (nextPageIndex < 0 || nextPageIndex >= this.albumPagesData.length)
			return;

		// 4B — Page turn sound
		if (this.audio) this.audio.playPageTurn();

		this.tweens.add({
			targets: this.albumPageContentContainer,
			alpha: 0,
			duration: 150,
			onComplete: () => {
				this.albumCurrentPage = nextPageIndex;
				this.renderAlbumPage(this.albumCurrentPage);
				this.tweens.add({
					targets: this.albumPageContentContainer,
					alpha: 1,
					duration: 150,
				});
			},
		});
	}

	createParticleEffects() {
		super.createParticleEffects();

		this.dustEmitter = this.particleManager.createEmitter({
			frame: { frames: [0, 1, 2, 3], cycle: true },
			x: { min: 100, max: 700 },
			y: { min: 250, max: 450 },
			lifespan: { min: 4000, max: 6000 },
			speedX: { min: -10, max: 10 },
			speedY: { min: -10, max: 10 },
			scale: { start: 0.2, end: 0.1 },
			quantity: 1,
			frequency: 2000,
			alpha: { start: 0.5, end: 0 },
			blendMode: "ADD",
		});

		this.lanternEmitter = this.particleManager.createEmitter({
			x: 570,
			y: 300,
			speed: { min: 30, max: 40 },
			angle: { min: 180, max: 360 },
			scale: { start: 0.5, end: 0.1 },
			blendMode: "ADD",
			lifespan: 800,
			tint: 0xffaa00,
			frequency: 50,
			quantity: 1,
			alpha: { start: 0.4, end: 0 },
		});

		this.steamEmitter = this.particleManager.createEmitter({
			x: 418,
			y: 334,
			speed: { min: 1, max: 20 },
			angle: { min: 250, max: 290 },
			scale: { start: 0.1, end: 0.5 },
			alpha: { start: 0.7, end: 0 },
			lifespan: 1500,
			tint: 0xffffff,
			blendMode: "ADD",
			frequency: 300,
			quantity: 2,
		});

		this.leafEmitter = this.particleManager.createEmitter({
			frame: { frames: [0, 1, 2, 3] },
			speedX: { min: -15, max: 15 },
			speedY: { min: 10, max: 40 },
			gravityY: 80,
			scale: { start: 0.2, end: 0.1 },
			rotate: { min: 0, max: 360 },
			lifespan: 1200,
			tint: 0x557a46, // Green bonsai leaf color
			frequency: -1, // Emit manually
		});
	}

	createBonsaiLeafDrop() {
		if (this.leafEmitter) {
			this.leafEmitter.explode(8, 500, 250);
		}
	}

	triggerItemEffect(item) {
		if (item.name === "lantern") {
			// Glow lighter / lighter burst effect for a period of time
			this.lanternEmitter.setQuantity(5);
			this.lanternEmitter.setScale({ start: 1, end: 0.2 });
			this.time.delayedCall(1000, () => {
				this.lanternEmitter.setQuantity(1);
				this.lanternEmitter.setScale({ start: 0.6, end: 0.1 });
			});
		} else if (item.name === "teapot") {
			// Teapot shows more smoke/steam on examine
			this.steamEmitter.setQuantity(6);
			this.steamEmitter.setSpeed({ min: 10, max: 40 });
			this.time.delayedCall(2000, () => {
				this.steamEmitter.setQuantity(2);
				this.steamEmitter.setSpeed({ min: 1, max: 20 });
			});
		} else if (item.name === "bonsai") {
			this.createBonsaiLeafDrop();
		}
	}
}
