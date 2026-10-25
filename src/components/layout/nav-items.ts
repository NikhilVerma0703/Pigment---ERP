import {
  BarChart3,
  FileDown,
  FlaskConical,
  LayoutDashboard,
  Package,
  Search,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/formula-creation", label: "Formula Creation", icon: FlaskConical },
  { href: "/pigment-packing", label: "Pigment Packing Details", icon: Package },
  { href: "/searching", label: "Searching", icon: Search },
  { href: "/stocks-consumption", label: "Stocks and Consumption", icon: BarChart3 },
  { href: "/reports", label: "Reports and Downloads", icon: FileDown },
];
