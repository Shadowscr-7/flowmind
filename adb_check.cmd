@echo off
echo === ADB DEVICES ===
C:\Users\jgomez\AppData\Local\Android\sdk\platform-tools\adb.exe devices
echo.
echo === RUNNING PACKAGES ===  
C:\Users\jgomez\AppData\Local\Android\sdk\platform-tools\adb.exe shell "dumpsys activity recents | findstr com.example"
echo.
echo === CHECK APP ===
C:\Users\jgomez\AppData\Local\Android\sdk\platform-tools\adb.exe shell "pm list packages | findstr flowmind"
C:\Users\jgomez\AppData\Local\Android\sdk\platform-tools\adb.exe shell "pm list packages | findstr example"
