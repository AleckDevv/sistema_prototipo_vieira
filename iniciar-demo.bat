@echo off
title Vieira ^| Gestao Operacional - demonstracao
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo.
  echo  O Node.js nao foi encontrado neste computador.
  echo  Instale o Node.js ^(https://nodejs.org^) ou use outro servidor local,
  echo  conforme as instrucoes do arquivo README.md.
  echo.
  pause
  exit /b 1
)
echo.
echo  Iniciando a demonstracao. Mantenha esta janela aberta durante a apresentacao.
echo.
node servidor.js --abrir
pause
