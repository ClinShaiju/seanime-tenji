# Licensing & Attributions

Seanime Tenji is an open-source mobile application. To respect open-source compliance and support the ecosystem, the codebase uses a dual/file-level licensing structure.

## Main Application License

The overall Seanime Tenji application, including its user interface, custom state management, components, API client layer, and application-specific logic, is licensed under the **GNU General Public
License v3.0 (GPL-3.0)**.

The full text of the license can be found in the [LICENSE](LICENSE) file in the root directory.

---

## Third-Party Modules & Credits

Certain native modules in this repository were inspired by or adapted from outstanding open-source projects. To comply with their respective licenses, these specific modules are licensed under the *
*Mozilla Public License 2.0 (MPL-2.0)**.

### 1. Background Download Manager (`modules/expo-download-manager`)

* **Description:** Implements background file downloads for Android (via OkHttp and background services) and iOS (via background URL sessions).
* **Inspiration / Derived From:** Inspired by the downloader implementation in [Streamyfin](https://github.com/streamyfin/streamyfin), licensed under MPL-2.0.
* **License:** [Mozilla Public License 2.0 (MPL-2.0)](modules/expo-download-manager/LICENSE)

### 2. MPV Player Wrapper (`modules/expo-mpv-player`)

* **Description:** Provides cross-platform high-performance video playback using `libmpv`, custom render loops, and picture-in-picture capabilities on iOS and Android.
* **Inspiration / Derived From:** Derived from and inspired by the MPV player integration and Picture-in-Picture logic in [Streamyfin](https://github.com/streamyfin/streamyfin)
  and [Findroid](https://github.com/findroid/findroid), licensed under MPL-2.0.
* **License:** [Mozilla Public License 2.0 (MPL-2.0)](modules/expo-mpv-player/LICENSE)

---

## Gratitude

We would like to express our deepest gratitude to the developers of **Streamyfin** and **Findroid** for their incredible contributions to the open-source media player community. Their excellent native
integrations made high-quality background downloading and native MPV integrations accessible and served as the perfect blueprint for Seanime Tenji's native extensions.
