# homey-bluesky

Homey app for connecting a Bluesky account and using it in Flows.

## What is in the repo

- Homey app manifest and compose files
- Bluesky account driver
- Flow cards for posting and account interactions
- Polling-based account state updates
- Localized app texts

## Development

Install dependencies:

```bash
bun install
```

Build:

```bash
bun run build
```

Run the app on Homey:

```bash
homey app run
```

## Authentication

The app uses a Bluesky handle together with an app password.

## Notes

- Widgets are currently disabled.
- Some account data is exposed as device values and settings.
- Notification-based triggers are detected by polling.
