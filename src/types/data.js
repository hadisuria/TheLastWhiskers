/**
 * @typedef {Object} RoomItem
 * @property {number} x - Center X position
 * @property {number} y - Center Y position
 * @property {number} width - Area width
 * @property {number} height - Area height
 * @property {string} name - Display name / label
 * @property {"display" | "gallery-door" | "album-trigger" | "room-exit" | "photo-display"} type - Item behavior category
 * @property {string} description - Interactive text description
 * @property {string} color - Hex string color format (e.g. "0xff0000")
 * @property {string} [photoKey] - Image texture key for gallery photo zoom
 */

/**
 * @typedef {Object} RoomData
 * @property {Array<[number, number]>} polygon - Boundary diamond polygon vertices
 * @property {[number, number]} center - Self-healing distance center point
 * @property {[number, number]} playerSpawn - Initial player spawn position
 * @property {string} [boundaryColor] - Boundary wall debug display color
 * @property {Array<RoomItem>} items - Interactive items layout data
 */

/**
 * @typedef {Object} AlbumPhoto
 * @property {string} key - Image texture key
 * @property {string} title - Page caption title
 * @property {string} desc - Page caption description
 */

/**
 * @typedef {Object} AlbumPage
 * @property {AlbumPhoto} left - Left page photo content
 * @property {AlbumPhoto} right - Right page photo content
 */

/**
 * @typedef {Array<AlbumPage>} AlbumData
 */

export {};
