# Запуск мобильной версии AniTier для телефона в той же Wi-Fi сети.
# Использование:
#   powershell -ExecutionPolicy Bypass -File .\serve-mobile.ps1
# Затем откройте на телефоне адрес, который появится в консоли.

param(
  [int]$Port = 8080,
  [switch]$NoOpen
)

$script = Join-Path $PSScriptRoot 'serve.ps1'
& $script -Port $Port -Lan -Mobile -NoOpen:$NoOpen
