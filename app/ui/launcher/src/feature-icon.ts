/**
 * Owns the lookup from a manifest's Lucide icon name (kebab case, app/features/define.ts) to the
 * launcher's icon component. Only the icons features name are imported: Lucide's full set would
 * double the launcher bundle. feature-icons.test.ts checks every manifest's name finds one, so a
 * new icon fails there until it is added here.
 */
import {
  Archive,
  ArrowLeftRight,
  Bell,
  BookOpen,
  Coins,
  Crosshair,
  Flag,
  Funnel,
  Hourglass,
  Keyboard,
  ListChecks,
  Map as MapIcon,
  MapPin,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  Sparkles,
  Timer,
  Users,
  Wine,
} from "lucide-vue-next";
import type { Component } from "vue";

const ICONS: Readonly<Record<string, Component>> = {
  archive: Archive,
  "arrow-left-right": ArrowLeftRight,
  bell: Bell,
  "book-open": BookOpen,
  coins: Coins,
  crosshair: Crosshair,
  flag: Flag,
  funnel: Funnel,
  hourglass: Hourglass,
  keyboard: Keyboard,
  "list-checks": ListChecks,
  map: MapIcon,
  "map-pin": MapPin,
  megaphone: Megaphone,
  "message-circle": MessageCircle,
  "mouse-pointer-click": MousePointerClick,
  sparkles: Sparkles,
  timer: Timer,
  users: Users,
  wine: Wine,
};

export const featureIcon = (name: string): Component | undefined => ICONS[name];
