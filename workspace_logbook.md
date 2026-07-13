# Workspace Logbook

## 2026-07-11 Investigation: User Notifications Failure
- **Findings**: Handlers for `/subscribe` and `/unsubscribe` were missing from the backend worker, tables were missing from D1, and service workers had no push listener.

## 2026-07-11 Execution: Enable Web Push Notifications
- **Database Schema**: Created `schema_v5.sql` and `cron_state` table and executed on remote D1.
- **Service Worker**: Updated `sw.js` and `wwwroot/sw.js` with `push` listeners and fallback `/api/latest-notification` fetch code.
- **Worker JS**: Implemented `/subscribe`, `/unsubscribe`, and `/api/latest-notification` endpoints. Configured VAPID encryption & Open-Meteo/NWS/USGS river alert scheduling logic.
- **Secrets Configured**: Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `CRON_SECRET` on wrangler.
- **Deployment**: Pushed commits to git to trigger Cloudflare build pipeline.

## 2026-07-12 Investigation & Plan: Repairing Web Push Notifications
- **Findings**:
  1. Service Worker Caching Bug: `wwwroot/sw.js` implements a generic Cache-First strategy that intercepts and caches ALL requests including POST requests (like `/subscribe` and `/unsubscribe`) and dynamic GET requests (like `/api/latest-notification`). Caching POST requests throws `TypeError: Request method 'POST' is not supported` inside the fetch handler promise chain, completely breaking the fetch pipeline and failing all client subscriptions.
  2. Global Function Missing: `initWeatherPush()` in `wwwroot/index.html` is not exposed to the global `window` object. This causes Blazor's JSInterop `JSRuntime.InvokeVoidAsync("initWeatherPush")` call on the `/notifications` page to fail with a ReferenceError.
  3. API Host Restrictions: The allowed push hosts check in `worker.js` restricts endpoints to a hardcoded list, rejecting valid subscriptions from brave, opera, vivaldi, or local test browsers.
  4. Broken Close Button: In `Personalization.razor`, the modal close button calls the non-existent JS function `closePersonalization()`, causing a runtime crash.
- **Planned Fixes**:
  1. Update `wwwroot/sw.js` and `sw.js` to skip caching for all non-GET requests and `/api/*`, `/subscribe`, `/unsubscribe`, and `/check-weather` endpoints.
  2. Expose `initWeatherPush` on `window` in `wwwroot/index.html`.
  3. Remove push service hostname restrictions in `worker.js` to support all browsers.
  4. Refactor `Personalization.razor` to use `NavigationManager` to navigate back home, eliminating the need for `closePersonalization()`.

## 2026-07-12 Execution: Blazor WASM Build and Asset Loading Repairs
- **MSBuild Exclusions**: Fixed the StaticWebAssets compilation crashes by adding the `./dotnet` SDK directory, `.wrangler` state, and root-level duplicated scripts to `<DefaultItemExcludes>` in [WaZWeather.csproj](file:///c:/dev/wazweather/WaZWeather.csproj), preventing file collisions.
- **Compression Fix**: Retained `<CompressionEnabled>false</CompressionEnabled>` to bypass MSBuild pre-compression dictionary key crashes.
- **Blazor Asset Fingerprinting**: Integrated a standard Blazor loader using `autostart="false"` inside [wwwroot/index.html](file:///c:/dev/wazweather/wwwroot/index.html). This lets MSBuild automatically rewrite the fingerprinted file name at publish time, while allowing dynamic JavaScript invocation via `Blazor.start()` when the "Personalize Settings" button is clicked.
- **Compilation & Verification**: Cleanly built the project and copied assets to `wwwroot`. Verified all endpoints and static resources now load with a `200 OK` status.

## 2026-07-13 Execution: Rebuilding Blazor WASM and Running Wrangler
- **Clean and Publish**: Cleaned up output directories and compiled/published the Blazor app to Release.
- **Copy Assets**: Copied framework, styles, and service worker files back to the wwwroot source directory.
- **Wrangler Dev Server**: Booted wrangler dev server to host the static assets locally and route requests.

2026-07-12: Server restarted. All integration blockers and D1 database issues for Settings & Alerts Modal were resolved prior to restart. Walkthrough artifact generated.
2026-07-12: Pushed Settings & Alerts modal integration and .NET 10 asset pipeline fixes to GitHub origin main. .gitignore updated to exclude local miniflare state and compiled wwwroot assets. Cloudflare CI deployment triggered.
2026-07-12: Fixed critical production deployment bug where build.sh failed to copy the compiled index.html and service-worker-assets.js to wwwroot, causing a blank screen and SyntaxError. Fix committed and pushed.
2026-07-12: Discovered secondary production bug where Wrangler ignored the compiled Blazor WASM assets because they were in .gitignore. Added a sed command to build.sh to dynamically strip wwwroot from .gitignore during the CI pipeline. Fix committed and pushed.

## 2026-07-13 Audit: NWS Alert Cron Scheduler Verification
- **Heat Advisory Verification**: Confirmed active Heat Advisories are successfully parsed. Response parsing of NWS GeoJSON properties (`props.id`, `props.event`, `props.expires`, `props.headline`) works correctly.
- **Cooldown Bug / Spamming**: Found that since "Heat Advisory" is not defined in `NWS_COOLDOWNS`, it defaults to `DEFAULT_NWS_COOLDOWN` (30 minutes). This causes the exact same Heat Advisory to be re-sent as a new push notification every 30 minutes, spamming users. Furthermore, high-severity events like "Tornado Warning" have a cooldown of `0`, causing them to spam every minute if the cron trigger is active and the warning remains in the NWS feed.
- **Subscription Preferences Bug**: Verified that `pushToAll` fetches all endpoints unconditionally using `SELECT endpoint FROM subscriptions` without filtering by user preferences (`preferences_weather`, `preferences_river`, `preferences_aqi`), completely ignoring user preference choices.
- **Cron Trigger Execution**: Verified that the cron trigger is active and running every minute (`* * * * *`) in `wrangler.toml`, successfully fetching from NWS and open-meteo, but database records confirm empty remote subscriptions, preventing active web push execution to client browsers.

