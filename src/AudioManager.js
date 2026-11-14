import Phaser from 'phaser';
import { CONFIG } from './config.js';

/**
 * AudioManager — Centralized audio controller for The Last Whiskers.
 * Supports volume channels, pitch variation, procedural synth fallbacks,
 * browser autoplay unlock, crossfading, and mute persistence.
 */
export const SOUND_CONFIG = CONFIG.audio;

export function preloadAudio(scene) {
	// Catch any audio loading errors gracefully so the game never crashes
	scene.load.on('loaderror', (fileObj) => {
		if (fileObj.type === 'audio') {
			console.warn(`[AudioManager] Audio file not found, will use fallback: ${fileObj.src}`);
			if (scene.registry) {
				const failed = scene.registry.get('_audio_failed') || [];
				failed.push(fileObj.key);
				scene.registry.set('_audio_failed', failed);
			}
		}
	});

	// Register sound assets from CONFIG.audio
	const audioEntries = [
		CONFIG.audio.footstep,
		CONFIG.audio.interact,
		CONFIG.audio.pageTurn,
		CONFIG.audio.doorSlide,
		CONFIG.audio.uiClick,
		CONFIG.audio.roomAmbience,
		CONFIG.audio.birds,
	];

	audioEntries.forEach((entry) => {
		if (entry && entry.key && entry.path) {
			scene.load.audio(entry.key, entry.path);
		}
	});
}

export default class AudioManager {
	/**
	 * @param {Phaser.Scene} scene - Active game scene.
	 */
	constructor(scene) {
		this.scene = scene;
		this.soundManager = scene.sound;

		// Read mute state from storage or default to false
		let savedMute = false;
		try {
			savedMute = localStorage.getItem('tlw_audio_muted') === 'true';
		} catch (_) {}
		this._muted = savedMute;

		// Channel volume scales
		this.channels = {
			master: CONFIG.audio.masterVolume,
			sfx: CONFIG.audio.channels.sfx,
			ambient: CONFIG.audio.channels.ambient,
			music: CONFIG.audio.channels.music,
		};

		this._ambienceSound = null;
		this._currentAmbienceKey = null;
		this._birdTimer = null;
		this._lastPlayed = new Map();
		this._unlocked = !this.soundManager.locked;

		this._failedKeys = new Set(scene.registry?.get('_audio_failed') || []);

		this._setupAudioUnlock();

		// Scene cleanup hook
		scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
		scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());

		this._updateDebugState();
	}

	// ---------------------------------------------------------------------------
	// Autoplay & Browser Audio Unlock
	// ---------------------------------------------------------------------------

	_setupAudioUnlock() {
		if (this._unlocked) {
			this._applyInitialMute();
			return;
		}

		const unlockHandler = () => {
			this._unlocked = true;
			this._applyInitialMute();
			this._updateDebugState();

			// If ambience was requested before unlock, start it now
			if (this._pendingAmbience) {
				const key = this._pendingAmbience;
				this._pendingAmbience = null;
				this.startAmbience(key);
			}
		};

		if (this.soundManager.locked) {
			this.soundManager.once(Phaser.Sound.Events.UNLOCKED, unlockHandler);

			// Also listen on window input as extra safety for all browser variants
			const onFirstGesture = () => {
				window.removeEventListener('pointerdown', onFirstGesture, true);
				window.removeEventListener('keydown', onFirstGesture, true);
				window.removeEventListener('touchstart', onFirstGesture, true);
				if (this.soundManager.context && this.soundManager.context.state === 'suspended') {
					this.soundManager.context.resume().then(() => {
						unlockHandler();
					}).catch(() => {});
				} else {
					unlockHandler();
				}
			};

			window.addEventListener('pointerdown', onFirstGesture, true);
			window.addEventListener('keydown', onFirstGesture, true);
			window.addEventListener('touchstart', onFirstGesture, true);
		}
	}

	_applyInitialMute() {
		this.soundManager.mute = this._muted;
		if (this._ambienceSound) {
			this._ambienceSound.setVolume(this._muted ? 0 : this._getEffectiveVolume('ambient', CONFIG.audio.roomAmbience.baseVolume));
		}
	}

	// ---------------------------------------------------------------------------
	// Public API — Ambience & Music Crossfade
	// ---------------------------------------------------------------------------

	/**
	 * Starts looping ambient room audio with optional fade-in.
	 * @param {string} [ambienceKey]
	 * @param {number} [fadeDuration=800]
	 */
	startAmbience(ambienceKey = CONFIG.audio.roomAmbience.key, fadeDuration = 800) {
		if (this._ambienceSound && this._currentAmbienceKey === ambienceKey && this._ambienceSound.isPlaying) {
			return;
		}

		if (!this._canPlay(ambienceKey)) {
			// If not unlocked yet or asset missing, defer
			if (this.soundManager.locked) {
				this._pendingAmbience = ambienceKey;
			}
			return;
		}

		const cfg = CONFIG.audio.roomAmbience;
		const targetVolume = this._muted ? 0 : this._getEffectiveVolume('ambient', cfg.baseVolume);

		// If another ambience is playing, crossfade out
		if (this._ambienceSound && this._ambienceSound.isPlaying) {
			const oldSnd = this._ambienceSound;
			if (this.scene?.tweens) {
				this.scene.tweens.add({
					targets: oldSnd,
					volume: 0,
					duration: fadeDuration,
					onComplete: () => {
						try { oldSnd.stop(); oldSnd.destroy(); } catch (_) {}
					},
				});
			} else {
				try { oldSnd.stop(); oldSnd.destroy(); } catch (_) {}
			}
		}

		try {
			this._ambienceSound = this.soundManager.add(ambienceKey, {
				loop: true,
				volume: 0,
			});
			this._currentAmbienceKey = ambienceKey;
			this._ambienceSound.play();

			if (fadeDuration > 0 && this.scene?.tweens) {
				this.scene.tweens.add({
					targets: this._ambienceSound,
					volume: targetVolume,
					duration: fadeDuration,
				});
			} else {
				this._ambienceSound.setVolume(targetVolume);
			}
		} catch (e) {
			console.warn(`[AudioManager] Could not play ambience: ${e.message}`);
			this._ambienceSound = null;
		}

		this._updateDebugState();
	}

	stopAmbience(fadeDuration = 800) {
		if (!this._ambienceSound) return;
		const snd = this._ambienceSound;
		this._ambienceSound = null;
		this._currentAmbienceKey = null;

		if (fadeDuration > 0 && this.scene?.tweens) {
			this.scene.tweens.add({
				targets: snd,
				volume: 0,
				duration: fadeDuration,
				onComplete: () => {
					try { snd.stop(); snd.destroy(); } catch (_) {}
				},
			});
		} else {
			try { snd.stop(); snd.destroy(); } catch (_) {}
		}
		this._updateDebugState();
	}

	// ---------------------------------------------------------------------------
	// Public API — Birds Scheduler
	// ---------------------------------------------------------------------------

	startBirds() {
		if (this._birdTimer) return;
		const cfg = CONFIG.audio.birds;
		if (!this._canPlay(cfg.key)) return;
		this._chirpOnce();
	}

	stopBirds() {
		if (this._birdTimer) {
			this._birdTimer.remove(false);
			this._birdTimer = null;
		}
	}

	_chirpOnce() {
		if (!this.scene?.time) return;
		const cfg = CONFIG.audio.birds;

		if (!this._muted && this._canPlay(cfg.key)) {
			try {
				const vol = this._getEffectiveVolume('ambient', cfg.baseVolume);
				this.soundManager.play(cfg.key, { volume: vol });
			} catch (_) {}
		}

		const delay = Phaser.Math.Between(cfg.intervalMin, cfg.intervalMax);
		this._birdTimer = this.scene.time.delayedCall(delay, () => {
			this._birdTimer = null;
			this._chirpOnce();
		});
	}

	// ---------------------------------------------------------------------------
	// Public API — Sound Effects with Pitch Variation & Synth Fallback
	// ---------------------------------------------------------------------------

	/**
	 * Plays a footstep sound with pitch randomization.
	 * @param {number} [customRate]
	 */
	playFootstep(customRate = null) {
		if (this._muted) return;
		const cfg = CONFIG.audio.footstep;
		const rate = customRate || Phaser.Math.FloatBetween(cfg.rateMin, cfg.rateMax);
		const vol = this._getEffectiveVolume('sfx', cfg.baseVolume);

		if (this._canPlay(cfg.key)) {
			try {
				this.soundManager.play(cfg.key, { volume: vol, rate });
			} catch (_) {}
		} else {
			// Procedural audio fallback (gentle floor tap)
			this._synthesizeTap(180, 0.04, vol * 0.4);
		}
	}

	/**
	 * Plays item interaction chime.
	 */
	playInteract() {
		if (this._muted) return;
		const cfg = CONFIG.audio.interact;
		const vol = this._getEffectiveVolume('sfx', cfg.baseVolume);
		if (this._canPlay(cfg.key)) {
			try {
				this.soundManager.play(cfg.key, { volume: vol });
			} catch (_) {}
		} else {
			this._synthesizeChime(vol);
		}
	}

	/**
	 * Plays photo album page turn sound.
	 */
	playPageTurn() {
		if (this._muted) return;
		const cfg = CONFIG.audio.pageTurn;
		const vol = this._getEffectiveVolume('sfx', cfg.baseVolume);
		if (this._canPlay(cfg.key)) {
			try {
				this.soundManager.play(cfg.key, { volume: vol });
			} catch (_) {}
		} else {
			this._synthesizeWhoosh(vol);
		}
	}

	/**
	 * Plays wooden sliding shoji door SFX.
	 */
	playDoorSlide() {
		if (this._muted) return;
		const cfg = CONFIG.audio.doorSlide;
		const vol = this._getEffectiveVolume('sfx', cfg.baseVolume);
		if (this._canPlay(cfg.key)) {
			try {
				this.soundManager.play(cfg.key, { volume: vol });
			} catch (_) {}
		} else {
			this._synthesizeDoorSlide(vol);
		}
	}

	/**
	 * Plays button / UI click SFX.
	 */
	playUIClick() {
		if (this._muted) return;
		const cfg = CONFIG.audio.uiClick;
		const vol = this._getEffectiveVolume('sfx', cfg.baseVolume);
		if (this._canPlay(cfg.key)) {
			try {
				this.soundManager.play(cfg.key, { volume: vol });
			} catch (_) {}
		} else {
			this._synthesizeTap(600, 0.02, vol * 0.5);
		}
	}

	// ---------------------------------------------------------------------------
	// Procedural Web Audio Synthesizers (Guaranteed Zero-Asset Fallback)
	// ---------------------------------------------------------------------------

	_getAudioContext() {
		return this.soundManager?.context || (window.AudioContext ? new window.AudioContext() : null);
	}

	_synthesizeTap(frequency = 200, duration = 0.05, volume = 0.1) {
		const ctx = this._getAudioContext();
		if (!ctx || ctx.state !== 'running') return;
		try {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = 'triangle';
			osc.frequency.setValueAtTime(frequency, ctx.currentTime);
			osc.frequency.exponentialRampToValueAtTime(frequency * 0.4, ctx.currentTime + duration);
			gain.gain.setValueAtTime(volume, ctx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start();
			osc.stop(ctx.currentTime + duration);
		} catch (_) {}
	}

	_synthesizeChime(volume = 0.2) {
		const ctx = this._getAudioContext();
		if (!ctx || ctx.state !== 'running') return;
		try {
			[523.25, 659.25, 783.99].forEach((freq, idx) => {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				const startTime = ctx.currentTime + idx * 0.06;
				const duration = 0.35;
				osc.type = 'sine';
				osc.frequency.setValueAtTime(freq, startTime);
				gain.gain.setValueAtTime(volume * 0.4, startTime);
				gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.start(startTime);
				osc.stop(startTime + duration);
			});
		} catch (_) {}
	}

	_synthesizeDoorSlide(volume = 0.25) {
		const ctx = this._getAudioContext();
		if (!ctx || ctx.state !== 'running') return;
		try {
			// Filtered noise burst simulating wooden friction
			const bufferSize = ctx.sampleRate * 0.35;
			const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
			const output = buffer.getChannelData(0);
			for (let i = 0; i < bufferSize; i++) {
				output[i] = Math.random() * 2 - 1;
			}
			const whiteNoise = ctx.createBufferSource();
			whiteNoise.buffer = buffer;

			const filter = ctx.createBiquadFilter();
			filter.type = 'bandpass';
			filter.frequency.value = 450;
			filter.Q.value = 1.8;

			const gain = ctx.createGain();
			gain.gain.setValueAtTime(volume * 0.5, ctx.currentTime);
			gain.gain.linearRampToValueAtTime(volume * 0.7, ctx.currentTime + 0.15);
			gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

			whiteNoise.connect(filter);
			filter.connect(gain);
			gain.connect(ctx.destination);
			whiteNoise.start();
		} catch (_) {}
	}

	_synthesizeWhoosh(volume = 0.2) {
		this._synthesizeDoorSlide(volume * 0.7);
	}

	// ---------------------------------------------------------------------------
	// Volume, Mute & Channels
	// ---------------------------------------------------------------------------

	_getEffectiveVolume(channel, baseVolume = 1.0) {
		const chVol = this.channels[channel] !== undefined ? this.channels[channel] : 1.0;
		return Math.max(0, Math.min(1, baseVolume * chVol * this.channels.master));
	}

	setChannelVolume(channel, volume) {
		if (this.channels[channel] !== undefined) {
			this.channels[channel] = Math.max(0, Math.min(1, volume));
			if (channel === 'ambient' && this._ambienceSound) {
				const vol = this._muted ? 0 : this._getEffectiveVolume('ambient', CONFIG.audio.roomAmbience.baseVolume);
				this._ambienceSound.setVolume(vol);
			}
			this._updateDebugState();
		}
	}

	toggleMute() {
		this._muted = !this._muted;
		try {
			localStorage.setItem('tlw_audio_muted', this._muted ? 'true' : 'false');
		} catch (_) {}

		if (this._ambienceSound) {
			const vol = this._muted ? 0 : this._getEffectiveVolume('ambient', CONFIG.audio.roomAmbience.baseVolume);
			this._ambienceSound.setVolume(vol);
		}
		this.soundManager.mute = this._muted;
		this._updateDebugState();
		return this._muted;
	}

	get isMuted() {
		return this._muted;
	}

	_canPlay(key) {
		if (this._failedKeys.has(key)) return false;
		if (!this.scene?.cache?.audio?.has(key)) return false;
		return true;
	}

	_updateDebugState() {
		if (!CONFIG.debug.enabled) return;
		window.__debug = window.__debug || {};
		window.__debug.audio = {
			muted: this._muted,
			unlocked: this._unlocked,
			ambiencePlaying: !!(this._ambienceSound && this._ambienceSound.isPlaying),
			currentAmbienceKey: this._currentAmbienceKey,
			channels: { ...this.channels },
		};
	}

	destroy() {
		this.stopBirds();
		this.stopAmbience(0);
	}
}
