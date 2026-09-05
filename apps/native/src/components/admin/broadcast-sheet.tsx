import type { BroadcastInput } from "@nabhya/shared";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useBroadcast } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/useTheme";
import { Alert } from "@/lib/alert";
import { apiErrorMessage } from "@/lib/api";

const AUDIENCES: Array<{ value: BroadcastInput["audience"]; label: string }> = [
	{ value: "ALL", label: "Everyone" },
	{ value: "VOLUNTEERS", label: "Volunteers" },
	{ value: "ORGANISATIONS", label: "NGOs" },
];

/**
 * Platform-wide announcement.
 *
 * Fans out to one notification per recipient, so it is confirmed before
 * sending — there is no unsend.
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
	const [audience, setAudience] = useState<BroadcastInput["audience"]>("ALL");
	const [error, setError] = useState<string | null>(null);

	const broadcast = useBroadcast();

	const send = () => {
		if (title.trim().length < 3 || body.trim().length < 3) {
			setError("Add a title and a message.");
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
									setTitle("");
									setBody("");
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

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

	return (
		<Sheet
			visible={visible}
			onClose={onClose}
			title="Broadcast"
			subtitle="Notifies every matching account. There is no unsend."
			footer={
				<Button onPress={send} loading={broadcast.isPending}>
					Review and send
				</Button>
			}
		>
			<Label style={{ marginBottom: spacing[2] }}>Audience</Label>
			<View style={{ flexDirection: "row", gap: spacing[2] }}>
				{AUDIENCES.map((option) => {
					const active = audience === option.value;
					return (
						<Pressable
							key={option.value}
							onPress={() => setAudience(option.value)}
							style={{
								flex: 1,
								alignItems: "center",
								paddingVertical: spacing[2.5],
								borderRadius: 12,
								backgroundColor: active
									? colors.primary.main
									: colors.background.tertiary,
							}}
						>
							<Body
								weight={active ? "bold" : "normal"}
								color={
									active ? (colors.primary.contrast as string) : "secondary"
								}
							>
								{option.label}
							</Body>
						</Pressable>
					);
				})}
			</View>

			<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
				Title
			</Label>
			<Input
				placeholder="e.g. Scheduled maintenance on Sunday"
				value={title}
				onChangeText={setTitle}
				style={inputStyle}
			/>

			<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
				Message
			</Label>
			<Input
				placeholder="What people need to know"
				value={body}
				onChangeText={setBody}
				multiline
				style={{ ...inputStyle, minHeight: 120, textAlignVertical: "top" }}
			/>

			{error && (
				<Caption
					color={colors.error.main as string}
					style={{ marginTop: spacing[3] }}
				>
					{error}
				</Caption>
			)}
		</Sheet>
	);
}
