# ⚽ Soccer Dribble

[![Gioca alla Demo](https://img.shields.io/badge/Gioca_alla_Demo-%23000000.svg?style=for-the-badge&logo=youtube&logoColor=white)](https://SapienzaInteractiveGraphicsCourse.github.io/final-project-soccer-dribble/)

**Final Project — Interactive Graphics Course**
**Sapienza University of Rome**
**Author:** Pierluca Grasso — Student ID: 1050186

---

## Overview

**Soccer Dribble** is a browser-based 3D soccer game built with [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/). It puts the player in direct control of a footballer on a fully realized 3D pitch, complete with teammates, AI-controlled opponents, goalkeepers, a referee, and a dynamic match atmosphere. The game was developed as the final project for the Interactive Graphics course at Sapienza University of Rome.

---

## Features

### 🎮 Gameplay
- **Full 3D third-person controls** with Pointer Lock API for an immersive experience
- **Game modes**: 3v3 match and Training with freekick and penalty
- **Player switching**: cycle through your teammates with `E`
- **Pass & Shoot system**: hold Left Click to charge a pass, Right Click to shoot (with a curved/diagonal trajectory)
- **Defensive Slide Tackle** with `T`
- **Stamina system**: sprint with `Shift`; stamina depletes and regenerates over time

### 🚀 Boost Mechanic
- Hold `Space` to activate a powerful speed burst that pushes the ball forward
- Boost is tracked by a dedicated yellow HUD bar
- Recharge by running over **glowing boost pads** scattered on the pitch

### 💎 Power-Ups & Bonuses
Collect diamond-shaped pickups on the field to load a special shot (active on next Right Click):
| Bonus | Effect |
|-------|--------|
| 🔥 **Super Shot** | 2.5× power, straight trajectory with fire trail |
| ⚡ **Electric Shot** | 2.5× power, unpredictable zig-zag trajectory |

> The bonus is lost if you pass the ball or switch players before shooting.

### 🤖 AI Entities
- **Teammates** — follow tactical positions and attack/defend based on possession state
- **Bots (opponents)** — actively chase the ball and attempt to score
- **Goalkeeper** — defends the goal dynamically, tracking the ball and the player
- **Referee** — patrols the pitch during play

### 🌍 Dynamic Environment
- **Day / Night** lighting, with full HDR/EXR skybox loading
- **Weather system**: Clear, Fog, Rain (15 000 particle rain), Snow (3 000 particle snowfall + ground patches)
- **Stadium spotlights** at night, positioned at the four corners of the arena
- Full PBR grass material (color, normal, roughness, AO maps) and a 3D `.glb` stadium model

### 🎬 Replay System
- After each goal, an automatic replay is triggered, playing back the last few seconds
- Skip the replay at any time by pressing `Space`
- Slow-motion effect with dynamic camera zoom during key moments

### 🧍 Player Customization
Before kick-off, you can customize your player:
- **Shirt color** and **skin tone** via color pickers
- **Hair style** (4 different `.glb` hairstyle accessories) and **hair color**
- Live 3D preview with drag-to-rotate and scroll-to-zoom

### 📊 HUD & Radar
- Scoreboard with HOME / AWAY score and match timer
- Stamina bar and Boost bar
- **Mini-radar** showing player position, ball position, and opponents
- Bonus slot indicator (slot-machine roll animation on pickup)

---

## Controls

| Input | Action |
|-------|--------|
| `W A S D` | Move / Orbit camera |
| `Mouse` | Aim / Camera look |
| `Shift` | Sprint (consumes Stamina) |
| `Left Click` (hold) | Charge & release a pass |
| `Right Click` | Shoot (diagonal curve) |
| `Space` | Activate Boost |
| `E` | Switch controlled player |
| `T` | Defensive slide tackle |
| `Esc` | Pause menu |

---

## Tech Stack

| Technology | Role |
|---|---|
| [Three.js](https://threejs.org/) `v0.183` | 3D rendering engine |
| [Vite](https://vitejs.dev/) `v8` | Build tool & dev server |
| Vanilla JavaScript (ES Modules) | Game logic |
| Vanilla CSS | UI styling |
| GLTFLoader / GLB | 3D model loading (player, stadium, ball, hair) |
| RGBELoader / EXRLoader | HDR & EXR skybox loading |
| PointerLockControls | First-person-style input |

---

## Project Structure

```
final-project-pierlucateam/
├── public/
│   ├── models/          # 3D assets (.glb): player, stadium, ball, hair styles
│   ├── textures/        # PBR grass textures, skybox HDR/EXR files
│   └── sound/           # Audio assets
├── src/
│   ├── main.js          # Entry point & game loop
│   ├── style.css        # Global UI styles
│   ├── core/
│   │   ├── SceneSetup.js      # Three.js scene, lights, weather, skybox
│   │   ├── ModelLoader.js     # GLTF/GLB loader utility
│   │   └── ReplaySystem.js    # Goal replay recording & playback
│   ├── entities/
│   │   ├── Player.js          # Player controller (movement, pass, shoot)
│   │   ├── Ball.js            # Ball physics & collision
│   │   ├── Teammate.js        # AI teammate logic
│   │   ├── Bot.js             # AI opponent logic
│   │   ├── GoalKeeper.js      # Goalkeeper AI
│   │   ├── Referee.js         # Referee entity
│   │   └── BenchPlayer.js     # Decorative bench players
│   ├── game/
│   │   ├── MatchManager.js    # Match rules, scoring, game states
│   │   ├── BonusManager.js    # Power-up spawning & collection
│   │   ├── BoostPadManager.js # Boost pad spawning & recharge logic
│   │   └── PossessionManager.js # Ball possession state machine
│   ├── effects/
│   │   ├── GameEffects.js     # Player indicator, goal arrow effects
│   │   ├── FireTrailEffect.js # Fire trail particle system for Super Shot
│   │   ├── BoosTrail.js       # Boost particle trail
│   │   ├── Arrow.js           # Directional arrow indicator
│   │   └── PlayerCustomizer.js # Runtime material & accessory customization
│   ├── environment/
│   │   └── Pitch.js           # Football pitch geometry & field lines
│   ├── ui/
│   │   └── UIManager.js       # All HUD, menus, and UI event handling
│   └── animation-action/      # Animation state machine helpers
├── index.html
├── package.json
└── vite.config.js
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later

### Installation

```bash
# Clone the repository
git clone https://github.com/SapienzaInteractiveGraphicsCourse/final-project-soccer-dribble.git
cd final-project-pierlucateam

# Install dependencies
npm install
```

### Run the development server

```bash
npm run dev
```

Open your browser at `http://localhost:5173` (or the port shown in your terminal).

### Build for production

```bash
npm run build
npm run preview
```

---

## Course Information

- **Course:** Interactive Graphics
- **University:** Sapienza University of Rome
- **Academic Year:** 2025/2026
- **Author:** Pierluca Grasso
- **Student ID:** 1050186
