# Pomodon

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
1. Switch mode between different pomodoro and to-do list by clicking on the moon
2. Choose track from your favorite medieval playlist and watch the battle animations.
3. Get a special animation effect when the player kills the monster
4. Easter egg: click on the bats to kill them!

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
