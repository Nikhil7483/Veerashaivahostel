@echo off
echo ===================================================
echo Veerashaiva Lingayath Boys Hostel - Domain Setup
echo ===================================================
echo.
echo Adding veerashaivahostel.run.place to Windows hosts file...
powershell -Command "Start-Process cmd -ArgumentList '/c echo 127.0.0.1 veerashaivahostel.run.place >> %windir%\System32\drivers\etc\hosts' -Verb RunAs"
echo.
echo Done! Please restart or refresh your browser at https://veerashaivahostel.run.place
pause
