export const BACKGROUNDS = {
  nebula: {
    id: "nebula",
    name: "Nebula",
    type: "aurora",
    description: "Slow cosmic glow with drifting stars.",
    className: "bg-nebula",
    accent: "#9b8cff",
  },
  midnightRain: {
    id: "midnightRain",
    name: "Midnight Rain",
    type: "rain",
    description: "A quiet night atmosphere with subtle rain.",
    className: "bg-midnight-rain",
    accent: "#5fa8ff",
  },
  sakuraNight: {
    id: "sakuraNight",
    name: "Sakura Night",
    type: "petals",
    description: "Moonlit petals with a soft evening glow.",
    className: "bg-sakura-night",
    accent: "#e9a7cf",
  },
  cyberCity: {
    id: "cyberCity",
    name: "Cyber City",
    type: "grid",
    description: "Neon depth with restrained motion.",
    className: "bg-cyber-city",
    accent: "#5cf2ff",
  },
  deepSpace: {
    id: "deepSpace",
    name: "Deep Space",
    type: "stars",
    description: "Minimal dark space for deep focus.",
    className: "bg-deep-space",
    accent: "#aab7ff",
  },
  lofiWindow: {
    id: "lofiWindow",
    name: "Lofi Window",
    type: "rain",
    description: "Warm room light behind a rainy window.",
    className: "bg-lofi-window",
    accent: "#f0b878",
  },
};

export const DEFAULT_BACKGROUND = "nebula";

export const BACKGROUND_STORAGE_KEY = "pomodoro_background_v2";

export const getBackground = (id) =>
  BACKGROUNDS[id] ?? BACKGROUNDS[DEFAULT_BACKGROUND];
