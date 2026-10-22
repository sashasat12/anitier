# Один раз скачивает JDK 17 и Android SDK для сборки APK.
# Запуск: powershell -ExecutionPolicy Bypass -File .\android\setup-tools.ps1

param(
  [string]$Dir = "$env:LOCALAPPDATA\AniTierAndroid"
)

$ErrorActionPreference = 'Stop'
$jdk = Join-Path $Dir 'jdk'
$sdk = Join-Path $Dir 'sdk'
$downloads = Join-Path $Dir 'downloads'
New-Item -ItemType Directory -Force -Path $Dir, $downloads | Out-Null

function Download([string]$url, [string]$path) {
  if (Test-Path $path) { return }
  Write-Host "Скачивание: $url" -ForegroundColor Cyan
  & curl.exe -L --fail --retry 3 --retry-delay 2 -sS -o $path $url
  if ($LASTEXITCODE -ne 0) { throw "Не удалось скачать $url" }
}

function Expand-Zip([string]$zip, [string]$destination) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $destination)
}

if (-not (Test-Path (Join-Path $jdk 'bin\java.exe'))) {
  $zip = Join-Path $downloads 'jdk17.zip'
  Download 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk' $zip
  $tmp = Join-Path $Dir 'jdk-tmp'
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  Expand-Zip $zip $tmp
  $inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
  if (-not $inner) { throw 'В архиве JDK нет папки' }
  Move-Item $inner.FullName $jdk
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path (Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'))) {
  $zip = Join-Path $downloads 'cmdline-tools.zip'
  Download 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip' $zip
  $tmp = Join-Path $Dir 'cmdline-tmp'
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  Expand-Zip $zip $tmp
  $inner = Get-ChildItem $tmp -Directory | Where-Object { $_.Name -eq 'cmdline-tools' } | Select-Object -First 1
  if (-not $inner) { throw 'В архиве нет папки cmdline-tools' }
  $latest = Join-Path $sdk 'cmdline-tools\latest'
  New-Item -ItemType Directory -Force -Path $latest | Out-Null
  Get-ChildItem $inner.FullName -Force | ForEach-Object { Move-Item $_.FullName $latest }
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

$env:JAVA_HOME = $jdk
$env:Path = (Join-Path $jdk 'bin') + ';' + $env:Path
$sdkmanager = Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'

Write-Host 'Принятие лицензий Android SDK...' -ForegroundColor Cyan
$yes = (1..40 | ForEach-Object { 'y' }) -join "`n"
$yes | & $sdkmanager --sdk_root=$sdk --licenses

Write-Host 'Установка platform и build-tools...' -ForegroundColor Cyan
& $sdkmanager --sdk_root=$sdk 'platforms;android-34' 'build-tools;34.0.0' 'platform-tools'

Write-Host "Готово. JDK: $jdk" -ForegroundColor Green
Write-Host "SDK: $sdk" -ForegroundColor Green
Write-Host 'Теперь можно запускать android\build-apk.ps1' -ForegroundColor Green
