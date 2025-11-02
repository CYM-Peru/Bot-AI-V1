/**
 * Channel color utility
 * Generates consistent colors for each WhatsApp number/channel
 */

export interface ChannelColor {
  bg: string;
  text: string;
  border: string;
  badge: string;
  name: string;
}

const CHANNEL_COLORS: ChannelColor[] = [
  {
    bg: "bg-gradient-to-br from-emerald-50 to-teal-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    badge: "bg-emerald-500",
    name: "Esmeralda"
  },
  {
    bg: "bg-gradient-to-br from-blue-50 to-indigo-50",
    text: "text-blue-700",
    border: "border-blue-200",
    badge: "bg-blue-500",
    name: "Azul"
  },
  {
    bg: "bg-gradient-to-br from-purple-50 to-pink-50",
    text: "text-purple-700",
    border: "border-purple-200",
    badge: "bg-purple-500",
    name: "Púrpura"
  },
  {
    bg: "bg-gradient-to-br from-amber-50 to-orange-50",
    text: "text-amber-700",
    border: "border-amber-200",
    badge: "bg-amber-500",
    name: "Ámbar"
  },
  {
    bg: "bg-gradient-to-br from-rose-50 to-pink-50",
    text: "text-rose-700",
    border: "border-rose-200",
    badge: "bg-rose-500",
    name: "Rosa"
  },
  {
    bg: "bg-gradient-to-br from-cyan-50 to-sky-50",
    text: "text-cyan-700",
    border: "border-cyan-200",
    badge: "bg-cyan-500",
    name: "Cian"
  },
  {
    bg: "bg-gradient-to-br from-lime-50 to-green-50",
    text: "text-lime-700",
    border: "border-lime-200",
    badge: "bg-lime-500",
    name: "Lima"
  },
  {
    bg: "bg-gradient-to-br from-fuchsia-50 to-purple-50",
    text: "text-fuchsia-700",
    border: "border-fuchsia-200",
    badge: "bg-fuchsia-500",
    name: "Fucsia"
  }
];

/**
 * Generate a consistent hash from a string
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Get color scheme for a channel connection ID
 */
export function getChannelColor(channelConnectionId: string | null): ChannelColor {
  if (!channelConnectionId) {
    // Default color for unknown channels
    return {
      bg: "bg-gradient-to-br from-slate-50 to-gray-50",
      text: "text-slate-700",
      border: "border-slate-200",
      badge: "bg-slate-500",
      name: "Sin canal"
    };
  }

  const hash = hashString(channelConnectionId);
  const index = hash % CHANNEL_COLORS.length;
  return CHANNEL_COLORS[index];
}

/**
 * Get a formatted label for a display number
 */
export function getNumberLabel(displayNumber: string | null, channelConnectionId: string | null): string {
  if (displayNumber) {
    // Format the full number for better readability
    const digits = displayNumber.replace(/\D/g, '');
    if (digits.length >= 10) {
      // Format as: +XX XXX XXX XXX (e.g., +51 961 842 916)
      const countryCode = digits.slice(0, -9);
      const area = digits.slice(-9, -6);
      const part1 = digits.slice(-6, -3);
      const part2 = digits.slice(-3);
      return countryCode ? `+${countryCode} ${area} ${part1} ${part2}` : `${area} ${part1} ${part2}`;
    }
    return displayNumber;
  }

  if (channelConnectionId) {
    // Use channel connection ID last characters
    const id = channelConnectionId.slice(-6);
    return `ID: ${id}`;
  }

  return "Sin número";
}
