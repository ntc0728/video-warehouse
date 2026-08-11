/**
 * 同步 package.json 版本 → capacitor.config.ts（version / android.versionCode）
 * + android/app/build.gradle（versionCode / versionName）。
 *
 * versionCode 规则：major*100000 + minor*1000 + patch*10（1.4.0 → 104000），
 * 保证随版本号单调递增（Android 要求每次上架 versionCode 必须更大）。
 *
 * 用法：node scripts/sync-android-version.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const [major, minor, patch] = version.split('.').map((n) => Number(n) || 0);
const versionCode = major * 100000 + minor * 1000 + patch * 10;

const capPath = join(root, 'capacitor.config.ts');
let cap = readFileSync(capPath, 'utf8');
cap = cap.replace(/version: '[^']+'/, `version: '${version}'`);
cap = cap.replace(/versionCode: \d+/, `versionCode: ${versionCode}`);
writeFileSync(capPath, cap);

const gradlePath = join(root, 'android', 'app', 'build.gradle');
let gradle = readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode \d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName "[^"]+"/, `versionName "${version}"`);
writeFileSync(gradlePath, gradle);

console.log(
  `[sync-android-version] v${version} (versionCode ${versionCode}) -> capacitor.config.ts + android/app/build.gradle`,
);
