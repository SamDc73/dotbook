import { useEffect, useMemo } from "react"
import { PanResponder, Platform } from "react-native"

// Day navigation without a button. Swipe left for the next day and right for
// the previous one (a horizontal fling; vertical scrolls are left alone), and
// on the web the ← / → keys do the same unless you are typing somewhere.
//
//   const pan = useDayNav(shift)
//   <View {...pan.panHandlers}>…</View>

const FLING_PX = 60
const SLOPE = 1.5 // horizontal must beat vertical by this much to count as a swipe

export function useDayNav(onShift) {
	useEffect(() => {
		if (Platform.OS !== "web") return
		function onKey(event) {
			if (isTyping(event.target)) return
			if (event.key === "ArrowLeft") onShift(-1)
			if (event.key === "ArrowRight") onShift(1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [onShift])

	return useMemo(
		() =>
			PanResponder.create({
				onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > FLING_PX && Math.abs(g.dx) > Math.abs(g.dy) * SLOPE,
				onPanResponderRelease: (_, g) => onShift(g.dx < 0 ? 1 : -1),
			}),
		[onShift]
	)
}

function isTyping(target) {
	const tag = target?.tagName
	return tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable === true
}
