import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition"
import Mic from "lucide-react-native/icons/mic"
import { useRef, useState } from "react"
import { Pressable } from "react-native"
import { available, startListening, stopListening } from "../voice/recognizer"
import { Icon } from "./ui/Icon"

// Tap to start, tap to stop. Not hold-to-talk: the recognizer ends on its own
// after the final result, and a release outside the button is not reliably
// delivered on web, which would leave the microphone open.
//
// `onTranscript` fires as words arrive, so the composer shows what was heard;
// `onDone` fires once with the final transcript and the kept audio, if any.
export function MicButton({ onTranscript, onDone }) {
	const [listening, setListening] = useState(false)
	// The recording in progress — not state, nothing renders from it.
	const take = useRef(null)

	useSpeechRecognitionEvent("start", () => setListening(true))
	useSpeechRecognitionEvent("result", (event) => {
		const transcript = event.results[0]?.transcript ?? ""
		if (take.current) take.current.transcript = transcript
		onTranscript(transcript)
	})
	useSpeechRecognitionEvent("audioend", (event) => {
		if (!take.current) return
		take.current.uri = event.uri
		take.current.durationMs = Date.now() - take.current.startedAt
	})
	useSpeechRecognitionEvent("end", () => {
		setListening(false)
		const finished = take.current
		take.current = null
		// No speech heard: nothing is written and nothing nags.
		if (finished?.transcript) onDone(finished)
	})

	if (!available()) return null

	async function toggle() {
		if (listening) {
			stopListening()
			return
		}
		const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
		if (!granted) return
		take.current = { transcript: "", uri: null, durationMs: null, startedAt: Date.now(), engine: null }
		take.current.engine = await startListening()
	}

	return (
		<Pressable
			onPress={toggle}
			className={listening ? "rounded-full bg-error-container p-xs" : "rounded-full p-xs"}
			accessibilityLabel={listening ? "Stop recording" : "Record a voice note"}
		>
			<Icon as={Mic} className={listening ? "text-on-error-container" : "text-outline"} />
		</Pressable>
	)
}
