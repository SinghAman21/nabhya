export interface TeamInviteEmailInput {
	to: string;
	organizationName: string;
	role: string;
	designation?: string | null;
	inviteUrl: string;
	expiresAt: Date;
}

export interface Mailer {
	sendTeamInvite(input: TeamInviteEmailInput): Promise<void>;
}
