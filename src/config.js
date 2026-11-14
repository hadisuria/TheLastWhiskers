/**
 * Global Configuration for The Last Whiskers
 * Central source of truth for all physics, animation, audio, and gameplay tunables.
 */
export const CONFIG = {
	physics: {
		walkSpeed: 150,
		sprintSpeed: 235,
		acceleration: 950,
		drag: 800,
		damping: false, // Standard drag deceleration
		bodySize: { width: 30, height: 30 },
		displaySize: { width: 40, height: 40 },
	},

	interaction: {
		range: 85,
		promptOffsetY: -35,
		pulseDuration: 600,
	},

	animation: {
		idle: {
			duration: 1200,
			scaleY: 1.04,
			scaleX: 0.97,
			ease: 'Sine.easeInOut',
		},
		trot: {
			duration: 160,
			scaleY: 0.89,
			scaleX: 1.08,
			tiltAngle: 4.5, // degrees
		},
		sprintMultiplier: 1.4,
		dustIntervalWalk: 160,
		dustIntervalSprint: 100,
	},

	audio: {
		masterVolume: 1.0,
		channels: {
			sfx: 0.7,
			ambient: 0.35,
			music: 0.5,
		},
		footstep: {
			key: 'sfx-footstep',
			path: '../assets/sounds/footstep.mp3',
			baseVolume: 0.25,
			rateMin: 0.93,
			rateMax: 1.08,
		},
		interact: {
			key: 'sfx-interact',
			path: '../assets/sounds/interact_chime.mp3',
			baseVolume: 0.5,
		},
		pageTurn: {
			key: 'sfx-page-turn',
			path: '../assets/sounds/page_turn.mp3',
			baseVolume: 0.45,
		},
		doorSlide: {
			key: 'sfx-door-slide',
			path: '../assets/sounds/door-slide.wav',
			baseVolume: 0.4,
		},
		uiClick: {
			key: 'sfx-ui-click',
			path: '../assets/sounds/ui-click.wav',
			baseVolume: 0.3,
		},
		roomAmbience: {
			key: 'sfx-ambience',
			path: '../assets/sounds/room-ambience.mp3',
			baseVolume: 0.3,
			loop: true,
		},
		birds: {
			key: 'sfx-birds',
			path: '../assets/sounds/bird-chirping.mp3',
			baseVolume: 0.4,
			intervalMin: 7000,
			intervalMax: 18000,
		},
		crossfadeDuration: 800,
	},

	navigation: {
		// Destination URL when choosing "Exit Website" at the sliding shoji doors
		exitRedirectUrl: 'https://example.com',
	},

	debug: {
		enabled: true,
	},
};
