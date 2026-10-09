// Versioned templates — a named stack ("nootstack", "big breakfast") whose
// contents change over time without rewriting history.

import * as z from "zod/v4"
import { addVersion, createTemplate, templatesOn } from "../../db/templates.js"
import { today } from "../../wallClock.js"
import { CONTENTS, idOf, OPTIONAL_DAY, READ_ONLY, WRITES } from "../fields.js"
import { reply } from "../reply.js"

const LABEL = z
	.string()
	.min(1)
	.optional()
	.describe("Version label, e.g. `1.4`; the next one after the latest when left out")

export function registerTemplateTools(server, { db, groupId, canWrite }) {
	server.registerTool(
		"list_templates",
		{
			title: "List templates",
			description:
				"Every template with the version in force today and all its versions (newest first). A line that " +
				"names a template (`took nootstack`) is logged with that day's version of its contents.",
			inputSchema: z.object({}),
			annotations: READ_ONLY,
		},
		async () => {
			const rows = await templatesOn(db, today())
			return reply(
				rows.map((template) => ({
					id: template.id,
					name: template.name,
					current: template.current?.label ?? null,
					versions: template.versions.map((version) => ({
						label: version.label,
						effectiveFrom: version.effective_from,
						contents: version.contents,
					})),
				}))
			)
		}
	)

	if (!canWrite) return

	server.registerTool(
		"create_template",
		{
			title: "Create a template",
			description: "A new template: a name that lines can mention, and its first version's contents.",
			inputSchema: z.object({
				name: z.string().min(1).describe("How a line names it, e.g. `nootstack`"),
				contents: CONTENTS,
				label: LABEL,
				effectiveFrom: OPTIONAL_DAY.describe("The day this version starts; today when left out"),
			}),
			annotations: WRITES,
		},
		async ({ name, contents, label, effectiveFrom }) => {
			const id = await createTemplate(db, groupId, { name, contents, label, effectiveFrom: effectiveFrom ?? today() })
			return reply({ id, name: name.trim() })
		}
	)

	server.registerTool(
		"add_template_version",
		{
			title: "Change a template",
			description:
				"A new version of a template from a given day on. Lines already logged keep the contents they " +
				"were logged with; lines from `effectiveFrom` on get this version.",
			inputSchema: z.object({
				templateId: idOf("template"),
				contents: CONTENTS,
				label: LABEL,
				effectiveFrom: OPTIONAL_DAY.describe("The day this version starts; today when left out"),
			}),
			annotations: WRITES,
		},
		async ({ templateId, contents, label, effectiveFrom }) => {
			await addVersion(db, groupId, templateId, { label, contents, effectiveFrom: effectiveFrom ?? today() })
			const [template] = (await templatesOn(db, today())).filter((row) => row.id === templateId)
			return reply({ id: templateId, name: template.name, latest: template.versions[0].label })
		}
	)
}
