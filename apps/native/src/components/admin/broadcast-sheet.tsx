import type { BroadcastInput } from "@nabhya/shared";
import { useState } from "react";
import { View } from "react-native";
import { FilterChips } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Caption, Label } from "@/components/ui/typography";
import { useBroadcast } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/use-theme";
import { Alert } from "@/lib/alert";
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
	const { colors, spacing } = useTheme();
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

	const send = () => {
		setTouched(true);
		if (title.trim().length < MIN_LENGTH || body.trim().length < MIN_LENGTH) {
			return;
		}
		setError(null);

		const audienceLabel =
			AUDIENCES.find((a) => a.value === audience)?.label ?? "Everyone";

		Alert.alert(
			`Send to ${audienceLabel.toLowerCase()}?`,
			"This notifies every matching account and cannot be undone.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Send",
					onPress: () =>
						broadcast.mutate(
							{ title: title.trim(), body: body.trim(), audience },
							{
								onSuccess: (result) => {
									reset();
									onClose();
									Alert.alert(
										"Sent",
										`Delivered to ${result.delivered} ${
											result.delivered === 1 ? "person" : "people"
										}.`,
									);
								},
								onError: (e) => setError(apiErrorMessage(e)),
							},
						),
				},
			],
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

			<Field label="Title" error={titleError}>
				<Input
					placeholder="e.g. Scheduled maintenance on Sunday"
					value={title}
					onChangeText={setTitle}
					accessibilityLabel="Title"
					maxLength={120}
					{...(titleError ? { accessibilityHint: titleError } : {})}
				/>
			</Field>

			<Field label="Message" error={bodyError}>
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

			{error && (
				<View
					accessibilityLiveRegion="polite"
					style={{
						marginTop: spacing[4],
						padding: spacing[3],
						borderRadius: 12,
						backgroundColor: colors.error.bg,
					}}
				>
					<Caption weight="medium" color={colors.error.ink}>
						{error}
					</Caption>
				</View>
			)}
			<View style={{ height: spacing[2] }} />
		</Sheet>
	);
}

function Field({
	label,
	error,
	children,
}: {
	label: string;
	error: string | null;
	children: React.ReactNode;
}) {
	const { colors, spacing } = useTheme();
	return (
		<View style={{ marginTop: spacing[5] }}>
			<Label style={{ marginBottom: spacing[1.5] }}>{label}</Label>
			{children}
			{error && (
				<Caption
					color={colors.error.ink}
					accessibilityLiveRegion="polite"
					style={{ marginTop: spacing[1.5] }}
				>
					{error}
				</Caption>
			)}
		</View>
	);
}
