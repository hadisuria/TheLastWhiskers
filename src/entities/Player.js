import Phaser from 'phaser';
import { CONFIG } from '../config.js';

/**
 * Player Entity — Encapsulates physics body, inertial movement,
 * keyboard/touch/gamepad inputs, procedural trot animations,
 * dust particle emission, and footstep sound synchronization.
 */
export default class Player extends Phaser.Physics.Arcade.Sprite {
	/**
	 * @param {Phaser.Scene} scene
	 * @param {number} x
	 * @param {number} y
	 */
	constructor(scene, x, y) {
		super(scene, x, y, 'cat');

		scene.add.existing(this);
		scene.physics.add.existing(this);

		const pcfg = CONFIG.physics;
		this.setDisplaySize(pcfg.displaySize.width, pcfg.displaySize.height);

		// Record initial base scales so procedural squash/stretch multiplies cleanly
		this.baseScaleX = this.scaleX;
		this.baseScaleY = this.scaleY;

		// Configure physics body (we manage isotropic drag & max speed cleanly in handleMovement)
		this.body.setSize(pcfg.bodySize.width, pcfg.bodySize.height);
		this.body.setCollideWorldBounds(true);
		this.body.setDrag(0, 0);
		this.body.setMaxSpeed(pcfg.walkSpeed);

		// Movement & Stride animation state
		this.stridePhase = 0;
		this.lastStepPhase = 0;
		this.isFacingRight = false;
		this.isSprinting = false;

		// Input setup
		this.setupInputs();

		// Dust particle emitter reference (assigned by scene)
		this.dustEmitter = null;
	}

	setupInputs() {
		const keyboard = this.scene.input.keyboard;
		this.cursors = keyboard.createCursorKeys();
		this.wasd = keyboard.addKeys({
			up: Phaser.Input.Keyboard.KeyCodes.W,
			down: Phaser.Input.Keyboard.KeyCodes.S,
			left: Phaser.Input.Keyboard.KeyCodes.A,
			right: Phaser.Input.Keyboard.KeyCodes.D,
		});
		this.shiftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
	}

	setDustEmitter(emitter) {
		this.dustEmitter = emitter;
	}

	/**
	 * Main update loop called by the room scene.
	 * @param {number} time
	 * @param {number} delta
	 */
	update(time, delta) {
		const dt = delta / 1000;
		this.handleMovement(dt);
		this.updateProceduralAnimation(time, dt);
		this.updateFacing();
		this.updateDebug();
	}

	// ---------------------------------------------------------------------------
	// Movement & Physics
	// ---------------------------------------------------------------------------

	handleMovement(dt) {
		if (this.scene.isTransitioning) {
			this.body.setVelocity(0, 0);
			this.body.setAcceleration(0, 0);
			return;
		}

		const pcfg = CONFIG.physics;
		let inputX = 0;
		let inputY = 0;

		// 1. Keyboard Input
		if (this.cursors.left.isDown || this.wasd.left.isDown) {
			inputX -= 1;
		}
		if (this.cursors.right.isDown || this.wasd.right.isDown) {
			inputX += 1;
		}
		if (this.cursors.up.isDown || this.wasd.up.isDown) {
			inputY -= 1;
		}
		if (this.cursors.down.isDown || this.wasd.down.isDown) {
			inputY += 1;
		}

		// 2. Touch D-pad Input
		if (this.scene.touchControls) {
			this.scene.touchControls.update();
			const tv = this.scene.touchControls.touchVelocity;
			if (tv.x !== 0 || tv.y !== 0) {
				inputX = tv.x / pcfg.walkSpeed;
				inputY = tv.y / pcfg.walkSpeed;
				if (this.scene.moveTarget) this.scene.moveTarget = null;
			}
		}

		// 3. Gamepad Input (if connected)
		if (this.scene.input.gamepad && this.scene.input.gamepad.total > 0) {
			const pad = this.scene.input.gamepad.getPad(0);
			if (pad) {
				const stickX = pad.leftStick.x;
				const stickY = pad.leftStick.y;
				if (Math.abs(stickX) > 0.15) inputX = stickX;
				if (Math.abs(stickY) > 0.15) inputY = stickY;

				if (pad.left) inputX = -1;
				if (pad.right) inputX = 1;
				if (pad.up) inputY = -1;
				if (pad.down) inputY = 1;
			}
		}

		// 4. Tap-to-move destination navigation
		if (inputX !== 0 || inputY !== 0) {
			if (this.scene.moveTarget) this.scene.moveTarget = null;
		} else if (this.scene.moveTarget) {
			const dx = this.scene.moveTarget.x - this.x;
			const dy = this.scene.moveTarget.y - this.y;
			const dist = Math.sqrt(dx * dx + dy * dy);

			// Arrival threshold with delta buffer
			if (dist < Math.max(12, pcfg.walkSpeed * dt * 1.5)) {
				this.scene.moveTarget = null;
				this.body.setAcceleration(0, 0);
				this.body.setVelocity(0, 0);
				if (this.scene.pendingItemInteraction) {
					this.scene.tapInteractRequested = true;
					this.scene.pendingItemInteraction = null;
				}
				return;
			}

			inputX = dx / dist;
			inputY = dy / dist;
		}

		// Normalize input vector so diagonal speed matches cardinal speed
		const length = Math.sqrt(inputX * inputX + inputY * inputY);
		if (length > 1) {
			inputX /= length;
			inputY /= length;
		}

		// Check Sprint
		this.isSprinting = this.shiftKey.isDown && length > 0.1;
		const targetMaxSpeed = this.isSprinting ? pcfg.sprintSpeed : pcfg.walkSpeed;
		this.body.setMaxSpeed(targetMaxSpeed);
		this.body.setAcceleration(0, 0);

		if (length > 0.05) {
			const targetVx = inputX * targetMaxSpeed;
			const targetVy = inputY * targetMaxSpeed;
			const accelStep = pcfg.acceleration * (this.isSprinting ? 1.25 : 1.0) * dt;
			const dvx = targetVx - this.body.velocity.x;
			const dvy = targetVy - this.body.velocity.y;
			const dvLen = Math.sqrt(dvx * dvx + dvy * dvy);

			if (dvLen <= accelStep) {
				this.body.setVelocity(targetVx, targetVy);
			} else {
				this.body.setVelocity(
					this.body.velocity.x + (dvx / dvLen) * accelStep,
					this.body.velocity.y + (dvy / dvLen) * accelStep
				);
			}
		} else {
			// Smooth isotropic drag deceleration toward (0, 0)
			const dragStep = pcfg.drag * dt;
			const speed = this.body.velocity.length();
			if (speed <= dragStep) {
				this.body.setVelocity(0, 0);
			} else {
				const scale = (speed - dragStep) / speed;
				this.body.setVelocity(
					this.body.velocity.x * scale,
					this.body.velocity.y * scale
				);
			}
		}

		// Clamp exact Euclidean speed so diagonals never exceed targetMaxSpeed
		if (this.body.velocity.length() > targetMaxSpeed) {
			this.body.velocity.normalize().scale(targetMaxSpeed);
		}
	}

	// ---------------------------------------------------------------------------
	// Procedural Animation (Squash, Stretch, Trot & Dust)
	// ---------------------------------------------------------------------------

	updateProceduralAnimation(time, dt) {
		const vx = this.body.velocity.x;
		const vy = this.body.velocity.y;
		const speed = Math.sqrt(vx * vx + vy * vy);
		const isMoving = speed > 10;
		const acfg = CONFIG.animation;

		if (isMoving) {
			// Walking/Trotting Cycle
			const strideRate = (speed / CONFIG.physics.walkSpeed) * (this.isSprinting ? 16 : 11);
			this.stridePhase += dt * strideRate;

			const bounce = Math.sin(this.stridePhase);
			const absBounce = Math.abs(bounce);

			// Dynamic squash and stretch
			const trotCfg = acfg.trot;
			const targetScaleY = this.baseScaleY * (1 - (1 - trotCfg.scaleY) * absBounce);
			const targetScaleX = this.baseScaleX * (1 + (trotCfg.scaleX - 1) * absBounce);
			this.setScale(this.isFacingRight ? -targetScaleX : targetScaleX, targetScaleY);

			// Jaunty cat trot tilt (tilt back and forth on alternate steps)
			const tilt = Math.cos(this.stridePhase * 0.5) * trotCfg.tiltAngle;
			this.setAngle(this.isFacingRight ? -tilt : tilt);

			// Detect footstep / ground contact (stridePhase crossing pi multiples)
			const currentStepIndex = Math.floor(this.stridePhase / Math.PI);
			if (currentStepIndex > this.lastStepPhase) {
				this.lastStepPhase = currentStepIndex;
				this.onStep(this.isSprinting);
			}
		} else {
			// Idle Breathing Cycle
			this.stridePhase = 0;
			this.lastStepPhase = 0;

			const idleCfg = acfg.idle;
			const breath = Math.sin((time / idleCfg.duration) * Math.PI * 2);
			const breathScaleY = this.baseScaleY * (1 + (idleCfg.scaleY - 1) * breath);
			const breathScaleX = this.baseScaleX * (1 - (1 - idleCfg.scaleX) * breath);
			this.setScale(this.isFacingRight ? -breathScaleX : breathScaleX, breathScaleY);

			// Return angle smoothly to 0
			if (Math.abs(this.angle) > 0.1) {
				this.setAngle(Phaser.Math.Linear(this.angle, 0, dt * 10));
			} else {
				this.setAngle(0);
			}
		}
	}

	onStep(isSprinting) {
		// 1. Play pitch-varied footstep sound
		if (this.scene.audio) {
			const rate = isSprinting
				? Phaser.Math.FloatBetween(1.08, 1.18)
				: Phaser.Math.FloatBetween(0.94, 1.06);
			this.scene.audio.playFootstep(rate);
		}

		// 2. Emit paw dust puff
		if (this.dustEmitter) {
			const offsetY = this.displayHeight * 0.35;
			this.dustEmitter.explode(isSprinting ? 3 : 2, this.x, this.y + offsetY);
		}
	}

	updateFacing() {
		const vx = this.body.velocity.x;
		if (vx < -5) {
			this.isFacingRight = false;
		} else if (vx > 5) {
			this.isFacingRight = true;
		}
	}

	// ---------------------------------------------------------------------------
	// Debug
	// ---------------------------------------------------------------------------

	updateDebug() {
		if (!CONFIG.debug.enabled) return;
		window.__debug = window.__debug || {};
		window.__debug.player = {
			x: Math.round(this.x),
			y: Math.round(this.y),
			vx: Math.round(this.body.velocity.x),
			vy: Math.round(this.body.velocity.y),
			speed: Math.round(this.body.velocity.length()),
			isSprinting: this.isSprinting,
			isFacingRight: this.isFacingRight,
			currentRoom: this.scene.scene.key,
		};
	}
}
