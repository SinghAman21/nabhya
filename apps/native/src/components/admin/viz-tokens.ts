/**
 * The console's chart palette.
 *
 * **Not the brand tones, on purpose.** `design-system.ts` is the source of
 * truth for the app's surfaces, inks and status colours, and the charts use it
 * for all of those. What it cannot supply is a *series* palette: `#FF7E40` is a
 * fill and measures 2.53:1 on white, so as a 2px line it fails the ≥3:1 a chart
 * mark needs, and the remaining tones (`success`, `error`, `warning`, `info`)
 * are **status** colours with reserved meaning — spending `error.main` on "new
 * volunteers" makes a growth line read as a problem.
 *
 * So the series slots come from a palette validated for the job, in both modes,
 * against these exact surfaces. Every value below was checked, not chosen:
 *
 * - **Series (categorical, all-pairs)** — blue / orange / aqua.
 *   Light: worst pair ΔE 9.2 (deuteranopia), normal-vision 24.0, all inside the
 *   L 0.43–0.77 band, chroma ≥ 0.10. Dark: ΔE 9.4, normal-vision 20.9, all ≥ 3:1
 *   on the dark surface. Aqua is 2.72:1 on the light surface, which is the one
 *   sub-3:1 slot — legal only with a relief channel, so **any chart using a
 *   third series must carry direct labels**. The two-series charts here do not
 *   reach it.
 * - **Pipeline (ordinal, one hue)** — three blue steps, monotone in lightness,
 *   adjacent ΔL ≥ 0.06, light end ≥ 2:1 on its surface. Ordinal rather than
 *   categorical because the order *is* the meaning: Pending → In review →
 *   Verified is a funnel, and a reader should see the progression in the colour.
 *   Dark reverses the ramp so "further along" stays the higher-contrast end.
 *
 * **Do not add a fourth series hue.** A generated one is indistinguishable from
 * an existing slot under simulated CVD; the answer is fewer series, a facet, or
 * a table.
 *
 * The order of the slots is itself the CVD-safety mechanism — assign them in
 * sequence, never cycle, and never reassign by rank (a filter that drops a
 * series must not repaint the survivors).
 */
export interface VizPalette {
	/** Categorical series slots, in fixed assignment order. */
	series: readonly [string, string, string];
	/** Ordinal ramp, first step nearest the surface. */
	pipeline: readonly [string, string, string];
	/** A stage that is off the pipeline (rejected). Neutral, not a series hue. */
	pipelineOff: string;
	/** Hairline grid and axis. One shade off the surface, never dashed. */
	grid: string;
	/** The bar/area track behind a partial fill. */
	track: string;
}

const LIGHT: VizPalette = {
	series: ["#2a78d6", "#eb6834", "#1baf7a"],
	pipeline: ["#86b6ef", "#3987e5", "#1c5cab"],
	pipelineOff: "#D8D8D2",
	grid: "#ECECE8",
	track: "#F0EFEC",
};

const DARK: VizPalette = {
	series: ["#3987e5", "#d95926", "#199e70"],
	// Reversed relative to light: on a dark surface the *lighter* step is the
	// high-contrast one, so "Verified" stays the most present segment.
	pipeline: ["#184f95", "#2a78d6", "#86b6ef"],
	pipelineOff: "#3A3A38",
	grid: "#242424",
	track: "#262626",
};

export function vizPalette(isDark: boolean): VizPalette {
	return isDark ? DARK : LIGHT;
}
