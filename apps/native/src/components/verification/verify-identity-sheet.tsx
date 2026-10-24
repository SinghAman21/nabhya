import { Clock, ShieldCheck, TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Body, Caption, H4, Label } from "@/components/ui/typography";
import {
	IdCapture,
	type IdCaptureValue,
} from "@/components/verification/id-capture";
import {
	SelfieCapture,
	type SelfieCaptureValue,
} from "@/components/verification/selfie-capture";
import {
	useIdentityStatus,
	useUploadUserDocument,
} from "@/hooks/use-documents";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";

/**
 * Identity verification, as one flow with two hosts.
 *
 * It is a task you step into and out of, not a place: the volunteer opens it
 * from Profile or from a disabled Apply / Pledge, does two captures, and goes
 * back to what they were doing. So the primary host is `VerifyIdentitySheet`
 * (a `wide` dialog on desktop, a bottom sheet on a phone), and the
 * `/verify-identity` route renders the same flow for deep links and the
 * notification that points at it.
 *
 * Every outcome is stated in the body, never an `Alert`: a failed upload has to
 * stay readable while a photo is retaken, and a success has to survive being
 * read. "Verified" and "under review" are a quiet status block - an icon, a
 * line and a sentence - rather than a tinted banner over an empty page.
 */
export function useVerifyIdentityFlow({ onDone }: { onDone: () => void }) {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const upload = useUploadUserDocument();
	const identity = useIdentityStatus();
	// A pending submission hides the capture form until asked for: offering it
	// unprompted read as "your upload was lost, do it again".
	const [replacing, setReplacing] = useState(false);
	const [idValue, setIdValue] = useState<IdCaptureValue | null>(null);
	const [selfieValue, setSelfieValue] = useState<SelfieCaptureValue | null>(
		null,
	);
	const [submitting, setSubmitting] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const replaceAll = identity.state === "rejected" || replacing;
	const needsId = replaceAll || !identity.hasGovId;
	const needsSelfie = replaceAll || !identity.hasSelfie;
	const required = Number(needsId) + Number(needsSelfie);
	const done =
		Number(needsId && !!idValue) + Number(needsSelfie && !!selfieValue);
	const canSubmit =
		required > 0 && done === required && !submitting && !submitted;

	const submit = async () => {
		if ((needsId && !idValue) || (needsSelfie && !selfieValue)) return;
		// Keep both replacement captures visible if the first upload changes the
		// server state before the second upload fails.
		if (identity.state === "rejected") setReplacing(true);
		setSubmitting(true);
		setError(null);
		try {
			if (needsId && idValue) {
				await upload.mutateAsync({
					documentType: idValue.documentType,
					documentKey: idValue.key,
				});
			}
			if (needsSelfie && selfieValue) {
				await upload.mutateAsync({
					documentType: "SELFIE",
					documentKey: selfieValue.primaryKey,
					metadata: {
						liveness: {
							challenge: selfieValue.challenge,
							secondaryFrameKey: selfieValue.secondaryFrameKey,
						},
					},
				});
			}
			setSubmitted(true);
			identity.refetch();
		} catch (e) {
			setError(
				apiErrorMessage(
					e,
					"We couldn't submit your documents. Check your connection and try again.",
				),
			);
		} finally {
			setSubmitting(false);
		}
	};

	const loading = identity.loading && !submitted;
	const status: StatusKind | null = submitted
		? "submitted"
		: identity.state === "verified"
			? "verified"
			: identity.state === "review" && !replacing
				? "review"
				: null;

	/* Body ------------------------------------------------------------------- */

	let body: React.ReactNode;
	if (loading) {
		body = (
			<View style={{ paddingVertical: spacing[10], alignItems: "center" }}>
				<Caption color="tertiary">Checking your verification</Caption>
			</View>
		);
	} else if (status) {
		body = <StatusBlock kind={status} />;
	} else {
		const intro =
			identity.state === "rejected"
				? {
						tone: "error" as const,
						title: "Your last submission needs another look",
						text: identity.remarks
							? `Reviewer's note: ${identity.remarks} Retake whichever photo it mentions and submit again.`
							: "Retake your ID and selfie - make sure the text is sharp and your face is well lit - and submit again.",
					}
				: identity.state === "partial"
					? {
							tone: "warning" as const,
							title: "One document received",
							text: identity.hasGovId
								? "Your ID is in. Add the selfie below to finish."
								: "Your selfie is in. Add your ID below to finish.",
						}
					: {
							tone: "neutral" as const,
							title: "Why verify?",
							text: "NGOs meet volunteers in person, so applying and pledging need a verified ID. Your photos are seen only by Nabhya's reviewers, never by NGOs.",
						};

		body = (
			<View style={{ gap: spacing[5] }}>
				<Intro {...intro} />
				<View
					style={{
						flexDirection: isDesktop ? "row" : "column",
						gap: spacing[4],
						alignItems: isDesktop ? "flex-start" : "stretch",
					}}
				>
					<Step
						index={1}
						title="Your Aadhaar card"
						received={!needsId}
						receivedNote="Already received. Only the selfie remains."
					>
						<IdCapture
							onChange={setIdValue}
							disabled={submitting || submitted}
						/>
					</Step>
					<Step
						index={2}
						title="A quick selfie"
						received={!needsSelfie}
						receivedNote="Already received. Only your ID remains."
					>
						<SelfieCapture
							onChange={setSelfieValue}
							disabled={submitting || submitted}
						/>
					</Step>
				</View>
			</View>
		);
	}

	/* Footer ----------------------------------------------------------------- */

	let footer: React.ReactNode = null;
	if (!loading) {
		if (status) {
			footer = (
				<FooterRow>
					{status === "review" ? (
						<Button variant="ghost" onPress={() => setReplacing(true)}>
							Replace photos
						</Button>
					) : null}
					<Button onPress={onDone}>Done</Button>
				</FooterRow>
			);
		} else {
			footer = (
				<View style={{ gap: spacing[2] }}>
					{/* The failure sits directly above the control that caused it, so
					    it is still on screen while the photo is retaken. */}
					{error ? (
						<Caption
							accessibilityLiveRegion="polite"
							color={colors.error.ink as string}
						>
							{error}
						</Caption>
					) : null}
					<FooterRow
						note={
							done === required
								? "Ready to submit."
								: `${done} of ${required} photos ready`
						}
					>
						<Button onPress={submit} disabled={!canSubmit} loading={submitting}>
							{error ? "Retry submission" : "Submit for review"}
						</Button>
					</FooterRow>
				</View>
			);
		}
	}

	return { body, footer };
}

/**
 * The modal host. `key` resets the flow on every open, so a second visit does
 * not reopen on the last one's "Submitted" state or half-taken photos.
 */
export function VerifyIdentitySheet({
	visible,
	onClose,
}: {
	visible: boolean;
	onClose: () => void;
}) {
	const [session, setSession] = useState(visible ? 1 : 0);
	const [wasVisible, setWasVisible] = useState(visible);
	if (visible !== wasVisible) {
		setWasVisible(visible);
		if (visible) setSession((n) => n + 1);
	}

	// Nothing mounts until the first open. The flow reads `/me` and the
	// documents list, and this sheet sits on public pages (every `PledgeSheet`
	// carries one): mounted eagerly it would query the account of a signed-out
	// visitor, and a 401 there force-signs-out. After the first open it stays
	// mounted so the close animation has something to animate.
	if (session === 0) return null;

	return <SheetBody key={session} visible={visible} onClose={onClose} />;
}

function SheetBody({
	visible,
	onClose,
}: {
	visible: boolean;
	onClose: () => void;
}) {
	const flow = useVerifyIdentityFlow({ onDone: onClose });

	return (
		<Sheet
			visible={visible}
			onClose={onClose}
			title="Verify your identity"
			subtitle="An Aadhaar photo and a quick selfie"
			wide
			footer={flow.footer}
		>
			{flow.body}
		</Sheet>
	);
}

/**
 * Owns a `VerifyIdentitySheet` for a screen. Returns the opener and the element
 * to mount once, at the screen's root (never inside another sheet: a Modal in a
 * Modal is what the "sequentially, never nested" rule exists for).
 */
export function useVerifyIdentitySheet() {
	const [open, setOpen] = useState(false);
	return {
		open: () => setOpen(true),
		sheet: (
			<VerifyIdentitySheet visible={open} onClose={() => setOpen(false)} />
		),
	};
}

/* -------------------------------------------------------------------------- */
/* Parts                                                                      */
/* -------------------------------------------------------------------------- */

type StatusKind = "verified" | "review" | "submitted";

const STATUS_COPY: Record<StatusKind, { title: string; text: string }> = {
	verified: {
		title: "You're verified",
		text: "NGOs see the verified badge on your applications and offers. There's nothing else to do here.",
	},
	review: {
		title: "Under review",
		text: "A reviewer is checking your ID and selfie, usually within a day or two. The result arrives in Activity.",
	},
	submitted: {
		title: "Submitted for review",
		text: "Your ID and selfie are in. A reviewer usually gets to them within a day or two, and the result arrives in Activity.",
	},
};

function StatusBlock({ kind }: { kind: StatusKind }) {
	const { colors, spacing } = useTheme();
	const verified = kind === "verified";
	const Icon = verified ? ShieldCheck : Clock;
	const copy = STATUS_COPY[kind];

	return (
		<View
			accessibilityLiveRegion="polite"
			style={{
				flexDirection: "row",
				gap: spacing[4],
				alignItems: "flex-start",
				paddingVertical: spacing[4],
			}}
		>
			<View
				style={{
					width: 44,
					height: 44,
					borderRadius: 22,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: verified
						? colors.success.bg
						: colors.background.subtle,
				}}
			>
				<Icon
					size={20}
					strokeWidth={2}
					color={
						verified
							? (colors.success.ink as string)
							: (colors.text.secondary as string)
					}
				/>
			</View>
			<View style={{ flex: 1, minWidth: 0, gap: spacing[1] }}>
				<H4 accessibilityRole="header">{copy.title}</H4>
				<Body color="secondary">{copy.text}</Body>
			</View>
		</View>
	);
}

/** One line of context above the steps. Type, not a tinted block. */
function Intro({
	tone,
	title,
	text,
}: {
	tone: "neutral" | "warning" | "error";
	title: string;
	text: string;
}) {
	const { colors, spacing } = useTheme();
	const ink =
		tone === "error"
			? (colors.error.ink as string)
			: tone === "warning"
				? (colors.warning.ink as string)
				: undefined;

	return (
		<View
			style={{ flexDirection: "row", gap: spacing[2.5] }}
			accessibilityLiveRegion={tone === "neutral" ? undefined : "polite"}
		>
			{tone !== "neutral" ? (
				<TriangleAlert
					size={16}
					strokeWidth={2}
					color={ink}
					style={{ marginTop: 2 }}
				/>
			) : null}
			<View style={{ flex: 1, minWidth: 0, gap: spacing[0.5] }}>
				<Label weight="bold" color={ink}>
					{title}
				</Label>
				<Caption color="secondary">{text}</Caption>
			</View>
		</View>
	);
}

/**
 * A numbered capture panel: a hairline outline rather than a raised card, so it
 * reads the same on the sheet's fill and on the page.
 */
function Step({
	index,
	title,
	received,
	receivedNote,
	children,
}: {
	index: number;
	title: string;
	received: boolean;
	receivedNote: string;
	children: React.ReactNode;
}) {
	const { colors, spacing, borderRadius } = useTheme();

	return (
		<View
			style={{
				flex: 1,
				minWidth: 0,
				alignSelf: "stretch",
				borderWidth: 1,
				borderColor: colors.border.hairline,
				borderRadius: borderRadius.lg,
				padding: spacing[4],
				gap: spacing[3],
			}}
		>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}
			>
				<View
					style={{
						width: 22,
						height: 22,
						borderRadius: 11,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: received
							? colors.success.bg
							: colors.background.subtle,
					}}
				>
					{received ? (
						<ShieldCheck
							size={12}
							strokeWidth={2.4}
							color={colors.success.ink as string}
						/>
					) : (
						<Caption weight="bold" color="secondary">
							{index}
						</Caption>
					)}
				</View>
				<Label weight="bold">{title}</Label>
			</View>
			{received ? <Caption color="tertiary">{receivedNote}</Caption> : children}
		</View>
	);
}

/**
 * Note on the left, actions sized to their labels on the right. A 620pt
 * dialog with a full-width Done reads as a page bar, not a dialog action.
 */
function FooterRow({
	note,
	children,
}: {
	note?: string;
	children: React.ReactNode;
}) {
	const { spacing } = useTheme();

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[3],
			}}
		>
			<View style={{ flex: 1, minWidth: 0 }}>
				{note ? (
					<Caption color="tertiary" numberOfLines={2}>
						{note}
					</Caption>
				) : null}
			</View>
			<View style={{ flexDirection: "row", gap: spacing[2] }}>{children}</View>
		</View>
	);
}
