@echo off
rem Restaura la barra de tareas de Windows si Lienzo se cerro mal.
rem Primero pide a Lienzo que se cierre bien; luego deshace lo que haya quedado.
cd /d "%~dp0"
echo Cerrando Lienzo y restaurando la barra de tareas de Windows...
"%~dp0Lienzo.exe" --salir
"%~dp0Lienzo.exe" --restaurar
echo Listo.
timeout /t 3 >nul
