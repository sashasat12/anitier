# Простой статический сервер для AniTier (без Python/Node).
# Запуск:  powershell -ExecutionPolicy Bypass -File .\serve.ps1
# Затем откройте http://127.0.0.1:8080

param(
  [int]$Port = 8080,
  [switch]$NoOpen,
  [switch]$Lan,
  [switch]$Mobile
)

$root = (Split-Path -Parent $MyInvocation.MyCommand.Path).TrimEnd([char[]]@([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar))
$rootPrefix = $root + [System.IO.Path]::DirectorySeparatorChar
$bindAddress = if ($Lan) { [System.Net.IPAddress]::Any } else { [System.Net.IPAddress]::Loopback }
$listener = [System.Net.Sockets.TcpListener]::new($bindAddress, $Port)
try {
  $listener.Start()
} catch {
  Write-Host "Не удалось запустить сервер на порту $Port. Возможно, он уже занят." -ForegroundColor Red
  exit 1
}

$pagePath = if ($Mobile) { '/mobile/' } else { '/' }
$localUrl = "http://127.0.0.1:$Port$pagePath"

Write-Host "AniTier: $localUrl" -ForegroundColor Green
Write-Host "Папка: $root"

if ($Lan) {
  $addresses = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
    Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and -not [System.Net.IPAddress]::IsLoopback($_) } |
    ForEach-Object { $_.IPAddressToString } |
    Select-Object -Unique

  if ($addresses) {
    Write-Host "Для телефона (та же Wi-Fi сеть):" -ForegroundColor Cyan
    foreach ($address in $addresses) {
      $phonePath = if ($Mobile) { '/mobile/' } else { '/' }
      Write-Host "  http://$address`:$Port$phonePath" -ForegroundColor Cyan
    }
    Write-Host "Если Windows спросит про доступ к сети — разрешите для PowerShell." -ForegroundColor Yellow
  } else {
    Write-Host "Не удалось определить локальный IP. Проверьте подключение к Wi-Fi." -ForegroundColor Yellow
  }
}

Write-Host "Остановка: Ctrl+C"
if (-not $NoOpen) { Start-Process $localUrl }

$mimeMap = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.ico'  = 'image/x-icon'
  '.woff2' = 'font/woff2'
}

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
    $requestLine = $reader.ReadLine()
    if ([string]::IsNullOrWhiteSpace($requestLine)) { $client.Close(); continue }
    while (($line = $reader.ReadLine()) -ne $null -and $line -ne '') { }

    $parts = $requestLine.Split(' ')
    $rawPath = if ($parts.Length -ge 2) { $parts[1] } else { '/' }
    $path = [System.Uri]::UnescapeDataString($rawPath.Split('?')[0])
    if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }

    $relative = $path.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
    $file = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
    if (Test-Path $file -PathType Container) { $file = Join-Path $file 'index.html' }

    if ($file.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path $file -PathType Leaf)) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
      $mime = if ($mimeMap.ContainsKey($ext)) { $mimeMap[$ext] } else { 'application/octet-stream' }
      $status = '200 OK'
    } else {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('404 — файл не найден')
      $mime = 'text/plain; charset=utf-8'
      $status = '404 Not Found'
    }

    $header = "HTTP/1.1 $status`r`nContent-Type: $mime`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
    $client.Close()
  } catch {
    try { $client.Close() } catch { }
  }
}
