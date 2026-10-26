import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/motion";
import { STORY_SCENE_MS, VOLUNTEERING_STORY } from "./story-content";

/** One cancellable timer; CSS paints progress without a React render per frame. */
export function useStoryPlayback() {
	const rootRef = useRef<HTMLElement>(null);
	const remaining = useRef(STORY_SCENE_MS);
	const generation = useRef(0);
	const [active, setActive] = useState(0);
	const [cycle, setCycle] = useState(0);
	const [manualPause, setManualPause] = useState(false);
	const [hoverHold, setHoverHold] = useState(false);
	const [focusHold, setFocusHold] = useState(false);
	const [visible, setVisible] = useState(false);
	const [documentVisible, setDocumentVisible] = useState(false);
	const [announcement, setAnnouncement] = useState("");
	const reduced = useReducedMotion();
	const paused =
		reduced ||
		manualPause ||
		hoverHold ||
		focusHold ||
		!visible ||
		!documentVisible;

	useEffect(() => {
		const update = () =>
			setDocumentVisible(document.visibilityState === "visible");
		update();
		document.addEventListener("visibilitychange", update);
		return () => document.removeEventListener("visibilitychange", update);
	}, []);

	useEffect(() => {
		const node = rootRef.current;
		if (!node) return;
		if (typeof IntersectionObserver === "undefined") {
			setVisible(true);
			return;
		}
		const observer = new IntersectionObserver(
			([entry]) =>
				setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.2),
			{ threshold: [0, 0.2] },
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (paused) return;
		const version = cycle;
		const budget = remaining.current;
		const started = performance.now();
		const timer = window.setTimeout(() => {
			generation.current += 1;
			remaining.current = STORY_SCENE_MS;
			setActive((step) => (step + 1) % VOLUNTEERING_STORY.length);
			setCycle((value) => value + 1);
		}, budget);
		return () => {
			window.clearTimeout(timer);
			// A manual selection or completed scene owns its new full duration.
			if (version === generation.current)
				remaining.current = Math.max(0, budget - (performance.now() - started));
		};
	}, [cycle, paused]);

	const select = (step: number) => {
		const next = (step + VOLUNTEERING_STORY.length) % VOLUNTEERING_STORY.length;
		generation.current += 1;
		remaining.current = STORY_SCENE_MS;
		setActive(next);
		setCycle((value) => value + 1);
		setManualPause(true);
		setAnnouncement(
			`Step ${next + 1} of ${VOLUNTEERING_STORY.length}: ${VOLUNTEERING_STORY[next].label}. ${VOLUNTEERING_STORY[next].caption}`,
		);
	};

	return {
		rootRef,
		active,
		cycle,
		paused,
		reduced,
		manualPause,
		announcement,
		select,
		setHoverHold,
		setFocusHold,
		toggle: () => {
			if (manualPause) {
				setManualPause(false);
				setFocusHold(false);
			} else setManualPause(true);
		},
	};
}
