import { nextLabel } from "@dotbook/core/templates"
import { useSQLiteContext } from "expo-sqlite"
import Bell from "lucide-react-native/icons/bell"
import Plus from "lucide-react-native/icons/plus"
import X from "lucide-react-native/icons/x"
import { useState } from "react"
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { PromotionCard } from "../../components/PromotionCard"
import { ReminderForm } from "../../components/ReminderForm"
import { ScreenHeader } from "../../components/ScreenHeader"
import { TemplateForm } from "../../components/TemplateForm"
import { Badge } from "../../components/ui/Badge"
import { Icon } from "../../components/ui/Icon"
import { Panel } from "../../components/ui/Panel"
import { Text } from "../../components/ui/Text"
import { addReminder, remindersFor, removeReminder, restoreReminder } from "../../db/reminders"
import { addVersion, createTemplate, decline, overview, promote } from "../../db/templates"
import { useLiveQuery } from "../../db/use-live-query"
import { clockAt } from "../../lib/format"
import { offerUndo } from "../../lib/undo"
import { useToday } from "../../lib/use-today"
import { ensurePermission, reconcile } from "../../notifications/reminders"

// Templates and their versions, plus the promotion prompts — computed live from
// the uses, so there is no stored "pending question" to go stale.
export default function Templates() {
	const db = useSQLiteContext()
	const insets = useSafeAreaInsets()
	const [selectedId, setSelectedId] = useState(null) // a template's versions, or the list
	const [adding, setAdding] = useState(false) // the form is open
	const [remindingId, setRemindingId] = useState(null) // the reminder form is open for this template

	const day = useToday()
	const all = useLiveQuery(["templates", "overview", day], () => overview(db, day))
	const selected = all.find((template) => template.id === selectedId) ?? null
	const prompted = all.filter((template) => template.candidate !== null)
	const reminders = useLiveQuery(["reminders", "template", selectedId], () => remindersFor(db, selectedId), {
		enabled: selectedId !== null,
	})

	// Back closes what is open first: a form, then the selection, then the screen.
	function back() {
		if (adding || remindingId) {
			setAdding(false)
			setRemindingId(null)
			return true
		}
		if (selected) {
			setSelectedId(null)
			return true
		}
		return false
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

	async function saveReminder(fields) {
		await ensurePermission()
		await addReminder(db, { templateId: selected.id, ...fields })
		await reconcile(db)
		setRemindingId(null)
	}

	async function dropReminder(reminder) {
		await removeReminder(db, reminder.id)
		await reconcile(db)
		offerUndo("Reminder removed", async () => {
			await restoreReminder(db, reminder.id)
			await reconcile(db)
		})
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			className="flex-1 bg-background"
			style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
		>
			<ScreenHeader
				title={selected ? selected.name : "Templates"}
				lede={selected ? "Versions, newest first — history does not move" : "Log once, retype nothing"}
				onBack={selected ? back : null}
			>
				{adding ? null : (
					<Pressable onPress={open} className="rounded-full p-xs active:bg-surface-container" accessibilityLabel="Add">
						<Icon as={Plus} className="text-primary" />
					</Pressable>
				)}
			</ScreenHeader>

			<ScrollView contentContainerClassName="gap-md p-md" keyboardShouldPersistTaps="handled">
				{adding ? (
					<TemplateForm
						withName={selected === null}
						defaultLabel={selected ? nextLabel(selected.versions[0].label) : "1.0"}
						onSubmit={save}
						onCancel={back}
					/>
				) : null}
				{selected === null
					? prompted.map((template) => (
							<PromotionCard
								key={template.id}
								template={template}
								onAccept={() => promote(db, template, template.candidate)}
								onDecline={() => decline(db, template, template.candidate)}
							/>
						))
					: null}
				{selected === null && all.length === 0 && !adding ? (
					<Text variant="line" className="text-on-surface-variant">
						No templates yet. Tap + and list what one line should stand for.
					</Text>
				) : null}
				{selected === null && all.length > 0 ? (
					<Panel eyebrow="Templates" flush>
						{all.map((template, i) => (
							<TemplateRow key={template.id} template={template} first={i === 0} onPress={setSelectedId} />
						))}
					</Panel>
				) : null}
				{selected?.versions.map((version) => (
					<VersionCard key={version.id} version={version} current={version.id === selected.current?.id} />
				))}
				{selected !== null && !adding ? (
					<Panel eyebrow="Reminders">
						{reminders.map((reminder) => (
							<ReminderRow key={reminder.id} reminder={reminder} onRemove={dropReminder} />
						))}
						{remindingId === selected.id ? (
							<ReminderForm onSubmit={saveReminder} onCancel={back} />
						) : (
							<Pressable
								onPress={() => setRemindingId(selected.id)}
								className="flex-row items-center gap-xs self-start rounded-item py-2xs active:bg-surface-container"
								accessibilityLabel="Add reminder"
							>
								<Icon as={Bell} className="text-primary" />
								<Text variant="label" className="font-body-medium text-primary">
									Add a reminder
								</Text>
							</Pressable>
						)}
					</Panel>
				) : null}
			</ScrollView>
		</KeyboardAvoidingView>
	)
}

function TemplateRow({ template, first, onPress }) {
	function press() {
		onPress(template.id)
	}
	return (
		<Pressable
			onPress={press}
			className={`flex-row items-center gap-sm px-md py-sm active:bg-surface-container ${first ? "" : "border-t border-outline-variant"}`}
		>
			<Text variant="line" className="flex-1">
				{template.name}
			</Text>
			<Badge variant="primary">v{template.current?.label ?? "—"}</Badge>
		</Pressable>
	)
}

// A version as the template's `.stackout`: a primary rule down the left, the
// wash behind, mono items, and the date it took effect. The current one is
// ringed with the primary hairline.
function VersionCard({ version, current }) {
	return (
		<View
			className={`gap-2xs rounded-r-md border-l-2 border-primary bg-primary-wash px-md py-sm ${current ? "rounded-md border border-l-2 border-primary-line" : ""}`}
		>
			<View className="flex-row items-baseline gap-sm">
				<Text variant="mono" className="text-primary">
					v{version.label}
				</Text>
				<Text variant="data">effective {version.effective_from} →</Text>
				{current ? (
					<Badge variant="primary" caps>
						current
					</Badge>
				) : null}
			</View>
			{version.contents.map((item) => (
				<Text key={item} variant="data" className="text-on-surface">
					{item}
				</Text>
			))}
		</View>
	)
}

// `9:00 am · notify · T2 +30m`
function ReminderRow({ reminder, onRemove }) {
	const [hour, minute] = reminder.at.split(":").map(Number)
	const parts = [clockAt(hour, minute), reminder.style]
	if (reminder.escalation_min !== null) parts.push(`T2 +${reminder.escalation_min}m`)
	function remove() {
		onRemove(reminder)
	}
	return (
		<View className="flex-row items-center gap-sm border-b border-dashed border-outline-variant py-xs">
			<Text variant="mono" className="flex-1 text-on-surface">
				{parts.join(" · ")}
			</Text>
			<Pressable
				onPress={remove}
				className="rounded-full p-2xs active:bg-surface-container"
				accessibilityLabel="Remove"
			>
				<Icon as={X} className="text-on-surface-variant" />
			</Pressable>
		</View>
	)
}
