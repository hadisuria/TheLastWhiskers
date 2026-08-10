import Phaser from "phaser";

/**
 * Shared Modal Lifecycle Helper
 * Handles depth-200 container creation, backdrop overlay, entrance/exit tweens,
 * keydown event listener, and clean container destruction.
 */
export function openModal(scene, options = {}) {
	const {
		overlayAlpha = 0.8,
		buildContent,
		onKeyDown,
		onClose,
	} = options;

	if (scene.interactText) {
		scene.interactText.setVisible(false);
	}

	// Depth-200 container
	const container = scene.add.container(0, 0).setDepth(200);

	let isClosing = false;

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

		if (container && container.active) {
			container.destroy();
		}
		if (onClose) onClose();
	};

	if (scene && scene.events) {
		scene.events.once(Phaser.Scenes.Events.SHUTDOWN, handleSceneExit);
		scene.events.once(Phaser.Scenes.Events.SLEEP, handleSceneExit);
	}

	// Semi-transparent click-to-close overlay
	const overlay = scene.add
		.rectangle(400, 300, 800, 600, 0x000000, overlayAlpha)
		.setInteractive()
		.on("pointerdown", () => closeModal());
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
		if (event.key === "e" || event.key === "E" || event.key === "Escape") {
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
