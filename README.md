# Torn Userscripts

Userscripts for [Torn](https://www.torn.com/) with a strict rules-first approach.

This repository is intentionally conservative. Scripts here are designed to stay within Torn's published scripting and API boundaries.

## Scripts

### Faction War Profile Status Banner

A profile-page userscript that displays a large `ONLINE` banner only when the viewed player is online and their faction is currently at war with yours.

What it does:

- Reads the visible status indicator on the currently open profile page
- Reads the visible faction name on the currently open profile page
- Uses Torn's official API to cache your faction's active war opponents
- Shows a high-contrast `ONLINE` banner only for online enemy war profiles
- Stores the API key locally in userscript storage
- Works with a `Public Only` API key because it only needs `faction -> basic`
- Keeps API usage minimal by caching war opponents and matching profiles by visible faction name

Example banner shown on a matching profile:

<img src="./faction-war-profile-status-banner/preview-current.png" alt="Faction War Profile Status Banner example" width="780" />

What it does not do:

- No automation
- No non-API Torn requests
- No hidden-page scraping
- No background monitoring of other pages or tabs

Install:

 - Load `faction-war-profile-status-banner/faction-war-profile-status-banner.user.js` in Tampermonkey or Violentmonkey, then open a Torn profile page and save a Torn API key in the inline setup panel

### Torn Vital Bars Polish

A focused userscript that improves the visible `Energy`, `Nerve`, `Happy`, `Life`, and `Chain` bars in Torn's sidebar while keeping the original layout and information structure intact.

<img src="./torn-vital-bars-polish/preview-current.png" alt="Torn Vital Bars Polish preview" width="180" />

What it does:

- Refines the visible vital bars only
- Keeps Torn's native sidebar density and structure
- Adds cleaner fills, restrained timer chips, and optional ticks
- Includes a local toggle for ticks on or off via the userscript menu

What it does not do:

- No automation
- No extra Torn page requests
- No hidden-page behavior
- No invented gameplay data

Install:

- Direct install: [torn-vital-bars-polish.user.js](https://raw.githubusercontent.com/phantium/torn-userscripts/main/torn-vital-bars-polish/torn-vital-bars-polish.user.js)
- GitHub source: [torn-vital-bars-polish](https://github.com/phantium/torn-userscripts/tree/main/torn-vital-bars-polish)

Because the script includes `@downloadURL` and `@updateURL` metadata pointing at GitHub raw content, Tampermonkey or Violentmonkey can update it from this repository when new versions are published.

## Repository Layout

- [faction-war-profile-status-banner](./faction-war-profile-status-banner): profile page online-status callout userscript
- [torn-vital-bars-polish](./torn-vital-bars-polish): current userscript and previews
