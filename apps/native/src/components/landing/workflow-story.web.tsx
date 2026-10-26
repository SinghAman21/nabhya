import { type CSSProperties, memo } from "react";
import { Icon } from "./icons.web";
import { STORY_SCENE_MS, VOLUNTEERING_STORY } from "./story-content";
import { StoryIllustration } from "./story-illustration.web";
import { useStoryPlayback } from "./use-story-playback.web";
import "./workflow-story.css";

function StoryTicket({ step }: { step: number }) {
	return (
		<div className={`story-ticket story-ticket-${step}`} aria-hidden="true">
			<div className="story-ticket-top">
				<span className="story-ticket-logo">
					<Icon name="Sprout" size={15} /> nabhya
				</span>
				<span>EXAMPLE</span>
			</div>
			{step < 2 ? (
				<>
					<div className="story-ticket-picture">
						<Icon name="Sprout" size={33} />
						<span>
							A little time.
							<br />
							Something good.
						</span>
					</div>
					<p className="story-ticket-kicker">
						{step === 0 ? "NGO OPPORTUNITY" : "FOUND IN YOUR FEED"}
					</p>
					<strong>A morning in the garden</strong>
					<span className="story-ticket-fact">
						<Icon name="MapPin" size={12} /> Community garden
					</span>
					<span className="story-ticket-fact">
						<Icon name="Calendar" size={12} /> Saturday · 9:00 AM
					</span>
					<span className="story-ticket-action">
						{step === 0 ? "Opportunity published" : "Help plant & water"}
						<Icon name={step === 0 ? "Check" : "ArrowUpRight"} size={14} />
					</span>
				</>
			) : step < 4 ? (
				<>
					<div
						className={`story-status-symbol ${step === 3 ? "is-accepted" : ""}`}
					>
						<Icon name={step === 3 ? "Check" : "Clock"} size={27} />
					</div>
					<p className="story-ticket-kicker">A MORNING IN THE GARDEN</p>
					<strong>
						{step === 2 ? "Application sent." : "You're accepted."}
					</strong>
					<div className="story-application-state">
						<span className="is-done">Applied</span>
						<span className={step === 3 ? "is-done" : ""}>Reviewed</span>
						<span className={step === 3 ? "is-done" : ""}>Accepted</span>
					</div>
					<p className="story-ticket-message">
						{step === 2
							? "The NGO will review your application."
							: "Your place is confirmed by the NGO."}
					</p>
				</>
			) : (
				<>
					<span className="story-meeting-icon">
						<Icon name={step === 4 ? "MapPin" : "HeartHandshake"} size={25} />
					</span>
					<strong>
						{step === 4 ? "See you at the garden." : "Good work, together."}
					</strong>
					<span className="story-ticket-fact">
						{step === 4
							? "Saturday · 9:00 AM"
							: "A little help becomes a shared effort."}
					</span>
				</>
			)}
		</div>
	);
}

export const WorkflowStory = memo(function WorkflowStory() {
	const playback = useStoryPlayback();
	const story = VOLUNTEERING_STORY[playback.active];
	return (
		<section
			id="how-it-works"
			className="workflow-story"
			ref={playback.rootRef}
			aria-roledescription="carousel"
			aria-label="The volunteering journey"
			data-active-step={playback.active + 1}
			data-playing={!playback.paused}
			onPointerEnter={(event) => {
				if (event.pointerType === "mouse") playback.setHoverHold(true);
			}}
			onPointerLeave={() => playback.setHoverHold(false)}
			onFocusCapture={(event) => {
				if (
					!event.currentTarget.contains(event.relatedTarget) &&
					event.target.matches(":focus-visible")
				)
					playback.setFocusHold(true);
			}}
			onBlurCapture={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget))
					playback.setFocusHold(false);
			}}
		>
			<div className="story-topline">
				<span>
					<span className="story-orange-dot" /> ILLUSTRATED WALKTHROUGH
				</span>
				{playback.reduced ? (
					<span className="story-motion-note">
						<Icon name="Pause" size={13} /> Autoplay off
					</span>
				) : (
					<button
						type="button"
						className="story-play-toggle"
						onClick={playback.toggle}
						aria-label={
							playback.manualPause
								? "Play illustrated story"
								: "Pause illustrated story"
						}
					>
						<Icon name={playback.manualPause ? "Play" : "Pause"} size={13} />
						{playback.manualPause ? "Play" : "Pause"}
					</button>
				)}
			</div>
			<ol className="story-steps" aria-label="Six steps to volunteering">
				{VOLUNTEERING_STORY.map((item, index) => (
					<li key={item.label}>
						<button
							type="button"
							aria-label={`Step ${index + 1}: ${item.label}`}
							aria-current={playback.active === index ? "step" : undefined}
							onClick={() => playback.select(index)}
						>
							<span className="story-step-label">
								<span>{String(index + 1).padStart(2, "0")}</span>
								{item.label}
							</span>
							<span className="story-progress-track" aria-hidden="true">
								<span
									key={`${playback.cycle}-${item.label}`}
									className="story-progress-fill"
									data-state={
										index < playback.active
											? "complete"
											: index === playback.active
												? "active"
												: "waiting"
									}
									style={
										{
											animationPlayState: playback.paused
												? "paused"
												: "running",
											"--story-duration": `${STORY_SCENE_MS}ms`,
										} as CSSProperties
									}
								/>
							</span>
						</button>
						<span className="landing-sr-only">{item.caption}</span>
					</li>
				))}
			</ol>
			<div className="story-stage">
				<StoryIllustration step={playback.active} />
				<StoryTicket step={playback.active} />
			</div>
			<div className="story-caption" aria-live="off">
				<span className="story-actor">{story.actor}</span>
				<h2>{story.title}</h2>
				<p>{story.caption}</p>
				<small>{story.detail}</small>
			</div>
			<div className="story-controls">
				<div className="story-playback">
					<span className="story-step-count">
						{String(playback.active + 1).padStart(2, "0")} <span>/ 06</span>
					</span>
					<div>
						<button
							type="button"
							className="story-arrow"
							aria-label="Previous story step"
							onClick={() => playback.select(playback.active - 1)}
						>
							<Icon name="ChevronLeft" size={17} />
						</button>
						<button
							type="button"
							className="story-arrow"
							aria-label="Next story step"
							onClick={() => playback.select(playback.active + 1)}
						>
							<Icon name="ArrowRight" size={17} />
						</button>
					</div>
				</div>
			</div>
			<span className="landing-sr-only" role="status" aria-live="polite">
				{playback.announcement}
			</span>
		</section>
	);
});
