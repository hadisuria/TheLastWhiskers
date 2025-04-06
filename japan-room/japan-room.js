// Add this function at the top of your file, outside of any existing functions
function pointInPolygon(point, polygon) {
	// Ray-casting algorithm to determine if a point is inside a polygon
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

// Create game instance
const game = new Phaser.Game(config);

// Global variables
let player;
let cursors;
let interactKey;
let interactableItems = [];
let activeItem = null;
let interactText;
let boundaries; // Added this as a global variable

function preload() {
	console.log("Loading assets...");

	// Load the complete room as a single image
	this.load.image("japanese-room", "../assets/room/room.jpeg");

	// Add load event listeners for debugging
	this.load.on("complete", function () {
		console.log("All assets loaded successfully!");
	});

	this.load.on("loaderror", function (file) {
		console.error("Error loading asset:", file.src);
	});
}

function create() {
	console.log("Creating scene...");

	// Add the complete room background
	const roomBg = this.add.image(400, 300, "japanese-room");

	// Size the background to fit the canvas
	roomBg.setDisplaySize(800, 600);
	console.log("Room background added:", roomBg);

	// Create invisible boundary walls to keep player inside the room
	boundaries = this.physics.add.staticGroup();

	// These coordinates form a polygon boundary around the tatami mat area
	// Adjust these values based on the exact shape of your room
	const boundaryPoints = [
		// Top-left corner to top-right
		[60, 375],
		[400, 240],
		// Top-right to bottom-right
		[400, 240],
		[750, 365],
		// Bottom-right to bottom-left
		[750, 365],
		[400, 500],
		// Bottom-left to top-left
		[400, 500],
		[60, 375],
	];

	// Create line segments for each boundary edge
	for (let i = 0; i < boundaryPoints.length; i += 2) {
		const [x1, y1] = boundaryPoints[i];
		const [x2, y2] = boundaryPoints[i + 1];

		// Calculate center point and dimensions for the boundary wall
		const centerX = (x1 + x2) / 2;
		const centerY = (y1 + y2) / 2;
		const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
		const angle = Math.atan2(y2 - y1, x2 - x1);

		// Create a thin rectangle for the boundary wall
		const wall = this.add.rectangle(centerX, centerY, length, 10);
		wall.setRotation(angle);
		// For debugging, make the boundaries visible with semi-transparency
		wall.setFillStyle(0xff0000, 0.3); // Red color with 30% opacity
		// wall.setVisible(false); // Uncomment this line to hide boundaries when done debugging

		// Add physics to the wall
		boundaries.add(wall);
	}

	// Create colored hitboxes for interactive areas
	console.log("Creating interactive areas...");

	// Define interactive regions with colors for visibility
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
		}, // Red
		{
			x: 440,
			y: 330,
			width: 40,
			height: 40,
			name: "teapot",
			description: "A ceramic teapot with freshly brewed green tea.",
			color: 0x00ff00,
		}, // Green
		{
			x: 110,
			y: 285,
			width: 80,
			height: 100,
			name: "bookshelf",
			description:
				"A wooden bookshelf filled with scrolls, books, and mementos.",
			color: 0x0000ff,
		}, // Blue
		{
			x: 500,
			y: 260,
			width: 50,
			height: 50,
			name: "bonsai",
			description:
				"A meticulously maintained miniature tree, representing harmony with nature.",
			color: 0xffff00,
		}, // Yellow
		{
			x: 700,
			y: 350,
			width: 80,
			height: 80,
			name: "cabinet",
			description:
				"A wooden cabinet containing traditional tea ceremony utensils.",
			color: 0xff00ff,
		}, // Purple
		{
			x: 220,
			y: 240,
			width: 100,
			height: 80,
			name: "sliding door",
			description:
				"Traditional shoji sliding doors with translucent paper panels.",
			color: 0x00ffff,
		}, // Cyan
		{
			x: 570,
			y: 300,
			width: 40,
			height: 40,
			name: "lantern",
			description:
				"A paper lantern casting a warm, gentle light throughout the room.",
			color: 0xffa500,
		}, // Orange
		{
			x: 360,
			y: 220,
			width: 40,
			height: 40,
			name: "plant",
			description: "A small potted plant adding a touch of green to the room.",
			color: 0x964b00,
		}, // Brown
	];

	// Create visible colored rectangles for each interactive area
	interactableItems = [];

	interactiveAreas.forEach((area) => {
		// Create a rectangle graphics object
		const graphics = this.add.rectangle(
			area.x,
			area.y,
			area.width,
			area.height,
			area.color,
			0.5
		);

		// Create the physics body (invisible but interactive)
		const hitbox = this.physics.add.existing(graphics, true); // true = static body
		// hitbox.body.setImmovable(true); // Uncommented this line to make sure items don't move

		// Store properties on the graphics object
		graphics.name = area.name;
		graphics.description = area.description;

		// Add text label for easy identification
		const label = this.add
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

	// Add visible player for debugging - place in a good starting position inside the room
	console.log("Adding player...");
	player = this.add.rectangle(400, 400, 20, 20, 0x00ff00, 1);
	this.physics.add.existing(player);
	player.body.setCollideWorldBounds(true);
	console.log("Player added:", player);

	// NOW add collisions between player and boundaries
	// this.physics.add.collider(player, boundaries);

	// Add collisions between player and items
	this.physics.add.collider(player, interactableItems);

	// Controls
	cursors = this.input.keyboard.createCursorKeys();
	interactKey = this.input.keyboard.addKey("E");

	// Interaction text
	interactText = this.add
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

	// Instructions with matching style
	this.add
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

	// Coordinates display for debugging
	this.coordText = this.add.text(10, 10, "Player: x=0, y=0", {
		fontSize: "14px",
		fontFamily: "Arial",
		fill: "#FFFFFF",
		backgroundColor: "#000000",
		padding: { x: 5, y: 2 },
	});

	console.log("Scene creation complete!");
}
function update() {
	// Player movement
	const playerBody = player.body;
	const prevX = player.x;
	const prevY = player.y;

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

	// Check player position in the NEXT frame before applying boundary constraints
	// This allows continued movement along boundaries

	// Define the room boundaries as a polygon
	const roomBoundary = [
		// [175, 220], // Top-left
		// [600, 100], // Top-right
		// [700, 150], // Right
		// [300, 500], // Bottom
		// [175, 220], // Back to start to close the polygon

		// Top-left corner to top-right
		[60, 375],
		[400, 240],
		// Top-right to bottom-right
		[400, 240],
		[750, 365],
		// Bottom-right to bottom-left
		[750, 365],
		[400, 500],
		// Bottom-left to top-left
		[400, 500],
		[60, 375],
	];

	// After physics update in this frame, check if the player would go outside the boundary
	// If outside, revert ONLY the component of movement (X or Y) that caused the boundary violation
	const nextPosition = {
		x: player.x + playerBody.velocity.x * (1 / 60), // Estimate next frame position
		y: player.y + playerBody.velocity.y * (1 / 60),
	};

	if (!pointInPolygon(nextPosition, roomBoundary)) {
		// Test if X movement alone would cause boundary violation
		const testX = { x: nextPosition.x, y: prevY };
		if (!pointInPolygon(testX, roomBoundary)) {
			player.x = prevX; // Revert X position
			playerBody.setVelocityX(0); // Stop X movement
		}

		// Test if Y movement alone would cause boundary violation
		const testY = { x: prevX, y: nextPosition.y };
		if (!pointInPolygon(testY, roomBoundary)) {
			player.y = prevY; // Revert Y position
			playerBody.setVelocityY(0); // Stop Y movement
		}
	}

	// Update player coordinates display
	this.coordText.setText(
		`Player: x=${Math.round(player.x)}, y=${Math.round(player.y)}`
	);

	// Rest of the interaction code remains the same
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

		// Highlight the active item
		interactableItems.forEach((item) => {
			if (item === activeItem) {
				item.setAlpha(0.7);
			} else {
				item.setAlpha(0.5);
			}
		});
	} else {
		interactableItems.forEach((item) => {
			item.setAlpha(0.5);
		});
	}

	// Handle interaction
	if (Phaser.Input.Keyboard.JustDown(interactKey) && activeItem) {
		const description = this.add
			.text(400, 350, activeItem.description, {
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
			.on("pointerdown", function () {
				this.destroy();
			});

		// Fade in the text
		this.tweens.add({
			targets: description,
			alpha: 1,
			duration: 200,
		});
	}

	// Clean up old message boxes
	this.children.each((child) => {
		if (child.getData("destroyTimer")) {
			if (
				this.time.now >
				child.getData("createTime") + child.getData("destroyTimer")
			) {
				this.tweens.add({
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
