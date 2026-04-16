# homey-bluesky

Homey app for connecting a Bluesky account and using it in Flows.

You can download the app for your Homey [here](https://homey.app/a/app.bsky/).

## What is in the repo

- Homey app manifest and compose files
- Bluesky account driver
- Flow cards for posting and account interactions
- Polling-based account state updates

<br>

The app is currently available in the following languages:
- 🇬🇧 English
- 🇨🇿 Czech
- 🇳🇱 Dutch

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

The app uses a Bluesky handle together with the account password or an app password for 2FA secured accounts.

## Notes

- Widgets are currently disabled.
- Notification-based triggers are detected by polling.
