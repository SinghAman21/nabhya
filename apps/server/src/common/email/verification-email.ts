/**
 * Onboarding email-verification template.
 *
 * There is no email provider wired yet (root AGENTS.md - notifications are
 * in-app only), so this module is deliberately provider-agnostic: a pure
 * render function returning `{ subject, html, text }` that any transport
 * (Resend, SES, Postmark, Supabase's email-template hooks, …) can
 * hand off as-is. No Nest dependencies on purpose - it must stay importable
 * from scripts and tests without booting the app.
 *
 * The HTML is table-based with fully inlined styles so it renders in Outlook
 * and Gmail clipping-safe (< 102KB), uses no remote assets (images are
 * blocked by default in most clients - the wordmark is text), and carries a
 * hidden preheader for the inbox preview line.
 */

export interface VerificationEmailInput {
	/** Recipient's display name; falls back to a generic greeting. */
	recipientName?: string | null;
	/** The signed verification link the button and fallback text point at. */
	verificationUrl: string;
	/** Optional one-time code, shown in a code box when the flow uses OTP. */
	code?: string | null;
	/** Link/code validity window used in the copy. Default 24. */
	expiresInHours?: number;
}

export interface RenderedEmail {
	subject: string;
	html: string;
	text: string;
}

// Brand tokens mirrored from apps/native/src/constants/design-system.ts.
const BRAND = {
	primary: "#FF7E40",
	primaryDark: "#E05A1A",
	background: "#FBFBF9",
	card: "#FFFFFF",
	border: "#F3F4F6",
	textPrimary: "#111111",
	textSecondary: "#404040",
	textTertiary: "#666666",
	textQuaternary: "#999999",
} as const;

const FONT_STACK =
	"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function renderVerificationEmail(
	input: VerificationEmailInput,
): RenderedEmail {
	if (!/^https?:\/\//i.test(input.verificationUrl)) {
		throw new Error("verificationUrl must be an absolute http(s) URL");
	}

	const name = input.recipientName?.trim();
	const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi there,";
	const expiresInHours = input.expiresInHours ?? 24;
	const url = escapeHtml(input.verificationUrl);
	const code = input.code?.trim();
	const preheader =
		"Confirm your email to start volunteering with verified NGOs across India.";

	const codeBlock = code
		? `
              <!-- One-time code -->
              <tr>
                <td align="center" style="padding: 0 40px 28px 40px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" style="background-color: ${BRAND.background}; border: 1px solid ${BRAND.border}; border-radius: 12px; padding: 14px 28px;">
                        <span style="font-family: 'Courier New', Courier, monospace; font-size: 28px; font-weight: 700; letter-spacing: 8px; color: ${BRAND.textPrimary};">${escapeHtml(code)}</span>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 12px 0 0 0; font-family: ${FONT_STACK}; font-size: 13px; line-height: 20px; color: ${BRAND.textQuaternary};">
                    Enter this code in the app, or simply use the button above.
                  </p>
                </td>
              </tr>`
		: "";

	const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>Verify your email</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.background}; -webkit-text-size-adjust: 100%;">
  <!-- Preheader: shows in the inbox preview, invisible in the body -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${BRAND.background};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 600px; max-width: 100%;">

          <!-- Wordmark -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <span style="font-family: ${FONT_STACK}; font-size: 22px; font-weight: 800; letter-spacing: 2px; color: ${BRAND.primary}; text-transform: uppercase;">Nabhya</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color: ${BRAND.card}; border: 1px solid ${BRAND.border}; border-radius: 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                <!-- Accent bar -->
                <tr>
                  <td style="height: 4px; background-color: ${BRAND.primary}; border-radius: 16px 16px 0 0; font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>

                <!-- Heading -->
                <tr>
                  <td align="center" style="padding: 40px 40px 8px 40px;">
                    <h1 style="margin: 0; font-family: ${FONT_STACK}; font-size: 24px; line-height: 32px; font-weight: 700; color: ${BRAND.textPrimary};">Verify your email address</h1>
                  </td>
                </tr>

                <!-- Body copy -->
                <tr>
                  <td style="padding: 16px 40px 28px 40px;">
                    <p style="margin: 0 0 12px 0; font-family: ${FONT_STACK}; font-size: 15px; line-height: 24px; color: ${BRAND.textSecondary};">${greeting}</p>
                    <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 15px; line-height: 24px; color: ${BRAND.textSecondary};">
                      Welcome to <strong>Nabhya</strong> - where verified NGOs and volunteers across India find each other. Confirm your email address to finish setting up your account and start making a difference.
                    </p>
                  </td>
                </tr>

                <!-- Button (bulletproof: table-based, no VML needed at this size) -->
                <tr>
                  <td align="center" style="padding: 0 40px 28px 40px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="background-color: ${BRAND.primary}; border-radius: 12px;">
                          <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 40px; font-family: ${FONT_STACK}; font-size: 16px; font-weight: 700; line-height: 20px; color: #FFFFFF; text-decoration: none; border-radius: 12px;">Verify my email</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
${codeBlock}
                <!-- Expiry note -->
                <tr>
                  <td align="center" style="padding: 0 40px 32px 40px;">
                    <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 13px; line-height: 20px; color: ${BRAND.textQuaternary};">
                      This link expires in ${expiresInHours} hours. If it has expired, sign in again to request a new one.
                    </p>
                  </td>
                </tr>

                <!-- Divider + fallback link -->
                <tr>
                  <td style="padding: 0 40px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="border-top: 1px solid ${BRAND.border}; font-size: 0; line-height: 0;">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px 36px 40px;">
                    <p style="margin: 0 0 6px 0; font-family: ${FONT_STACK}; font-size: 13px; line-height: 20px; color: ${BRAND.textTertiary};">
                      If the button doesn't work, copy and paste this link into your browser:
                    </p>
                    <p style="margin: 0; word-break: break-all;">
                      <a href="${url}" target="_blank" style="font-family: ${FONT_STACK}; font-size: 13px; line-height: 20px; color: ${BRAND.primaryDark}; text-decoration: underline;">${url}</a>
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 28px 24px 0 24px;">
              <p style="margin: 0 0 6px 0; font-family: ${FONT_STACK}; font-size: 12px; line-height: 18px; color: ${BRAND.textQuaternary};">
                You're receiving this because someone signed up for Nabhya with this address.<br />
                If it wasn't you, you can safely ignore this email - no account will be activated.
              </p>
              <p style="margin: 12px 0 0 0; font-family: ${FONT_STACK}; font-size: 12px; line-height: 18px; color: ${BRAND.textQuaternary};">
                Nabhya · Connecting verified NGOs and volunteers across India
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

	const text = [
		name ? `Hi ${name},` : "Hi there,",
		"",
		"Welcome to Nabhya - where verified NGOs and volunteers across India find each other.",
		"Confirm your email address to finish setting up your account:",
		"",
		input.verificationUrl,
		...(code ? ["", `Or enter this code in the app: ${code}`] : []),
		"",
		`This link expires in ${expiresInHours} hours. If it has expired, sign in again to request a new one.`,
		"",
		"If you didn't sign up for Nabhya, you can safely ignore this email - no account will be activated.",
		"",
		"Nabhya · Connecting verified NGOs and volunteers across India",
	].join("\n");

	return {
		subject: "Verify your email to get started with Nabhya",
		html,
		text,
	};
}
