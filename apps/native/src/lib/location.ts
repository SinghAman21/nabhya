import * as Location from "expo-location";
import { Platform } from "react-native";

/**
 * Ask the device where it is, once, and say plainly what happened.
 *
 * ## The web trap this exists for
 *
 * Both callers used to gate on `Location.requestForegroundPermissionsAsync()`
 * and give up when `granted` was false. On the web that check **never
 * prompts**: expo-location's web module answers it from
 * `navigator.permissions.query({ name: "geolocation" })`, and a browser that
 * has not been asked yet reports `"prompt"` — which maps to `UNDETERMINED`,
 * so `granted` is `false`. The result was that "Use my current location" in the
 * web app failed instantly with "location is off", having never asked for it.
 *
 * The browser's own permission prompt is raised by `getCurrentPosition`, so on
 * the web that call *is* the request. Native keeps the explicit request, which
 * is what surfaces the OS dialog there.
 *
 * ## Why the shape
 *
 * "Denied" and "failed" need different copy — one is a setting the user can
 * change, the other is a retry — and the coordinates are worth keeping even
 * when the platform cannot name the place they belong to, so this returns them
 * separately from any reverse geocoding.
 */
export type PositionResult =
	| { status: "ok"; latitude: number; longitude: number }
	| { status: "denied" }
	| { status: "failed" };

export async function requestPosition(): Promise<PositionResult> {
	try {
		if (Platform.OS !== "web") {
			const permission = await Location.requestForegroundPermissionsAsync();
			if (!permission.granted) return { status: "denied" };
		}

		const position = await Location.getCurrentPositionAsync({
			accuracy: Location.Accuracy.Balanced,
		});

		return {
			status: "ok",
			latitude: position.coords.latitude,
			longitude: position.coords.longitude,
		};
	} catch (error) {
		// The browser rejects `getCurrentPosition` with a `GeolocationPositionError`
		// whose code 1 is PERMISSION_DENIED; expo-location wraps a denial in an
		// error whose message says as much. Either way the user needs the
		// "it's switched off" copy, not "try again".
		return { status: isDenial(error) ? "denied" : "failed" };
	}
}

function isDenial(error: unknown): boolean {
	if (typeof error === "object" && error !== null) {
		const code = (error as { code?: unknown }).code;
		if (code === 1 || code === "E_NO_PERMISSIONS") return true;
	}
	const message = error instanceof Error ? error.message.toLowerCase() : "";
	return message.includes("denied") || message.includes("permission");
}

/**
 * The street-level part of a reverse-geocoded place, as one line.
 *
 * Reverse geocoding is a platform service and **is not available on the web at
 * all** — `Location.reverseGeocodeAsync` throws there — and on Android it can
 * return an empty array when Play Services' geocoder is unavailable. So every
 * caller must treat "no name" as normal; `nearestCity` in `lib/cities.ts` is
 * the fallback that keeps the feature useful in those cases.
 */
export async function reverseGeocode(
	latitude: number,
	longitude: number,
): Promise<Location.LocationGeocodedAddress | null> {
	try {
		const [place] = await Location.reverseGeocodeAsync({
			latitude,
			longitude,
		});
		return place ?? null;
	} catch {
		return null;
	}
}

/**
 * City, state, pincode and a street line, excluding anything repeated.
 *
 * The OS repeats itself: on Android `name` is often the same string as
 * `street`, and `district` is often the city again, so a naive join produces
 * "Bandra West, Bandra West, Mumbai".
 */
export function placeParts(place: Location.LocationGeocodedAddress): {
	city: string | null;
	region: string | null;
	pincode: string | null;
	address: string;
} {
	const streetish = [
		place.name,
		place.streetNumber,
		place.street,
		place.district,
		place.subregion,
	]
		.map((part) => part?.trim())
		.filter((part): part is string => Boolean(part));

	const seen = new Set<string>();
	const address = streetish
		.filter((part) => {
			const key = part.toLowerCase();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.join(", ");

	return {
		city: place.city ?? place.district ?? place.subregion ?? null,
		region: place.region ?? null,
		pincode: place.postalCode ?? null,
		address,
	};
}
