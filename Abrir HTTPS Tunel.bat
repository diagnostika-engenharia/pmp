@echo off
cd /d "%~dp0"
title Diagnostika - Tunel HTTPS para celular
color 0B

:: Verifica se servidor local esta rodando, se nao inicia
netstat -an | find "8765" | find "LISTENING" >nul 2>&1
if not %errorlevel%==0 (
    echo Iniciando servidor local...
    start "" /B node server.js
    timeout /t 2 /nobreak >nul
)

echo.
echo ============================================================
echo   DIAGNOSTIKA - Tunel HTTPS para acessar pelo celular
echo ============================================================
echo.
echo Aguarde aparecer a URL https://xxxxx.lhr.life abaixo.
echo Copie e abra no celular (mesma rede ou qualquer rede).
echo.
echo Mantenha esta janela aberta enquanto usar no celular.
echo Para encerrar: feche esta janela.
echo.
echo Se cair, basta fechar e abrir este atalho de novo.
echo ============================================================
echo.

:loop
"C:\Program Files\Git\usr\bin\ssh.exe" -o StrictHostKeyChecking=no -o ServerAliveInterval=20 -o ServerAliveCountMax=180 -o ExitOnForwardFailure=yes -R 80:localhost:8765 nokey@localhost.run
echo.
echo *** Tunel caiu. Reconectando em 3 segundos... ***
timeout /t 3 /nobreak >nul
goto loop
