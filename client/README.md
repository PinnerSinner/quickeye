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

## Deployment

The client is deployed via AWS Amplify Hosting. Point it to this directory, and set the build command to:

```
npm -w client run build
```

Output directory: `client/dist`

## Game Flow

1. **Connect Screen** — enter the WebSocket API URL (from `cdk deploy`)
2. **Lobby** — create a new room or join by code
3. **Game** — spot the matching symbol between center and your card
4. **Scores** — view final standings when game ends

## Architecture

- **Hooks** — state management for WebSocket and game
- **Screens** — three main UI components (Connect, Lobby, Game)
- **Messages** — typed via @quickeye/shared discriminated unions
