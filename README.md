<div align="center">

# 🍅 Pomodoro

### **Focus is the feature. Everything else supports it.**

A focused, client-side productivity workspace built around the Pomodoro rhythm — combining a reliable timer, Spotify study music, lightweight tasks, atmospheric backgrounds, ambient sound, and a creative break experience.

<p>
  <a href="https://chillingbing648-sketch.github.io/Pomodoro/"><strong>▶ Live Preview</strong></a>
  ·
  <a href="https://github.com/chillingbing648-sketch/Pomodoro"><strong>Source Code</strong></a>
  ·
  <a href="./pomodoro-react"><strong>React Workspace</strong></a>
</p>

<img src="https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=111111" alt="React 19.2">
<img src="https://img.shields.io/badge/Vite-8.3-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 8.3">
<img src="https://img.shields.io/badge/JavaScript-ESM-F7DF1E?style=flat-square&logo=javascript&logoColor=111111" alt="JavaScript ESM">
<img src="https://img.shields.io/badge/CSS3-UI-1572B6?style=flat-square&logo=css3&logoColor=white" alt="CSS3">
<img src="https://img.shields.io/badge/Spotify-Embed-1DB954?style=flat-square&logo=spotify&logoColor=white" alt="Spotify Embed">
<img src="https://img.shields.io/badge/Client--Side-Only-8B5CF6?style=flat-square" alt="Client-side only">

</div>

---

## ✦ What is Pomodoro?

Pomodoro is a minimal focus workspace designed around one principle:

> **The timer should command attention. Everything else should support the session.**

Instead of treating a Pomodoro timer as an isolated stopwatch, the project brings the surrounding focus tools into one calm interface:

**Focus → Music → Tasks → Atmosphere → Break → Return**

It is intentionally client-side, lightweight, and free from a project-owned backend or database.

## 🚀 Live Preview

### **[Open Pomodoro →](https://chillingbing648-sketch.github.io/Pomodoro/)**

The deployed React workspace is available through GitHub Pages.

For the original lightweight implementation, open `pomo.html` directly in a modern browser.

---

## 🖼️ Preview

![Pomodoro workspace preview](https://raw.githubusercontent.com/chillingbing648-sketch/Pomodoro/main/docs/preview.svg)

---

## ✨ Core Features

| Capability | What it does |
|---|---|
| ⏱️ **Pomodoro Timer** | Focus, Short Break and Long Break sessions |
| 🔁 **Session Rhythm** | Tracks the Work → Break cycle and Long Break cadence |
| ⚙️ **Custom Durations** | Configure Work, Short Break and Long Break lengths |
| 🎵 **Spotify Workspace** | Keep focus music alongside the timer |
| ✓ **Lightweight Tasks** | Add, complete and delete tasks |
| 🍅 **Pomodoro Attribution** | Completed Work sessions can contribute to an unfinished task |
| 🌌 **Atmospheres** | Six animated visual environments designed for different moods |
| 🔊 **Ambient Sound** | Background-specific procedural sound profiles with persistent settings |
| 🎨 **Creative Break** | Canvas-based doodling during the Long Break |
| 🔔 **Notifications** | Optional browser session notifications |
| 💾 **Local Persistence** | Stores supported preferences and task/background state locally |
| ⌨️ **Keyboard Controls** | Fast timer controls in the React workspace |
| 📱 **Responsive UI** | Designed for desktop and smaller screens |
| ♿ **Reduced Motion** | Respects the browser's reduced-motion preference |

---

## 🌌 Atmosphere System

The React workspace includes an independent background engine designed to add atmosphere without competing with the timer.

### Available environments

- **Nebula** — slow interstellar clouds
- **Midnight Rain** — quiet storm over a sleeping city
- **Sakura Night** — petals drifting under moonlight
- **Cyber City** — restrained neon skyline
- **Deep Space** — distant world and stars
- **Lofi Window** — warm room during rainy dusk

Each atmosphere has its own visual renderer, palette, motion profile and ambient sound identity.

The background selection is persisted locally and remains independent from timer state.

![Background and system architecture](https://raw.githubusercontent.com/chillingbing648-sketch/Pomodoro/main/docs/architecture.svg)

---

## 🧠 Timer Model

The default rhythm is:

**25 min Work → 5 min Short Break → repeat → 15 min Long Break**

| Session | Default |
|---|---:|
| Work | **25 min** |
| Short Break | **5 min** |
| Long Break | **15 min** |

The React workspace uses a deadline-based timer reference with lightweight UI updates. The original vanilla implementation uses `requestAnimationFrame`.

The two implementations are kept separate so the project can demonstrate both a framework-based and browser-native approach.

---

## 🎵 Music + Focus

Spotify is treated as part of the workspace rather than an external afterthought.

The embedded player keeps study music close to the active session while the timer remains the primary interaction.

Playback behaviour is ultimately controlled by Spotify and the browser.

---

## ✓ Tasks + Pomodoro Attribution

The task system is deliberately lightweight.

A task contains:

- title
- completion state
- Pomodoro count
- deletion action

When a Work session completes, the React implementation can attribute the completed Pomodoro to an unfinished task.

The goal is simple:

`Task → Focus Session → Completed Pomodoro → Task Progress`

No project-management layer is required.

---

## 🎨 Creative Break

The Long Break introduces a different interaction model: a Canvas 2D doodle space.

Current capabilities include:

- color selection
- brush sizing
- pointer-based drawing
- clear-board action

The intention is to make the break feel like a reset rather than another productivity dashboard.

---

## 🏗️ Architecture

The repository currently contains two implementations of the product:

### React / Vite

`pomodoro-react/`

- React UI
- deadline-based timer logic
- task state
- background engine
- ambient sound engine
- Spotify integration
- Canvas drawing
- browser persistence
- notifications

### Vanilla

`pomo.html` · `pomo.css` · `pomo.js`

- browser-native DOM
- `requestAnimationFrame`
- Canvas 2D
- Spotify embed
- no npm setup required

### Runtime

```text
User
  ↓
UI
  ↓
Session + Timer State
  ├── Tasks
  ├── Spotify
  ├── Atmosphere
  ├── Ambient Audio
  └── Break Canvas
  ↓
Browser APIs
  ├── localStorage
  ├── Canvas 2D
  ├── Web Audio
  ├── Notifications
  └── requestAnimationFrame
```

**No project-owned backend, database or authentication service is required.**

---

## 🛠️ Technology Stack

![Technology stack](https://raw.githubusercontent.com/chillingbing648-sketch/Pomodoro/main/docs/tech-stack.svg)

| Layer | Technology | Purpose |
|---|---|---|
| UI | **React 19** | Interactive application |
| Build | **Vite 8** | Development and production bundling |
| Language | **JavaScript / ESM** | Application logic |
| Styling | **CSS3** | Responsive visual system |
| Rendering | **Canvas 2D** | Backgrounds and doodling |
| Audio | **Web Audio API / HTML Audio** | Ambient and completion sound |
| Storage | **localStorage** | Client-side persistence |
| Music | **Spotify Embed** | Focus music |
| Notifications | **Web Notifications API** | Session alerts |
| Quality | **ESLint 10** | Static analysis |

---

## 📁 Project Structure

```text
Pomodoro/
├── pomo.html
├── pomo.css
├── pomo.js
├── pomodoro-react/
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── src/
│       ├── App.jsx
│       ├── App.css
│       ├── index.css
│       ├── main.jsx
│       ├── components/
│       │   ├── BackgroundEngine.jsx
│       │   └── BackgroundGallery.jsx
│       └── data/
│           └── backgrounds.js
├── docs/
│   ├── preview.svg
│   ├── architecture.svg
│   └── tech-stack.svg
├── .github/
│   └── workflows/
│       └── deploy.yml
└── README.md
```

---

## ⚡ Getting Started

### Prerequisites

- Node.js 20+
- npm
- A modern browser

### Run the React workspace

```bash
cd pomodoro-react
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

### Production build

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

---

## 🌐 Deployment

The React workspace is deployed through GitHub Pages using:

`.github/workflows/deploy.yml`

Every push to `main` triggers the deployment workflow:

```text
Push to main
   ↓
GitHub Actions
   ↓
npm ci
   ↓
npm run build
   ↓
GitHub Pages artifact
   ↓
Live deployment
```

### Production URL

**https://chillingbing648-sketch.github.io/Pomodoro/**

---

## 🔧 Where to Modify Things

| Area | File |
|---|---|
| React timer + session logic | `pomodoro-react/src/App.jsx` |
| React visual system | `pomodoro-react/src/App.css` |
| Global styles | `pomodoro-react/src/index.css` |
| Background definitions + ambient profiles | `pomodoro-react/src/data/backgrounds.js` |
| Background rendering | `pomodoro-react/src/components/BackgroundEngine.jsx` |
| Background picker | `pomodoro-react/src/components/BackgroundGallery.jsx` |
| React entry point | `pomodoro-react/src/main.jsx` |
| GitHub Pages deployment | `.github/workflows/deploy.yml` |
| Vanilla markup | `pomo.html` |
| Vanilla styling | `pomo.css` |
| Vanilla logic | `pomo.js` |

---

## 🎯 Design Principles

### 01 — Focus first
The timer remains the primary product interaction.

### 02 — Music stays close
Spotify belongs inside the focus workspace.

### 03 — Keep supporting systems lightweight
Tasks, sound and atmosphere should assist focus rather than become distractions.

### 04 — Make breaks feel different
A break should create mental distance from the work session.

### 05 — Atmosphere over decoration
Motion and sound exist to establish a calm environment, not to compete for attention.

### 06 — Polish before bloat
The project prioritizes refinement of the existing experience over adding endless features.

---

## 🔐 Privacy & Data

Pomodoro is primarily client-side.

There is currently:

- no project-owned backend
- no project-owned database
- no account system
- no required API key

Supported local state is stored in the browser through `localStorage`.

Spotify remains an external service, and browser permissions apply to features such as notifications and audio playback.

---

## 🚧 Project Status

**Active development**

| Area | Status |
|---|---|
| Core timer | Integrated |
| Short / Long Breaks | Integrated |
| Spotify workspace | Integrated |
| Tasks | Integrated |
| Pomodoro attribution | Integrated |
| Background engine | Integrated |
| Ambient sound | Integrated |
| Long Break doodle | Integrated |
| GitHub Pages deployment | Integrated |
| Further UX refinement | Ongoing |

---

## 🤝 Contributing

Improvements, bug fixes and thoughtful UI/UX suggestions are welcome.

For changes:

1. Fork the repository.
2. Create a focused branch.
3. Make the smallest practical change.
4. Run `npm run lint`.
5. Run `npm run build`.
6. Open a pull request with a concise description.

Keep contributions aligned with the project's core principle:

> **Focus first.**

---

## 📌 Project Links

- **[Live Preview](https://chillingbing648-sketch.github.io/Pomodoro/)**
- **[GitHub Repository](https://github.com/chillingbing648-sketch/Pomodoro)**
- **[React Workspace](./pomodoro-react)**

---

<div align="center">

### 🍅 Focus. Pause. Reset. Repeat.

**A small productivity workspace designed around deep focus.**

<sub>React · Vite · JavaScript · CSS · Canvas 2D · Web Audio · Spotify</sub>

</div>
