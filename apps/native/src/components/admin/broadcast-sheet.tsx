import type { BroadcastInput } from "@nabhya/shared";
import { useState } from "react";
import { View } from "react-native";
import { Field } from "@/components/form-field";
import { Banner, FilterChips } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirm, toast } from "@/components/ui/overlay";
import { Sheet } from "@/components/ui/sheet";
import { Label } from "@/components/ui/typography";
import { useBroadcast } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";

type Audience = BroadcastInput["audience"];

const AUDIENCES: Array<{ value: Audience; label: string }> = [
	{ value: "ALL", label: "Everyone" },
	{ value: "VOLUNTEERS", label: "Volunteers" },
	{ value: "ORGANISATIONS", label: "NGOs" },
];

const MIN_LENGTH = 3;

/**
 * Platform-wide announcement.
 *
 * Fans out to one notification per recipient, so it is confirmed before
 * sending — there is no unsend. Validation is inline, under the field it is
 * about, so the reviewer never has to guess which of two boxes was too short.
 */
export function BroadcastSheet({
	visible,
	onClose,
}: {
	visible: boolean;
	onClose: () => void;
}) {
	const { spacing } = useTheme();
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [audience, setAudience] = useState<Audience>("ALL");
	const [touched, setTouched] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const broadcast = useBroadcast();

	const titleError =
		touched && title.trim().length < MIN_LENGTH
			? "Give it a short, clear title."
			: null;
	const bodyError =
		touched && body.trim().length < MIN_LENGTH
			? "Say what people need to know."
			: null;

	const reset = () => {
		setTitle("");
		setBody("");
		setAudience("ALL");
		setTouched(false);
		setError(null);
	};

	const close = () => {
		setError(null);
		onClose();
	};

	const send = async () => {
		setTouched(true);
		if (title.trim().length < MIN_LENGTH || body.trim().length < MIN_LENGTH) {
			return;
		}
		setError(null);

		const audienceLabel =
			AUDIENCES.find((a) => a.value === audience)?.label ?? "Everyone";

		const ok = await confirm({
			title: `Send to ${audienceLabel.toLowerCase()}?`,
			message: "This notifies every matching account and cannot be undone.",
			confirmLabel: "Send",
			// Not destructive — it creates something rather than removing it —
			// but still worth a stop, because the audience is everyone.
			destructive: false,
		});
		if (!ok) return;
		broadcast.mutate(
			{ title: title.trim(), body: body.trim(), audience },
			{
				onSuccess: (result) => {
					reset();
					onClose();
					toast.success(
						`Delivered to ${result.delivered} ${
							result.delivered === 1 ? "person" : "people"
						}.`,
					);
				},
				onError: (e) => setError(apiErrorMessage(e)),
			},
		);
	};

	return (
		<Sheet
			visible={visible}
			onClose={close}
			title="Broadcast"
			subtitle="One notification to every matching account"
			footer={
				<Button onPress={send} loading={broadcast.isPending}>
					Review and send
				</Button>
			}
		>
			<Label style={{ marginBottom: spacing[2] }}>Audience</Label>
			<FilterChips
				options={AUDIENCES}
				value={audience}
				onChange={setAudience}
				inline
			/>
			<View style={{ height: spacing[5] }} />

			<Field label="Title" {...(titleError ? { error: titleError } : {})}>
				<Input
					placeholder="e.g. Scheduled maintenance on Sunday"
					value={title}
					onChangeText={setTitle}
					accessibilityLabel="Title"
					maxLength={120}
					{...(titleError ? { accessibilityHint: titleError } : {})}
				/>
			</Field>

			<Field label="Message" {...(bodyError ? { error: bodyError } : {})}>
				<Input
					placeholder="What people need to know"
					value={body}
					onChangeText={setBody}
					multiline
					accessibilityLabel="Message"
					style={{ minHeight: 120, textAlignVertical: "top" }}
					{...(bodyError ? { accessibilityHint: bodyError } : {})}
				/>
			</Field>

			{/* The send failed and the sheet is still open with the message in it,
			    so this is a form error and belongs on the form — a toast would
			    vanish while the sender is still reading it. */}
			{error && (
				<Banner tone="error" title="Couldn't send" description={error} />
			)}
			<View style={{ height: spacing[2] }} />
		</Sheet>
	);
}
