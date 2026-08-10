/**
 * AudioManager — Phaser Sound Manager wrapper for The Last Whiskers.
 *
 * Design goals (Phase 4B):
 *  - All sound file paths live in SOUND_CONFIG below. Dropping in real audio
 *    files is a data change, not a code change.
 *  - If a referenced audio file is missing or fails to load, we warn and
 *    continue — no crash, no thrown exception.
 *  - Mute state is in-memory only (resets on reload) — no localStorage.
 *  - Sounds don't stack / spam on rapid input; each sound type has a minimum
 *    interval and/or is played as a single instance.
 *
 * Usage:
 *   // In PreloadScene.preload():
 *   preloadAudio(this);
 *
 *   // In each game scene's create():
 *   this.audio = new AudioManager(this);
 *   this.audio.startAmbience();
 *   this.audio.startBirds();   // random chirping
 *
 *   // Then call as needed:
 *   this.audio.playFootstep();
 *   this.audio.playInteract();
 *   this.audio.playPageTurn();
 *   this.audio.stopAmbience();
 */

// ---------------------------------------------------------------------------
// Sound config — edit file paths / volumes here; no other code changes needed.
// ---------------------------------------------------------------------------
export const SOUND_CONFIG = {
	footstep: {
		key: "sfx-footstep",
		path: "../assets/sounds/footstep.mp3",
		volume: 0.1,
		/**
		 * Minimum ms between successive footstep plays.
		 * Keep this close to (or slightly below) the footstep audio clip's own
		 * duration so steps sound continuous but never overlap/stack.
		 */
		minInterval: 180,
	},
	interact: {
		key: "sfx-interact",
		path: "../assets/sounds/interact_chime.mp3",
		volume: 0.5,
		minInterval: 300,
	},
	pageTurn: {
		key: "sfx-page-turn",
		path: "../assets/sounds/page_turn.mp3",
		volume: 0.45,
		minInterval: 200,
	},
	ambience: {
		key: "sfx-ambience",
		// NOTE: filename uses a hyphen, not an underscore
		path: "../assets/sounds/room-ambience.mp3",
		volume: 0.18,
		loop: true,
	},
	birds: {
		key: "sfx-birds",
		path: "../assets/sounds/bird-chirping.mp3",
		volume: 0.4,
		/**
		 * Random interval range (ms) between individual bird chirp plays.
		 * A new random delay in [min, max] is chosen after each chirp finishes.
		 */
		intervalMin: 8000,
		intervalMax: 22000,
	},
};

// ---------------------------------------------------------------------------
// Preload helper — call from PreloadScene (or any preloading scene)
// ---------------------------------------------------------------------------

/**
 * Registers all sound files with Phaser's loader.
 * Missing files are handled gracefully via the 'loaderror' event.
 * @param {Phaser.Scene} scene
 */
export function preloadAudio(scene) {
	// Track which keys failed to load so AudioManager can skip them
	scene.load.on("loaderror", (fileObj) => {
		if (fileObj.type === "audio") {
			console.warn(
				`[AudioManager] Audio file not found, will be skipped: ${fileObj.src}`,
			);
			// Tag the key so AudioManager knows not to play it
			if (!scene.registry) return;
			const failed = scene.registry.get("_audio_failed") || [];
			failed.push(fileObj.key);
			scene.registry.set("_audio_failed", failed);
		}
	});

	Object.values(SOUND_CONFIG).forEach(({ key, path }) => {
		scene.load.audio(key, path);
	});
}

// ---------------------------------------------------------------------------
// AudioManager class
// ---------------------------------------------------------------------------

export default class AudioManager {
	/**
	 * @param {Phaser.Scene} scene - The owning game scene.
	 */
	constructor(scene) {
		this.scene = scene;
		this.soundManager = scene.sound;

		/** @type {boolean} Global mute state (in-memory, resets on reload) */
		this._muted = false;

		/** @type {Phaser.Sound.BaseSound|null} Looping ambience instance */
		this._ambienceSound = null;

		/** @type {Phaser.Time.TimerEvent|null} Bird chirp scheduler */
		this._birdTimer = null;

		/** @type {Map<string, number>} Last-played timestamps for spam prevention */
		this._lastPlayed = new Map();

		/** @type {Set<string>} Keys that failed to load */
		this._failedKeys = new Set(scene.registry?.get("_audio_failed") || []);

		// Clean up everything when scene shuts down or is destroyed
		scene.events.once("shutdown", () => this._stopAll());
		scene.events.once("destroy", () => this._stopAll());
	}

	// ---------------------------------------------------------------------------
	// Public API — Ambience
	// ---------------------------------------------------------------------------

	/** Start the looping ambient room tone. */
	startAmbience() {
		if (this._ambienceSound) return; // already playing
		const cfg = SOUND_CONFIG.ambience;
		if (!this._canPlay(cfg.key)) return;

		try {
			this._ambienceSound = this.soundManager.add(cfg.key, {
				loop: true,
				volume: this._muted ? 0 : cfg.volume,
			});
			this._ambienceSound.play();
		} catch (e) {
			console.warn(`[AudioManager] Could not start ambience: ${e.message}`);
			this._ambienceSound = null;
		}
	}

	/** Stop the ambience, optionally fading out. */
	stopAmbience(fadeDuration = 800) {
		if (!this._ambienceSound) return;
		const snd = this._ambienceSound;
		this._ambienceSound = null;

		if (fadeDuration > 0 && this.scene?.tweens) {
			this.scene.tweens.add({
				targets: snd,
				volume: 0,
				duration: fadeDuration,
				onComplete: () => {
					try {
						snd.stop();
					} catch (_) {}
				},
			});
		} else {
			try {
				snd.stop();
			} catch (_) {}
		}
	}

	/** Fade out current ambience and restart it (e.g. on room transition). */
	crossfadeAmbience(fadeDuration = 800) {
		this.stopAmbience(fadeDuration);
		this.scene.time.delayedCall(fadeDuration, () => this.startAmbience());
	}

	// ---------------------------------------------------------------------------
	// Public API — Random bird chirping
	// ---------------------------------------------------------------------------

	/**
	 * Start random periodic bird chirps. Each chirp is followed by a random
	 * delay in [intervalMin, intervalMax] ms before the next one plays.
	 * Safe to call multiple times — won't schedule a second timer if one exists.
	 */
	startBirds() {
		if (this._birdTimer) return; // already scheduled
		const cfg = SOUND_CONFIG.birds;
		if (!this._canPlay(cfg.key)) return;

		// Play immediately on first call, then schedule randomly
		this._chirpOnce();
	}

	/** Stop the random bird chirp scheduler. */
	stopBirds() {
		if (this._birdTimer) {
			this._birdTimer.remove(false);
			this._birdTimer = null;
		}
	}

	// ---------------------------------------------------------------------------
	// Public API — One-shot sounds
	// ---------------------------------------------------------------------------

	/** Play a footstep sound. Call every frame while moving — it self-rate-limits. */
	playFootstep() {
		this._playOnce("footstep");
	}

	/** Play the soft chime on item interaction. */
	playInteract() {
		this._playOnce("interact");
	}

	/** Play the page-turn sound for album flips. */
	playPageTurn() {
		this._playOnce("pageTurn");
	}

	// ---------------------------------------------------------------------------
	// Public API — Mute
	// ---------------------------------------------------------------------------

	/**
	 * Toggle global mute. Returns the new mute state.
	 * @returns {boolean} true = now muted
	 */
	toggleMute() {
		this._muted = !this._muted;

		// Apply to looping ambience immediately (volume 0 = silent but still running)
		if (this._ambienceSound) {
			this._ambienceSound.setVolume(
				this._muted ? 0 : SOUND_CONFIG.ambience.volume,
			);
		}

		// Phaser's global mute flag covers all other sounds (one-shots + birds)
		this.soundManager.mute = this._muted;
		return this._muted;
	}

	/** @returns {boolean} */
	get isMuted() {
		return this._muted;
	}

	// ---------------------------------------------------------------------------
	// Internals
	// ---------------------------------------------------------------------------

	/**
	 * Play a single bird chirp and schedule the next one after a random delay.
	 * @private
	 */
	_chirpOnce() {
		if (!this.scene?.time) return; // scene already destroyed
		const cfg = SOUND_CONFIG.birds;

		if (!this._muted && this._canPlay(cfg.key)) {
			try {
				this.soundManager.play(cfg.key, { volume: cfg.volume });
			} catch (e) {
				console.warn(`[AudioManager] Could not play birds: ${e.message}`);
			}
		}

		// Schedule the next chirp at a random interval
		const delay = Phaser.Math.Between(cfg.intervalMin, cfg.intervalMax);
		this._birdTimer = this.scene.time.delayedCall(delay, () => {
			this._birdTimer = null;
			this._chirpOnce();
		});
	}

	/**
	 * Play a one-shot sound by config key, respecting spam interval + mute.
	 * @param {string} configKey - key in SOUND_CONFIG
	 * @private
	 */
	_playOnce(configKey) {
		if (this._muted) return;
		const cfg = SOUND_CONFIG[configKey];
		if (!cfg) return;
		if (!this._canPlay(cfg.key)) return;

		const now = Date.now();
		const last = this._lastPlayed.get(configKey) || 0;
		if (cfg.minInterval && now - last < cfg.minInterval) return;
		this._lastPlayed.set(configKey, now);

		try {
			this.soundManager.play(cfg.key, { volume: cfg.volume });
		} catch (e) {
			console.warn(`[AudioManager] Could not play "${cfg.key}": ${e.message}`);
		}
	}

	/**
	 * Returns false if the key failed to load or isn't in the audio cache.
	 * Prevents Phaser errors on missing/placeholder assets.
	 * @param {string} key
	 * @private
	 */
	_canPlay(key) {
		if (this._failedKeys.has(key)) return false;
		// Check Phaser's audio cache — safest cross-version approach
		if (!this.scene.cache.audio.has(key)) return false;
		return true;
	}

	/** Stop everything and cancel the bird timer. */
	_stopAll() {
		this.stopBirds();
		this.stopAmbience(0);
	}
}
