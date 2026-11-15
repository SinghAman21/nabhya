import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./encryption";

describe("AES-256-GCM encryption", () => {
	const sampleKey =
		"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

	it("round-trips arbitrary plaintext", () => {
		const account = "12345678901234";
		const encrypted = encrypt(account, sampleKey);

		expect(encrypted).not.toBe(account);
		expect(encrypted.split(":")).toHaveLength(3);

		const decrypted = decrypt(encrypted, sampleKey);
		expect(decrypted).toBe(account);
	});

	it("produces distinct ciphertexts for identical plaintext (IV randomness)", () => {
		const plaintext = "98765432109876";
		const enc1 = encrypt(plaintext, sampleKey);
		const enc2 = encrypt(plaintext, sampleKey);

		expect(enc1).not.toBe(enc2);
		expect(decrypt(enc1, sampleKey)).toBe(plaintext);
		expect(decrypt(enc2, sampleKey)).toBe(plaintext);
	});

	it("rejects tampered ciphertext", () => {
		const encrypted = encrypt("secret", sampleKey);
		const [iv, tag, cipher] = encrypted.split(":") as [string, string, string];

		// Flip one character in the ciphertext
		const tamperedCipher =
			cipher.slice(0, -1) + (cipher.slice(-1) === "a" ? "b" : "a");
		const tampered = `${iv}:${tag}:${tamperedCipher}`;

		expect(() => decrypt(tampered, sampleKey)).toThrow();
	});

	it("rejects tampered authentication tag", () => {
		const encrypted = encrypt("secret", sampleKey);
		const [iv, tag, cipher] = encrypted.split(":") as [string, string, string];

		const tamperedTag = tag.slice(0, -1) + (tag.slice(-1) === "a" ? "b" : "a");
		const tampered = `${iv}:${tamperedTag}:${cipher}`;

		expect(() => decrypt(tampered, sampleKey)).toThrow();
	});

	it("rejects decryption with the wrong key", () => {
		const encrypted = encrypt("secret", sampleKey);
		const wrongKey =
			"fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

		expect(() => decrypt(encrypted, wrongKey)).toThrow();
	});
});
