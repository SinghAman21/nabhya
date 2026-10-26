/** An illustrative walkthrough, never live application or NGO activity. */
export const VOLUNTEERING_STORY = [
	{
		label: "Post",
		actor: "The NGO",
		title: "A little help, needed here.",
		caption: "An NGO shares a role, a place and a time.",
		detail: "NGOs complete document review before publishing.",
		visual:
			"An NGO coordinator prepares an opportunity beside a community centre.",
	},
	{
		label: "Discover",
		actor: "You",
		title: "That looks like my kind of thing.",
		caption: "Find an opportunity that fits your interests.",
		detail: "Browse opportunities before creating an account.",
		visual:
			"A volunteer discovers the same gardening opportunity on their phone.",
	},
	{
		label: "Apply",
		actor: "You",
		title: "Count me in.",
		caption: "Send your application straight to the NGO.",
		detail: "Sign in and verify your identity before applying.",
		visual: "The volunteer sends an application; its status is pending review.",
	},
	{
		label: "Accepted",
		actor: "The NGO",
		title: "There's a place for you.",
		caption: "The NGO reviews and confirms your place.",
		detail: "Acceptance is decided by the NGO.",
		visual:
			"The coordinator reviews the volunteer's application and accepts it.",
	},
	{
		label: "Show up",
		actor: "Together",
		title: "From your screen to your community.",
		caption: "Meet the team, ready to lend a hand.",
		detail: "Check the event's time, place and instructions.",
		visual:
			"The volunteer arrives at the community garden and meets the NGO coordinator.",
	},
	{
		label: "Contribute",
		actor: "Together",
		title: "Good work has good company.",
		caption: "Make a difference alongside the community.",
		detail: "NGOs can record attendance and issue certificates.",
		visual:
			"The volunteer and NGO coordinator kneel together to plant and water a young tree.",
	},
] as const;

export const STORY_SCENE_MS = 6000;
