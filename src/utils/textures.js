const SAMPLE_MARGIN = 2;

export function createTransparentTexture(scene, key, sourceKey, tolerance = 40) {
	// Idempotency guard — if this already ran (e.g. scene restarted before
	// this fix), don't reprocess or remove a working texture.
	if (scene.textures.exists(key)) return;

	if (!scene.textures.exists(sourceKey)) {
		console.warn(`Texture key ${sourceKey} does not exist.`);
		return;
	}

	const sourceTexture = scene.textures.get(sourceKey).getSourceImage();
	if (!sourceTexture || !sourceTexture.width || !sourceTexture.height) {
		console.error("Failed to find a valid source image for key:", sourceKey);
		return;
	}

	const canvas = document.createElement("canvas");
	canvas.width = sourceTexture.width;
	canvas.height = sourceTexture.height;
	const ctx = canvas.getContext("2d");
	ctx.drawImage(sourceTexture, 0, 0);

	const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const data = imgData.data;
	const w = canvas.width;
	const h = canvas.height;

	const samplePoints = [
		[SAMPLE_MARGIN, SAMPLE_MARGIN],
		[w - 1 - SAMPLE_MARGIN, SAMPLE_MARGIN],
		[SAMPLE_MARGIN, h - 1 - SAMPLE_MARGIN],
		[w - 1 - SAMPLE_MARGIN, h - 1 - SAMPLE_MARGIN],
		[Math.floor(w / 2), SAMPLE_MARGIN],
		[Math.floor(w / 2), h - 1 - SAMPLE_MARGIN],
		[SAMPLE_MARGIN, Math.floor(h / 2)],
		[w - 1 - SAMPLE_MARGIN, Math.floor(h / 2)],
	];

	const samples = [];
	for (const [x, y] of samplePoints) {
		const i = (y * w + x) * 4;
		if (data[i + 3] > 50) samples.push(`${data[i]},${data[i + 1]},${data[i + 2]}`);
	}

	if (samples.length === 0) {
		console.warn(
			`Chroma-key: no opaque background pixels sampled for "${sourceKey}" — ` +
			`registering the source image as-is (no keying applied) so the sprite still renders.`,
		);
		// CRITICAL FIX: still register the destination key. A sprite must
		// never be able to reference a texture key that doesn't exist.
		scene.textures.addCanvas(key, canvas);
		return;
	}

	const counts = {};
	let bg = samples[0];
	let bestCount = 0;
	for (const s of samples) {
		counts[s] = (counts[s] || 0) + 1;
		if (counts[s] > bestCount) { bestCount = counts[s]; bg = s; }
	}
	const [bgR, bgG, bgB] = bg.split(",").map(Number);

	for (let i = 0; i < data.length; i += 4) {
		const dist = Math.sqrt(
			(data[i] - bgR) ** 2 + (data[i + 1] - bgG) ** 2 + (data[i + 2] - bgB) ** 2,
		);
		if (dist < tolerance) data[i + 3] = 0;
	}
	ctx.putImageData(imgData, 0, 0);

	scene.textures.addCanvas(key, canvas);
}
