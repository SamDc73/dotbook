// The browser's download: a blob behind a link that is clicked for the person.
export async function saveFile(name, text, mimeType) {
	const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
	const link = document.createElement("a")
	link.href = url
	link.download = name
	link.click()
	URL.revokeObjectURL(url)
}
