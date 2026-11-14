import Phaser from "phaser";
import BaseRoomScene from "./BaseRoomScene.js";
import { openModal } from "../ui/Modal.js";
import { CONFIG } from "../config.js";
import japaneseRoomData from "../data/rooms/japanese-room.json";
import albumData from "../data/album.json";

// External destination URL when exiting through the sliding shoji gate.
export const EXIT_REDIRECT_URL = CONFIG.navigation.exitRedirectUrl;

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
	}

	create() {
		this.activeItem = null;
		this.showHelpOverlays = false;
		this.isAlbumOpen = false;
		this.isExitModalOpen = false;

		// Build scene components
		this.setupRoom();
		this.createBoundaries();
		this.createInteractiveAreas();

		// Particle systems (dust, lantern, steam, leaves)
		this.createParticleEffects();

		// Setup player entity & colliders
		this.setupPlayer();

		const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
		const bannerText = isTouch
			? "Tap screen / D-pad to move • Tap E or items to interact"
			: "WASD / Arrows to move • Shift to sprint • E to interact • H for help";
		this.setupUI(bannerText);

		// Audio
		this.initAudio(true);
	}

	setupRoom() {
		const bg = this.add.graphics();
		bg.fillStyle(0x18110c, 1);
		bg.fillRect(0, 0, 800, 600);
		bg.fillStyle(0x2a1c13, 0.45);
		bg.fillEllipse(400, 320, 740, 520);

		const roomBg = this.add.image(400, 300, "japanese-room");
		roomBg.setDisplaySize(800, 600);
	}

	update(time, delta) {
		if (this.isAlbumOpen || this.isExitModalOpen) {
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

	onItemInteract(item) {
		if (item.type === "gallery-door" || item.type === "exit-gate") {
			if (this.audio) this.audio.playInteract();
			this.openDoorActionModal();
			return;
		}
		if (item.type === "album-trigger") {
			if (this.audio) this.audio.playInteract();
			this.openPhotoAlbum();
			return;
		}

		if (this.audio) this.audio.playInteract();
		this.showItemDescription(item);
		this.triggerItemEffect(item);
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
				fontSize: "16px",
				fontFamily: "Outfit, monospace",
				fill: "#F7E9D7",
				backgroundColor: "#3a2a1e",
				padding: { x: 15, y: 10 },
				wordWrap: { width: 500 },
				stroke: "#1a0f08",
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

	// ---------------------------------------------------------------------------
	// Photo Album
	// ---------------------------------------------------------------------------

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

		this.input.on("pointerdown", onPointerDown);
		this.input.on("pointerup", onPointerUp);

		openModal(this, {
			overlayAlpha: 0.8,
			onCloseStart: () => {
				this.isAlbumOpen = false;
			},
			onClose: () => {
				this.isAlbumOpen = false;
				this.input.off("pointerdown", onPointerDown);
				this.input.off("pointerup", onPointerUp);
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

				const bookBg = this.add.graphics();
				bookBg.fillStyle(0x000000, 0.4);
				bookBg.fillRoundedRect(65, 55, 670, 480, 16);

				bookBg.fillStyle(0x2d1a12, 1);
				bookBg.fillRoundedRect(60, 50, 680, 490, 12);

				bookBg.lineStyle(4, 0xd4af37, 1);
				bookBg.strokeRoundedRect(68, 58, 664, 474, 8);

				bookBg.fillStyle(0xfaf6ec, 1);
				bookBg.fillRoundedRect(80, 70, 310, 450, 6);

				bookBg.fillStyle(0xfaf6ec, 1);
				bookBg.fillRoundedRect(410, 70, 310, 450, 6);

				bookBg.fillStyle(0x000000, 0.12);
				bookBg.fillRect(380, 70, 10, 450);
				bookBg.fillRect(410, 70, 10, 450);

				bookBg.fillStyle(0x130a07, 1);
				bookBg.fillRect(397, 60, 6, 470);

				container.add(bookBg);

				this.albumPageContentContainer = this.add.container(0, 0);
				container.add(this.albumPageContentContainer);

				this.albumPagesData = albumData;
				this.renderAlbumPage(this.albumCurrentPage);
			},
		});
	}

	renderAlbumPage(pageIndex) {
		this.albumPageContentContainer.removeAll(true);
		const page = this.albumPagesData[pageIndex];

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

		if (pageIndex > 0) {
			const leftZone = this.add
				.rectangle(235, 295, 310, 450, 0x000000, 0)
				.setInteractive({ useHandCursor: true })
				.on("pointerdown", () => this.flipPage(-1));
			this.albumPageContentContainer.add(leftZone);
		}
		if (pageIndex < this.albumPagesData.length - 1) {
			const rightZone = this.add
				.rectangle(565, 295, 310, 450, 0x000000, 0)
				.setInteractive({ useHandCursor: true })
				.on("pointerdown", () => this.flipPage(1));
			this.albumPageContentContainer.add(rightZone);
		}

		// Render Left & Right Polaroids (border drawn behind photo so natural overhang isn't crossed by lines)
		const sides = [
			{
				data: page.left,
				centerX: 235,
				polaroidX: 110,
				borderX: 125,
				rot: -0.02,
				tapeRot: -0.05,
			},
			{
				data: page.right,
				centerX: 565,
				polaroidX: 440,
				borderX: 455,
				rot: 0.02,
				tapeRot: 0.05,
			},
		];

		for (const side of sides) {
			const polaroid = this.add.graphics();
			polaroid.fillStyle(0xffffff, 1);
			polaroid.fillRoundedRect(side.polaroidX, 95, 250, 260, 4);
			polaroid.lineStyle(1, 0xe0d6c5, 1);
			polaroid.strokeRoundedRect(side.polaroidX, 95, 250, 260, 4);
			polaroid.setRotation(side.rot);
			this.albumPageContentContainer.add(polaroid);

			const tape = this.add
				.rectangle(side.centerX, 95, 55, 16, 0xddccbb, 0.45)
				.setRotation(side.tapeRot);
			this.albumPageContentContainer.add(tape);

			const imgBorder = this.add.graphics();
			imgBorder.lineStyle(1.5, 0x888070, 0.7);
			imgBorder.strokeRect(side.borderX, 125, 220, 170);
			imgBorder.setRotation(side.rot);
			this.albumPageContentContainer.add(imgBorder);

			const image = this.add.image(side.centerX, 210, side.data.key);
			image.setDisplaySize(220, 170);
			image.setRotation(side.rot);
			this.albumPageContentContainer.add(image);

			const title = this.add
				.text(side.centerX, 320, side.data.title, {
					fontSize: "15px",
					fontFamily: "Playfair Display",
					color: "#3e2723",
					fontStyle: "bold italic",
				})
				.setOrigin(0.5)
				.setRotation(side.rot);
			this.albumPageContentContainer.add(title);

			const desc = this.add
				.text(side.centerX, 410, side.data.desc, {
					fontSize: "13px",
					fontFamily: "monospace",
					color: "#5d4037",
					wordWrap: { width: 250 },
					align: "center",
					lineSpacing: 3,
				})
				.setOrigin(0.5);
			this.albumPageContentContainer.add(desc);
		}

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

		// Page Buttons
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

		const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
		const promptStr = isTouch
			? "Tap outside or ESC to Close • Tap pages, ◀ ▶ or Swipe to turn pages"
			: "Click outside or Press E / ESC to Close • Use A/D or Left/Right arrows to turn pages";

		const closePrompt = this.add
			.text(400, 560, promptStr, {
				fontSize: "12px",
				fontFamily: "monospace",
				color: "#b5a89e",
			})
			.setOrigin(0.5);
		this.albumPageContentContainer.add(closePrompt);
	}

	flipPage(direction) {
		const nextPageIndex = this.albumCurrentPage + direction;
		if (nextPageIndex < 0 || nextPageIndex >= this.albumPagesData.length)
			return;

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

	// ---------------------------------------------------------------------------
	// Particle Emitters
	// ---------------------------------------------------------------------------

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
			tint: 0x557a46,
			frequency: -1,
		});
	}

	createBonsaiLeafDrop() {
		if (this.leafEmitter) {
			this.leafEmitter.explode(8, 500, 250);
		}
	}

	triggerItemEffect(item) {
		if (item.name === "lantern") {
			this.lanternEmitter.setQuantity(5);
			this.lanternEmitter.setScale({ start: 1, end: 0.2 });
			this.time.delayedCall(1000, () => {
				this.lanternEmitter.setQuantity(1);
				this.lanternEmitter.setScale({ start: 0.6, end: 0.1 });
			});
		} else if (item.name === "teapot") {
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

	// ---------------------------------------------------------------------------
	// Sliding Shoji Door Modal & Room Transition
	// ---------------------------------------------------------------------------

	openDoorActionModal() {
		this.isExitModalOpen = true;

		openModal(this, {
			overlayAlpha: 0.8,
			closeOnOverlayClick: true,
			closeOnEOrEscKey: true,
			onCloseStart: () => {
				this.isExitModalOpen = false;
				this.moveTarget = null;
				this.pendingItemInteraction = null;
			},
			onClose: () => {
				this.isExitModalOpen = false;
				this.moveTarget = null;
				this.pendingItemInteraction = null;
			},
			onKeyDown: (event, closeModal) => {
				if (event.key === "c" || event.key === "C") {
					if (this.audio) this.audio.playUIClick();
					closeModal();
				} else if (event.key === "1" || event.key === "g" || event.key === "G" || event.key === "Enter") {
					closeModal();
					this.transitionToGallery();
				} else if (event.key === "2" || event.key === "x" || event.key === "X") {
					this.confirmExit();
				}
			},
			buildContent: (container, closeModal) => {
				const modalBg = this.add.graphics();
				modalBg.fillStyle(0x000000, 0.55);
				modalBg.fillRoundedRect(165, 140, 470, 310, 16);

				modalBg.fillStyle(0x2d1a12, 1);
				modalBg.fillRoundedRect(160, 135, 480, 310, 14);

				modalBg.lineStyle(3, 0xd4af37, 1);
				modalBg.strokeRoundedRect(160, 135, 480, 310, 14);

				modalBg.fillStyle(0x1e1410, 1);
				modalBg.fillRoundedRect(170, 145, 460, 290, 10);
				container.add(modalBg);

				const titleText = this.add
					.text(400, 180, "🚪 Sliding Shoji Doors", {
						fontSize: "22px",
						fontFamily: "Playfair Display, serif",
						color: "#F7E9D7",
						fontStyle: "bold",
						stroke: "#000000",
						strokeThickness: 2,
					})
					.setOrigin(0.5);
				container.add(titleText);

				const messageText = this.add
					.text(400, 218, "Where would you like to go?", {
						fontSize: "14px",
						fontFamily: "Outfit, sans-serif",
						color: "#C2A880",
						align: "center",
					})
					.setOrigin(0.5);
				container.add(messageText);

				// Button 1: Enter Memorial Photo Gallery
				const galleryBtnBg = this.add.graphics();
				const drawGalleryBtn = (isHover) => {
					galleryBtnBg.clear();
					galleryBtnBg.fillStyle(isHover ? 0xe9c46a : 0xd4af37, 1);
					galleryBtnBg.fillRoundedRect(200, 250, 400, 46, 8);
					galleryBtnBg.lineStyle(2, 0xfff0aa, 1);
					galleryBtnBg.strokeRoundedRect(200, 250, 400, 46, 8);
				};
				drawGalleryBtn(false);
				container.add(galleryBtnBg);

				const galleryText = this.add
					.text(400, 273, "🖼️  Enter Memorial Photo Gallery (1 / Enter)", {
						fontSize: "14px",
						fontFamily: "Outfit, sans-serif",
						color: "#1f140e",
						fontStyle: "bold",
					})
					.setOrigin(0.5);
				container.add(galleryText);

				const galleryZone = this.add
					.rectangle(400, 273, 400, 46, 0x000000, 0)
					.setInteractive({ useHandCursor: true })
					.on("pointerover", () => drawGalleryBtn(true))
					.on("pointerout", () => drawGalleryBtn(false))
					.on("pointerdown", (pointer, localX, localY, event) => {
						if (event && event.stopPropagation) event.stopPropagation();
						closeModal();
						this.transitionToGallery();
					});
				container.add(galleryZone);

				// Button 2: Exit Website (placeholder redirect to external web)
				const exitBtnBg = this.add.graphics();
				const drawExitBtn = (isHover) => {
					exitBtnBg.clear();
					exitBtnBg.fillStyle(isHover ? 0xf28f73 : 0xe07a5f, 1);
					exitBtnBg.fillRoundedRect(200, 310, 400, 44, 8);
					exitBtnBg.lineStyle(2, 0xffb499, 1);
					exitBtnBg.strokeRoundedRect(200, 310, 400, 44, 8);
				};
				drawExitBtn(false);
				container.add(exitBtnBg);

				const exitText = this.add
					.text(400, 332, "🌐  Exit Website (2)", {
						fontSize: "14px",
						fontFamily: "Outfit, sans-serif",
						color: "#FFFFFF",
						fontStyle: "bold",
					})
					.setOrigin(0.5);
				container.add(exitText);

				const exitZone = this.add
					.rectangle(400, 332, 400, 44, 0x000000, 0)
					.setInteractive({ useHandCursor: true })
					.on("pointerover", () => drawExitBtn(true))
					.on("pointerout", () => drawExitBtn(false))
					.on("pointerdown", (pointer, localX, localY, event) => {
						if (event && event.stopPropagation) event.stopPropagation();
						this.confirmExit();
					});
				container.add(exitZone);

				// Button 3: Stay Here / Cancel
				const cancelBtnBg = this.add.graphics();
				const drawCancelBtn = (isHover) => {
					cancelBtnBg.clear();
					cancelBtnBg.fillStyle(isHover ? 0x5d4c3e : 0x4a3c31, 1);
					cancelBtnBg.fillRoundedRect(280, 370, 240, 38, 8);
					cancelBtnBg.lineStyle(1.5, 0x8d6e63, 1);
					cancelBtnBg.strokeRoundedRect(280, 370, 240, 38, 8);
				};
				drawCancelBtn(false);
				container.add(cancelBtnBg);

				const cancelText = this.add
					.text(400, 389, "Stay in Japanese Room (E / Esc)", {
						fontSize: "13px",
						fontFamily: "Outfit, sans-serif",
						color: "#D4AF37",
					})
					.setOrigin(0.5);
				container.add(cancelText);

				const cancelZone = this.add
					.rectangle(400, 389, 240, 38, 0x000000, 0)
					.setInteractive({ useHandCursor: true })
					.on("pointerover", () => drawCancelBtn(true))
					.on("pointerout", () => drawCancelBtn(false))
					.on("pointerdown", (pointer, localX, localY, event) => {
						if (event && event.stopPropagation) event.stopPropagation();
						if (this.audio) this.audio.playUIClick();
						closeModal();
					});
				container.add(cancelZone);
			},
		});
	}

	transitionToGallery() {
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
				this.scene.start("GalleryScene");
			}
		);
	}

	confirmExit() {
		if (this.audio) this.audio.playUIClick();
		try {
			if (window.top && window.top !== window) {
				window.top.location.href = EXIT_REDIRECT_URL;
			} else {
				window.location.href = EXIT_REDIRECT_URL;
			}
		} catch (e) {
			window.location.href = EXIT_REDIRECT_URL;
		}
	}
}
