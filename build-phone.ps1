# Собирает один автономный HTML-файл для телефона.
# Открывается напрямую из файла, без локального сервера.
# Запуск: powershell -ExecutionPolicy Bypass -File .\build-phone.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Text([string]$relative) {
  return [System.IO.File]::ReadAllText((Join-Path $root $relative), [System.Text.Encoding]::UTF8).Replace("`r`n", "`n")
}

$html = Read-Text 'mobile\index.html'
$styles = Read-Text 'styles.css'
$mobileStyles = Read-Text 'mobile\mobile.css'
$core = Read-Text 'core.js'
$app = Read-Text 'app.js'

$html = $html.Replace(
  '<link rel="stylesheet" href="../styles.css">' + "`n" + '<link rel="stylesheet" href="mobile.css">',
  "<style>`n$styles`n$mobileStyles`n</style>"
)

$html = $html.Replace(
  '<script src="../core.js" defer></script>' + "`n" +
  '<script src="../app.js" defer></script>' + "`n" +
  '<script src="mobile.js" defer></script>',
  "<script>`n$core`n</script>`n<script>`n$app`n</script>"
)

$html = $html.Replace('<link rel="manifest" href="manifest.webmanifest">' + "`n", '')
$html = $html.Replace('<link rel="apple-touch-icon" href="icons/icon-192.png">' + "`n", '')
$html = $html.Replace(
  '<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">',
  '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 64 64''%3E%3Cdefs%3E%3ClinearGradient id=''g'' x1=''0'' y1=''0'' x2=''1'' y2=''1''%3E%3Cstop offset=''0'' stop-color=''%23ff4d8d''/%3E%3Cstop offset=''1'' stop-color=''%238a5cff''/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=''64'' height=''64'' rx=''16'' fill=''url(%23g)''/%3E%3Ctext x=''32'' y=''45'' font-family=''Arial'' font-size=''36'' font-weight=''700'' fill=''white'' text-anchor=''middle''%3EA%3C/text%3E%3C/svg%3E">'
)

$html = [regex]::Replace(
  $html,
  '\s*<button class="icon-btn install-btn" id="install-app"[^>]*>.*?</button>',
  ''
)

$html = $html.Replace('AniTier Mobile — аниме в кармане', 'AniTier Phone — без сервера')
$html = $html.Replace(
  'Мобильная версия · Данные:',
  'Автономная версия для телефона · Данные:'
)
$html = $html.Replace(
  '<meta name="description" content="Мобильная версия AniTier:',
  '<meta name="description" content="Автономная версия AniTier для телефона:'
)

$out = Join-Path $root 'AniTier-phone.html'
[System.IO.File]::WriteAllText($out, $html, $utf8)

$size = [Math]::Round((Get-Item $out).Length / 1KB, 1)
Write-Host "Готово: $out ($size КБ)" -ForegroundColor Green
Write-Host 'Скопируйте этот файл на телефон и откройте в Chrome. Сервер не нужен.'
