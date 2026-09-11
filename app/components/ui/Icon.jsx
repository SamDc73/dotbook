import { styled } from "nativewind"

// Lucide icons take their colour and size as props. styled() lets token classes
// drive them instead, so an icon never carries a colour in JavaScript:
//   <Icon as={ChevronLeft} className="text-primary" />
// (react-native-reusables does this with NativeWind 4's cssInterop, which v5 replaced.)
export const Icon = styled(({ as: Glyph, ...props }) => <Glyph {...props} />, {
	className: { target: "style", nativeStyleMapping: { color: "color", width: "size", height: "size" } },
})
