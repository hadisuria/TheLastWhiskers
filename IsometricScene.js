// This file shows how to implement isometric movement in Phaser
// Replace the relevant parts in the main game code to convert to isometric

class IsometricScene extends Phaser.Scene {
	constructor() {
		super("IsometricScene");

		// Isometric projection constants
		this.isoSize = 64; // The tile size in pixels
	}

	preload() {
		// Load isometric tileset and sprites
		// this.load.image("isoFloor", "assets/iso-floor.png");
		this.load.image("isoFloor", "assets/Isometric/floor_E.png");
		this.load.image("isoWall", "assets/isometric/wall_E.png");
		this.load.image("isoTable", "assets/isometric/block_E.png");
		this.load.image("isoBookshelf", "assets/isometric/iso-bookshelf.png");
		this.load.image("isoPlant", "assets/isometric/iso-plant.png");
		this.load.spritesheet("isoPlayer", "assets/isometric/iso-player.png", {
			frameWidth: 64,
			frameHeight: 64,
		});
	}

	create() {
		// Create isometric tile map
		this.createIsometricMap();

		// Create player with isometric movement
		this.createPlayer();

		// Create interactable items
		this.createItems();

		// Setup controls
		this.cursors = this.input.keyboard.createCursorKeys();
		this.interactKey = this.input.keyboard.addKey("E");

		// UI elements
		this.setupUI();
	}

	createIsometricMap() {
		// Create a simple grid of floor tiles
		this.floorGroup = this.add.group();

		// For a simple 8x8 room
		for (let y = 0; y < 8; y++) {
			for (let x = 0; x < 8; x++) {
				// Convert grid coordinates to isometric screen coordinates
				const screenX = (x - y) * (this.isoSize / 2);
				const screenY = (x + y) * (this.isoSize / 4);

				// Create floor tile
				const tile = this.add.image(
					screenX + 400, // Center offset
					screenY + 200, // Center offset
					"isoFloor"
				);

				// Store grid position for collision detection
				tile.setData("gridX", x);
				tile.setData("gridY", y);

				this.floorGroup.add(tile);
			}
		}

		// Add walls around the edges
		this.createWalls();
	}

	createWalls() {
		// Create walls around the perimeter (simplified)
		this.wallGroup = this.add.group();

		// Example: North and East walls
		for (let x = 0; x < 8; x++) {
			// North wall (y = 0)
			const northWallX = (x - 0) * (this.isoSize / 2);
			const northWallY = (x + 0) * (this.isoSize / 4) - 32; // Lifted up

			const northWall = this.add.image(
				northWallX + 400,
				northWallY + 200,
				"isoWall"
			);

			this.wallGroup.add(northWall);

			// East wall (x = 7)
			if (x < 7) {
				// Skip corner which is already covered
				const eastWallX = (7 - x) * (this.isoSize / 2);
				const eastWallY = (7 + x) * (this.isoSize / 4) - 32; // Lifted up

				const eastWall = this.add.image(
					eastWallX + 400,
					eastWallY + 200,
					"isoWall"
				);

				// Rotate east wall appropriately
				eastWall.setRotation(Math.PI / 2);

				this.wallGroup.add(eastWall);
			}
		}
	}

	createPlayer() {
		// Create player sprite at isometric center
		this.player = this.add.sprite(400, 300, "isoPlayer");

		// Store grid position
		this.player.gridX = 4;
		this.player.gridY = 4;

		// Update screen position based on grid position
		this.updatePlayerPosition();

		// Create animations for 4 directions
		this.createPlayerAnimations();
	}

	createPlayerAnimations() {
		// Create animations for each direction
		// This is a placeholder - you'll need to adapt based on your spritesheet
		this.anims.create({
			key: "walk-north",
			frames: this.anims.generateFrameNumbers("isoPlayer", {
				start: 0,
				end: 3,
			}),
			frameRate: 10,
			repeat: -1,
		});

		this.anims.create({
			key: "walk-east",
			frames: this.anims.generateFrameNumbers("isoPlayer", {
				start: 4,
				end: 7,
			}),
			frameRate: 10,
			repeat: -1,
		});

		this.anims.create({
			key: "walk-south",
			frames: this.anims.generateFrameNumbers("isoPlayer", {
				start: 8,
				end: 11,
			}),
			frameRate: 10,
			repeat: -1,
		});

		this.anims.create({
			key: "walk-west",
			frames: this.anims.generateFrameNumbers("isoPlayer", {
				start: 12,
				end: 15,
			}),
			frameRate: 10,
			repeat: -1,
		});

		// Idle animation
		this.anims.create({
			key: "idle",
			frames: [{ key: "isoPlayer", frame: 0 }],
			frameRate: 10,
		});
	}

	createItems() {
		// Create interactable items
		this.interactableItems = [];

		// Table in the center
		const table = this.add.image(400, 280, "isoTable");
		table.gridX = 4;
		table.gridY = 3;
		table.name = "table";
		table.description = "A traditional Japanese tea table with cushions.";
		this.interactableItems.push(table);

		// Bookshelf on the west side
		const bookshelf = this.add.image(300, 250, "isoBookshelf");
		bookshelf.gridX = 2;
		bookshelf.gridY = 2;
		bookshelf.name = "bookshelf";
		bookshelf.description = "A wooden bookshelf filled with scrolls and books.";
		this.interactableItems.push(bookshelf);

		// Plant on the east side
		const plant = this.add.image(500, 250, "isoPlant");
		plant.gridX = 6;
		plant.gridY = 2;
		plant.name = "plant";
		plant.description = "A carefully maintained bonsai plant.";
		this.interactableItems.push(plant);
	}

	setupUI() {
		// Interaction text
		this.interactText = this.add
			.text(400, 500, "", {
				fontSize: "16px",
				fill: "#fff",
				backgroundColor: "#000",
				padding: { x: 10, y: 5 },
			})
			.setOrigin(0.5);
		this.interactText.setVisible(false);

		// Instructions
		this.add
			.text(
				400,
				50,
				"Use arrow keys to move. Press E to interact with items.",
				{
					fontSize: "16px",
					fill: "#fff",
					backgroundColor: "#000",
					padding: { x: 10, y: 5 },
				}
			)
			.setOrigin(0.5);
	}

	update() {
		// Handle player movement in grid
		let newGridX = this.player.gridX;
		let newGridY = this.player.gridY;
		let isMoving = false;

		if (this.cursors.left.isDown) {
			newGridX--;
			newGridY--;
			this.player.anims.play("walk-west", true);
			isMoving = true;
		} else if (this.cursors.right.isDown) {
			newGridX++;
			newGridY++;
			this.player.anims.play("walk-east", true);
			isMoving = true;
		}

		if (this.cursors.up.isDown) {
			newGridX++;
			newGridY--;
			this.player.anims.play("walk-north", true);
			isMoving = true;
		} else if (this.cursors.down.isDown) {
			newGridX--;
			newGridY++;
			this.player.anims.play("walk-south", true);
			isMoving = true;
		}

		// If not moving, play idle animation
		if (!isMoving) {
			this.player.anims.play("idle", true);
		}

		// Update player position if valid move
		if (this.isValidMove(newGridX, newGridY)) {
			this.player.gridX = newGridX;
			this.player.gridY = newGridY;
			this.updatePlayerPosition();
		}

		// Check for interaction with items
		this.checkItemInteraction();
	}

	updatePlayerPosition() {
		// Convert grid position to screen coordinates
		const screenX =
			(this.player.gridX - this.player.gridY) * (this.isoSize / 2);
		const screenY =
			(this.player.gridX + this.player.gridY) * (this.isoSize / 4);

		// Update player position with smooth movement
		this.tweens.add({
			targets: this.player,
			x: screenX + 400,
			y: screenY + 200,
			duration: 100,
			ease: "Linear",
		});

		// Update depth sorting based on y-coordinate (further down = on top)
		this.player.setDepth(this.player.y);
	}

	isValidMove(gridX, gridY) {
		// Check boundaries
		if (gridX < 0 || gridX > 7 || gridY < 0 || gridY > 7) {
			return false;
		}

		// Check collision with items
		for (const item of this.interactableItems) {
			if (item.gridX === gridX && item.gridY === gridY) {
				return false;
			}
		}

		return true;
	}

	checkItemInteraction() {
		// Reset active item
		this.activeItem = null;
		this.interactText.setVisible(false);

		// Check proximity to items
		for (const item of this.interactableItems) {
			if (
				Math.abs(this.player.gridX - item.gridX) <= 1 &&
				Math.abs(this.player.gridY - item.gridY) <= 1
			) {
				this.activeItem = item;
				this.interactText.setText(`Press E to examine the ${item.name}`);
				this.interactText.setVisible(true);
				break;
			}
		}

		// Handle interaction
		if (Phaser.Input.Keyboard.JustDown(this.interactKey) && this.activeItem) {
			this.showItemDescription(this.activeItem);
		}
	}

	showItemDescription(item) {
		// Create description text
		const descText = this.add
			.text(400, 350, item.description, {
				fontSize: "18px",
				fill: "#fff",
				backgroundColor: "#000",
				padding: { x: 15, y: 10 },
				wordWrap: { width: 500 },
			})
			.setOrigin(0.5)
			.setDepth(1000)
			.setAlpha(0)
			.setData("destroyTimer", 3000)
			.setData("createTime", this.time.now)
			.setInteractive()
			.on("pointerdown", function () {
				this.destroy();
			});

		// Fade in
		this.tweens.add({
			targets: descText,
			alpha: 1,
			duration: 200,
		});
	}
}

// Configure the game
const config = {
	type: Phaser.AUTO,
	width: 800,
	height: 600,
	backgroundColor: "#5e3f6b",
	scene: [IsometricScene],
};

// Create and start the game
const game = new Phaser.Game(config);
