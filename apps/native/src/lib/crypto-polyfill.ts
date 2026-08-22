import * as ExpoCrypto from "expo-crypto";

const g = globalThis as Record<string, unknown>;

if (ExpoCrypto.getRandomValues) {
	g.crypto ??= {} as Crypto;
	const cryptoObj = g.crypto as Crypto;
	cryptoObj.getRandomValues ??= ExpoCrypto.getRandomValues.bind(
		ExpoCrypto,
	) as Crypto["getRandomValues"];
	cryptoObj.randomUUID ??= () => {
		const bytes = ExpoCrypto.getRandomValues(new Uint8Array(16));
		bytes[6] = (bytes[6] & 0x0f) | 0x40;
		bytes[8] = (bytes[8] & 0x3f) | 0x80;
		const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
			"",
		);
		return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`;
	};
}
