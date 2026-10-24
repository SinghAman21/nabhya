export interface TeamInviteEmailInput {
	to: string;
	organizationName: string;
	role: string;
	designation?: string | null;
	inviteUrl: string;
	expiresAt: Date;
}

export interface DonationReceiptEmailInput {
	to: string;
	donorName: string | null;
	organizationName: string;
	/** Already formatted, e.g. "INR 1,500.00". */
	amount: string;
	receiptNumber: string;
	completedAt: Date;
	/** The rendered receipt, attached so a guest donor has it without an account. */
	pdf: Uint8Array;
}

export interface Mailer {
	sendTeamInvite(input: TeamInviteEmailInput): Promise<void>;
	sendDonationReceipt(input: DonationReceiptEmailInput): Promise<void>;
}
