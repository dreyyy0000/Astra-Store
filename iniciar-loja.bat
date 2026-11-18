@echo off
setlocal
cd /d "%~dp0"
title Astra Store - Inicializador

echo ========================================
echo          ASTRA STORE - INICIAR
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado.
  echo Instale o Node.js 18 ou superior e execute este arquivo novamente.
  pause
  exit /b 1
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Foi criado o arquivo .env.
  echo Configure nele os dados de acesso do seu MySQL.
  notepad ".env"
  echo.
  echo Depois de salvar o .env, pressione qualquer tecla para continuar.
  pause >nul
)

if not exist "node_modules" (
  echo Instalando dependencias da loja...
  call npm install
  if errorlevel 1 (
    echo ERRO: nao foi possivel instalar as dependencias.
    pause
    exit /b 1
  )
)

echo Verificando os arquivos JavaScript...
call npm run check
if errorlevel 1 (
  echo ERRO: a verificacao encontrou um problema. Veja a mensagem acima.
  pause
  exit /b 1
)

echo Iniciando servidor Node.js...
start "Astra Store - Servidor" cmd /k "cd /d ""%~dp0"" && npm run dev"
echo Aguardando o servidor iniciar...
timeout /t 3 /nobreak >nul
start "" "http://localhost:3000"
echo.
echo Loja aberta em http://localhost:3000
 echo Mantenha a janela 'Astra Store - Servidor' aberta.
echo Para parar a loja, feche a janela do servidor ou pressione Ctrl+C nela.
echo.
pause
