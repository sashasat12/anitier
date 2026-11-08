# Автоматизация релиза AniTier по чек-листу из AGENTS.md.
# Значения берутся из файлов: ничего дублировать вручную не нужно.
#
# Примеры:
#   powershell -ExecutionPolicy Bypass -File .\release.ps1
#       проверить версии, прогнать тесты, пересобрать артефакты
#   powershell -ExecutionPolicy Bypass -File .\release.ps1 -Commit
#       то же плюс коммит всех изменений
#   powershell -ExecutionPolicy Bypass -File .\release.ps1 -Push
#       то же плюс отправка в main (GitHub Pages обновится сам)
#   powershell -ExecutionPolicy Bypass -File .\release.ps1 -Release
#       полный цикл: пуш, тег vX.Y.Z и GitHub-релиз с AniTier.apk (включает Push)
#
# Требования: Edge/Chrome для тестов, JDK/SDK для APK, gh для GitHub-релиза.

param(
  [switch]$SkipTests,
  [switch]$Commit,
  [switch]$Push,
  [switch]$Release
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Read-Text([string]$path) {
  return [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
}

function Invoke-Script([string]$file, [string[]]$arguments = @()) {
  Write-Host "> $file $($arguments -join ' ')" -ForegroundColor Cyan
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $file @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Не удалось выполнить $file (код $LASTEXITCODE)"
  }
}

# --- версия приходит из core.js и сверяется со всеми остальными местами ---
$coreText = Read-Text (Join-Path $root 'core.js')
$versionMatch = [regex]::Match($coreText, "APP_VERSION\s*=\s*'([0-9]+)\.([0-9]+)\.([0-9]+)'")
if (-not $versionMatch.Success) { throw 'В core.js не найден APP_VERSION.' }
$version = $versionMatch.Groups[1].Value + '.' + $versionMatch.Groups[2].Value + '.' + $versionMatch.Groups[3].Value
$problems = @()

$changelogText = Read-Text (Join-Path $root 'changelog.js')
$changelogVersion = [regex]::Match($changelogText, "version:\s*'([0-9.]+)'").Groups[1].Value
if ($changelogVersion -ne $version) {
  $problems += "changelog.js: первая запись '$changelogVersion', ожидалось '$version'"
}

$manifestText = Read-Text (Join-Path $root 'android\AndroidManifest.xml')
$manifestName = [regex]::Match($manifestText, 'android:versionName="([0-9.]+)"').Groups[1].Value
if ($manifestName -ne $version) {
  $problems += "AndroidManifest.xml: versionName '$manifestName', ожидалось '$version'"
}

$manifestCode = [regex]::Match($manifestText, 'android:versionCode="([0-9]+)"').Groups[1].Value
if (-not $manifestCode) {
  $problems += 'AndroidManifest.xml: не найден versionCode'
}

foreach ($html in @('index.html', (Join-Path 'mobile' 'index.html'))) {
  $htmlText = Read-Text (Join-Path $root $html)
  $stale = [regex]::Matches($htmlText, '\?v=([0-9.]+)') |
    Where-Object { $_.Groups[1].Value -ne $version }
  if ($stale.Count -gt 0) {
    $problems += "${html}: есть ссылки с ?v= кроме '$version'"
  }
}

if ($problems.Count -gt 0) {
  foreach ($problem in $problems) {
    Write-Host "ПРОБЛЕМА: $problem" -ForegroundColor Red
  }
  Write-Host 'Поднимите версию в core.js, changelog.js, AndroidManifest.xml, mobile/sw.js и ?v= в index.html, mobile/index.html.' -ForegroundColor Yellow
  exit 1
}
Write-Host "Версии синхронизированы: $version (versionCode $manifestCode)" -ForegroundColor Green

# --- тесты и сборка ---
if ($SkipTests) {
  Write-Host 'Тесты пропущены по флагу -SkipTests.' -ForegroundColor Yellow
} else {
  Invoke-Script (Join-Path $root 'test.ps1')
}

Invoke-Script (Join-Path $root 'build-phone.ps1')
Invoke-Script (Join-Path $root 'android\build-apk.ps1')

$apkPath = Join-Path $root 'AniTier.apk'
if (-not (Test-Path $apkPath)) { throw 'AniTier.apk не собрался.' }
Write-Host 'Артефакты готовы: AniTier-phone.html, AniTier.apk' -ForegroundColor Green

# --- git: без флагов ничего не трогаем ---
function Invoke-Git([string[]]$arguments) {
  $output = & git @arguments 2>&1
  if ($LASTEXITCODE -ne 0) { throw "git $([string]$arguments[0]): $output" }
  return ($output | Out-String).Trim()
}

$tag = "v$version"
$wantCommit = $Commit -or $Push -or $Release
$wantPush = $Push -or $Release
$wantRelease = $Release

$status = Invoke-Git @('status', '--porcelain')
$hasChanges = ($status -replace '^\?\? (AniTier-phone\.html|AniTier\.apk)$', '').Trim().Length -gt 0

if ($wantCommit -and $hasChanges) {
  $titleMatch = [regex]::Match($changelogText, [regex]::Escape("version: '$version'") + '[\s\S]*?title:\s*''([^'']+)''')
  $commitTitle = if ($titleMatch.Success) { "Релиз $version — " + $titleMatch.Groups[1].Value } else { "Релиз $version" }
  Invoke-Git @('add', '-A')
  Invoke-Git @('commit', '-m', $commitTitle)
  Write-Host "Коммит создан: $commitTitle" -ForegroundColor Green
}

if ($wantPush) {
  Invoke-Git @('push', 'origin', 'main')
  Write-Host 'Отправлено в main: Pages обновится сам.' -ForegroundColor Green
}

### --- GitHub-релиз ---
if ($wantRelease) {
  $changelogTail = [regex]::Match(
    $changelogText,
    [regex]::Escape("version: '$version'") + '[\s\S]*?\}\s*,'
  ).Value
  if (-not $changelogTail) { throw "В changelog.js не найдена запись $version." }

  $entryTitle = [regex]::Match($changelogTail, 'title:\s*''([^'']+)''').Groups[1].Value
  if (-not $entryTitle) { throw 'В записи changelog нет title.' }

  $itemsText = [regex]::Match($changelogTail, 'items:\s*\[([\s\S]*?)\]').Groups[1].Value
  $bullets = [regex]::Matches($itemsText, "'([^']{20,})'") |
    ForEach-Object { '- ' + $_.Groups[1].Value }
  if (-not $bullets) {
    $bullets = [regex]::Matches($itemsText, "'([^']+)'") | ForEach-Object { '- ' + $_.Groups[1].Value }
  }

  $notes = New-Object System.Collections.Generic.List[string]
  $notes.Add("## Что нового`n") | Out-Null
  foreach ($bullet in $bullets) { $notes.Add($bullet) | Out-Null }
  $notes.Add("`n## Установка") | Out-Null
  $notes.Add('Скачайте AniTier.apk и установите на Android. Версия: ' + "$version (versionCode $manifestCode).") | Out-Null

  $notesPath = Join-Path $env:TEMP ("anitier-release-" + $version + ".md")
  [IO.File]::WriteAllText($notesPath, ($notes -join "`r`n"), (New-Object Text.UTF8Encoding($false)))

  Write-Host "Создаём GitHub-релиз $tag…" -ForegroundColor Cyan
  & gh release create $tag $apkPath --title "AniTier $version — $entryTitle" --notes-file $notesPath --target main
  if ($LASTEXITCODE -ne 0) { throw 'Не удалось создать GitHub-релиз (gh).' }
  Write-Host "Релиз создан: $tag с AniTier.apk" -ForegroundColor Green
  Write-Host 'Проверка после выкладки: gh api repos/sashasat12/anitier/pages/builds/latest' -ForegroundColor DarkGray
}
