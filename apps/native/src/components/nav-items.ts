import {
	Building2,
	CalendarDays,
	FileCheck2,
	FileText,
	HandCoins,
	HeartHandshake,
	House,
	LayoutDashboard,
	Megaphone,
	Newspaper,
	ScrollText,
	Star,
	User,
	Users,
} from "lucide-react-native";
import type { NavItem } from "@/components/sidebar";

/**
 * The desktop rail's contents, per role.
 *
 * These used to live inside `(ngo)/_layout.tsx` and `(admin)/_layout.tsx`,
 * which was fine while the rail only ever appeared inside those groups. It now
 * also appears around the shared root-level screens - notifications, an NGO's
 * public page, a certificate - through `AppShell`, and a rail whose contents
 * depend on which file rendered it is a rail that changes as you navigate.
 */

export const NGO_NAV_ITEMS: NavItem[] = [
	// Feed is the landing page, so it leads - unsectioned, like Dashboard.
	{ label: "Feed", href: "/(ngo)/feed", icon: Newspaper },
	{ label: "Dashboard", href: "/(ngo)", icon: House },
	{
		label: "Needs",
		href: "/(ngo)/needs",
		icon: HeartHandshake,
		section: "Programmes",
	},
	{
		label: "Events",
		href: "/(ngo)/events",
		icon: CalendarDays,
		section: "Programmes",
	},
	{
		label: "Updates",
		href: "/(ngo)/announcements",
		icon: Megaphone,
		section: "Audience",
	},
	{ label: "Reviews", href: "/(ngo)/reviews", icon: Star, section: "Audience" },
	{
		label: "Donations",
		href: "/(ngo)/donations",
		icon: HandCoins,
		section: "Money",
	},
	{
		label: "Reports",
		href: "/(ngo)/reports",
		icon: FileText,
		section: "Money",
	},
	{ label: "Team", href: "/(ngo)/team", icon: Users, section: "Organisation" },
	{
		label: "Profile",
		href: "/(ngo)/profile",
		icon: User,
		section: "Organisation",
	},
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
	{ label: "Overview", href: "/(admin)", icon: LayoutDashboard },
	{
		label: "Queue",
		href: "/(admin)/queue",
		icon: FileCheck2,
		section: "Review",
	},
	// Two populations, two screens, no overlap: `organizations` is the NGO
	// *organisations* and `volunteers` is volunteers only. An NGO's own user
	// account is reached from its organisation's dossier - see the note at the
	// top of `(admin)/volunteers.tsx`.
	{
		label: "NGOs",
		href: "/(admin)/organizations",
		icon: Building2,
		section: "Directory",
	},
	{
		label: "Volunteers",
		href: "/(admin)/volunteers",
		icon: Users,
		section: "Directory",
	},
	{
		label: "Activity",
		href: "/(admin)/audit",
		icon: ScrollText,
		section: "Records",
	},
];
