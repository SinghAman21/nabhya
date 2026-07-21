const { hairlineWidth } = require("nativewind/theme");

/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: "class",
	content: ["./src/**/*.{js,jsx,ts,tsx}"],
	presets: [require("nativewind/preset")],
	theme: {
		extend: {
			colors: {
				border: "#E5E7EB",
				input: "#E5E7EB",
				ring: "#FF7E40",
				background: "#FBFBF9",
				foreground: "#111111",
				primary: {
					DEFAULT: "#FF7E40",
					foreground: "#FFFFFF",
				},
				secondary: {
					DEFAULT: "#FAFAFA",
					foreground: "#404040",
				},
				destructive: {
					DEFAULT: "#EF4444",
					foreground: "#FFFFFF",
				},
				muted: {
					DEFAULT: "#F5F5F5",
					foreground: "#666666",
				},
				accent: {
					DEFAULT: "#FAFAFA",
					foreground: "#111111",
				},
				popover: {
					DEFAULT: "#FFFFFF",
					foreground: "#111111",
				},
				card: {
					DEFAULT: "#FFFFFF",
					foreground: "#111111",
				},
			},
			borderRadius: {
				lg: 16,
				md: 14,
				sm: 12,
			},
			borderWidth: {
				hairline: hairlineWidth(),
			},
			keyframes: {
				"accordion-down": {
					from: { height: "0" },
					to: { height: "var(--radix-accordion-content-height)" },
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: "0" },
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
			},
		},
	},
	future: {
		hoverOnlyWhenSupported: true,
	},
	plugins: [require("tailwindcss-animate")],
};
