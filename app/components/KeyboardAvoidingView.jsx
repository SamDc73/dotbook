import { styled } from "nativewind"
import { KeyboardAvoidingView as Avoiding } from "react-native-keyboard-controller"

// React Native's own KeyboardAvoidingView stays still on Android 17: edge to
// edge, the window keeps its full height under the keyboard, and the composer
// at the bottom of a screen is typed into unseen. keyboard-controller follows
// the keyboard's insets as it moves. styled() lets token classes reach it.
export const KeyboardAvoidingView = styled(Avoiding, { className: "style" })
