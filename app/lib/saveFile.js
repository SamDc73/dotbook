import { File, Paths } from "expo-file-system"
import * as Sharing from "expo-sharing"

// A file leaves the phone through the system share sheet: save to Files,
// send it anywhere. Written to the cache first, which needs no permission.
export async function saveFile(name, text, mimeType) {
	const file = new File(Paths.cache, name)
	if (file.exists) file.delete()
	await file.write(text)
	await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name })
}
