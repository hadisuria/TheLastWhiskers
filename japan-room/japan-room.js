// Japanese Room Interactive Exploration Game
// Utility functions
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

// Game configuration
const config = {
	type: Phaser.AUTO,
	width: 800,
	height: 600,
	scene: {
		preload: preload,
		create: create,
		update: update,
	},
	physics: {
		default: "arcade",
		arcade: {
			debug: false,
		},
	},
};

// Game instance
const game = new Phaser.Game(config);

// Global variables
let player;
let cursors;
let interactKey;
let interactableItems = [];
let activeItem = null;
let interactText;
let boundaries;

// Asset loading
function preload() {
	this.load.image("japanese-room", "../assets/room/room.jpeg");
	this.load.spritesheet("particle", "../assets/particles/particles.png", {
		frameWidth: 16,
		frameHeight: 16,
	});

	this.load.on("complete", () => console.log("Assets loaded successfully"));
	this.load.on("loaderror", (file) =>
		console.error("Error loading asset:", file.src)
	);
}

// Scene setup
function create() {
	setupRoom(this);
	createBoundaries(this);
	createInteractiveAreas(this);
	setupPlayer(this);
	setupUI(this);

	this.particleEffects = createParticleEffects(this);
}

function setupRoom(scene) {
	const roomBg = scene.add.image(400, 300, "japanese-room");
	roomBg.setDisplaySize(800, 600);
}

function createBoundaries(scene) {
	boundaries = scene.physics.add.staticGroup();

	const boundaryPoints = [
		[60, 375],
		[400, 240],
		[400, 240],
		[750, 365],
		[750, 365],
		[400, 500],
		[400, 500],
		[60, 375],
	];

	for (let i = 0; i < boundaryPoints.length; i += 2) {
		const [x1, y1] = boundaryPoints[i];
		const [x2, y2] = boundaryPoints[i + 1];

		const centerX = (x1 + x2) / 2;
		const centerY = (y1 + y2) / 2;
		const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
		const angle = Math.atan2(y2 - y1, x2 - x1);

		const wall = scene.add.rectangle(centerX, centerY, length, 10);
		wall.setRotation(angle);
		wall.setFillStyle(0xff0000, 0.3);

		boundaries.add(wall);
	}
}

function createInteractiveAreas(scene) {
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
				"Traditional shoji sliding doors with translucent paper panels.",
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
			description: "A small potted plant adding a touch of green to the room.",
			color: 0x964b00,
		},
	];

	interactiveAreas.forEach((area) => {
		const graphics = scene.add.rectangle(
			area.x,
			area.y,
			area.width,
			area.height,
			area.color,
			0.5
		);

		const hitbox = scene.physics.add.existing(graphics, true);

		graphics.name = area.name;
		graphics.description = area.description;

		const label = scene.add
			.text(area.x, area.y, area.name, {
				fontSize: "12px",
				fontFamily: "Arial",
				color: "#FFFFFF",
				backgroundColor: "#000000",
				padding: { x: 3, y: 3 },
			})
			.setOrigin(0.5);

		interactableItems.push(graphics);
	});
}

function setupPlayer(scene) {
	player = scene.add.rectangle(400, 420, 20, 20, 0x00ff00, 1);
	scene.physics.add.existing(player);
	player.body.setCollideWorldBounds(true);

	scene.physics.add.collider(player, interactableItems);

	cursors = scene.input.keyboard.createCursorKeys();
	interactKey = scene.input.keyboard.addKey("E");
}

function setupUI(scene) {
	interactText = scene.add
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
	interactText.setVisible(false);

	scene.add
		.text(400, 50, "Use arrow keys to move. Press E to interact with items.", {
			fontSize: "16px",
			fontFamily: "monospace",
			fill: "#F7E9D7",
			backgroundColor: "#4A3C31",
			padding: { x: 10, y: 5 },
			stroke: "#000000",
			strokeThickness: 2,
		})
		.setOrigin(0.5);

	scene.coordText = scene.add.text(10, 10, "Player: x=0, y=0", {
		fontSize: "14px",
		fontFamily: "Arial",
		fill: "#FFFFFF",
		backgroundColor: "#000000",
		padding: { x: 5, y: 2 },
	});
}

// Game update loop
function update() {
	handlePlayerMovement(this);
	handlePlayerBoundaries(this);
	updateCoordinatesDisplay(this);
	handleItemInteractions(this);
	cleanupMessages(this);
}

function handlePlayerMovement(scene) {
	const playerBody = player.body;

	playerBody.setVelocity(0);

	if (cursors.left.isDown) {
		playerBody.setVelocityX(-150);
	} else if (cursors.right.isDown) {
		playerBody.setVelocityX(150);
	}

	if (cursors.up.isDown) {
		playerBody.setVelocityY(-150);
	} else if (cursors.down.isDown) {
		playerBody.setVelocityY(150);
	}
}

function handlePlayerBoundaries(scene) {
	const prevX = player.x;
	const prevY = player.y;

	const roomBoundary = [
		[60, 375],
		[400, 240],
		[400, 240],
		[750, 365],
		[750, 365],
		[400, 500],
		[400, 500],
		[60, 375],
	];

	const nextPosition = {
		x: player.x + player.body.velocity.x * (1 / 60),
		y: player.y + player.body.velocity.y * (1 / 60),
	};

	if (!pointInPolygon(nextPosition, roomBoundary)) {
		const testX = { x: nextPosition.x, y: prevY };
		if (!pointInPolygon(testX, roomBoundary)) {
			player.x = prevX;
			player.body.setVelocityX(0);
		}

		const testY = { x: prevX, y: nextPosition.y };
		if (!pointInPolygon(testY, roomBoundary)) {
			player.y = prevY;
			player.body.setVelocityY(0);
		}
	}
}

function updateCoordinatesDisplay(scene) {
	scene.coordText.setText(
		`Player: x=${Math.round(player.x)}, y=${Math.round(player.y)}`
	);
}

function handleItemInteractions(scene) {
	activeItem = null;
	interactText.setVisible(false);

	const sortedItems = interactableItems
		.map((item) => {
			const distance = Phaser.Math.Distance.Between(
				player.x,
				player.y,
				item.x,
				item.y
			);
			return { item, distance };
		})
		.sort((a, b) => a.distance - b.distance);

	if (sortedItems.length > 0 && sortedItems[0].distance < 80) {
		activeItem = sortedItems[0].item;
		interactText.setText(`Press E to examine the ${activeItem.name}`);
		interactText.setVisible(true);

		interactableItems.forEach((item) => {
			item.setAlpha(item === activeItem ? 0.7 : 0.5);
		});
	} else {
		interactableItems.forEach((item) => {
			item.setAlpha(0.5);
		});
	}

	if (Phaser.Input.Keyboard.JustDown(interactKey) && activeItem) {
		showItemDescription(scene, activeItem);
		scene.particleEffects.createEffectForItem(activeItem);

		if (activeItem.name === "lantern") {
			const nearestItem = interactableItems.find(
				(item) =>
					item !== activeItem &&
					Phaser.Math.Distance.Between(
						item.x,
						item.y,
						activeItem.x,
						activeItem.y
					) < 150
			);

			if (nearestItem) {
				scene.lightningEffect.createLightningBetweenItems(
					activeItem,
					nearestItem
				);
			}
		}
	}
}

function showItemDescription(scene, item) {
	const description = scene.add
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
		.setData("createTime", scene.time.now)
		.setInteractive()
		.on("pointerdown", function () {
			this.destroy();
		});

	scene.tweens.add({
		targets: description,
		alpha: 1,
		duration: 200,
	});
}

function cleanupMessages(scene) {
	scene.children.each((child) => {
		if (child.getData("destroyTimer")) {
			if (
				scene.time.now >
				child.getData("createTime") + child.getData("destroyTimer")
			) {
				scene.tweens.add({
					targets: child,
					alpha: 0,
					duration: 200,
					onComplete: function () {
						child.destroy();
					},
				});
			}
		}
	});
}

function createPlayerSplashEffect(scene) {
	const splash = scene.add.particles("particle").createEmitter({
		x: player.x,
		y: player.y,
		speed: { min: 50, max: 100 },
		angle: { min: 0, max: 360 },
		scale: { start: 0.2, end: 0.1 },
		alpha: { start: 0.7, end: 0 },
		lifespan: 300,
		quantity: 5,
		tint: 0x99aaff,
	});

	scene.time.delayedCall(300, () => {
		splash.remove();
	});
}

// Special effects systems
function createParticleEffects(scene) {
	const dustParticles = scene.add.particles("particle");
	const dustEmitter = dustParticles.createEmitter({
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

	const lanternGlow = scene.add.particles("particle");
	const lanternEmitter = lanternGlow.createEmitter({
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

	let steamEmitter = createSteamEmitter(scene);

	return {
		dustEmitter,
		lanternEmitter,
		steamEmitter,
		createEffectForItem: function (item) {
			if (item.name === "lantern") {
				lanternEmitter.setQuantity(5);
				lanternEmitter.setScale({ start: 1, end: 0.2 });
				scene.time.delayedCall(1000, () => {
					lanternEmitter.setQuantity(1);
					lanternEmitter.setScale({ start: 0.6, end: 0.1 });
				});
			} else if (item.name === "teapot") {
				scene.time.delayedCall(2000, () => {
					steamEmitter.stop();
					scene.time.delayedCall(500, () => {
						steamEmitter.remove();
						scene.time.delayedCall(2500, () => {
							// Recreate and start the steam emitter after 2 seconds
							steamEmitter = createSteamEmitter(scene); // Added scene parameter
							steamEmitter.start();
						});
					});
				});
			}
		},
	};
}

function createSteamEmitter(scene) {
	const steamEmitter = scene.add.particles("particle").createEmitter({
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

	return steamEmitter;
}

function createInteractionParticles(scene, item, color = 0xffffff) {
	const emitter = scene.add.particles("particle").createEmitter({
		x: item.x,
		y: item.y,
		speed: { min: 30, max: 60 },
		angle: { min: 0, max: 360 },
		scale: { start: 0.4, end: 0.1 },
		blendMode: "ADD",
		lifespan: 500,
		tint: color,
		quantity: 5,
	});

	scene.time.delayedCall(500, () => {
		emitter.stop();
		scene.time.delayedCall(600, () => {
			emitter.remove();
		});
	});

	return emitter;
}
