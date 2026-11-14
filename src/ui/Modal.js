import Phaser from "phaser";

/**
 * Shared Modal Lifecycle Helper
 * Handles depth-200 container creation, backdrop overlay, entrance/exit tweens,
 * keydown event listener, and clean container destruction.
 */
export function openModal(scene, options = {}) {
	const {
		overlayAlpha = 0.8,
		closeOnOverlayClick = true,
		closeOnEOrEscKey = true,
		buildContent,
		onKeyDown,
		onCloseStart,
		onClose,
	} = options;

	const prevBannerVisible = scene?.bannerText ? scene.bannerText.visible : false;

	if (scene?.interactText) {
		scene.interactText.setVisible(false);
	}
	if (scene?.bannerText) {
		scene.bannerText.setVisible(false);
	}
	if (scene?.coordText) {
		scene.coordText.setVisible(false);
	}

	// Depth-200 container
	const container = scene.add.container(0, 0).setDepth(200);

	let isClosing = false;

	const restoreSceneHud = () => {
		if (scene?.bannerText && scene.bannerText.active) {
			scene.bannerText.setVisible(prevBannerVisible);
		}
		if (scene?.coordText && scene.coordText.active && scene.showHelpOverlays) {
			scene.coordText.setVisible(true);
		}
	};

	const removeListeners = () => {
		window.removeEventListener("keydown", keyListener);
		if (scene && scene.events) {
			scene.events.off(Phaser.Scenes.Events.SHUTDOWN, handleSceneExit);
			scene.events.off(Phaser.Scenes.Events.SLEEP, handleSceneExit);
		}
	};

	const closeModal = () => {
		if (isClosing) return;
		isClosing = true;
		removeListeners();
		restoreSceneHud();
		if (scene) {
			if (scene.interactKey && typeof scene.interactKey.reset === "function") {
				scene.interactKey.reset();
			}
			scene.tapInteractRequested = false;
			if (scene.touchControls) {
				scene.touchControls.consumeInteract();
			}
		}
		if (onCloseStart) onCloseStart();

		scene.tweens.add({
			targets: container,
			y: 30,
			alpha: 0,
			duration: 200,
			ease: "Power2",
			onComplete: () => {
				if (container && container.active) {
					container.destroy();
				}
				if (onClose) onClose();
			},
		});
	};

	// Safety net: remove listeners and destroy container on scene shutdown or sleep
	const handleSceneExit = () => {
		if (isClosing) return;
		isClosing = true;
		removeListeners();
		restoreSceneHud();

		if (container && container.active) {
			container.destroy();
		}
		if (onClose) onClose();
	};

	if (scene && scene.events) {
		scene.events.once(Phaser.Scenes.Events.SHUTDOWN, handleSceneExit);
		scene.events.once(Phaser.Scenes.Events.SLEEP, handleSceneExit);
	}

	// Semi-transparent backdrop overlay
	const overlay = scene.add
		.rectangle(400, 300, 800, 600, 0x000000, overlayAlpha)
		.setInteractive();

	if (closeOnOverlayClick) {
		overlay.on("pointerdown", () => closeModal());
	}

	container.add(overlay);

	// Custom content population
	if (buildContent) {
		buildContent(container, closeModal);
	}

	// Entrance tween (y: 50 -> 0, alpha: 0 -> 1, Back.easeOut, 250ms)
	container.y = 50;
	container.alpha = 0;
	scene.tweens.add({
		targets: container,
		y: 0,
		alpha: 1,
		duration: 250,
		ease: "Back.easeOut",
	});

	// Keydown listener
	const keyListener = (event) => {
		if (event.repeat) return;
		if (closeOnEOrEscKey && (event.key === "e" || event.key === "E" || event.key === "Escape")) {
			closeModal();
			return;
		}
		if (onKeyDown) {
			onKeyDown(event, closeModal);
		}
	};
	window.addEventListener("keydown", keyListener);

	return { container, closeModal };
}
