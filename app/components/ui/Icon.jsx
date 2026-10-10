import { styled } from "nativewind"
import { cn } from "./cn"

// Lucide icons take their colour and size as props. styled() lets token classes
// drive them instead, so an icon never carries a colour in JavaScript:
//   <Icon as={ChevronLeft} className="text-primary" />
// Every icon is one size (h-icon w-icon, √φ) unless a class says otherwise.
// (react-native-reusables does this with NativeWind 4's cssInterop, which v5 replaced.)
const StyledIcon = styled(({ as: Glyph, ...props }) => <Glyph {...props} />, {
	className: { target: "style", nativeStyleMapping: { color: "color", width: "size", height: "size" } },
})

export function Icon({ className, ...props }) {
	return <StyledIcon className={cn("h-icon w-icon", className)} {...props} />
}
