# @quickeye/client

React SPA client for Quickeye multiplayer game. Connects to the WebSocket API and provides real-time game UI.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Opens http://localhost:3000. Hot-reload enabled.

## Building

```bash
npm run build
```

Outputs optimized bundle to `dist/`.

## Environment Variables

Create a `.env.local` file (or set in Amplify console):

```
VITE_WSS_URL=wss://your-api-gateway-url/prod
```

Get the WebSocket URL from `cdk deploy` output in `/infra`.

## Deployment via AWS Amplify Hosting

1. **Connect repo** — AWS Amplify → New app → Connect GitHub
2. **Build settings** — Set to:
   ```
   Build command:    npm -w client run build
   Build output dir: client/dist
   ```
3. **Environment variables** — In Amplify console, add:
   ```
   VITE_WSS_URL = wss://gkj3douxjj.execute-api.us-east-1.amazonaws.com/prod
   ```
4. **Deploy** — Push to main, Amplify builds and deploys automatically

The client will pre-fill the WebSocket URL from the environment variable but allow users to override it if needed.

## Game Flow

1. **Connect Screen** — enter the WebSocket API URL (from `cdk deploy`)
2. **Lobby** — create a new room or join by code
3. **Game** — spot the matching symbol between center and your card
4. **Scores** — view final standings when game ends

## Architecture

- **Hooks** — state management for WebSocket and game
- **Screens** — three main UI components (Connect, Lobby, Game)
- **Messages** — typed via @quickeye/shared discriminated unions
