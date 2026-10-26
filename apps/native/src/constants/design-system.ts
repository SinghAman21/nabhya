export const lightColors = {
	primary: {
		main: "#FF7E40",
		light: "#FFA366",
		dark: "#E05A1A",
		/** Label colour on a `primary.main` fill. Warm near-black: 7.44:1.
		 *  White here was 2.53:1 - the old default failed WCAG AA on every button. */
		contrast: "#1A0F0A",
		/** Brand as *text* on a light surface. #FF7E40 is 2.53:1 and unusable
		 *  for type or icons; this is 7.31:1 on white, 6.71:1 on `primary.tint`. */
		ink: "#9A3412",
		/** Faint brand wash for selected rows and brand-toned pills. */
		tint: "#FFF3EC",
	},
	neutral: {
		50: "#FAFAFA",
		100: "#F5F5F5",
		200: "#EEEEEE",
		300: "#E0E0E0",
		400: "#BDBDBD",
		500: "#9E9E9E",
		600: "#757575",
		700: "#616161",
		800: "#424242",
		900: "#212121",
		black: "#000000",
		white: "#FFFFFF",
	},
	success: {
		main: "#22C55E",
		light: "#4ADE80",
		dark: "#16A34A",
		bg: "#F0FDF4",
		border: "#22C55E",
		/** Text/icon grade on this tone's `bg` (6.81:1). `main` is a fill colour. */
		ink: "#166534",
		/** Icon/label colour *on* a `success.main` fill (6.5:1). White there is
		 *  2.3:1 - the verified badge's tick used to be hardcoded white. */
		contrast: "#052E16",
	},
	error: {
		main: "#EF4444",
		light: "#F87171",
		dark: "#DC2626",
		bg: "#FEF2F2",
		border: "#EF4444",
		/** Text/icon grade on this tone's `bg` (7.60:1). `main` is a fill colour. */
		ink: "#991B1B",
	},
	warning: {
		main: "#F59E0B",
		light: "#FBBF24",
		dark: "#D97706",
		bg: "#FFFBEB",
		border: "#F59E0B",
		/** Text/icon grade on this tone's `bg` (6.84:1). `main` is a fill colour. */
		ink: "#92400E",
	},
	info: {
		main: "#3B82F6",
		light: "#60A5FA",
		dark: "#2563EB",
		bg: "#EFF6FF",
		border: "#3B82F6",
		/** Text/icon grade on this tone's `bg` (8.01:1). `main` is a fill colour. */
		ink: "#1E40AF",
	},
	/**
	 * The fifth tone, for a category that is neither a status nor an action:
	 * today only "Story" on a feed card. It exists as a token because the card
	 * previously drew that pill from two hardcoded violets, which meant a
	 * white-violet pill on a near-black card in dark mode.
	 */
	accent: {
		main: "#8B5CF6",
		light: "#A78BFA",
		dark: "#7C3AED",
		bg: "#F5F3FF",
		border: "#8B5CF6",
		/** Text/icon grade on this tone's `bg` (8.59:1). `main` is a fill colour. */
		ink: "#5B21B6",
	},
	background: {
		warm: "#FBFBF9",
		primary: "#FFFFFF",
		secondary: "#FAFAFA",
		tertiary: "#F5F5F5",
		overlay: "#E5E5E5",
		/** Raised surface: cards, grouped lists, sheets. */
		card: "#FFFFFF",
		sheet: "#FFFFFF",
		/** Inset surface: chips, icon wells, quiet fills inside a card. */
		subtle: "#F4F4F2",
	},
	text: {
		primary: "#111111",
		secondary: "#404040",
		tertiary: "#666666",
		quaternary: "#757575",
		disabled: "#8E8E8E",
		inverse: "#FFFFFF",
	},
	border: {
		light: "#F3F4F6",
		medium: "#E5E7EB",
		dark: "#D1D5DB",
		/** Divider inside a grouped list. Visible, but only just. */
		hairline: "#ECECE8",
	},
	special: {
		premium: "#FBBF24",
		danger: "#FF5F57",
		link: "#333333",
		orange: "#D96D57",
		white: "#FFFFFF",
	},
	/**
	 * The dark brand panel beside sign-in / sign-up (`auth-split-layout.tsx`).
	 * Dark in both schemes - it is the logotype's ground, not a surface.
	 */
	brand: {
		/** The same warm near-black as dark mode. It was #0A0A0A here, so the
		 *  brand panel was a neutral black in light mode and a warm brown in
		 *  dark - two brands depending on a phone setting. */
		surface: "#1F1712",
		ink: "#FFFFFF",
		/** Body copy on `surface` (7.0:1). */
		muted: "#A3A3A3",
		/** Small print on `surface` (5.5:1). */
		faint: "#8F8F8F",
		rule: "#3A2E26",
	},
	shadow: "#00000050",
} as const;

/** Public editorial palette, built on the app's original orange brand tokens. */
export const landingColors = {
	primary: lightColors.primary.main,
	"primary-hover": lightColors.primary.light,
	"primary-contrast": lightColors.primary.contrast,
	"brand-ink": lightColors.primary.ink,
	heading: lightColors.brand.surface,
	panel: lightColors.brand.surface,
	ivory: "#F7F5EF",
	white: lightColors.neutral.white,
	accent: lightColors.primary.main,
	"accent-ink": lightColors.primary.ink,
	tint: lightColors.primary.tint,
	text: "#2C241F",
	muted: "#6B625C",
	border: "#E8DFD6",
	"on-panel-muted": "#E0CFC2",
	"on-panel-border": "#735D4C",
	"illustration-skin": "#BC7954",
	"illustration-skin-light": "#E4AE88",
	"illustration-denim": "#718793",
	"illustration-wall": "#E9DCCB",
} as const;

export const darkColors = {
	primary: {
		main: "#FF7E40",
		light: "#FFA366",
		dark: "#E05A1A",
		contrast: "#1A0F0A",
		/** 9.49:1 on the dark background - the light-mode ink would vanish here. */
		ink: "#FF9A66",
		tint: "#4A2A20",
	},
	neutral: {
		50: "#171717",
		100: "#262626",
		200: "#333333",
		300: "#404040",
		400: "#525252",
		500: "#737373",
		600: "#A3A3A3",
		700: "#D4D4D4",
		800: "#E5E5E5",
		900: "#F5F5F5",
		black: "#FFFFFF",
		white: "#0A0A0A",
	},
	success: {
		main: "#22C55E",
		light: "#4ADE80",
		dark: "#16A34A",
		bg: "#052E16",
		border: "#22C55E",
		/** Text/icon grade on this tone's dark `bg` (9.65:1). */
		ink: "#6EE7A0",
		contrast: "#052E16",
	},
	error: {
		main: "#EF4444",
		light: "#F87171",
		dark: "#DC2626",
		bg: "#450A0A",
		border: "#EF4444",
		/** Text/icon grade on this tone's dark `bg` (8.51:1). */
		ink: "#FCA5A5",
	},
	warning: {
		main: "#F59E0B",
		light: "#FBBF24",
		dark: "#D97706",
		bg: "#451A03",
		border: "#F59E0B",
		/** Text/icon grade on this tone's dark `bg` (10.39:1). */
		ink: "#FCD34D",
	},
	info: {
		main: "#3B82F6",
		light: "#60A5FA",
		dark: "#2563EB",
		bg: "#0C1F3F",
		border: "#3B82F6",
		/** Text/icon grade on this tone's dark `bg` (9.07:1). */
		ink: "#93C5FD",
	},
	accent: {
		main: "#8B5CF6",
		light: "#A78BFA",
		dark: "#7C3AED",
		bg: "#231A47",
		border: "#8B5CF6",
		/** Text/icon grade on this tone's dark `bg` (8.24:1). */
		ink: "#C4B5FD",
	},
	background: {
		warm: "#0E0E0E",
		primary: "#0A0A0A",
		secondary: "#171717",
		tertiary: "#262626",
		overlay: "#333333",
		/** Lifted off the page rather than cut into it - dark mode has no shadows. */
		card: "#191919",
		subtle: "#232323",
		sheet: "#111111",
	},
	text: {
		primary: "#F5F5F5",
		secondary: "#D4D4D4",
		tertiary: "#A3A3A3",
		quaternary: "#8F8F8F",
		disabled: "#6E6E6E",
		inverse: "#0A0A0A",
	},
	border: {
		light: "#262626",
		medium: "#333333",
		dark: "#404040",
		hairline: "#242424",
	},
	special: {
		premium: "#FBBF24",
		danger: "#FF5F57",
		link: "#D4D4D4",
		orange: "#D96D57",
		white: "#FFFFFF",
	},
	brand: {
		/** Lifted and warmed off `background.warm` (#0E0E0E). The light-mode
		 *  #0A0A0A sat 1% away from it, so in dark mode the phone's brand bar
		 *  vanished into the form below it. */
		surface: "#1F1712",
		ink: "#FFFFFF",
		/** 7.0:1 on this surface. */
		muted: "#A3A3A3",
		/** 5.5:1 on this surface. */
		faint: "#8F8F8F",
		rule: "#3A2E26",
	},
	shadow: "#00000080",
} as const;

/**
 * Chrome drawn *over* photos and video - feed tiles and the fullscreen viewer.
 * One set for both schemes on purpose: the ground is the picture, not the
 * theme, so a scrim that flipped to white in light mode would wash the image
 * out. White ink on a 55% black scrim reads on any frame.
 */
/**
 * The grounds of the brand panels (`components/panel-wash.tsx`): a dark,
 * near-flat colour with one faint tonal wash in a corner - enough that the
 * panel is not a flat slab, never enough to read as a glow. One set for both
 * schemes on purpose, like `mediaColors`: each panel is its own dark ground.
 *
 * An earlier pass drew a solid orange sun and rings here. It was the loudest
 * thing on the sign-in screen; the panel should frame the words, not compete.
 */
export const panelGrounds = {
	/** Sign-in and sign-up: warm, the brand's own ground. */
	ember: { ground: "#16100D", wash: "#FF7E40", strength: 0.16 },
	/** The onboarding rail: a deep blue, quieter - a working surface. */
	dusk: { ground: "#0E1322", wash: "#4F7BFF", strength: 0.18 },
} as const;

export type PanelGround = keyof typeof panelGrounds;

/** Rules, wells and secondary type on a panel ground - white at low alpha. */
export const panelInk = {
	fill: "rgba(255,255,255,0.05)",
	border: "rgba(255,255,255,0.1)",
	/** Body copy (>= 7:1 on either ground). */
	muted: "rgba(255,255,255,0.68)",
	/** Small print (>= 4.6:1). */
	faint: "rgba(255,255,255,0.5)",
} as const;

export const mediaColors = {
	ink: "#FFFFFF",
	/** Secondary text over the viewer's black ground (the "2 / 5" counter). */
	inkMuted: "#A3A3A3",
	scrim: "rgba(0,0,0,0.55)",
	scrimPressed: "rgba(0,0,0,0.75)",
	/** The unfilled part of the video scrubber. */
	track: "rgba(255,255,255,0.25)",
	/** Letterbox behind a video tile before the first frame. */
	stage: "#111111",
	/** The fullscreen viewer's ground. */
	viewer: "#000000",
	/** A liked heart over media - `error.light`, readable on black in both modes. */
	liked: "#F87171",
} as const;

export const typography = {
	fontFamily: {
		display: "NeutralFace-Bold",
		displayRegular: "NeutralFace",
		sans: "MonaSans",
		sansBold: "MonaSans-Bold",
		sansMedium: "MonaSans-Medium",
		sansLight: "MonaSans-Light",
		mono: "MonaSans",
	},
	fontSize: {
		xs: 11,
		sm: 12,
		base: 14,
		md: 15,
		lg: 16,
		xl: 17,
		"2xl": 20,
		"3xl": 24,
		"4xl": 26,
		"5xl": 30,
		"6xl": 36,
		"7xl": 42,
	},
	fontWeight: {
		light: "300" as const,
		normal: "400" as const,
		medium: "500" as const,
		semibold: "600" as const,
		bold: "700" as const,
	},
	lineHeight: {
		tight: 1.2,
		snug: 1.375,
		normal: 1.5,
		relaxed: 1.625,
		loose: 2,
	},
	letterSpacing: {
		tighter: -0.8,
		tight: -0.43,
		normal: 0,
		wide: 0.37,
		wider: 0.8,
	},
} as const;

export const spacing = {
	0: 0,
	0.5: 2,
	1: 4,
	1.5: 6,
	2: 8,
	2.5: 10,
	3: 12,
	3.5: 14,
	4: 16,
	5: 20,
	6: 24,
	7: 28,
	8: 32,
	9: 36,
	10: 40,
	12: 48,
	14: 56,
	16: 64,
	20: 80,
	24: 96,
	28: 112,
	32: 128,
} as const;

export const borderRadius = {
	none: 0,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 20,
	"2xl": 24,
	"3xl": 26,
	"4xl": 36,
	full: 9999,
} as const;

export const shadows = {
	none: {
		shadowColor: "transparent",
		shadowOffset: { width: 0, height: 0 },
		shadowOpacity: 0,
		shadowRadius: 0,
		elevation: 0,
	},
	sm: {
		shadowColor: "#00000050",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 2,
		elevation: 8,
	},
	md: {
		shadowColor: "#000000ba",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.06,
		shadowRadius: 8,
		elevation: 4,
	},
	lg: {
		shadowColor: "#000000ba",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 12,
		elevation: 10,
	},
	xl: {
		shadowColor: "#000000ba",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.12,
		shadowRadius: 16,
		elevation: 8,
	},
	"2xl": {
		shadowColor: "#000000ba",
		shadowOffset: { width: 0, height: 12 },
		shadowOpacity: 0.15,
		shadowRadius: 24,
		elevation: 12,
	},
} as const;

/**
 * Card elevation. Deliberately shallow - the surface should separate from the
 * page without announcing itself. Dark mode leans on `background.card` instead,
 * since a shadow on near-black is invisible.
 */
export const elevation = {
	card: {
		shadowColor: "#0B0B0F",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 3,
		elevation: 1,
	},
	raised: {
		shadowColor: "#0B0B0F",
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.08,
		shadowRadius: 16,
		elevation: 6,
	},
} as const;

export const layout = {
	container: {
		sm: 640,
		md: 768,
		lg: 1024,
		xl: 1280,
	},
	screenPadding: {
		horizontal: spacing[4],
		vertical: spacing[5],
	},
	height: {
		button: { sm: 32, md: 40, lg: 44, xl: 52 },
		input: { sm: 40, md: 48, lg: 56 },
		header: 60,
		tabBar: 68,
	},
	iconSize: {
		xs: 16,
		sm: 18,
		md: 20,
		lg: 24,
		xl: 28,
		"2xl": 32,
		"3xl": 40,
	},
} as const;

export const animation = {
	duration: {
		fast: 150,
		normal: 300,
		slow: 500,
	},
	easing: {
		linear: "linear",
		ease: "ease",
		easeIn: "ease-in",
		easeOut: "ease-out",
		easeInOut: "ease-in-out",
	},
	spring: {
		gentle: { damping: 50, stiffness: 300 },
		bouncy: { damping: 15, stiffness: 400 },
		stiff: { damping: 100, stiffness: 400 },
	},
} as const;

export const opacity = {
	0: 0,
	5: 0.05,
	10: 0.1,
	20: 0.2,
	25: 0.25,
	30: 0.3,
	40: 0.4,
	50: 0.5,
	60: 0.6,
	70: 0.7,
	75: 0.75,
	80: 0.8,
	90: 0.9,
	95: 0.95,
	100: 1,
} as const;

export const getShadow = (size: keyof typeof shadows) => shadows[size];

export const withOpacity = (color: string, opacity: number): string => {
	if (color.startsWith("#")) {
		const r = Number.parseInt(color.slice(1, 3), 16);
		const g = Number.parseInt(color.slice(3, 5), 16);
		const b = Number.parseInt(color.slice(5, 7), 16);
		return `rgba(${r}, ${g}, ${b}, ${opacity})`;
	}
	return color;
};

const getLuminance = (color: string): number => {
	const hex = color.replace("#", "");
	const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
	const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
	const b = Number.parseInt(hex.slice(4, 6), 16) / 255;

	const toLinear = (c: number) =>
		c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

	return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

export const getContrastColor = (backgroundColor: string): string => {
	const luminance = getLuminance(backgroundColor);
	return luminance > 0.5 ? lightColors.neutral[900] : lightColors.neutral.white;
};

export const isLightColor = (color: string): boolean =>
	getLuminance(color) > 0.5;
