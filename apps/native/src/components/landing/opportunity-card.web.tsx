import { useState } from "react";
import { TYPE_LABEL } from "./controls.web";
import { Botanical, Icon } from "./icons.web";
import type { LandingOpportunity, StoredImageRenderer } from "./types";
export function OpportunityCard({
	item,
	renderStoredImage,
}: {
	item: LandingOpportunity;
	renderStoredImage?: StoredImageRenderer;
}) {
	const [failedImage, setFailedImage] = useState<string | null>(null);
	return (
		<article className="landing-opportunity">
			<a
				href={item.href}
				className={`opportunity-image opportunity-image-${item.kind}`}
				aria-label={
					item.demo ? `Development sample: ${item.title}` : item.title
				}
				tabIndex={-1}
			>
				{item.imageUrl && failedImage !== item.imageUrl ? (
					<img
						src={item.imageUrl}
						width="800"
						height="480"
						loading="lazy"
						decoding="async"
						alt={item.imageAlt ?? ""}
						onError={() => setFailedImage(item.imageUrl ?? null)}
					/>
				) : item.imageKey && renderStoredImage ? (
					renderStoredImage(item.imageKey, "")
				) : item.kind === "event" && item.date ? (
					<div className="opportunity-date-art">
						<div>
							<span>{item.date.split(" ").slice(1).join(" ")}</span>
							<strong>{item.date.split(" ")[0]}</strong>
						</div>
						<span>
							<Icon name="MapPin" size={22} />
							{item.city ?? "Find the meeting place in the event"}
						</span>
					</div>
				) : (
					<div className="opportunity-art">
						<Botanical />
						<span>
							{item.kind === "need"
								? "Something you can share."
								: item.kind === "event"
									? "Somewhere you can show up."
									: "A story worth following."}
						</span>
					</div>
				)}
				<span className="opportunity-type">
					<Icon
						name={
							item.kind === "need"
								? "Heart"
								: item.kind === "event"
									? "Calendar"
									: "File"
						}
						size={13}
					/>
					{TYPE_LABEL[item.kind]}
				</span>
				{item.demo ? (
					<span className="opportunity-example">Demo listing</span>
				) : null}
			</a>
			<div className="opportunity-content">
				<div className="opportunity-byline">
					<span className="organization-initial">
						{item.organization.charAt(0)}
					</span>
					<span>{item.organization}</span>
					{item.verified ? (
						<span
							className="verified-mark"
							role="img"
							aria-label="NGO documents reviewed"
							title="NGO documents reviewed"
						>
							<Icon name="ShieldCheck" size={16} />
						</span>
					) : null}
				</div>
				{item.category ? (
					<p className="opportunity-cause">{item.category}</p>
				) : null}
				<h3>
					<a href={item.href}>{item.title}</a>
				</h3>
				<p className="opportunity-description">{item.description}</p>
				<div className="opportunity-facts">
					{item.city ? (
						<span>
							<Icon name="MapPin" size={14} />
							{item.city}
						</span>
					) : null}
					{item.date ? (
						<span>
							<Icon name="Calendar" size={14} />
							{item.date}
						</span>
					) : null}
					{item.fact ? (
						<span>
							<Icon name="HeartHandshake" size={15} />
							{item.fact}
						</span>
					) : null}
				</div>
				<a className="opportunity-action" href={item.href}>
					{item.action}
					<Icon name="ArrowUpRight" size={18} />
				</a>
			</div>
		</article>
	);
}
export function OpportunitySkeleton() {
	return (
		<div
			className="landing-opportunity opportunity-skeleton"
			aria-hidden="true"
		>
			<div className="opportunity-image" />
			<div className="opportunity-content">
				<span />
				<span />
				<span />
				<span />
			</div>
		</div>
	);
}
