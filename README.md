# Pomo Dungeon

Pomo Dungeon is a gamified pomodoro + task tracker. Create quests, fight monsters,
unlock avatars, and track your focus stats. The app works fully offline with
local storage, and can optionally sync to MongoDB when Google sign-in is enabled.

## Features

- Task quests with priorities, deadlines, and a battle flow
- Pomodoro-style focus timer + rewards
- Collectible avatars and coin economy
- Records view for focus stats and quests
- Optional Google sign-in + cloud sync

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Environment Variables

Create a `.env` or `.env.local` file in the project root as needed:

- `MONGODB_URI` (optional): Mongo connection string for the Vite dev API
  middleware in `server/`. Without it, API calls will fail and the app will
  continue using local storage.
- `VITE_API_BASE_URL` (optional): Base URL for a separate API server. If empty,
  the app uses the Vite dev middleware.
- `VITE_GOOGLE_CLIENT_ID` (optional): Google OAuth client ID to enable sign-in.

## Google Sign-In (dev)

1. Create a Google OAuth Client ID (Web).
2. Add your dev origins under **Authorized JavaScript origins**, including:
   - `http://localhost:5173`
   - `http://127.0.0.1:5173`
   - Any HTTPS dev tunnel or custom domain you use.
3. Add to `.env.local`:
   - `VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com`

Note: Google sign-in requires HTTPS for non-localhost origins.

## Scripts

- `npm run dev` - start Vite dev server
- `npm run build` - build for production
- `npm run preview` - preview the production build
- `npm run lint` - run ESLint

## Project Layout

- `src/` - React UI and game logic
- `server/` - Vite middleware API (MongoDB + user/task tracking)
- `assets/` + `public/assets/` - sprite sheets and art assets
