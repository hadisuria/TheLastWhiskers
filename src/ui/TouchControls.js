/**
 * TouchControls — On-screen D-pad + Interact button for mobile/touch devices.
 *
 * Architecture:
 *  - Creates DOM elements (not Phaser objects) overlaid on the canvas so they
 *    always sit on top regardless of Phaser's depth system.
 *  - Only shown when a touch device is detected (navigator.maxTouchPoints > 0
 *    OR any 'touchstart' event fires).
 *  - Exposes `touchVelocity` { x, y } and `interactPressed` flag that
 *    BaseRoomScene.handlePlayerMovement() merges with keyboard velocity.
 *  - The "H" debug overlay stays keyboard-only as specified.
 */
export default class TouchControls {
	/**
	 * @param {Phaser.Scene} scene - The owning Phaser scene (used for cleanup events).
	 * @param {number} speed - Movement speed to report (should match BaseRoomScene speed).
	 */
	constructor(scene, speed = 150) {
		this.scene = scene;
		this.speed = speed;

		/** @type {{ x: number, y: number }} Current touch-derived velocity */
		this.touchVelocity = { x: 0, y: 0 };

		/** @type {boolean} True for one update tick after the interact button is pressed */
		this.interactPressed = false;

		/** @type {Set<string>} Currently held directions: 'up'|'down'|'left'|'right' */
		this._held = new Set();

		/** @type {HTMLElement|null} */
		this._container = null;

		/** @type {boolean} Whether touch controls have been injected into the DOM */
		this._injected = false;

		// Check immediately; also listen for first touch in case detection is late
		if (this._isTouchDevice()) {
			this._inject();
		} else {
			const onFirstTouch = () => {
				window.removeEventListener('touchstart', onFirstTouch);
				if (!this._injected) this._inject();
			};
			window.addEventListener('touchstart', onFirstTouch, { passive: true });
			this._onFirstTouchListener = onFirstTouch;
		}

		// Clean up when the scene shuts down
		scene.events.once('shutdown', () => this.destroy());
		scene.events.once('destroy', () => this.destroy());
	}

	// ---------------------------------------------------------------------------
	// Detection
	// ---------------------------------------------------------------------------

	_isTouchDevice() {
		return (
			('ontouchstart' in window) ||
			(navigator.maxTouchPoints > 0) ||
			(navigator.msMaxTouchPoints > 0)
		);
	}

	// ---------------------------------------------------------------------------
	// DOM injection
	// ---------------------------------------------------------------------------

	_inject() {
		if (this._injected) return;
		this._injected = true;

		// Root overlay container — sits above the Phaser canvas
		const container = document.createElement('div');
		container.id = 'tlw-touch-controls';
		container.style.cssText = `
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			height: 200px;
			pointer-events: none;
			display: flex;
			justify-content: space-between;
			align-items: flex-end;
			padding: 16px 20px;
			box-sizing: border-box;
			z-index: 9999;
			user-select: none;
			-webkit-user-select: none;
		`;

		// D-pad
		const dpad = this._createDpad();
		container.appendChild(dpad);

		// Interact button
		const interactBtn = this._createInteractButton();
		container.appendChild(interactBtn);

		document.body.appendChild(container);
		this._container = container;
	}

	_createDpad() {
		const dpad = document.createElement('div');
		dpad.style.cssText = `
			position: relative;
			width: 150px;
			height: 150px;
			pointer-events: none;
		`;

		// Direction config: [direction, label, top, left]
		const directions = [
			['up',    '▲', '0px',    '50px'],
			['down',  '▼', '100px',  '50px'],
			['left',  '◀', '50px',   '0px'],
			['right', '▶', '50px',   '100px'],
		];

		directions.forEach(([dir, label, top, left]) => {
			const btn = document.createElement('button');
			btn.setAttribute('aria-label', `Move ${dir}`);
			btn.style.cssText = `
				position: absolute;
				top: ${top};
				left: ${left};
				width: 50px;
				height: 50px;
				border-radius: 8px;
				border: 2px solid rgba(212,175,55,0.6);
				background: rgba(42,28,18,0.72);
				color: #F7E9D7;
				font-size: 20px;
				line-height: 1;
				display: flex;
				align-items: center;
				justify-content: center;
				pointer-events: all;
				cursor: pointer;
				backdrop-filter: blur(4px);
				-webkit-backdrop-filter: blur(4px);
				transition: background 0.1s;
				touch-action: none;
			`;
			btn.textContent = label;

			const press = (e) => {
				e.preventDefault();
				this._held.add(dir);
				btn.style.background = 'rgba(212,175,55,0.45)';
			};
			const release = (e) => {
				e.preventDefault();
				this._held.delete(dir);
				btn.style.background = 'rgba(42,28,18,0.72)';
			};

			btn.addEventListener('touchstart', press, { passive: false });
			btn.addEventListener('touchend', release, { passive: false });
			btn.addEventListener('touchcancel', release, { passive: false });
			// Mouse fallback (dev-tools touch emulation sends mouse events too)
			btn.addEventListener('mousedown', press);
			btn.addEventListener('mouseup', release);
			btn.addEventListener('mouseleave', release);

			dpad.appendChild(btn);
		});

		return dpad;
	}

	_createInteractButton() {
		const btn = document.createElement('button');
		btn.setAttribute('aria-label', 'Interact');
		btn.style.cssText = `
			width: 80px;
			height: 80px;
			border-radius: 50%;
			border: 3px solid rgba(212,175,55,0.75);
			background: rgba(42,28,18,0.78);
			color: #F7E9D7;
			font-size: 15px;
			font-family: monospace;
			font-weight: bold;
			pointer-events: all;
			cursor: pointer;
			backdrop-filter: blur(4px);
			-webkit-backdrop-filter: blur(4px);
			transition: background 0.1s;
			touch-action: none;
			line-height: 1.2;
			letter-spacing: 0.05em;
		`;
		btn.textContent = 'E\n✦';

		const press = (e) => {
			e.preventDefault();
			this.interactPressed = true;
			btn.style.background = 'rgba(212,175,55,0.45)';
		};
		const release = (e) => {
			e.preventDefault();
			btn.style.background = 'rgba(42,28,18,0.78)';
		};

		btn.addEventListener('touchstart', press, { passive: false });
		btn.addEventListener('touchend', release, { passive: false });
		btn.addEventListener('touchcancel', release, { passive: false });
		btn.addEventListener('mousedown', press);
		btn.addEventListener('mouseup', release);
		btn.addEventListener('mouseleave', release);

		return btn;
	}

	// ---------------------------------------------------------------------------
	// Per-frame update — called by BaseRoomScene.handlePlayerMovement()
	// ---------------------------------------------------------------------------

	/**
	 * Recomputes `touchVelocity` from the currently held directions.
	 * Call once per frame before reading `touchVelocity`.
	 */
	update() {
		let vx = 0;
		let vy = 0;

		if (this._held.has('left'))  vx -= this.speed;
		if (this._held.has('right')) vx += this.speed;
		if (this._held.has('up'))    vy -= this.speed;
		if (this._held.has('down'))  vy += this.speed;

		// Normalize diagonal
		if (vx !== 0 && vy !== 0) {
			vx *= 0.7071;
			vy *= 0.7071;
		}

		this.touchVelocity = { x: vx, y: vy };
	}

	/**
	 * Consumes the interact press flag — returns true once per press.
	 * @returns {boolean}
	 */
	consumeInteract() {
		if (this.interactPressed) {
			this.interactPressed = false;
			return true;
		}
		return false;
	}

	// ---------------------------------------------------------------------------
	// Cleanup
	// ---------------------------------------------------------------------------

	destroy() {
		if (this._onFirstTouchListener) {
			window.removeEventListener('touchstart', this._onFirstTouchListener);
		}
		if (this._container && this._container.parentNode) {
			this._container.parentNode.removeChild(this._container);
		}
		this._container = null;
	}
}
