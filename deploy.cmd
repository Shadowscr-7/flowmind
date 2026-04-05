@echo off
echo ==============================
echo  FLOWMIND - BUILD AND DEPLOY
echo ==============================
echo.

:: Navigate to app directory (relative to project root)
cd /d "%~dp0app"

echo [MODE] Select build mode:
echo   1. Debug APK (emulator/device testing)
echo   2. Release APK (device testing)
echo   3. Release AAB (Google Play upload)
echo.
set /p MODE="Enter choice (1/2/3): "

if "%MODE%"=="3" goto :aab
if "%MODE%"=="2" goto :release_apk
goto :debug_apk

:debug_apk
echo.
echo [BUILD] Building Flutter APK (debug)...
call flutter build apk --debug --dart-define-from-file=.env
if errorlevel 1 goto :build_failed
echo.
echo [INSTALL] Installing debug APK...
adb install -r build\app\outputs\flutter-apk\app-debug.apk
echo.
echo [LAUNCH] Launching app...
adb shell am start -n com.flowmind.flowmind_app/.MainActivity
goto :done

:release_apk
echo.
echo [BUILD] Building Flutter APK (release)...
call flutter build apk --release --dart-define-from-file=.env
if errorlevel 1 goto :build_failed
echo.
echo [INSTALL] Installing release APK...
adb install -r build\app\outputs\flutter-apk\app-release.apk
echo.
echo [LAUNCH] Launching app...
adb shell am start -n com.flowmind.flowmind_app/.MainActivity
goto :done

:aab
echo.
echo [BUILD] Building Flutter App Bundle (release)...
call flutter build appbundle --release --dart-define-from-file=.env
if errorlevel 1 goto :build_failed
echo.
echo ==============================
echo  AAB READY FOR GOOGLE PLAY
echo  Location: build\app\outputs\bundle\release\app-release.aab
echo ==============================
goto :done

:build_failed
echo.
echo !!! BUILD FAILED !!!
pause
exit /b 1

:done
echo.
echo ==============================
echo  DONE!
echo ==============================
