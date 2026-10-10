import { useEffect, useState } from "react";
import { View } from "react-native";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

/**
 * Collecting the remarks a rejection requires.
 *
 * One sheet for one document and for forty, because the shape of the decision
 * is identical: the server refuses a rejection without remarks, so there is
 * always a box, and the only thing that changes is the count in the title.
 * Approving needs no sheet at all - it is one press from the row or the bulk
 * bar - which is the asymmetry the queue is built around: the common answer is
 * cheap and the consequential one asks a question.
 *
 * The remarks are sent to the uploader, so the copy says so. A reviewer typing
 * "bad scan" into a box with no audience is writing a note to nobody; the same
 * reviewer told it reaches the NGO writes "the second page is cut off".
 *
 * **The remarks survive a failed request.** Confirming no longer clears the
 * box: the parent closes the sheet (`count` → 0) only once the rejection has
 * gone through, and that close is what clears it. It used to clear on press,
 * so a 500 or a dropped connection left the sheet open, the error toast up,
 * and the reviewer's paragraph gone.
 */
export function RejectDocumentsSheet({
	count,
	onClose,
	onConfirm,
	pending,
}: {
	/** How many documents are being rejected. 0 closes the sheet. */
	count: number;
	onClose: () => void;
	onConfirm: (remarks: string) => void;
	pending?: boolean;
}) {
	const { spacing } = useTheme();
	const [remarks, setRemarks] = useState("");
	const [error, setError] = useState<string | null>(null);

	// Cleared whenever the sheet goes away - dismissed, or closed by the parent
	// after a successful rejection - and never while it is still showing.
	useEffect(() => {
		if (count === 0) {
			setRemarks("");
			setError(null);
		}
	}, [count]);

	const close = () => {
		setRemarks("");
		setError(null);
		onClose();
	};

	const confirm = () => {
		const text = remarks.trim();
		if (!text) {
			setError("Say what is wrong, so the uploader can fix it.");
			return;
		}
		setError(null);
		onConfirm(text);
	};

	return (
		<Sheet
			visible={count > 0}
			onClose={close}
			title={count > 1 ? `Reject ${count} documents` : "Reject document"}
			subtitle={
				count > 1
					? "One set of remarks is sent for all of them"
					: "The uploader is told why"
			}
			footer={
				<Button
					variant="destructive"
					onPress={confirm}
					{...(pending ? { loading: pending } : {})}
				>
					{count > 1 ? `Reject ${count}` : "Reject"}
				</Button>
			}
		>
			<Field
				label="What is wrong?"
				{...(error ? { error } : {})}
				hint="The uploader sees this and can re-submit."
			>
				<Input
					placeholder="e.g. The second page is cut off"
					value={remarks}
					onChangeText={(text) => {
						setRemarks(text);
						if (error && text.trim()) setError(null);
					}}
					autoFocus
					multiline
					maxLength={500}
					accessibilityLabel="Rejection remarks"
					{...(error ? { accessibilityHint: error } : {})}
					style={{ minHeight: 96, textAlignVertical: "top" }}
				/>
			</Field>

			{count > 1 && (
				// Said before they commit, not after: rejecting a mixed selection
				// with one reason is a decision, and one they can still undo by
				// closing this sheet.
				<Caption color="tertiary" style={{ marginBottom: spacing[2] }}>
					Every one of the {count} selected documents gets these remarks. If
					they are wrong for different reasons, reject them separately.
				</Caption>
			)}
			<View style={{ height: spacing[2] }} />
		</Sheet>
	);
}
