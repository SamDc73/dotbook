// Statistics over aligned daily series (see series.js). Nulls are skipped.
//
// Descriptive only. No p-values and no causal claims: V0.1 deliberately defers
// N-of-1 / causal analysis, so everything here is "these two things moved
// together", stated with the sample size beside it.
//
// No statistics library: the arithmetic below is shorter than the import and
// a junior can check every line against a textbook.

/** Days with too few paired points give a correlation that one outlier decides — a week is the floor. */
export const MIN_PAIRS = 7

// How far apart two series are compared in `lagScan`: today ±3 days.
const MAX_LAG = 3

/**
 * Trailing mean over `window` days; null until the window is fully observed
 * (every one of the last `window` values non-null).
 * @param {(number|null)[]} values
 * @param {number} window
 * @returns {(number|null)[]}
 */
export function movingAverage(values, window = 7) {
	return values.map((_, i) => {
		if (i + 1 < window) return null
		const slice = values.slice(i + 1 - window, i + 1)
		if (slice.some((value) => value === null)) return null
		return mean(slice)
	})
}

/**
 * Pearson correlation over the days where both series have a value.
 * `r` is null with fewer than MIN_PAIRS pairs or when either side never varies.
 * @param {(number|null)[]} a
 * @param {(number|null)[]} b
 * @returns {{ r: number|null, n: number }}
 */
export function pearson(a, b) {
	const pairs = []
	for (let i = 0; i < Math.min(a.length, b.length); i++) {
		if (a[i] !== null && b[i] !== null) pairs.push([a[i], b[i]])
	}
	const n = pairs.length
	if (n < MIN_PAIRS) return { r: null, n }

	const xs = pairs.map((pair) => pair[0])
	const ys = pairs.map((pair) => pair[1])
	const meanX = mean(xs)
	const meanY = mean(ys)
	let covariance = 0
	let varianceX = 0
	let varianceY = 0
	for (let i = 0; i < n; i++) {
		const dx = xs[i] - meanX
		const dy = ys[i] - meanY
		covariance += dx * dy
		varianceX += dx * dx
		varianceY += dy * dy
	}
	if (varianceX === 0 || varianceY === 0) return { r: null, n }
	return { r: covariance / Math.sqrt(varianceX * varianceY), n }
}

/**
 * Correlate `a` on one day with `b` `lag` days later (negative: earlier).
 * `lag = 1` asks "does today's a go with tomorrow's b" — caffeine today, sleep tonight.
 * @param {(number|null)[]} a
 * @param {(number|null)[]} b
 * @param {number} lag
 */
export function laggedPearson(a, b, lag) {
	const shiftedA = []
	const shiftedB = []
	for (let i = 0; i < a.length; i++) {
		const j = i + lag
		if (j < 0 || j >= b.length) continue
		shiftedA.push(a[i])
		shiftedB.push(b[j])
	}
	return pearson(shiftedA, shiftedB)
}

/**
 * The lag in −MAX_LAG…MAX_LAG with the strongest |r|; ties go to the smaller
 * |lag|, so "same day" wins unless a shift is clearly stronger.
 * @returns {{ lag: number, r: number|null, n: number }}
 */
export function lagScan(a, b) {
	let best = { lag: 0, ...pearson(a, b) }
	for (let lag = -MAX_LAG; lag <= MAX_LAG; lag++) {
		if (lag === 0) continue
		const result = laggedPearson(a, b, lag)
		if (
			stronger(result.r, best.r) ||
			(result.r !== null && Math.abs(result.r) === Math.abs(best.r) && Math.abs(lag) < Math.abs(best.lag))
		) {
			best = { lag, ...result }
		}
	}
	return best
}

/**
 * Every pair of named series, strongest first, so a screen can say
 * "coffee ↔ sleep r = −0.42 (n = 31)". Pairs without a usable r sort last.
 * @param {Record<string, (number|null)[]>} seriesByName
 * @returns {{ a: string, b: string, r: number|null, n: number }[]}
 */
export function correlations(seriesByName) {
	const names = Object.keys(seriesByName)
	const pairs = []
	for (let i = 0; i < names.length; i++) {
		for (let j = i + 1; j < names.length; j++) {
			pairs.push({ a: names[i], b: names[j], ...pearson(seriesByName[names[i]], seriesByName[names[j]]) })
		}
	}
	return pairs.sort((x, y) => Math.abs(y.r ?? 0) - Math.abs(x.r ?? 0))
}

/**
 * Ported from the web prototype's correlations engine: the mean of `values` on
 * days a flag was on versus off — "sleep averaged 6.9h on caffeine days, 7.6h
 * without". Needs three days on each side, the prototype's own floor.
 * @param {(number|null)[]} flags   1 / 0 / null, e.g. a habit or a "took X" count
 * @param {(number|null)[]} values
 * @returns {{ avgWith: number, avgWithout: number, change: number, nWith: number, nWithout: number } | null}
 *   `change` is a fraction of the "without" mean; null when a side has fewer than 3 days
 */
export function withVsWithout(flags, values) {
	const on = []
	const off = []
	for (let i = 0; i < Math.min(flags.length, values.length); i++) {
		if (flags[i] === null || values[i] === null) continue
		if (flags[i] > 0) on.push(values[i])
		else off.push(values[i])
	}
	if (on.length < 3 || off.length < 3) return null
	const avgWith = mean(on)
	const avgWithout = mean(off)
	const change = avgWithout === 0 ? 0 : (avgWith - avgWithout) / avgWithout
	return { avgWith, avgWithout, change, nWith: on.length, nWithout: off.length }
}

function mean(values) {
	return values.reduce((sum, value) => sum + value, 0) / values.length
}

// `candidate` beats `current` when it exists and is larger in magnitude.
function stronger(candidate, current) {
	if (candidate === null) return false
	if (current === null) return true
	return Math.abs(candidate) > Math.abs(current)
}
