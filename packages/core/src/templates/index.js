// @dotbook/core/templates — versioned templates: resolution, snapshots,
// deviations, and the promotion rules. Pure functions over rows; no I/O.

export { applyDeviation, diffItems, itemName, sameDeviation } from "./deviations.js"
export { PROMOTION_THRESHOLD, PROMOTION_WINDOW, promotionCandidate } from "./promotion.js"
export { findTemplateUse, nextLabel, resolveVersion } from "./versions.js"
