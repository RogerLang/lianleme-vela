import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fail = message => {
  console.error(`vela-check: ${message}`);
  process.exitCode = 1;
};
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const exists = file => fs.existsSync(path.join(root, file));

const manifestPath = "src/manifest.json";
const packagePath = "package.json";
const iconPath = "src/common/icon.png";
const ignorePath = ".gitignore";
const pagePath = "src/pages/index/index.ux";
const protocolPath = "src/common/workout-protocol.js";
const specPath = "docs/WORKOUT_PROTOCOL_V1.md";

for (const required of [manifestPath, packagePath, iconPath, ignorePath, pagePath, protocolPath, specPath]) {
  if (!exists(required)) fail(`missing Vela project file: ${required}`);
}

if (!exists(manifestPath) || !exists(packagePath)) process.exit();

const manifest = JSON.parse(read(manifestPath));
const packageJson = JSON.parse(read(packagePath));
const page = exists(pagePath) ? read(pagePath) : "";
const protocol = exists(protocolPath) ? read(protocolPath) : "";
const spec = exists(specPath) ? read(specPath) : "";

if (manifest.package !== "io.github.rogerlang.lianleme") fail("Vela package must match Android package for Xiaomi interconnect");
if (manifest.name !== "练了么") fail("Vela app name changed unexpectedly");
if (!/^\d+\.\d+\.\d+$/.test(manifest.versionName || "")) fail("Vela versionName must use semantic x.y.z format");
if (!Number.isInteger(manifest.versionCode) || manifest.versionCode < 1) fail("Vela versionCode must be a positive integer");
if (packageJson.version !== manifest.versionName) fail("Vela package.json version must match manifest versionName");
const runtimeVersion = page.match(/var APP_VERSION = ['\"]([^'\"]+)['\"]/);
if (!runtimeVersion || runtimeVersion[1] !== manifest.versionName) fail("Vela runtime APP_VERSION must match manifest versionName");
if (manifest.icon !== "/common/icon.png") fail("Vela manifest icon must remain /common/icon.png");
if (!Array.isArray(manifest.deviceTypeList) || !manifest.deviceTypeList.includes("watch")) fail("Vela deviceTypeList must include watch");
if (manifest.config?.designWidth !== 336) fail("Vela designWidth must remain 336 for Xiaomi Smart Band 9 Pro");
if (Number(manifest.minPlatformVersion || 0) < 1200) fail("system.interconnect baseline requires minPlatformVersion 1200 in the Xiaomi demo baseline");
for (const featureName of ["system.vibrator", "system.storage", "system.interconnect", "system.app"]) {
  if (!Array.isArray(manifest.features) || !manifest.features.some(feature => feature?.name === featureName)) {
    fail(`Vela manifest must declare ${featureName}`);
  }
}

for (const requiredScript of ["icon", "check", "start", "build", "release"]) {
  if (!packageJson.scripts?.[requiredScript]) fail(`Vela package.json is missing ${requiredScript} script`);
}
if (!packageJson.devDependencies?.["aiot-toolkit"]) fail("Vela aiot-toolkit dependency is missing");
if (!packageJson.devDependencies?.["@aiot-toolkit/jsc"]) fail("Vela JSC dependency is missing");

const ignore = read(ignorePath);
for (const required of ["node_modules", "build", "dist", "src/common/icon.png"]) {
  if (!ignore.includes(required)) fail(`Vela .gitignore must ignore ${required}`);
}

if (!page.includes("@system.interconnect")) fail("Vela workout page must import system.interconnect");
if (!page.includes("@system.app")) fail("Vela workout page must import system.app");
if (!protocol.includes("lianleme.workout") || !protocol.includes("VERSION = 1")) fail("Workout Protocol V1 marker is missing");
for (const marker of [
  "applyIncomingProgress",
  "progress-ack",
  "syncPending",
  "pendingPlan",
  "tryApplyPendingPlan",
  "sendPlanAck",
  "status: status || 'accepted'",
  "'deferred'",
  "'active-session'",
  "'sync-pending'",
  "PROGRESS_RETRY_MS",
  "scheduleProgressRetry",
  "stopProgressRetry",
  "saveState(function(saved)",
  "persistPlan(function(planSaved)"
]) {
  if (!page.includes(marker)) fail(`bidirectional wearable sync marker missing: ${marker}`);
}
for (const marker of ["normalizeProgress", "progressMatchesPlan", "actualRir", "exerciseMeta", "workoutName", "String(progress.planId || '') === String(workout.planId || '')"]) {
  if (!protocol.includes(marker)) fail(`bidirectional protocol marker missing: ${marker}`);
}
for (const marker of ["screen === 'rir'", "selectRir0", "selectRir5", "actualRir", "finishCurrentSet(null)"]) {
  if (!page.includes(marker)) fail(`wearable RIR flow marker missing: ${marker}`);
}
const rirRowCount = (page.match(/class="rir-row"/g) || []).length;
if (rirRowCount !== 3) fail(`wearable RIR picker must have exactly 3 rows, found ${rirRowCount}`);
const rirButtonCount = (page.match(/class="rir-button"/g) || []).length;
if (rirButtonCount !== 6) fail(`wearable RIR picker must have exactly 6 buttons, found ${rirButtonCount}`);
for (const marker of ["progress` — either direction", "progress-ack", "syncPending", "actualRir", "deferred", "pending plan", "exerciseMeta", "durable", "retry"]) {
  if (!spec.includes(marker)) fail(`Workout Protocol V1 documentation marker missing: ${marker}`);
}

for (const publicText of [page, protocol, spec]) {
  if (publicText.includes("github_pat_") || publicText.includes("Authorization:") || publicText.includes("fitness-data-private")) {
    fail("Vela public source contains private credential or repository markers");
  }
}

if (!process.exitCode) console.log(`vela-check: all checks passed (${manifest.versionName} / ${manifest.versionCode})`);
