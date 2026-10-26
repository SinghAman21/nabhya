import { useId } from "react";
import { VOLUNTEERING_STORY } from "./story-content";

/** The same coordinator and volunteer stay in one community setting throughout. */
function Head({ woman = false }: { woman?: boolean }) {
	return (
		<g className={woman ? "story-person-woman" : "story-person-man"}>
			{woman ? (
				<path d="M-13-8C-24-14-29 2-19 13l9-3Z" className="story-hair" />
			) : null}
			<path d="M-6 9v13H7V8" className="story-skin" />
			<ellipse cy="-2" rx="14" ry="17" className="story-skin" />
			<path
				d={
					woman
						? "M-14 0C-21-17-4-29 10-18c7 4 8 12 5 17-4-1-7-8-8-13-7 9-16 8-21 14Z"
						: "M-14-1C-19-20-8-25 2-23c13-5 19 7 13 21L9-13c-8 5-15 5-23 12Z"
				}
				className="story-hair"
			/>
			<path d="M-5-1h.1M6-1h.1" className="story-face" />
			<path d="M-3 7q4 3 7-1" className="story-smile" />
		</g>
	);
}

function Person({
	x,
	y,
	woman = false,
	pose = "stand",
	flip = false,
}: {
	x: number;
	y: number;
	woman?: boolean;
	pose?: "stand" | "walk" | "garden" | "phone" | "clipboard";
	flip?: boolean;
}) {
	const gardening = pose === "garden";
	return (
		<g
			transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}
			className={woman ? "story-volunteer" : "story-coordinator"}
		>
			{gardening ? (
				<>
					<path
						d="m-12 68-26 29 40 10M12 70l34 28-13 13"
						className="story-trousers"
					/>
					<path
						d="m-12 16-18 47 35 15 25-36C27 25 12 14-12 16Z"
						className="story-shirt"
					/>
					<path d="m6 34 27 29 27 12" className="story-arm" />
					<path d="m-13 31 9 32 29 16" className="story-arm" />
					<g transform="translate(6 0) rotate(13)">
						<Head woman={woman} />
					</g>
					<path d="M-1 106h18m15 4h17" className="story-shoes" />
				</>
			) : (
				<>
					<path
						d={
							pose === "walk"
								? "m-8 76-17 50-14 23M10 78l27 39 16 26"
								: "m-10 77-6 70M11 77l8 70"
						}
						className="story-trousers"
					/>
					<path
						d="M-18 20Q0 11 18 20l9 59q-25 12-52 0Z"
						className="story-shirt"
					/>
					<path
						d={
							pose === "phone"
								? "m-19 29-10 31 31-8M19 29l10 27-19-15"
								: pose === "clipboard"
									? "m-19 28-10 29 37 1M18 28l9 24-17 5"
									: "m-19 29-12 44M19 29l12 44"
						}
						className="story-arm"
					/>
					<Head woman={woman} />
					<path
						d={
							pose === "walk"
								? "m-39 150-10 2m101-7 12 1"
								: "m-16 148-12 2m47-2 12 2"
						}
						className="story-shoes"
					/>
					{pose === "phone" ? (
						<g transform="translate(0 30) rotate(12)">
							<rect width="17" height="29" rx="3" className="story-phone" />
							<path d="M5 5h7M6 23h5" className="story-phone-line" />
						</g>
					) : null}
					{pose === "clipboard" ? (
						<g transform="translate(-2 36) rotate(-9)">
							<rect width="26" height="34" rx="2" className="story-clipboard" />
							<path d="M7 10h12M7 17h10M7 24h7" className="story-paper-line" />
						</g>
					) : null}
				</>
			)}
		</g>
	);
}

function Sapling({
	x,
	y,
	scale = 1,
}: {
	x: number;
	y: number;
	scale?: number;
}) {
	return (
		<g transform={`translate(${x} ${y}) scale(${scale})`}>
			<path
				d="M0 0q-3-25 3-51M1-25c-24 1-30-12-29-23 19 1 27 10 29 23ZM2-38c21 0 28-13 27-25-18 3-27 12-27 25Z"
				className="story-leaves"
			/>
			<path d="M-12 1h26" className="story-ground-stroke" />
		</g>
	);
}

export function StoryIllustration({ step }: { step: number }) {
	const titleId = useId();
	const field = step >= 4;
	return (
		<svg
			className="story-illustration"
			viewBox="0 0 600 380"
			role="img"
			aria-labelledby={titleId}
		>
			<title id={titleId}>{VOLUNTEERING_STORY[step].visual}</title>
			<path
				d="M31 321C143 302 210 337 302 325c115-16 165-7 272-14"
				className="story-ground-stroke"
			/>
			<ellipse cx="300" cy="330" rx="271" ry="17" className="story-ground" />
			<g className="story-building">
				<path d="M40 306V141l65-27 65 27v165" className="story-wall" />
				<path d="m30 145 75-33 75 33" className="story-building-line" />
				<path d="M86 306v-75a20 20 0 0 1 40 0v75" className="story-door" />
				<rect
					x="60"
					y="162"
					width="87"
					height="24"
					rx="3"
					className="story-sign"
				/>
				<text x="104" y="178" textAnchor="middle">
					COMMUNITY
				</text>
				<path
					d="M58 202h14v24H58Zm80 0h14v24h-14ZM114 266h.1"
					className="story-building-line"
				/>
			</g>
			<path d="M219 133c58-69 184-75 250 4" className="story-connection" />
			<path d="m462 125 8 13-15 1" className="story-connection-arrow" />
			<circle cx="218" cy="133" r="5" className="story-connection-point" />
			<Sapling x={579} y={312} scale={0.85} />
			<Sapling x={26} y={314} scale={0.53} />
			<g key={step} className="story-scene-change">
				{!field ? (
					<>
						<Person x={155} y={161} pose={step === 3 ? "phone" : "clipboard"} />
						<Person
							x={548}
							y={162}
							woman
							pose={step === 0 ? "stand" : "phone"}
							flip
						/>
						{step === 0 ? (
							<g className="story-scattered">
								<path d="M231 74h67v28h-12l-7 9v-9h-48Z" />
								<text x="245" y="92">
									Details?
								</text>
								<path d="M423 72h90v27h-12l-7 8v-8h-71Z" />
								<text x="438" y="90">
									Still open?
								</text>
							</g>
						) : null}
						{step === 2 ? (
							<g transform="translate(216 197)" className="story-sent-letter">
								<path d="m0 0 39-12L26 25l-8-15Z" />
								<path d="m18 10 21-22" />
							</g>
						) : null}
						{step === 3 ? (
							<g transform="translate(484 107)" className="story-accepted-seal">
								<circle r="19" />
								<path d="m-8 0 6 6L9-7" />
							</g>
						) : null}
					</>
				) : step === 4 ? (
					<>
						<Person x={178} y={163} pose="clipboard" />
						<Person x={403} y={158} woman pose="walk" flip />
						<path d="M465 325c-73 29-141 11-210-3" className="story-footpath" />
						<Sapling x={514} y={321} scale={0.65} />
					</>
				) : (
					<>
						<path
							d="M231 321q107-27 240-4l-31 23H251Z"
							className="story-garden-bed"
						/>
						<Person x={244} y={212} pose="garden" />
						<Person x={451} y={211} woman pose="garden" flip />
						<Sapling x={350} y={324} scale={1.22} />
						<path
							d="m435 291 29-10 9 25-29 11Z"
							className="story-watering-can"
						/>
						<path
							d="m444 284-7-17m-4 29-19-11-2 10 21 11"
							className="story-building-line"
						/>
						<path d="m401 293-6 7m13-4-5 7" className="story-water" />
					</>
				)}
			</g>
			<text
				className="story-person-label"
				x={field ? 177 : 155}
				y={field && step === 5 ? 197 : 353}
				textAnchor="middle"
			>
				{field && step === 5 ? "" : "The NGO"}
			</text>
			<text
				className="story-person-label"
				x={field ? 426 : 548}
				y="353"
				textAnchor="middle"
			>
				{step === 5 ? "Your community" : "You"}
			</text>
		</svg>
	);
}
