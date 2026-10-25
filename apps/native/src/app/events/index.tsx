import { useRouter } from "expo-router";
import { EventFeed } from "@/components/event-feed";
import { Screen, ScreenHeader } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { signInAndReturn } from "@/lib/return-to";
import { useAuthStore } from "@/store/auth-store";

/**
 * Public directory of volunteering events. Anyone can browse this without an
 * account; applying prompts a sign-in. Signed-in people get here from inside
 * the app, so the header offers a way back instead of a "My account" button.
 */
export default function PublicEvents() {
	const router = useRouter();
	const email = useAuthStore((s) => s.email);

	return (
		<Screen>
			<EventFeed
				header={
					email ? (
						<ScreenHeader back title="Events" />
					) : (
						<ScreenHeader
							title="Events"
							subtitle="From verified NGOs across India"
							action={
								<Button
									size="sm"
									onPress={() => void signInAndReturn("/events")}
									accessibilityLabel="Sign in to apply to events"
								>
									Sign in
								</Button>
							}
						/>
					)
				}
			/>
		</Screen>
	);
}
