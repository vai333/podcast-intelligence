import {
  Activity,
  FileText,
  History,
  Hash,
  type LucideIcon,
  ListVideo,
  Megaphone,
  Radio,
  Settings,
  Users,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that should also mark this item active. */
  match?: string[];
  exact?: boolean;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Brief",
    items: [
      { href: "/dashboard", label: "Latest brief", icon: FileText, exact: true },
      { href: "/dashboard/briefs", label: "Past briefs", icon: History, match: ["/dashboard/briefs"] },
    ],
  },
  {
    label: "Explore",
    items: [
      { href: "/dashboard/guests", label: "Guests", icon: Users },
      { href: "/dashboard/topics", label: "Topics", icon: Hash },
      { href: "/dashboard/sponsors", label: "Sponsors", icon: Megaphone },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/dashboard/shows", label: "Shows", icon: Radio },
      { href: "/dashboard/episodes", label: "Episodes", icon: ListVideo },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/dashboard/system", label: "System", icon: Activity },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const EXPLORE_TABS = [
  { href: "/dashboard/guests", label: "Guests" },
  { href: "/dashboard/topics", label: "Topics" },
  { href: "/dashboard/sponsors", label: "Sponsors" },
];

/** True when the path is the latest week's home or one of its section pages. */
export function onLatestBrief(pathname: string, latestWeek: string | null): boolean {
  if (pathname === "/dashboard") return true;
  return !!latestWeek && (pathname === `/dashboard/briefs/${latestWeek}` || pathname.startsWith(`/dashboard/briefs/${latestWeek}/`));
}

export function isActive(pathname: string, item: NavItem, latestWeek: string | null = null): boolean {
  if (item.href === "/dashboard") return onLatestBrief(pathname, latestWeek);
  if (item.href === "/dashboard/briefs") return pathname.startsWith("/dashboard/briefs") && !onLatestBrief(pathname, latestWeek);
  if (item.exact) return pathname === item.href;
  return [item.href, ...(item.match ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
