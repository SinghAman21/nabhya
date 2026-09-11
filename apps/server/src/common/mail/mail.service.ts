import { env } from "@nabhya/env/server";
import { Injectable, Logger } from "@nestjs/common";
import type { Mailer, TeamInviteEmailInput } from "./mail.types";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

@Injectable()
export class MailService implements Mailer {
	private readonly logger = new Logger(MailService.name);
	private readonly from = `${env.MAIL_FROM_NAME} <${env.MAIL_FROM_EMAIL}>`;

	async sendTeamInvite(input: TeamInviteEmailInput): Promise<void> {
		if (!env.RESEND_API_KEY) {
			this.logger.warn(
				`Resend is not configured; team invite email to ${input.to} was not sent.`,
			);
			return;
		}

		const response = await fetch(RESEND_EMAILS_URL, {
			method: "POST",
			headers: {
				authorization: `Bearer ${env.RESEND_API_KEY}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				from: this.from,
				to: input.to,
				subject: `You're invited to join ${input.organizationName} on Nabhya`,
				html: this.teamInviteHtml(input),
				text: this.teamInviteText(input),
			}),
		});

		if (!response.ok) {
			const body = await response.text();
			throw new Error(
				`Resend email failed with ${response.status}: ${body.slice(0, 500)}`,
			);
		}
	}

	private teamInviteText(input: TeamInviteEmailInput) {
		const designation = input.designation ? ` (${input.designation})` : "";
		return [
			`You've been invited to join ${input.organizationName} on Nabhya as ${input.role}${designation}.`,
			"",
			`Accept the invite: ${input.inviteUrl}`,
			"",
			`This invite expires on ${input.expiresAt.toDateString()}.`,
		].join("\n");
	}

	private teamInviteHtml(input: TeamInviteEmailInput) {
		const designation = input.designation ? ` (${input.designation})` : "";
		return `
			<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #172033;">
				<h1 style="font-size: 22px; margin-bottom: 12px;">Join ${this.escape(input.organizationName)} on Nabhya</h1>
				<p>You've been invited as <strong>${this.escape(input.role)}${this.escape(designation)}</strong>.</p>
				<p>
					<a href="${this.escape(input.inviteUrl)}" style="display: inline-block; padding: 12px 18px; background: #1f6feb; color: white; text-decoration: none; border-radius: 8px;">
						Accept invite
					</a>
				</p>
				<p style="color: #5b6472; font-size: 14px;">This invite expires on ${this.escape(input.expiresAt.toDateString())}.</p>
				<p style="color: #5b6472; font-size: 14px;">If the button does not work, copy this link: ${this.escape(input.inviteUrl)}</p>
			</div>
		`;
	}

	private escape(value: string) {
		return value
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll('"', "&quot;");
	}
}
