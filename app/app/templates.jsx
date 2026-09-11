import { nextLabel } from "@dotbook/core/templates"
import { useRouter } from "expo-router"
import { useSQLiteContext } from "expo-sqlite"
import { ChevronLeft, Plus } from "lucide-react-native"
import { styled } from "nativewind"
import { useCallback, useState } from "react"
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { PromotionCard } from "../components/PromotionCard"
import { TemplateForm } from "../components/TemplateForm"
import { addVersion, createTemplate, decline, overview, promote } from "../db/templates"
import { useLiveQuery } from "../db/use-live-query"
import { today } from "../lib/day"

const ICON = { className: { target: "style", nativeStyleMapping: { color: "color" } } }
const BackIcon = styled(ChevronLeft, ICON)
const AddIcon = styled(Plus, ICON)

// Templates and their versions, plus the promotion prompts — computed live from
// the uses, so there is no stored "pending question" to go stale.
export default function Templates() {
	const db = useSQLiteContext()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const [selectedId, setSelectedId] = useState(null) // a template's versions, or the list
	const [adding, setAdding] = useState(false) // the form is open

	const query = useCallback(() => overview(db, today()), [db])
	const all = useLiveQuery(db, query)
	const selected = all.find((template) => template.id === selectedId) ?? null
	const prompted = all.filter((template) => template.candidate !== null)

	function back() {
		if (adding) {
			setAdding(false)
			return
		}
		if (selected) {
			setSelectedId(null)
			return
		}
		router.back()
	}

	function open() {
		setAdding(true)
	}

	async function save(fields) {
		if (selected) {
			await addVersion(db, selected.id, fields)
		} else {
			await createTemplate(db, fields)
		}
		setAdding(false)
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			className="flex-1 bg-background"
			style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
		>
			<View className="flex-row items-center gap-sm bg-surface px-md py-sm">
				<Pressable onPress={back} className="rounded-md p-xs active:bg-surface-container" accessibilityLabel="Back">
					<BackIcon className="text-on-surface-variant" />
				</Pressable>
				<Text className="flex-1 text-subheading text-on-surface">{selected ? selected.name : "Templates"}</Text>
				{!adding && (
					<Pressable onPress={open} className="rounded-md p-xs active:bg-surface-container" accessibilityLabel="Add">
						<AddIcon className="text-primary" />
					</Pressable>
				)}
			</View>

			<ScrollView contentContainerClassName="gap-sm p-md" keyboardShouldPersistTaps="handled">
				{adding ? (
					<TemplateForm
						withName={selected === null}
						defaultLabel={selected ? nextLabel(selected.versions[0].label) : "1.0"}
						onSubmit={save}
						onCancel={back}
					/>
				) : null}
				{selected === null &&
					prompted.map((template) => (
						<PromotionCard
							key={template.id}
							template={template}
							onAccept={() => promote(db, template, template.candidate)}
							onDecline={() => decline(db, template, template.candidate)}
						/>
					))}
				{selected === null &&
					all.map((template) => <TemplateRow key={template.id} template={template} onPress={setSelectedId} />)}
				{selected?.versions.map((version) => (
					<VersionCard key={version.id} version={version} current={version.id === selected.current?.id} />
				))}
			</ScrollView>
		</KeyboardAvoidingView>
	)
}

function TemplateRow({ template, onPress }) {
	function press() {
		onPress(template.id)
	}
	return (
		<Pressable
			onPress={press}
			className="flex-row items-center gap-sm rounded-md px-sm py-sm active:bg-surface-container"
		>
			<Text className="flex-1 text-body text-on-surface">{template.name}</Text>
			<Text className="text-label text-primary">v{template.current?.label ?? "—"}</Text>
		</Pressable>
	)
}

function VersionCard({ version, current }) {
	return (
		<View
			className={
				current ? "gap-2xs rounded-md bg-primary-container p-sm" : "gap-2xs rounded-md bg-surface-container-low p-sm"
			}
		>
			<View className="flex-row gap-sm">
				<Text className="text-label text-primary">v{version.label}</Text>
				<Text className="text-label text-on-surface-variant">from {version.effective_from}</Text>
			</View>
			{version.contents.map((item) => (
				<Text key={item} className="text-body text-on-surface">
					{item}
				</Text>
			))}
		</View>
	)
}
