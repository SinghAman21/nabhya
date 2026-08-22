import { useRouter } from "expo-router";
import { EventFeed } from "@/components/event-feed";
import { Screen, ScreenHeader } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";

/**
 * Public directory of volunteering events. Anyone can browse this without an
 * account; applying prompts a sign-in.
 */
export default function PublicEvents() {
	const router = useRouter();
	const email = useAuthStore((s) => s.email);

	return (
		<Screen>
			<EventFeed
				header={
					<ScreenHeader
						title="Volunteer"
						subtitle="Events from verified NGOs across India."
						action={
							email ? (
								<Button
									size="sm"
									variant="outline"
									onPress={() => router.replace("/")}
								>
									My account
								</Button>
							) : (
								<Button size="sm" onPress={() => router.push("/(auth)/login")}>
									Sign in
								</Button>
							)
						}
					/>
				}
			/>
		</Screen>
	);
}
