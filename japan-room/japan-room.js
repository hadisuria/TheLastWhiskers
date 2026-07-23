// Japanese Room Interactive Exploration Game

// Helper function: Point in polygon check
function pointInPolygon(point, polygon) {
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const xi = polygon[i][0];
		const yi = polygon[i][1];
		const xj = polygon[j][0];
		const yj = polygon[j][1];

		const intersect =
			yi > point.y !== yj > point.y &&
			point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

// Room boundaries polygon (isometric diamond)
const ROOM_POLYGON = [
	[60, 375],
	[400, 240],
	[750, 365],
	[400, 500],
];

// Gallery boundaries polygon (isometric diamond)
const GALLERY_POLYGON = [
	[80, 380],
	[400, 260],
	[720, 380],
	[400, 500],
];

class JapaneseRoomScene extends Phaser.Scene {
	constructor() {
		super({ key: "JapaneseRoomScene" });
	}

	preload() {
		this.load.image("japanese-room", "../assets/room/room.jpeg");
		this.load.image("cat-raw", "../assets/character/cat.png");
		this.load.spritesheet("particle", "../assets/particles/particles.png", {
			frameWidth: 16,
			frameHeight: 16,
		});

		// Album photos preloading
		this.load.image("album-kitten", "../assets/objects/cat_kitten.png");
		this.load.image("album-milo", "../assets/objects/cat_milo.png");
		this.load.image("album-sleeping", "../assets/objects/cat_sleeping.png");
		this.load.image("album-luna", "../assets/objects/cat_luna.png");
		this.load.image("album-window", "../assets/objects/cat_window.png");
		this.load.image("album-oliver", "../assets/objects/cat_oliver.png");

		this.load.on("complete", () => console.log("Assets loaded successfully"));
		this.load.on("loaderror", (file) =>
			console.error("Error loading asset:", file.src),
		);
	}

	create() {
		// Clean / transparentize the player sprite background dynamically
		this.createTransparentTexture("cat", "cat-raw");

		// Initialize state properties
		this.interactableItems = [];
		this.activeItem = null;
		this.showHelpOverlays = false;
		this.isAlbumOpen = false;

		// Build scene components
		this.setupRoom();
		this.createBoundaries();
		this.createInteractiveAreas();
		this.setupPlayer();
		this.setupUI();

		// Systems
		this.createParticleEffects();
	}

	createTransparentTexture(key, sourceKey, tolerance = 40) {
		if (!this.textures.exists(sourceKey)) {
			console.warn(`Texture key ${sourceKey} does not exist.`);
			return;
		}
		const sourceTexture = this.textures.get(sourceKey).getSourceImage();
		if (!sourceTexture) {
			console.error("Failed to find source image for key:", sourceKey);
			return;
		}

		const canvas = document.createElement("canvas");
		canvas.width = sourceTexture.width;
		canvas.height = sourceTexture.height;
		const ctx = canvas.getContext("2d");
		ctx.drawImage(sourceTexture, 0, 0);

		const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const data = imgData.data;

		// Dynamic background color detection from top-left pixel (0, 0)
		const bgR = data[0];
		const bgG = data[1];
		const bgB = data[2];
		const bgA = data[3];

		if (bgA > 50) {
			for (let i = 0; i < data.length; i += 4) {
				const r = data[i];
				const g = data[i + 1];
				const b = data[i + 2];

				// Calculate distance in RGB space
				const dist = Math.sqrt(
					Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2),
				);

				if (dist < tolerance) {
					data[i + 3] = 0; // Set alpha to 0
				}
			}
			ctx.putImageData(imgData, 0, 0);
		}

		if (this.textures.exists(key)) {
			this.textures.remove(key);
		}
		this.textures.addCanvas(key, canvas);
	}

	setupRoom() {
		const roomBg = this.add.image(400, 300, "japanese-room");
		roomBg.setDisplaySize(800, 600);
	}

	createBoundaries() {
		this.boundaries = this.add.group();

		const len = ROOM_POLYGON.length;
		for (let i = 0; i < len; i++) {
			const [x1, y1] = ROOM_POLYGON[i];
			const [x2, y2] = ROOM_POLYGON[(i + 1) % len];

			const centerX = (x1 + x2) / 2;
			const centerY = (y1 + y2) / 2;
			const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
			const angle = Math.atan2(y2 - y1, x2 - x1);

			const wall = this.add.rectangle(centerX, centerY, length, 10);
			wall.setRotation(angle);
			wall.setFillStyle(0xff0000, 0.3);
			wall.setAlpha(0); // Invisible by default

			this.boundaries.add(wall);
		}
	}

	createInteractiveAreas() {
		const interactiveAreas = [
			{
				x: 400,
				y: 360,
				width: 120,
				height: 80,
				name: "kotatsu",
				description:
					"A traditional Japanese heated table with a blanket and cushions.",
				color: 0xff0000,
			},
			{
				x: 440,
				y: 330,
				width: 40,
				height: 40,
				name: "teapot",
				description: "A ceramic teapot with freshly brewed green tea.",
				color: 0x00ff00,
			},
			{
				x: 110,
				y: 285,
				width: 80,
				height: 100,
				name: "bookshelf",
				description:
					"A wooden bookshelf filled with scrolls, books, and mementos.",
				color: 0x0000ff,
			},
			{
				x: 500,
				y: 260,
				width: 50,
				height: 50,
				name: "bonsai",
				description:
					"A meticulously maintained miniature tree, representing harmony with nature.",
				color: 0xffff00,
			},
			{
				x: 700,
				y: 350,
				width: 80,
				height: 80,
				name: "cabinet",
				description:
					"A wooden cabinet containing traditional tea ceremony utensils.",
				color: 0xff00ff,
			},
			{
				x: 220,
				y: 240,
				width: 100,
				height: 80,
				name: "sliding door",
				description:
					"Traditional shoji sliding doors. Press E to enter the Memorial Gallery Room.",
				color: 0x00ffff,
			},
			{
				x: 570,
				y: 300,
				width: 40,
				height: 40,
				name: "lantern",
				description:
					"A paper lantern casting a warm, gentle light throughout the room.",
				color: 0xffa500,
			},
			{
				x: 360,
				y: 220,
				width: 40,
				height: 40,
				name: "plant",
				description:
					"A small potted plant adding a touch of green to the room.",
				color: 0x964b00,
			},
		];

		interactiveAreas.forEach((area) => {
			const graphics = this.add.rectangle(
				area.x,
				area.y,
				area.width,
				area.height,
				area.color,
				0.5,
			);
			graphics.setAlpha(0); // Invisible by default

			this.physics.add.existing(graphics, true);

			graphics.name = area.name;
			graphics.description = area.description;
			graphics.color = area.color;

			const label = this.add
				.text(area.x, area.y, area.name, {
					fontSize: "12px",
					fontFamily: "Arial",
					color: "#FFFFFF",
					backgroundColor: "#000000",
					padding: { x: 3, y: 3 },
				})
				.setOrigin(0.5)
				.setVisible(false); // Invisible by default

			graphics.label = label;
			this.interactableItems.push(graphics);
		});
	}

	setupPlayer() {
		// Use the new transparent cute cat sprite
		this.player = this.physics.add.sprite(400, 420, "cat");
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
		this.helpKey = this.input.keyboard.addKey("H");
	}

	setupUI() {
		this.interactText = this.add
			.text(400, 550, "", {
				fontSize: "16px",
				fontFamily: "monospace",
				fill: "#F7E9D7",
				backgroundColor: "#4A3C31",
				padding: { x: 10, y: 5 },
				stroke: "#000000",
				strokeThickness: 2,
			})
			.setOrigin(0.5);
		this.interactText.setVisible(false);

		this.add
			.text(
				400,
				50,
				"Arrow keys / WASD to move. E to interact. H to toggle help overlays.",
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
			.setOrigin(0.5);

		this.coordText = this.add.text(10, 10, "Player: x=0, y=0", {
			fontSize: "14px",
			fontFamily: "Arial",
			fill: "#FFFFFF",
			backgroundColor: "#000000",
			padding: { x: 5, y: 2 },
		});

		// Fade in camera when starting
		this.cameras.main.fadeIn(800, 0, 0, 0);
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
		this.cleanupMessages();

		if (Phaser.Input.Keyboard.JustDown(this.helpKey)) {
			this.showHelpOverlays = !this.showHelpOverlays;
			this.toggleHelpOverlays();
		}
	}

	handlePlayerMovement() {
		const playerBody = this.player.body;
		playerBody.setVelocity(0);

		let vx = 0;
		let vy = 0;
		const speed = 150;

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

		// Normalize speed for diagonal movement
		if (vx !== 0 && vy !== 0) {
			vx *= 0.7071;
			vy *= 0.7071;
		}

		playerBody.setVelocity(vx, vy);

		// Flip sprite based on movement direction
		if (vx < 0) {
			this.player.setFlipX(false);
		} else if (vx > 0) {
			this.player.setFlipX(true);
		}

		// Trigger puff/dust walk effects
		if (vx !== 0 || vy !== 0) {
			if (this.time.now > (this.lastSplashTime || 0) + 150) {
				this.createPlayerSplashEffect();
				this.lastSplashTime = this.time.now;
			}
		}
	}

	handlePlayerBoundaries(delta) {
		const prevX = this.player.x;
		const prevY = this.player.y;

		// Calculate step in seconds
		const dt = delta / 1000;
		const nextX = this.player.x + this.player.body.velocity.x * dt;
		const nextY = this.player.y + this.player.body.velocity.y * dt;
		const nextPosition = { x: nextX, y: nextY };

		// If the next position is inside the polygon, it's always valid!
		if (pointInPolygon(nextPosition, ROOM_POLYGON)) {
			return;
		}

		// Self-healing: if already outside, allow movement only if it brings us closer to the center (400, 370)
		const currentPosition = { x: prevX, y: prevY };
		const isCurrentlyInside = pointInPolygon(currentPosition, ROOM_POLYGON);

		if (!isCurrentlyInside) {
			const distPrev = Phaser.Math.Distance.Between(prevX, prevY, 400, 370);
			const distNext = Phaser.Math.Distance.Between(nextX, nextY, 400, 370);

			if (distNext < distPrev) {
				return; // Allow moving back inside!
			}
		}

		// Normal sliding collision response
		const testX = { x: nextX, y: prevY };
		if (!pointInPolygon(testX, ROOM_POLYGON)) {
			this.player.x = prevX;
			this.player.body.setVelocityX(0);
		}

		const testY = { x: prevX, y: nextY };
		if (!pointInPolygon(testY, ROOM_POLYGON)) {
			this.player.y = prevY;
			this.player.body.setVelocityY(0);
		}
	}

	updateCoordinatesDisplay() {
		this.coordText.setText(
			`Player: x=${Math.round(this.player.x)}, y=${Math.round(this.player.y)}`,
		);
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
			if (this.activeItem.name === "sliding door") {
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

		if (Phaser.Input.Keyboard.JustDown(this.interactKey) && this.activeItem) {
			if (this.activeItem.name === "sliding door") {
				// Transition to gallery scene
				this.player.body.setVelocity(0);
				this.input.keyboard.enabled = false;
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
			if (this.activeItem.name === "bookshelf") {
				this.openPhotoAlbum();
				return;
			}

			this.showItemDescription(this.activeItem);
			this.triggerItemEffect(this.activeItem);
		}
	}

	showItemDescription(item) {
		if (this.activeDescription && this.activeDescription.active) {
			this.activeDescription.destroy();
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
			.setData("destroyTimer", 3000)
			.setData("createTime", this.time.now)
			.setInteractive()
			.on("pointerdown", () => {
				if (this.activeDescription === description) {
					this.activeDescription = null;
				}
				description.destroy();
			});

		this.tweens.add({
			targets: description,
			alpha: 1,
			duration: 200,
		});

		this.activeDescription = description;
	}

	openPhotoAlbum() {
		this.isAlbumOpen = true;
		this.albumCurrentPage = 0;
		this.interactText.setVisible(false);

		// Parent container for the album modal
		this.albumContainer = this.add.container(0, 0).setDepth(200);

		// Semi-transparent overlay backdrop
		const overlay = this.add
			.rectangle(400, 300, 800, 600, 0x000000, 0.8)
			.setInteractive()
			.on("pointerdown", () => closeAlbum());
		this.albumContainer.add(overlay);

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

		this.albumContainer.add(bookBg);

		// Nested container to hold the page elements that change
		this.albumPageContentContainer = this.add.container(0, 0);
		this.albumContainer.add(this.albumPageContentContainer);

		// Define the pages data
		this.albumPagesData = [
			{
				left: {
					key: "album-kitten",
					title: "Tiny Beginnings",
					desc: "First day home. So small, she was constantly exploring the rugs with soft meows."
				},
				right: {
					key: "album-milo",
					title: "Milo's High Ground",
					desc: "Milo immediately claimed the top of the cabinet. A natural explorer from the start."
				}
			},
			{
				left: {
					key: "album-sleeping",
					title: "Sunny Naps",
					desc: "Luna spent her afternoons searching for the warmest, sunniest spot on the tatami."
				},
				right: {
					key: "album-luna",
					title: "Luna's Curiosity",
					desc: "Luna's favorite hiding spot—a cozy little basket where she felt safe and sound."
				}
			},
			{
				left: {
					key: "album-window",
					title: "Window Watching",
					desc: "Spending hours looking out at the rain, dreaming of butterflies outside."
				},
				right: {
					key: "album-oliver",
					title: "Oliver's Vigil",
					desc: "Oliver sitting perfectly still, keeping watch over the garden and the falling leaves."
				}
			}
		];

		// Render the first page
		this.renderAlbumPage(this.albumCurrentPage);

		// Subtle entrance animation
		this.albumContainer.y = 50;
		this.albumContainer.alpha = 0;
		this.tweens.add({
			targets: this.albumContainer,
			y: 0,
			alpha: 1,
			duration: 250,
			ease: "Back.easeOut",
		});

		// Listeners
		const albumListener = (event) => {
			if (event.key === "e" || event.key === "E" || event.key === "Escape") {
				closeAlbum();
			} else if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
				this.flipPage(-1);
			} else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
				this.flipPage(1);
			}
		};
		window.addEventListener("keydown", albumListener);

		let isClosing = false;
		const closeAlbum = () => {
			if (isClosing) return;
			isClosing = true;
			window.removeEventListener("keydown", albumListener);

			this.tweens.add({
				targets: this.albumContainer,
				y: 30,
				alpha: 0,
				duration: 200,
				ease: "Power2",
				onComplete: () => {
					this.albumContainer.destroy();
					this.isAlbumOpen = false;
				},
			});
		};
	}

	renderAlbumPage(pageIndex) {
		// Clear old page contents
		this.albumPageContentContainer.removeAll(true);

		const page = this.albumPagesData[pageIndex];

		// 1. Album Title / Header
		const headerText = this.add.text(400, 32, "🐾 Photo Album 🐾", {
			fontSize: "18px",
			fontFamily: "Playfair Display",
			color: "#F7E9D7",
			fontStyle: "bold",
			stroke: "#000000",
			strokeThickness: 1
		}).setOrigin(0.5);
		this.albumPageContentContainer.add(headerText);

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
		const leftTape = this.add.rectangle(235, 95, 55, 16, 0xddccbb, 0.45).setRotation(-0.05);
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
		const leftTitle = this.add.text(235, 320, page.left.title, {
			fontSize: "15px",
			fontFamily: "Playfair Display",
			color: "#3e2723",
			fontStyle: "bold italic"
		}).setOrigin(0.5).setRotation(-0.02);
		this.albumPageContentContainer.add(leftTitle);

		// Left Page Description (handwritten note look)
		const leftDesc = this.add.text(235, 410, page.left.desc, {
			fontSize: "13px",
			fontFamily: "monospace",
			color: "#5d4037",
			wordWrap: { width: 250 },
			align: "center",
			lineSpacing: 3
		}).setOrigin(0.5);
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
		const rightTape = this.add.rectangle(565, 95, 55, 16, 0xddccbb, 0.45).setRotation(0.05);
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
		const rightTitle = this.add.text(565, 320, page.right.title, {
			fontSize: "15px",
			fontFamily: "Playfair Display",
			color: "#3e2723",
			fontStyle: "bold italic"
		}).setOrigin(0.5).setRotation(0.02);
		this.albumPageContentContainer.add(rightTitle);

		// Right Page Description
		const rightDesc = this.add.text(565, 410, page.right.desc, {
			fontSize: "13px",
			fontFamily: "monospace",
			color: "#5d4037",
			wordWrap: { width: 250 },
			align: "center",
			lineSpacing: 3
		}).setOrigin(0.5);
		this.albumPageContentContainer.add(rightDesc);

		// --- NAVIGATION ELEMENTS ---
		// Page Numbers
		const leftPageNum = this.add.text(95, 500, (pageIndex * 2 + 1).toString(), {
			fontSize: "12px",
			fontFamily: "monospace",
			color: "#8d6e63"
		}).setOrigin(0.5);
		this.albumPageContentContainer.add(leftPageNum);

		const rightPageNum = this.add.text(705, 500, (pageIndex * 2 + 2).toString(), {
			fontSize: "12px",
			fontFamily: "monospace",
			color: "#8d6e63"
		}).setOrigin(0.5);
		this.albumPageContentContainer.add(rightPageNum);

		// Previous Page Arrow Button
		if (pageIndex > 0) {
			const prevBtn = this.add.text(35, 290, "◀", {
				fontSize: "36px",
				fontFamily: "Arial",
				color: "#d4a373",
				stroke: "#1a0f0d",
				strokeThickness: 2
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
			const nextBtn = this.add.text(765, 290, "▶", {
				fontSize: "36px",
				fontFamily: "Arial",
				color: "#d4a373",
				stroke: "#1a0f0d",
				strokeThickness: 2
			})
			.setOrigin(0.5)
			.setInteractive({ useHandCursor: true })
			.on("pointerdown", () => this.flipPage(1))
			.on("pointerover", () => nextBtn.setColor("#e9c46a"))
			.on("pointerout", () => nextBtn.setColor("#d4a373"));
			this.albumPageContentContainer.add(nextBtn);
		}

		// Bottom Close Help Tip
		const closePrompt = this.add.text(400, 560, "Click outside or Press E / ESC to Close • Use A/D or Left/Right arrows to turn pages", {
			fontSize: "12px",
			fontFamily: "monospace",
			color: "#b5a89e"
		}).setOrigin(0.5);
		this.albumPageContentContainer.add(closePrompt);
	}

	flipPage(direction) {
		const nextPageIndex = this.albumCurrentPage + direction;
		if (nextPageIndex < 0 || nextPageIndex >= this.albumPagesData.length) return;

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
					duration: 150
				});
			}
		});
	}

	cleanupMessages() {
		this.children.each((child) => {
			if (child.getData("destroyTimer")) {
				if (
					this.time.now >
					child.getData("createTime") + child.getData("destroyTimer")
				) {
					if (child.getData("isFading")) return;
					child.setData("isFading", true);

					this.tweens.add({
						targets: child,
						alpha: 0,
						duration: 200,
						onComplete: () => {
							if (this.activeDescription === child) {
								this.activeDescription = null;
							}
							child.destroy();
						},
					});
				}
			}
		});
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

	// Particles
	createParticleEffects() {
		this.particleManager = this.add.particles("particle");

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

		this.walkEmitter = this.particleManager.createEmitter({
			speed: { min: 10, max: 30 },
			angle: { min: 0, max: 360 },
			scale: { start: 0.15, end: 0.05 },
			alpha: { start: 0.5, end: 0 },
			lifespan: 300,
			tint: 0xeeddbb,
			frequency: -1, // Emit manually
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

class GalleryScene extends Phaser.Scene {
	constructor() {
		super({ key: "GalleryScene" });
	}

	preload() {
		this.load.image("gallery-room", "../assets/room/gallery.png");

		// Load memorial photos of the grey cat
		this.load.image("photo-sleeping", "../assets/objects/cat_sleeping.png");
		this.load.image("photo-kitten", "../assets/objects/cat_kitten.png");
		this.load.image("photo-window", "../assets/objects/cat_window.png");
	}

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

		// Setup UI
		this.setupUI();

		// Systems
		this.createParticleEffects();

		// Help toggle key
		this.helpKey = this.input.keyboard.addKey("H");
	}

	createBoundaries() {
		this.boundaries = this.add.group();

		const len = GALLERY_POLYGON.length;
		for (let i = 0; i < len; i++) {
			const [x1, y1] = GALLERY_POLYGON[i];
			const [x2, y2] = GALLERY_POLYGON[(i + 1) % len];

			const centerX = (x1 + x2) / 2;
			const centerY = (y1 + y2) / 2;
			const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
			const angle = Math.atan2(y2 - y1, x2 - x1);

			const wall = this.add.rectangle(centerX, centerY, length, 10);
			wall.setRotation(angle);
			wall.setFillStyle(0x0000ff, 0.3);
			wall.setAlpha(0); // Invisible by default

			this.boundaries.add(wall);
		}
	}

	createInteractiveAreas() {
		const items = [
			{
				x: 230,
				y: 290,
				width: 70,
				height: 70,
				name: "Kitten Days",
				description:
					"Kitten Days - Tiny, curious, and full of life. Exploring every corner of the room with wide eyes.",
				photoKey: "photo-kitten",
				color: 0x99aaff,
			},
			{
				x: 400,
				y: 280,
				width: 70,
				height: 70,
				name: "Sunny Spots",
				description:
					"Sunny Spots - Finding the warmest patch of light on the tatami floor and sleeping peacefully for hours.",
				photoKey: "photo-sleeping",
				color: 0xffaa66,
			},
			{
				x: 570,
				y: 290,
				width: 70,
				height: 70,
				name: "Quiet Moments",
				description:
					"Quiet Moments - Sitting peacefully by the window, watching the world go by. Forever in my heart.",
				photoKey: "photo-window",
				color: 0x88ff88,
			},
			{
				x: 400,
				y: 520,
				width: 100,
				height: 60,
				name: "sliding door",
				description: "Go back to the main room.",
				isExit: true,
				color: 0xffffff,
			},
		];

		items.forEach((item) => {
			const graphics = this.add.rectangle(
				item.x,
				item.y,
				item.width,
				item.height,
				item.color,
				0.5,
			);
			graphics.setAlpha(0);

			this.physics.add.existing(graphics, true);

			graphics.name = item.name;
			graphics.description = item.description;
			graphics.photoKey = item.photoKey || null;
			graphics.isExit = item.isExit || false;
			graphics.color = item.color;

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
		// Uses the transparent "cat" texture registered globally
		this.player = this.physics.add.sprite(400, 470, "cat");
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
	}

	setupUI() {
		this.interactText = this.add
			.text(400, 550, "", {
				fontSize: "16px",
				fontFamily: "monospace",
				fill: "#F7E9D7",
				backgroundColor: "#4A3C31",
				padding: { x: 10, y: 5 },
				stroke: "#000000",
				strokeThickness: 2,
			})
			.setOrigin(0.5)
			.setDepth(10);
		this.interactText.setVisible(false);

		this.add
			.text(
				400,
				50,
				"Memorial Photo Room. E to inspect photos. H to toggle help overlays.",
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
			.setDepth(10);

		this.coordText = this.add
			.text(10, 10, "Player: x=0, y=0", {
				fontSize: "14px",
				fontFamily: "Arial",
				fill: "#FFFFFF",
				backgroundColor: "#000000",
				padding: { x: 5, y: 2 },
			})
			.setDepth(10);

		// Fade in camera when entering
		this.cameras.main.fadeIn(800, 0, 0, 0);
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

	handlePlayerMovement() {
		const playerBody = this.player.body;
		playerBody.setVelocity(0);

		let vx = 0;
		let vy = 0;
		const speed = 150;

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

		if (vx !== 0 && vy !== 0) {
			vx *= 0.7071;
			vy *= 0.7071;
		}

		playerBody.setVelocity(vx, vy);

		// Flip sprite based on movement direction
		if (vx < 0) {
			this.player.setFlipX(true);
		} else if (vx > 0) {
			this.player.setFlipX(false);
		}

		if (vx !== 0 || vy !== 0) {
			if (this.time.now > (this.lastSplashTime || 0) + 150) {
				this.createPlayerSplashEffect();
				this.lastSplashTime = this.time.now;
			}
		}
	}

	handlePlayerBoundaries(delta) {
		const prevX = this.player.x;
		const prevY = this.player.y;

		const dt = delta / 1000;
		const nextX = this.player.x + this.player.body.velocity.x * dt;
		const nextY = this.player.y + this.player.body.velocity.y * dt;
		const nextPosition = { x: nextX, y: nextY };

		// If the next position is inside the polygon, it's always valid!
		if (pointInPolygon(nextPosition, GALLERY_POLYGON)) {
			return;
		}

		// Self-healing: if already outside, allow movement only if it brings us closer to the center (400, 380)
		const currentPosition = { x: prevX, y: prevY };
		const isCurrentlyInside = pointInPolygon(currentPosition, GALLERY_POLYGON);

		if (!isCurrentlyInside) {
			const distPrev = Phaser.Math.Distance.Between(prevX, prevY, 400, 380);
			const distNext = Phaser.Math.Distance.Between(nextX, nextY, 400, 380);

			if (distNext < distPrev) {
				return; // Allow moving back inside!
			}
		}

		// Normal sliding collision response
		const testX = { x: nextX, y: prevY };
		if (!pointInPolygon(testX, GALLERY_POLYGON)) {
			this.player.x = prevX;
			this.player.body.setVelocityX(0);
		}

		const testY = { x: prevX, y: nextY };
		if (!pointInPolygon(testY, GALLERY_POLYGON)) {
			this.player.y = prevY;
			this.player.body.setVelocityY(0);
		}
	}

	updateCoordinatesDisplay() {
		this.coordText.setText(
			`Player: x=${Math.round(this.player.x)}, y=${Math.round(this.player.y)}`,
		);
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
			if (this.activeItem.isExit) {
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

		if (Phaser.Input.Keyboard.JustDown(this.interactKey) && this.activeItem) {
			if (this.activeItem.isExit) {
				this.player.body.setVelocity(0);
				this.input.keyboard.enabled = false;
				this.cameras.main.fadeOut(800, 0, 0, 0);
				this.cameras.main.once(
					Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
					() => {
						this.input.keyboard.enabled = true;
						this.scene.start("JapaneseRoomScene");
					},
				);
			} else {
				this.zoomPhoto(this.activeItem);
			}
		}
	}

	zoomPhoto(item) {
		this.isZoomed = true;
		this.interactText.setVisible(false);

		// Container for all modal elements
		const container = this.add.container(0, 0).setDepth(200);

		// Semi-transparent dark background
		const overlay = this.add
			.rectangle(400, 300, 800, 600, 0x000000, 0.75)
			.setInteractive()
			.on("pointerdown", () => closeModal());
		container.add(overlay);

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
		const closePrompt = this.add
			.text(400, 495, "Click or Press E to Close", {
				fontSize: "12px",
				fontFamily: "monospace",
				fill: "#7A6855",
				align: "center",
			})
			.setOrigin(0.5);
		container.add(closePrompt);

		// Add a subtle bounce animation to the frame
		container.y = 50;
		container.alpha = 0;
		this.tweens.add({
			targets: container,
			y: 0,
			alpha: 1,
			duration: 250,
			ease: "Back.easeOut",
		});

		// Listen for E key press to close
		const closeListener = (event) => {
			if (event.key === "e" || event.key === "E" || event.key === "Escape") {
				closeModal();
			}
		};
		window.addEventListener("keydown", closeListener);

		let isClosing = false;
		const closeModal = () => {
			if (isClosing) return;
			isClosing = true;
			window.removeEventListener("keydown", closeListener);

			this.tweens.add({
				targets: container,
				y: 30,
				alpha: 0,
				duration: 200,
				ease: "Power2",
				onComplete: () => {
					container.destroy();
					this.isZoomed = false;
				},
			});
		};
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
}

// Game configuration
const config = {
	type: Phaser.AUTO,
	width: 800,
	height: 600,
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH,
	},
	scene: [JapaneseRoomScene, GalleryScene],
	physics: {
		default: "arcade",
		arcade: {
			debug: false,
		},
	},
};

// Game instance
const game = new Phaser.Game(config);
