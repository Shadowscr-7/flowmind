@echo off
echo === CHECKING EMULATOR ===
C:\Users\jgomez\AppData\Local\Android\sdk\platform-tools\adb.exe devices
echo.
echo === FLUTTER BUILD LOG (last 20 lines) ===
if exist C:\temp\flutter_final.txt (
    powershell -NoProfile -Command "Get-Content C:\temp\flutter_final.txt | Where-Object { $_ -notmatch 'INFO|CPUID|IPv6|Ignore|host.doesn' -and $_.Trim() -ne '' } | Select-Object -Last 20"
) else (
    echo No build log found
)
echo.
echo === DART PROCESSES ===
tasklist /FI "IMAGENAME eq dart.exe" 2>nul
