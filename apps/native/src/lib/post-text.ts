export function composePostText(title: string, description: string) {
	const cleanTitle = title.trim();
	const cleanDescription = description.trim();
	return cleanTitle ? `${cleanTitle}\n\n${cleanDescription}` : cleanDescription;
}

export function splitPostText(text: string) {
	const trimmed = text.trim();
	if (!trimmed) {
		return { title: null as string | null, description: "" };
	}

	const [title, ...rest] = trimmed.split(/\n\n+/);
	if (rest.length === 0) {
		return { title: null as string | null, description: trimmed };
	}

	return {
		title: title.trim() || null,
		description: rest.join("\n\n").trim(),
	};
}
