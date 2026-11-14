/**
 * Point in polygon check using ray-casting algorithm.
 * @param {{x: number, y: number}} point
 * @param {Array<[number, number]>} polygon
 * @returns {boolean}
 */
export function pointInPolygon(point, polygon) {
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const xi = polygon[i][0];
		const yi = polygon[i][1];
		const xj = polygon[j][0];
		const yj = polygon[j][1];

		const intersect =
			yi > point.y !== yj > point.y &&
			point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

/**
 * Finds the closest point on a line segment AB to point P.
 * @param {number} px
 * @param {number} py
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @returns {{x: number, y: number, distSq: number, nx: number, ny: number}}
 */
function closestPointOnSegment(px, py, ax, ay, bx, by) {
	const abx = bx - ax;
	const aby = by - ay;
	const abLenSq = abx * abx + aby * aby;
	if (abLenSq === 0) {
		const dx = px - ax;
		const dy = py - ay;
		return { x: ax, y: ay, distSq: dx * dx + dy * dy, nx: 0, ny: 0 };
	}

	const apx = px - ax;
	const apy = py - ay;
	let t = (apx * abx + apy * aby) / abLenSq;
	t = Math.max(0, Math.min(1, t));

	const qx = ax + t * abx;
	const qy = ay + t * aby;
	const dx = px - qx;
	const dy = py - qy;

	// Perpendicular normal (pointing 90 degrees clockwise)
	const segLen = Math.sqrt(abLenSq);
	const nx = -aby / segLen;
	const ny = abx / segLen;

	return { x: qx, y: qy, distSq: dx * dx + dy * dy, nx, ny };
}

/**
 * Resolves polygon boundary collision and smoothly slides velocity along the nearest wall.
 * Prevents getting stuck on corners or diagonal boundaries.
 * @param {{x: number, y: number}} currentPos
 * @param {{x: number, y: number}} nextPos
 * @param {{x: number, y: number}} velocity
 * @param {Array<[number, number]>} polygon
 * @param {{x: number, y: number}} center
 * @returns {{x: number, y: number, vx: number, vy: number}}
 */
export function constrainToPolygonWithSlide(currentPos, nextPos, velocity, polygon, center) {
	if (!polygon || polygon.length < 3) {
		return { x: nextPos.x, y: nextPos.y, vx: velocity.x, vy: velocity.y };
	}

	const isNextInside = pointInPolygon(nextPos, polygon);
	const isCurrentInside = pointInPolygon(currentPos, polygon);

	// If moving freely inside, allow movement directly
	if (isNextInside && isCurrentInside) {
		return { x: nextPos.x, y: nextPos.y, vx: velocity.x, vy: velocity.y };
	}

	// Find the closest edge of the polygon to the player's position
	let bestDistSq = Infinity;
	let bestPoint = { x: currentPos.x, y: currentPos.y };
	let bestNormal = { x: 0, y: 0 };

	const len = polygon.length;
	for (let i = 0; i < len; i++) {
		const [ax, ay] = polygon[i];
		const [bx, by] = polygon[(i + 1) % len];
		const res = closestPointOnSegment(nextPos.x, nextPos.y, ax, ay, bx, by);
		if (res.distSq < bestDistSq) {
			bestDistSq = res.distSq;
			bestPoint = { x: res.x, y: res.y };
			bestNormal = { x: res.nx, y: res.ny };
		}
	}

	// Ensure normal points inward towards room center
	const toCenterX = center.x - bestPoint.x;
	const toCenterY = center.y - bestPoint.y;
	if (bestNormal.x * toCenterX + bestNormal.y * toCenterY < 0) {
		bestNormal.x = -bestNormal.x;
		bestNormal.y = -bestNormal.y;
	}

	// Clamped position: 2 pixels inward from the nearest polygon edge
	const clampedX = bestPoint.x + bestNormal.x * 2;
	const clampedY = bestPoint.y + bestNormal.y * 2;

	// Slide velocity along the wall (remove outward component)
	const outwardNx = -bestNormal.x;
	const outwardNy = -bestNormal.y;
	const dotOut = velocity.x * outwardNx + velocity.y * outwardNy;

	let vx = velocity.x;
	let vy = velocity.y;
	if (dotOut > 0) {
		vx -= dotOut * outwardNx;
		vy -= dotOut * outwardNy;
	}

	return {
		x: clampedX,
		y: clampedY,
		vx,
		vy,
	};
}
