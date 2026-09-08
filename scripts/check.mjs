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

for (const required of [manifestPath, packagePath, iconPath, ignorePath, pagePath]) {
  if (!exists(required)) fail(`missing Vela project file: ${required}`);
}

if (!exists(manifestPath) || !exists(packagePath)) process.exit();

const manifest = JSON.parse(read(manifestPath));
const packageJson = JSON.parse(read(packagePath));
const page = exists(pagePath) ? read(pagePath) : "";

if (manifest.package !== "com.rogerlang.lianleme.vela") fail("Vela package id changed unexpectedly");
if (manifest.name !== "练了么") fail("Vela app name changed unexpectedly");
if (!/^\d+\.\d+\.\d+$/.test(manifest.versionName || "")) fail("Vela versionName must use semantic x.y.z format");
if (!Number.isInteger(manifest.versionCode) || manifest.versionCode < 1) fail("Vela versionCode must be a positive integer");
if (packageJson.version !== manifest.versionName) fail("Vela package.json version must match manifest versionName");
if (manifest.icon !== "/common/icon.png") fail("Vela manifest icon must remain /common/icon.png");
if (!Array.isArray(manifest.deviceTypeList) || !manifest.deviceTypeList.includes("watch")) fail("Vela deviceTypeList must include watch");
if (manifest.config?.designWidth !== 336) fail("Vela designWidth must remain 336 for Xiaomi Smart Band 9 Pro");
if (!Array.isArray(manifest.features) || !manifest.features.some(feature => feature?.name === "system.vibrator")) {
  fail("Vela manifest must declare system.vibrator");
}
if (!Array.isArray(manifest.features) || !manifest.features.some(feature => feature?.name === "system.storage")) {
  fail("Vela manifest must declare system.storage");
}

for (const requiredScript of ["icon", "check", "start", "build", "release"]) {
  if (!packageJson.scripts?.[requiredScript]) fail(`Vela package.json is missing ${requiredScript} script`);
}
if (!packageJson.devDependencies?.["aiot-toolkit"]) fail("Vela aiot-toolkit dependency is missing");
if (!packageJson.devDependencies?.["@aiot-toolkit/jsc"]) fail("Vela JSC dependency is missing");

const ignore = read(ignorePath);
for (const required of ["node_modules", "dist", "src/common/icon.png"]) {
  if (!ignore.includes(required)) fail(`Vela .gitignore must ignore ${required}`);
}

if (page.includes("github_pat_") || page.includes("Authorization:") || page.includes("fitness-data-private")) {
  fail("Vela public source contains private credential or repository markers");
}

if (!process.exitCode) console.log(`vela-check: all checks passed (${manifest.versionName} / ${manifest.versionCode})`);
