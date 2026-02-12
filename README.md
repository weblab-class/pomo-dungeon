# Pomodon

## Elevator Pitch

**Turn your to-do list into an epic RPG adventure.** Pomodon transforms mundane task management into an engaging game where every completed task is a victory, every focus session is a battle, and every achievement unlocks new rewards. Instead of checking off boring lists, you'll fight monsters, collect coins, unlock collectible avatars, and watch your productivity stats level up. It's the pomodoro technique meets dungeon crawler—making productivity fun, addictive, and actually motivating.

---

Pomodon is a gamified pomodoro + task tracker. Create quests, fight monsters,
unlock avatars, and track your focus stats. The app works fully offline with
local storage, and can optionally sync to MongoDB when Google sign-in is enabled.

## Features

- Task quests with priorities, deadlines, and a battle flow
- Pomodoro-style focus timer + rewards
- Collectible avatars and coin economy
- Records view for focus stats and quests
- Google sign-in + cloud sync
- SoundCloud API for SoundCloud playlist

## Functions
1. Switch mode between different 

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 19, Vite 7, JSX |
| **Backend** | Node.js, Vite API middleware |
| **Database** | MongoDB, Mongoose (ODM) |
| **Real-time** | Socket.IO (client + server) |
| **Auth & APIs** | Google Sign-In, SoundCloud API |
| **Storage** | Browser localStorage (offline), MongoDB (cloud sync) |

---

## Resume Bullet Points

- **Built a gamified productivity web app** that combines Pomodoro-style focus timers with an RPG battle flow; users complete “quests” (tasks), fight monsters during focus sessions, and earn coins to unlock collectible avatars.
- **Designed and implemented full-stack features** including task CRUD, user profiles, and optional cloud sync via MongoDB and Google Sign-In, with offline-first support using localStorage.
- **Integrated real-time functionality** with Socket.IO for live updates and built REST-style API routes (tasks, users, stats) using Vite dev server middleware and Mongoose models.
- **Developed an interactive battle/timer UI** with sprite-based animations, SoundCloud playlist integration for focus music, and a records dashboard for focus stats and quest history.
- **Shipped end-to-end flows** for avatar customization, dungeon-style theming, and a coin/avatar economy to drive engagement and habit formation.

---

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.



## Project Layout

- `src/` - React UI and game logic
- `server/` - Vite middleware API (MongoDB + user/task tracking)
- `assets/` + `public/assets/` - sprite sheets and art assets

## Credits
Luiz Melo on itch.io for providing free rpg elements
Adobe Creative Cloud for providing backdrops
Medieval Lofi for providing lofi music
SoundCloud for providing SoundCloud API
