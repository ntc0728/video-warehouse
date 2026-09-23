/**
 * 同步 package.json 版本 → capacitor.config.ts（version / android.versionCode）
 * + android/app/build.gradle（versionCode / versionName）。
 *
 * versionCode 规则：major*100000 + minor*1000 + patch*10（1.4.0 → 104000），
 * 保证随版本号单调递增（Android 要求每次上架 versionCode 必须更大）。
 *
 * 用法：
 *   node scripts/sync-android-version.mjs           # 写入（同步）
 *   node scripts/sync-android-version.mjs --check   # 只校验不写；漂移则 exit 1（供 lint:all 门禁）
 *
 * 为什么需要 --check（2026-09-23）：
 *   CI 两条 workflow 都在**临时 checkout** 里跑本脚本，结果不回写仓库 →
 *   仓库副本 `capacitor.config.ts` 长期带旧版本号（曾漂移 1.27.1 / 127010 vs package.json 1.27.2）。
 *   本地直跑 `npx cap sync android` 会把旧版本号带进原生工程。--check 让漂移在 lint 阶段就暴露。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const [major, minor, patch] = version.split('.').map((n) => Number(n) || 0);
const versionCode = major * 100000 + minor * 1000 + patch * 10;

const capPath = join(root, 'capacitor.config.ts');
const gradlePath = join(root, 'android', 'app', 'build.gradle');

// ── --check：只比对，不写盘；任一漂移 exit 1 ──────────────────────────────
// 注：`android/` 被 .gitignore（:26），`android/app/build.gradle` 未入库 →
//   CI 全新 checkout / 未跑过 `cap add` 的机器上该文件不存在，此时跳过其校验（不是漂移）。
//   仓库内真正会漂移的是 **tracked 的 `capacitor.config.ts`**（CI 在临时 checkout 里改、不回写）。
if (CHECK) {
  const cap = readFileSync(capPath, 'utf8');
  const mismatch = [];
  if (!new RegExp(`version: '${version}'`).test(cap)) mismatch.push('capacitor.config.ts: version');
  if (!new RegExp(`versionCode: ${versionCode}`).test(cap))
    mismatch.push('capacitor.config.ts: versionCode');

  if (existsSync(gradlePath)) {
    const gradle = readFileSync(gradlePath, 'utf8');
    if (!new RegExp(`versionCode ${versionCode}`).test(gradle))
      mismatch.push('android/app/build.gradle: versionCode');
    if (!new RegExp(`versionName "${version}"`).test(gradle))
      mismatch.push('android/app/build.gradle: versionName');
  } else {
    console.log('[sync-android-version] 未找到 android/app/build.gradle（未 cap add）→ 跳过其校验');
  }

  if (mismatch.length) {
    console.error(
      `[sync-android-version] ✗ 版本漂移（真源 package.json = ${version} / versionCode ${versionCode}）：\n  - ${mismatch.join('\n  - ')}\n  修复：npm run sync:android-version（改完记得 commit）`,
    );
    process.exit(1);
  }
  console.log(`[sync-android-version] ✓ 版本一致（v${version} / versionCode ${versionCode}）`);
  process.exit(0);
}

let cap = readFileSync(capPath, 'utf8');
cap = cap.replace(/version: '[^']+'/, `version: '${version}'`);
cap = cap.replace(/versionCode: \d+/, `versionCode: ${versionCode}`);
writeFileSync(capPath, cap);

let gradle = readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode \d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName "[^"]+"/, `versionName "${version}"`);
writeFileSync(gradlePath, gradle);

console.log(
  `[sync-android-version] v${version} (versionCode ${versionCode}) -> capacitor.config.ts + android/app/build.gradle`,
);
