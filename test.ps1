# Запуск браузерных тестов AniTier без Node/npm.
# Требуется Microsoft Edge или Google Chrome.

param(
  [int]$Port = 8099,
  [switch]$UpdateVisual,
  [switch]$SkipVisual
)

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

  function Wait-Eval {
    param([string]$Expr, [int]$Attempts = 80)
    for ($i = 0; $i -lt $Attempts; $i++) {
      Start-Sleep -Milliseconds 250
      try {
        $r = Invoke-Cdp -Method 'Runtime.evaluate' -Params @{ expression = $Expr; returnByValue = $true; awaitPromise = $true }
        return $r.result.value
      } catch { }
    }
    return $null
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
  for ($i = 0; $i -lt 240; $i++) {
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

  # ---------------- визуальная регрессия (CDP, без доп. зависимостей) ----------------
  # Скриншоты ключевых экранов сравниваются с эталонами в tests/visual/baseline.
  # Нестабильный рендер в headless (шрифты/анимации/тайминги сети) возможен:
  # сценарии ждут init + fonts.ready + паузы; при ложных срабатываниях — уточнить
  # допуск/стабилизацию, не отключать проверку. Первый запуск/обновление: -UpdateVisual.
  # Допуск 24 (сумма RGBA на пиксель) — минимальный запас на AA/растеризацию шрифтов.
  if (-not $SkipVisual) {
    $visualDir = Join-Path $root 'tests\visual\baseline'
    $actualDir = Join-Path $root 'tests\visual\_actual'
    New-Item -ItemType Directory -Force -Path $visualDir | Out-Null
    New-Item -ItemType Directory -Force -Path $actualDir | Out-Null

    $tabClick = "const goTab=(tab)=>{const el=document.querySelector('[data-action=""tab""][data-tab=""'+tab+'""], #tab-'+tab); if(el) el.click(); else if(window.AniTier&&window.AniTier.switchTab) window.AniTier.switchTab(tab);};"
    $stabilizeCss = "try{const s=document.createElement('style');s.id='visual-stable';s.textContent='*,*::before,*::after{animation:none!important;animation-delay:0s!important;animation-duration:0s!important;transition:none!important;transition-delay:0s!important;transition-duration:0s!important;caret-color:transparent!important;scroll-behavior:auto!important}*:focus,*:focus-visible{outline:none!important}*::selection{background:transparent!important;color:inherit!important}*{scrollbar-width:none!important}*::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}.bg-orbs,.bg-orbs *{animation:none!important}';document.head.appendChild(s);if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();try{window.getSelection&&window.getSelection().removeAllRanges()}catch(e){}document.querySelectorAll('*').forEach(el=>{try{if(el.scrollTop)el.scrollTop=0;if(el.scrollLeft)el.scrollLeft=0}catch(e){}});}catch(e){}"
    $waitBase = "(async()=>{try{localStorage.clear()}catch(e){}" + $stabilizeCss + "let g=0;while(!window.__anitierTest&&g++<240)await new Promise(r=>setTimeout(r,50));await window.__anitierTest.init();" + $stabilizeCss + "if(window.AniTier){const rel=(a)=>Promise.resolve((a&&a.relations)||[]);window.AniTier.fetchAnimeRelations=rel;window.AniTier.fetchAllFranchise=(a)=>Promise.resolve(a?[a]:[]);}if(document.fonts&&document.fonts.ready)await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));"
    $settle = "if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();try{window.getSelection&&window.getSelection().removeAllRanges()}catch(e){}document.querySelectorAll('*').forEach(el=>{try{if(el.scrollTop)el.scrollTop=0}catch(e){}});try{await Promise.race([Promise.all(Array.from(document.images||[]).map(img=>img.complete?null:new Promise(r=>{img.addEventListener('load',r,{once:true});img.addEventListener('error',r,{once:true});setTimeout(r,1200)}))),new Promise(r=>setTimeout(r,2000))])}catch(e){}await new Promise(r=>setTimeout(r,600));if(document.fonts&&document.fonts.ready)await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await new Promise(r=>setTimeout(r,120));if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();return 'ok';})()"
    $clearLists = "const st=window.AniTier&&window.AniTier.state;if(st){const e={S:[],A:[],B:[],C:[],D:[],F:[],N:[]};st.lists.watched=JSON.parse(JSON.stringify(e));st.lists.planned=JSON.parse(JSON.stringify(e));if(window.AniTier&&window.AniTier.refreshViews)try{window.AniTier.refreshViews()}catch(e){}}"
    $waitItems = "let w=0;while((!(window.AniTier&&window.AniTier.state&&window.AniTier.state.db&&window.AniTier.state.db.items&&window.AniTier.state.db.items.length))&&w++<240)await new Promise(r=>setTimeout(r,50));"
    $seedWatched = $waitItems + "const st=window.AniTier.state;const items=st.db.items.slice(0,6);const tiers=['S','A','B','C','D','F'];st.lists.watched={S:[],A:[],B:[],C:[],D:[],F:[],N:[]};items.forEach((it,i)=>{st.lists.watched[tiers[i%tiers.length]].push(Object.assign({},it));});if(window.AniTier.refreshViews)try{window.AniTier.refreshViews()}catch(e){}"
    $openCard = $waitItems + "const id=window.AniTier.state.db.items[0].id;if(window.AniTier.openModal)window.AniTier.openModal(id);await new Promise(r=>setTimeout(r,350));"
    $openSettings = "if(window.AniTier.openSettings)window.AniTier.openSettings();else document.querySelector('[data-action=""open-settings""],[data-action=""settings""]')?.click();await new Promise(r=>setTimeout(r,250));"
    $openStats = $seedWatched + "if(window.AniTier.openStats)window.AniTier.openStats();else document.querySelector('[data-action=""open-stats""],[data-action=""stats""]')?.click();await new Promise(r=>setTimeout(r,350));"
    $openExchange = $seedWatched + "if(window.AniTierCore){window.AniTierCore.encodeTierShare=()=> 'ANITIER-TIER-1:VISUAL';}if(window.AniTier.openExchange)window.AniTier.openExchange('export','watched');else document.querySelector('[data-action=""open-exchange""]')?.click();await new Promise(r=>setTimeout(r,350));"

    $scenarios = @(
      @{ name='desktop-db-filled'; url="/index.html?demo=1&test=1"; width=1280; height=900; setup=($waitBase + $tabClick + "goTab('db');" + $settle) },
      @{ name='desktop-watched-empty'; url="/index.html?demo=1&test=1"; width=1280; height=900; setup=($waitBase + $clearLists + $tabClick + "goTab('watched');" + $settle) },
      @{ name='desktop-card'; url="/index.html?demo=1&test=1"; width=1280; height=900; setup=($waitBase + $tabClick + "goTab('db');" + $openCard + $settle) },
      @{ name='desktop-settings'; url="/index.html?demo=1&test=1"; width=1280; height=900; setup=($waitBase + $openSettings + $settle) },
      @{ name='desktop-stats'; url="/index.html?demo=1&test=1"; width=1280; height=900; setup=($waitBase + $openStats + $settle) },
      @{ name='desktop-exchange'; url="/index.html?demo=1&test=1"; width=1280; height=900; setup=($waitBase + $openExchange + $settle) },
      @{ name='mobile-db-filled'; url="/mobile/index.html?demo=1&test=1"; width=390; height=844; setup=($waitBase + $tabClick + "goTab('db');" + $settle) },
      @{ name='mobile-watched-empty'; url="/mobile/index.html?demo=1&test=1"; width=390; height=844; setup=($waitBase + $clearLists + $tabClick + "goTab('watched');" + $settle) },
      @{ name='mobile-card'; url="/mobile/index.html?demo=1&test=1"; width=390; height=844; setup=($waitBase + $tabClick + "goTab('db');" + $openCard + $settle) },
      @{ name='mobile-settings'; url="/mobile/index.html?demo=1&test=1"; width=390; height=844; setup=($waitBase + $openSettings + $settle) },
      @{ name='mobile-stats'; url="/mobile/index.html?demo=1&test=1"; width=390; height=844; setup=($waitBase + $openStats + $settle) },
      @{ name='mobile-exchange'; url="/mobile/index.html?demo=1&test=1"; width=390; height=844; setup=($waitBase + $openExchange + $settle) }
    )

    $visualFailures = @()
    foreach ($sc in $scenarios) {
      [void](Invoke-Cdp -Method 'Emulation.setDeviceMetricsOverride' -Params @{ width = $sc.width; height = $sc.height; deviceScaleFactor = 1; mobile = ($sc.url -like '/mobile/*') })
      [void](Invoke-Cdp -Method 'Page.navigate' -Params @{ url = "http://127.0.0.1:$Port$($sc.url)" })
      Start-Sleep -Milliseconds 800
      [void](Wait-Eval -Expr $sc.setup -Attempts 160)
      Start-Sleep -Milliseconds 350
      $shot = Invoke-Cdp -Method 'Page.captureScreenshot' -Params @{ format = 'png'; fromSurface = $true }
      $actualPath = Join-Path $actualDir "$($sc.name).png"
      [IO.File]::WriteAllBytes($actualPath, [Convert]::FromBase64String($shot.data))
      $basePath = Join-Path $visualDir "$($sc.name).png"

      if ($UpdateVisual) {
        Copy-Item -LiteralPath $actualPath -Destination $basePath -Force
        Write-Host "VISUAL: эталон обновлён — $($sc.name)" -ForegroundColor Cyan
        continue
      }
      if (-not (Test-Path $basePath)) {
        $visualFailures += "VISUAL FAIL: $($sc.name) — нет эталона (запустите .\test.ps1 -UpdateVisual). Актуальный: $actualPath"
        continue
      }

      # Сравнение в браузере через canvas; файлы читаются с локального сервера (без гигантских CDP-выражений).
      [void](Invoke-Cdp -Method 'Page.navigate' -Params @{ url = "http://127.0.0.1:$Port/tests/visual-compare.html" })
      Start-Sleep -Milliseconds 350
      [void](Wait-Eval -Expr "window.visualCompare ? 'ready' : ''" -Attempts 50)
      $cmpExpr = "(async()=>JSON.stringify(await window.visualCompare('visual/baseline/$($sc.name).png','visual/_actual/$($sc.name).png', 24)))()"
      $cmpRaw = Wait-Eval -Expr $cmpExpr -Attempts 160
      $cmp = $null
      if ($cmpRaw) { try { $cmp = $cmpRaw | ConvertFrom-Json } catch { } }
      if (-not $cmp) {
        $visualFailures += "VISUAL FAIL: $($sc.name) — сравнение не вернуло результат (актуальный: $actualPath)"
      } elseif (-not $cmp.ok) {
        $reason = if ($cmp.reason -eq 'size') { "размер $($cmp.actual -join 'x') != $($cmp.expected -join 'x')" } else { "отличающихся пикселей: $($cmp.diffPixels), макс. дельта: $($cmp.maxChannelDelta)" }
        $visualFailures += "VISUAL FAIL: $($sc.name) — $reason (актуальный: $actualPath)"
      } else {
        Write-Host "VISUAL OK: $($sc.name)" -ForegroundColor Green
      }
    }

    [void](Invoke-Cdp -Method 'Emulation.clearDeviceMetricsOverride')

    if ($visualFailures.Count -gt 0) {
      Write-Host 'ВИЗУАЛЬНАЯ РЕГРЕССИЯ' -ForegroundColor Red
      $visualFailures | ForEach-Object { Write-Host $_ -ForegroundColor Red }
      Write-Host 'Обновить эталоны: .\test.ps1 -UpdateVisual' -ForegroundColor Yellow
      exit 1
    }
    Write-Host "VISUAL: $($scenarios.Count) экранов без отличий" -ForegroundColor Green
  }

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
