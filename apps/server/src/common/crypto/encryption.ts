import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@nabhya/env/server";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * Output format: `${ivHex}:${authTagHex}:${ciphertextHex}`
 * - IV is randomly generated per call.
 * - GCM provides authenticated encryption: ciphertext cannot be altered without
 *   detection.
 */
export function encrypt(
	plaintext: string,
	keyHex = env.ENCRYPTION_MASTER_KEY,
): string {
	const key = Buffer.from(keyHex, "hex");
	if (key.length !== 32) {
		throw new Error("Master key must be exactly 32 bytes (64 hex characters)");
	}

	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);

	const ciphertext = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);

	const authTag = cipher.getAuthTag();

	return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Decrypts an AES-256-GCM payload produced by `encrypt`.
 *
 * Expects `${ivHex}:${authTagHex}:${ciphertextHex}`.
 * Throws if the authentication tag fails (tampered payload or wrong key).
 */
export function decrypt(
	payload: string,
	keyHex = env.ENCRYPTION_MASTER_KEY,
): string {
	const parts = payload.split(":");
	if (parts.length !== 3) {
		throw new Error(
			"Invalid encrypted payload format: expected iv:authTag:ciphertext",
		);
	}

	const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];

	const key = Buffer.from(keyHex, "hex");
	if (key.length !== 32) {
		throw new Error("Master key must be exactly 32 bytes (64 hex characters)");
	}

	const iv = Buffer.from(ivHex, "hex");
	const authTag = Buffer.from(authTagHex, "hex");
	const ciphertext = Buffer.from(ciphertextHex, "hex");

	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);

	const plaintext = Buffer.concat([
		decipher.update(ciphertext),
		decipher.final(),
	]);

	return plaintext.toString("utf8");
}
