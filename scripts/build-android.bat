@echo off
REM Android 一键构建脚本 (Batch 版本)
REM 用法: scripts\build-android.bat [--release]

setlocal

set PROJECT_ROOT=%~dp0..

echo ========================================
echo   KinoTV - Android 构建脚本
echo ========================================
echo.

REM 1. 安装依赖
echo [1/5] 安装 npm 依赖...
cd /d "%PROJECT_ROOT%"
call npm install
if %ERRORLEVEL% neq 0 (
    echo npm install 失败
    exit /b 1
)

REM 2. 构建 Web 资源
echo [2/5] 构建 Web 资源 (CAPACITOR=true)...
set CAPACITOR=true
call npm run build
if %ERRORLEVEL% neq 0 (
    echo Web 构建失败
    exit /b 1
)

REM 3. 同步到 Android
echo [3/5] 同步 Capacitor 资源到 Android...
call npx cap sync android
if %ERRORLEVEL% neq 0 (
    echo Capacitor sync 失败
    exit /b 1
)

REM 应用 res + DLNA 补丁（android/ 被 gitignore，cap add 模板不含这些文件）
if exist "%PROJECT_ROOT%\scripts\android-res-patch" (
    xcopy /E /Y /I "%PROJECT_ROOT%\scripts\android-res-patch\*" "%PROJECT_ROOT%\android\app\src\main\res\"
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\scripts\patch-android-dlna.ps1"
if %ERRORLEVEL% neq 0 (
    echo DLNA 补丁失败
    exit /b 1
)

REM 4. 构建 APK
echo [4/5] 构建 APK...
cd /d "%PROJECT_ROOT%\android"

if "%1"=="--release" (
    echo   构建 Release APK...
    call gradlew.bat assembleRelease
) else (
    echo   构建 Debug APK...
    call gradlew.bat assembleDebug
)

if %ERRORLEVEL% neq 0 (
    echo Gradle 构建失败
    exit /b 1
)

REM 5. 完成
echo.
echo ========================================
echo   构建完成！
echo ========================================
echo.

if "%1"=="--release" (
    echo APK 位置: android\app\build\outputs\apk\release\
) else (
    echo APK 位置: android\app\build\outputs\apk\debug\
)

endlocal
