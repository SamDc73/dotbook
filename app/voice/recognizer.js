import { Paths } from "expo-file-system"
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition"
import { Platform } from "react-native"

// The device's own recognizer, English only (V0.1 feature 15). On Android the
// on-device model is used when it is installed; otherwise the default service,
// which may send audio to Google — noted, not hidden, in `engineId`.

export function available() {
	return ExpoSpeechRecognitionModule.isRecognitionAvailable()
}

/**
 * Start listening. Returns the engine id recorded with the voice note, so a
 * better recognizer later can tell which recordings to re-run.
 */
export async function startListening() {
	const onDevice = await onDeviceReady()
	ExpoSpeechRecognitionModule.start({
		lang: "en-US",
		interimResults: true,
		maxAlternatives: 1,
		requiresOnDeviceRecognition: onDevice,
		recordingOptions: recordingOptions(),
	})
	return engineId(onDevice)
}

export function stopListening() {
	ExpoSpeechRecognitionModule.stop()
}

// Android 13+ ships an on-device recognizer, but its English model has to be
// installed once by the person (Settings → Android System Intelligence). Until
// then the default service is used, so the button still works on first use.
async function onDeviceReady() {
	if (Platform.OS !== "android" || !ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
		return false
	}
	try {
		const { installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({})
		return installedLocales.some((locale) => locale.startsWith("en"))
	} catch {
		return false
	}
}

// The audio is kept, not discarded: transcripts are derived data and a better
// engine later can re-run over old recordings. Saved under the document
// directory so the OS never clears it. Android 13+ and iOS only — elsewhere
// (web, older Android) the recognizer cannot hand the audio back.
function recordingOptions() {
	if (!ExpoSpeechRecognitionModule.supportsRecording()) {
		return undefined
	}
	return { persist: true, outputDirectory: Paths.document.uri, outputFileName: `voice-${Date.now()}.wav` }
}

function engineId(onDevice) {
	if (Platform.OS === "web") {
		return "web-speech"
	}
	if (Platform.OS === "ios") {
		return "ios-sfspeech"
	}
	if (onDevice) {
		return "android-on-device"
	}
	return ExpoSpeechRecognitionModule.getDefaultRecognitionService().packageName || "android-speech"
}
