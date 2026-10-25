# Showcase: release APK + local server over ngrok

For a live demo the APK talks to **this laptop's** API through a fixed ngrok
domain, not to Render. Nothing is deployed; the laptop *is* the backend, so it
must stay awake and online for the whole demo.

- API tunnel (fixed for this ngrok account): `https://pomological-nada-occultly.ngrok-free.dev`
- Database, auth and storage: the Supabase project in `apps/server/.env` (the
  same one the seeded demo data lives in).
- APK: `apps/native/android/app/build/outputs/apk/release/app-release.apk`

## Before the demo (every time)

Two terminals, both left running.

**1. API** (repo root, PowerShell):

```powershell
$env:TRUST_PROXY="1"; pnpm --filter server dev
```

`TRUST_PROXY=1` makes the server read each phone's real address from ngrok's
`X-Forwarded-For`. Without it every phone shares one rate-limit bucket
(120 requests/minute per route) and a busy room gets "Too many requests".
Only set it behind a tunnel or proxy.

**2. Tunnel:**

```powershell
ngrok http 3000 --url=https://pomological-nada-occultly.ngrok-free.dev
```

**3. Check, from the phone's browser or any machine:**
`https://pomological-nada-occultly.ngrok-free.dev/api/health` - must answer
JSON with `"storage":"supabase"`. (ngrok shows a one-time "You are about to
visit" page in a browser; click Visit. The app itself never sees that page - it
sends `ngrok-skip-browser-warning`.)

**4. Warm up:** open the app once per role before people arrive - the first
feed request after a server start is the slowest.

Demo accounts (password = email): `volunteer@nabhya.com`, `ngo@nabhya.com`,
`superadmin@nabhya.com` (the console is desktop web).

## Laptop checklist

- Plugged in; sleep and screen-off disabled for the duration.
- Don't edit server files mid-demo: `dev` watches and restarts on save.
- Wi-Fi or a phone hotspot with internet - ngrok needs outbound internet; the
  phones can be on any network, including mobile data.

## Install the APK

```powershell
adb install -r apps/native/android/app/build/outputs/apk/release/app-release.apk
```

Or copy the file to the phone and open it (allow "install unknown apps"). It is
signed with the release key in `D:\Space\kalki_misc\nabhya-release\`, so later
builds install over it without uninstalling.

## Rebuild the APK

Only needed after app code changes. The API URL is baked in at build time.

```powershell
cd apps/native
# Only after an Expo SDK or native dependency change - regenerates android/:
#   $env:CI="1"; npx expo prebuild --platform android --clean --no-install
#   then restore package.json (prebuild rewrites its scripts) and reapply the
#   local edits below.
cd android
$env:EXPO_PUBLIC_API_URL="https://pomological-nada-occultly.ngrok-free.dev"
$env:NODE_ENV="production"
./gradlew assembleRelease --no-daemon --max-workers=2
```

Local edits a `prebuild --clean` wipes (backups of the last good set are in
`D:\Space\kalki_misc\nabhya-release\android-backup-sdk57\`):

- `app/build.gradle`: a `release` signing config loading
  `D:/Space/kalki_misc/nabhya-release/keystore.properties`, and the `release`
  build type using `signingConfigs.release`.
- `build.gradle`: the `subprojects` hook capping CMake to `compile=3;link=1`
  jobs (16 parallel clang processes exhaust the paging file).
- `gradle.properties`: `org.gradle.parallel=false`,
  `reactNativeArchitectures=armeabi-v7a,arm64-v8a`.
  `android.enableMinifyInReleaseBuilds=false` comes from `app.json`
  (expo-build-properties) - R8 stays off until Razorpay keep rules exist.
- `local.properties`: `sdk.dir=C:/ProgramData/Android/Sdk` and
  `cmake.dir=C:/ProgramData/Android/Sdk/cmake/3.31.6` (CMake 3.22's ninja loops
  on pnpm's long paths).

Network timeouts from `dl.google.com` / Maven Central are transient: re-run.

## Known demo caveats

- A certificate's "Download PDF" opens in the phone browser, which shows the
  ngrok visit page once before the PDF.
- Razorpay checkout runs in the APK (it does not in Expo Go). Use test keys
  unless you mean to take real money.
- If the laptop sleeps or ngrok stops, the app shows "Couldn't reach Nabhya" -
  restart both terminals; the URL does not change.
