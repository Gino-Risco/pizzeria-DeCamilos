# deploy.ps1 - Actualiza el codigo y reinicia los 3 servicios en PM2
# Uso: desde la raiz del proyecto, ejecutar:  .\deploy.ps1
$ErrorActionPreference = "Stop"

Write-Host "==> git pull" -ForegroundColor Cyan
git pull

Write-Host "==> Backend: instalando dependencias y generando cliente Prisma" -ForegroundColor Cyan
Push-Location backend_3
npm install
npx prisma generate
Pop-Location

Write-Host "==> Frontend: instalando dependencias y compilando build de produccion" -ForegroundColor Cyan
Push-Location frontend_3
npm install
npm run build
Pop-Location

Write-Host "==> Microservicio de impresion: instalando dependencias" -ForegroundColor Cyan
Push-Location microservicio_impresion
npm install
Pop-Location

Write-Host "==> Reiniciando PM2 (0-downtime donde se pueda)" -ForegroundColor Cyan
pm2 startOrReload ecosystem.config.js --update-env
pm2 save

Write-Host "Listo." -ForegroundColor Green
pm2 list
