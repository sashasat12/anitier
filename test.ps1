# Запуск браузерных тестов AniTier без Node/npm.
# Требуется Microsoft Edge или Google Chrome.

param([int]$Port = 8099)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$browserCandidates = @(
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
)
$browser = $browserCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $browser) {
  Write-Host 'Не найден Edge/Chrome для запуска браузерных тестов.' -ForegroundColor Red
  exit 1
}

function Get-FreeTcpPort {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $listener.Start()
  try { return ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port }
  finally { $listener.Stop() }
}

$server = Start-Process -FilePath 'powershell.exe' `
  -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $root 'serve.ps1'), '-Port', $Port, '-NoOpen') `
  -PassThru -WindowStyle Hidden

$debugPort = Get-FreeTcpPort
$profileDir = Join-Path $env:TEMP ("anitier-test-profile-" + [Guid]::NewGuid().ToString('N'))
$browserProcess = $null
$ws = $null
$script:cdpId = 0
$script:cdpEvents = New-Object System.Collections.ArrayList

try {
  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/index.html" -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch {
      Start-Sleep -Milliseconds 200
    }
  }
  if (-not $ready) { throw "Не удалось запустить локальный сервер на порту $Port" }

  $browserProcess = Start-Process -FilePath $browser -ArgumentList @(
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    "--user-data-dir=$profileDir",
    "--remote-debugging-port=$debugPort",
    'about:blank'
  ) -PassThru -WindowStyle Hidden

  $target = $null
  for ($i = 0; $i -lt 40; $i++) {
    try {
      $targets = Invoke-RestMethod -Uri "http://127.0.0.1:$debugPort/json/list" -TimeoutSec 2
      $target = $targets | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
      if ($target) { break }
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }
  if (-not $target) { throw 'Не удалось подключиться к отладочному порту браузера' }

  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  [void]$ws.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [System.Threading.CancellationToken]::None).Wait(5000)

  function Invoke-Cdp {
    param(
      [Parameter(Mandatory = $true)][string]$Method,
      [hashtable]$Params = @{}
    )

    $script:cdpId++
    $id = $script:cdpId
    $json = @{ id = $id; method = $Method; params = $Params } | ConvertTo-Json -Compress -Depth 12
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $ws.SendAsync(
      [ArraySegment[byte]]::new($bytes),
      [System.Net.WebSockets.WebSocketMessageType]::Text,
      $true,
      [System.Threading.CancellationToken]::None
    ).Wait()

    while ($true) {
      $stream = New-Object System.IO.MemoryStream
      do {
        $buffer = New-Object byte[] 65536
        $received = $ws.ReceiveAsync(
          [ArraySegment[byte]]::new($buffer),
          [System.Threading.CancellationToken]::None
        ).Result
        $stream.Write($buffer, 0, $received.Count)
      } while (-not $received.EndOfMessage)

      $text = [System.Text.Encoding]::UTF8.GetString($stream.ToArray())
      $message = $text | ConvertFrom-Json

      if ($message.id -eq $id) {
        if ($message.error) { throw "CDP $($message.error.message)" }
        return $message.result
      }
      if ($message.method) { [void]$script:cdpEvents.Add($message) }
    }
  }

  [void](Invoke-Cdp -Method 'Page.enable')
  [void](Invoke-Cdp -Method 'Runtime.enable')
  [void](Invoke-Cdp -Method 'Page.navigate' -Params @{ url = "http://127.0.0.1:$Port/tests/index.html" })

  $expression = @'
JSON.stringify({
  status: document.documentElement.dataset.testStatus || '',
  summary: document.documentElement.dataset.testSummary || '',
  failures: (document.getElementById('test-failures') || {}).textContent || ''
})
'@

  $result = $null
  for ($i = 0; $i -lt 140; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $evaluation = Invoke-Cdp -Method 'Runtime.evaluate' -Params @{
        expression = $expression
        returnByValue = $true
      }
      $raw = $evaluation.result.value
      if ($raw) {
        $state = $raw | ConvertFrom-Json
        if ($state.status -eq 'passed' -or $state.status -eq 'failed') {
          $result = $state
          break
        }
      }
    } catch {
      # Страница ещё загружается или контекст выполнения пересоздаётся.
    }
  }

  if (-not $result) {
    Write-Host 'ТЕСТЫ НЕ ЗАВЕРШИЛИСЬ: таймаут ожидания результата' -ForegroundColor Red
    $logs = $script:cdpEvents |
      Where-Object { $_.method -eq 'Runtime.consoleAPICalled' } |
      ForEach-Object { ($_.params.args | ForEach-Object { $_.value }) -join ' ' }
    if ($logs) { Write-Host ($logs -join "`n") }
    exit 1
  }

  if ($result.status -ne 'passed') {
    Write-Host 'ТЕСТЫ НЕ ПРОЙДЕНЫ' -ForegroundColor Red
    if ($result.failures) { Write-Host $result.failures }
    $logs = $script:cdpEvents |
      Where-Object { $_.method -eq 'Runtime.consoleAPICalled' } |
      ForEach-Object { ($_.params.args | ForEach-Object { $_.value }) -join ' ' }
    if ($logs) { Write-Host "`nConsole:`n$($logs -join "`n")" }
    exit 1
  }

  Write-Host "ТЕСТЫ ПРОЙДЕНЫ: $($result.summary)" -ForegroundColor Green
  exit 0
} finally {
  if ($ws) {
    try { $ws.Dispose() } catch { }
  }
  if ($browserProcess -and -not $browserProcess.HasExited) {
    Stop-Process -Id $browserProcess.Id -Force -ErrorAction SilentlyContinue
  }
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains($profileDir) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Milliseconds 200
  Remove-Item -LiteralPath $profileDir -Recurse -Force -ErrorAction SilentlyContinue
}
