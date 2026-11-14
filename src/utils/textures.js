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
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
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

/**
 * Flood-fills only the exterior backdrop connected to the image edges,
 * replacing it with transparency so isometric rooms blend into the UI theme
 * without affecting interior colors.
 */
export function keyExteriorBackdrop(scene, key, sourceKey, tolerance = 32) {
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
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	ctx.drawImage(sourceTexture, 0, 0);

	const w = canvas.width;
	const h = canvas.height;
	const imgData = ctx.getImageData(0, 0, w, h);
	const data = imgData.data;

	const bgR = data[0];
	const bgG = data[1];
	const bgB = data[2];
	const tolSq = tolerance * tolerance;

	const visited = new Uint8Array(w * h);
	const queue = new Int32Array(w * h);
	let head = 0;
	let tail = 0;

	const trySeed = (x, y) => {
		const idx = y * w + x;
		if (visited[idx]) return;
		const p = idx * 4;
		const dr = data[p] - bgR;
		const dg = data[p + 1] - bgG;
		const db = data[p + 2] - bgB;
		if (dr * dr + dg * dg + db * db <= tolSq) {
			visited[idx] = 1;
			queue[tail++] = idx;
		}
	};

	for (let x = 0; x < w; x++) {
		trySeed(x, 0);
		trySeed(x, h - 1);
	}
	for (let y = 1; y < h - 1; y++) {
		trySeed(0, y);
		trySeed(w - 1, y);
	}

	while (head < tail) {
		const idx = queue[head++];
		const p = idx * 4;
		data[p + 3] = 0;

		const x = idx % w;
		const y = (idx - x) / w;

		if (x > 0) trySeed(x - 1, y);
		if (x + 1 < w) trySeed(x + 1, y);
		if (y > 0) trySeed(x, y - 1);
		if (y + 1 < h) trySeed(x, y + 1);
	}

	// Feather 1px fringe pixels directly adjacent to keyed exterior
	const fringeTolSq = (tolerance + 24) * (tolerance + 24);
	for (let y = 1; y < h - 1; y++) {
		for (let x = 1; x < w - 1; x++) {
			const idx = y * w + x;
			if (visited[idx]) continue;
			const hasClearedNeighbor =
				visited[idx - 1] || visited[idx + 1] || visited[idx - w] || visited[idx + w];
			if (!hasClearedNeighbor) continue;
			const p = idx * 4;
			const dr = data[p] - bgR;
			const dg = data[p + 1] - bgG;
			const db = data[p + 2] - bgB;
			if (dr * dr + dg * dg + db * db <= fringeTolSq) {
				data[p + 3] = Math.min(data[p + 3], 60);
			}
		}
	}

	ctx.putImageData(imgData, 0, 0);
	scene.textures.addCanvas(key, canvas);
}
