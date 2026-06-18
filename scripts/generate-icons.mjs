/**
 * Android 图标和启动页生成脚本
 * 使用 sharp 库将 KinoTV.webp 转换为各尺寸图标
 */
import sharp from 'sharp';
import { existsSync, mkdirSync, unlinkSync, rmdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// 删除默认矢量图文件（会覆盖 PNG 图标）
function removeDefaultIcons() {
  const filesToDelete = [
    'android/app/src/main/res/drawable/ic_launcher_background.xml',
    'android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml',
    'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
    'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml',
  ];
  
  const dirsToDelete = [
    'android/app/src/main/res/drawable-v24',
    'android/app/src/main/res/mipmap-anydpi-v26',
  ];
  
  for (const file of filesToDelete) {
    const fullPath = join(projectRoot, file);
    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
      console.log(`  ✓ 删除: ${file.split('/').pop()}`);
    }
  }
  
  for (const dir of dirsToDelete) {
    const fullPath = join(projectRoot, dir);
    if (existsSync(fullPath)) {
      try {
        rmdirSync(fullPath);
        console.log(`  ✓ 删除空目录: ${dir.split('/').pop()}`);
      } catch { /* 目录不为空，跳过 */ }
    }
  }
}

// 源图标路径
const sourceIcon = join(projectRoot, 'src/assets/icon/KinoTV.webp');

// Android 图标尺寸
const iconSizes = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

// 启动页尺寸（竖屏）
const splashSizes = {
  mdpi: { width: 320, height: 480 },
  hdpi: { width: 480, height: 720 },
  xhdpi: { width: 640, height: 960 },
  xxhdpi: { width: 960, height: 1440 },
  xxxhdpi: { width: 1280, height: 1920 },
};

// 启动页尺寸（横屏）
const splashLandSizes = {
  mdpi: { width: 480, height: 320 },
  hdpi: { width: 720, height: 480 },
  xhdpi: { width: 960, height: 640 },
  xxhdpi: { width: 1440, height: 960 },
  xxxhdpi: { width: 1920, height: 1280 },
};

// 确保目录存在
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// 生成圆形图标
async function generateRoundIcon(source, output, size) {
  const radius = Math.floor(size / 2);
  
  // 创建圆形遮罩
  const circleBuffer = Buffer.from(
    `<svg width="${size}" height="${size}">
      <circle cx="${radius}" cy="${radius}" r="${radius}" fill="white"/>
    </svg>`
  );
  
  // 调整源图大小
  const resized = await sharp(source)
    .resize(size, size, { fit: 'cover' })
    .toBuffer();
  
  // 应用圆形遮罩
  await sharp(resized)
    .composite([{
      input: circleBuffer,
      blend: 'dest-in',
    }])
    .png()
    .toFile(output);
}

// 主函数
async function main() {
  console.log('========================================');
  console.log('  生成 Android 图标和启动页');
  console.log('========================================\n');

  // 检查源文件
  if (!existsSync(sourceIcon)) {
    console.error('源图标不存在:', sourceIcon);
    process.exit(1);
  }

  console.log('源图标:', sourceIcon);
  console.log('');

  // 删除默认矢量图文件
  console.log('清理默认图标...');
  removeDefaultIcons();
  console.log('');

  // 生成各尺寸图标
  console.log('生成 App 图标...');
  for (const [density, size] of Object.entries(iconSizes)) {
    const outputDir = join(projectRoot, `android/app/src/main/res/mipmap-${density}`);
    ensureDir(outputDir);
    
    // 标准图标
    const iconPath = join(outputDir, 'ic_launcher.png');
    await sharp(sourceIcon)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(iconPath);
    
    // 圆形图标
    const roundIconPath = join(outputDir, 'ic_launcher_round.png');
    await generateRoundIcon(sourceIcon, roundIconPath, size);
    
    console.log(`  ✓ ${density}: ${size}x${size}`);
  }

  // 生成启动页
  console.log('\n生成启动页...');
  
  // 生成竖屏启动页
  for (const [density, dimensions] of Object.entries(splashSizes)) {
    const outputDir = join(projectRoot, `android/app/src/main/res/drawable-${density}`);
    ensureDir(outputDir);
    
    const { width, height } = dimensions;
    const iconSize = Math.floor(Math.min(width, height) * 0.3);
    const iconX = Math.floor((width - iconSize) / 2);
    const iconY = Math.floor((height - iconSize) / 2);
    
    // 调整图标大小
    const resizedIcon = await sharp(sourceIcon)
      .resize(iconSize, iconSize, { fit: 'contain' })
      .toBuffer();
    
    // 创建启动页（蓝色背景 + 居中图标）
    const splashPath = join(outputDir, 'splash.png');
    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 24, g: 144, b: 255, alpha: 1 },
      },
    })
      .composite([{
        input: resizedIcon,
        left: iconX,
        top: iconY,
      }])
      .png()
      .toFile(splashPath);
    
    console.log(`  ✓ ${density}: ${width}x${height}`);
  }
  
  // 生成横屏启动页
  for (const [density, dimensions] of Object.entries(splashLandSizes)) {
    const outputDir = join(projectRoot, `android/app/src/main/res/drawable-land-${density}`);
    ensureDir(outputDir);
    
    const { width, height } = dimensions;
    const iconSize = Math.floor(Math.min(width, height) * 0.3);
    const iconX = Math.floor((width - iconSize) / 2);
    const iconY = Math.floor((height - iconSize) / 2);
    
    // 调整图标大小
    const resizedIcon = await sharp(sourceIcon)
      .resize(iconSize, iconSize, { fit: 'contain' })
      .toBuffer();
    
    // 创建横屏启动页
    const splashPath = join(outputDir, 'splash.png');
    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 24, g: 144, b: 255, alpha: 1 },
      },
    })
      .composite([{
        input: resizedIcon,
        left: iconX,
        top: iconY,
      }])
      .png()
      .toFile(splashPath);
    
    console.log(`  ✓ land-${density}: ${width}x${height}`);
  }
  
  // 生成基础 drawable 启动页（使用 xhdpi 尺寸）
  const baseDir = join(projectRoot, 'android/app/src/main/res/drawable');
  ensureDir(baseDir);
  const baseSplashPath = join(baseDir, 'splash.png');
  const baseDimensions = splashSizes.xhdpi;
  const baseIconSize = Math.floor(Math.min(baseDimensions.width, baseDimensions.height) * 0.3);
  const baseIconX = Math.floor((baseDimensions.width - baseIconSize) / 2);
  const baseIconY = Math.floor((baseDimensions.height - baseIconSize) / 2);
  const baseResizedIcon = await sharp(sourceIcon)
    .resize(baseIconSize, baseIconSize, { fit: 'contain' })
    .toBuffer();
  await sharp({
    create: {
      width: baseDimensions.width,
      height: baseDimensions.height,
      channels: 4,
      background: { r: 24, g: 144, b: 255, alpha: 1 },
    },
  })
    .composite([{
      input: baseResizedIcon,
      left: baseIconX,
      top: baseIconY,
    }])
    .png()
    .toFile(baseSplashPath);
  console.log(`  ✓ drawable: ${baseDimensions.width}x${baseDimensions.height}`);

  console.log('\n========================================');
  console.log('  图标生成完成！');
  console.log('========================================');
  console.log('\n下一步:');
  console.log('  1. npx cap sync android');
  console.log('  2. cd android && .\\gradlew.bat assembleDebug');
}

main().catch(console.error);
