# Changelog

All notable changes to this project will be documented in this file.

## v0.1.24

- ⚡️ Player: Pause playback when the device is locked/turned off (background audio while using other apps still works)
- ⚡️ Player: Remember the brightness set via gestures across playback sessions
- ⚡️ Torrent search: Cached/Uncached filter and instant-availability badge for debrid
- ⚡️ Discover: "Aired Recently" row
- ⚡️ Schedule: Missing Episodes and Upcoming Episodes sections
- ⚡️ Search: Tags and Minimum Score filters

## v0.1.21

- ⚡️ Refactored support for mobile server downloads
- ⚡️ Android: Trust local certs
- 🦺 iOS: Potential fix for orientation restoration issues

## v0.1.20

- 🎉 Alpha release

### OTA (6/10):

- ⚡️ Player: Option to disable subtitles
- ⚡️ Torrent search: Support for search across providers
- ⚡️ Torrent search: Redesigned layout and smart search params
- ⚡️ Manga: Improved zooming handling
- 🦺 Local Manga: Fixed cache pollution causing incorrect chapters being shown
- 🦺 Android: Use stepper instead of slider for score
- 🦺 Logs: Fixed log entry size causing crashes
- 🦺 Player: Fixed overlays being stuck
- 🦺 Player: Fixed persistent homebar indicator on iOS
- 🦺 Home: Fixed part of the library not showing up when switching off offline mode

### OTA:

- ⚡️ Manga: Double tap to zoom in/out
- 🦺 Auth: Bypass status check when switching to offline mode
- 🦺 iOS: Fixed websocket issues causing stream starts to fail
- 🦺 Android: Add dynamic safe insets to navbar
