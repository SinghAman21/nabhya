import type { db as dbType } from "@nabhya/db";
import { users } from "@nabhya/db/schema";
import { IDENTITY_REQUIRED_MESSAGE } from "@nabhya/shared";
import { ForbiddenException } from "@nestjs/common";
import { eq } from "drizzle-orm";

/**
 * Applying to an event and pledging to a need both end with a stranger turning
 * up in person - at a venue, or at an NGO's door for a handover - so both are
 * gated on a verified identity (government ID and liveness selfie, both
 * approved by a superadmin; see `computeUserVerificationStatus`). Browsing,
 * following, reviewing and donating money stay open: none of them puts anyone
 * in a room together.
 *
 * Checked against the database rather than the token: verification changes
 * when a reviewer decides, and a token minted before that would otherwise keep
 * the old answer until it expired.
 */
export async function assertIdentityVerified(
	db: typeof dbType,
	userId: string,
): Promise<void> {
	const user = await db.query.users.findFirst({
		where: eq(users.id, userId),
		columns: { verificationStatus: true },
	});

	if (user?.verificationStatus !== "VERIFIED") {
		throw new ForbiddenException(IDENTITY_REQUIRED_MESSAGE);
	}
}
