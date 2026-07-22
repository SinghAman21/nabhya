import { describe, expect, it } from "vitest";
import { renderVerificationEmail } from "./verification-email";

const URL = "https://app.nabhya.org/verify?token=abc123";

describe("renderVerificationEmail", () => {
	it("renders the link, greeting and subject", () => {
		const email = renderVerificationEmail({
			recipientName: "Asha Rao",
			verificationUrl: URL,
		});

		expect(email.subject).toContain("Nabhya");
		expect(email.html).toContain(URL);
		expect(email.html).toContain("Hi Asha Rao,");
		expect(email.text).toContain(URL);
		expect(email.text).toContain("Hi Asha Rao,");
	});

	it("falls back to a generic greeting without a name", () => {
		const email = renderVerificationEmail({ verificationUrl: URL });
		expect(email.html).toContain("Hi there,");
		expect(email.text).toContain("Hi there,");
	});

	it("escapes HTML in the recipient name", () => {
		const email = renderVerificationEmail({
			recipientName: '<img src=x onerror="alert(1)">',
			verificationUrl: URL,
		});
		expect(email.html).not.toContain("<img src=x");
		expect(email.html).toContain("&lt;img");
	});

	it("shows the one-time code only when provided", () => {
		const withCode = renderVerificationEmail({
			verificationUrl: URL,
			code: "482913",
		});
		expect(withCode.html).toContain("482913");
		expect(withCode.text).toContain("482913");

		const withoutCode = renderVerificationEmail({ verificationUrl: URL });
		expect(withoutCode.text).not.toContain("enter this code");
	});

	it("uses the provided expiry window in the copy", () => {
		const email = renderVerificationEmail({
			verificationUrl: URL,
			expiresInHours: 2,
		});
		expect(email.html).toContain("expires in 2 hours");
		expect(email.text).toContain("expires in 2 hours");
	});

	it("rejects non-http verification URLs", () => {
		expect(() =>
			renderVerificationEmail({ verificationUrl: "javascript:alert(1)" }),
		).toThrow(/absolute http/);
	});
});
