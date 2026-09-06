import { Redirect } from "expo-router";

/**
 * Back-compat redirect. The NGO feed lives at `/(ngo)/feed` so the sidebar
 * (desktop) and tab bar (mobile) stay mounted; this keeps old deep links
 * working. The group layout's role guard applies after the redirect.
 */
export default function FeedRedirect() {
	return <Redirect href="/(ngo)/feed" />;
}
