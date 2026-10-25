# Снимки графа знаний по версиям и отчёт об изменениях между ними.
# Граф строится локально из AST, без API-ключей и без LLM-разметки сообществ.
#
# Примеры:
#   powershell -ExecutionPolicy Bypass -File .\graph-versions.ps1
#       пересобрать граф текущей версии и сохранить снимок
#   powershell -ExecutionPolicy Bypass -File .\graph-versions.ps1 -Tag v1.8.1
#       собрать снимок из git-тега в отдельном worktree
#   powershell -ExecutionPolicy Bypass -File .\graph-versions.ps1 -Diff v1.8.1 v1.9.0
#       отчёт об изменениях между снимками
#
# Снимки лежат в graphify-out\versions\<версия>\ (graph.json, graph.html, GRAPH_REPORT.md)
# и в git не попадают. Отчёт: graphify-out\versions\CHANGES-<от>-<до>.md

param(
  [string]$Tag = '',
  [string[]]$Diff = @()
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$versionsDir = Join-Path $root 'graphify-out\versions'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Invoke-Git([string]$git, [string[]]$arguments) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'SilentlyContinue'
  try {
    & $git @arguments 2>$null | Out-Null
    return $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
}

function Get-Graphify {
  $cmd = Get-Command graphify -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $local = Join-Path $env:USERPROFILE '.local\bin\graphify.exe'
  if (Test-Path $local) { return $local }
  throw 'Не найден graphify. Установите его и повторите.'
}

function Get-Git {
  $cmd = Get-Command git -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($path in @('C:\Program Files\Git\cmd\git.exe', "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe")) {
    if (Test-Path $path) { return $path }
  }
  throw 'Не найден git.'
}

function Get-AppVersion {
  $text = [IO.File]::ReadAllText((Join-Path $root 'core.js'), [Text.Encoding]::UTF8)
  $match = [regex]::Match($text, "APP_VERSION\s*=\s*'([0-9.]+)'")
  if ($match.Success) { return $match.Groups[1].Value }
  return 'unknown'
}

function Invoke-Graphify([string]$dir, [string[]]$arguments) {
  $graphify = Get-Graphify
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'SilentlyContinue'
  Push-Location $dir
  try {
    $output = & $graphify @arguments 2>&1
    $code = $LASTEXITCODE
  } finally {
    Pop-Location
    $ErrorActionPreference = $previous
  }
  if ($code -ne 0) { $output | ForEach-Object { Write-Host $_ } }
  return $code
}

function Invoke-GraphBuild([string]$dir) {
  $code = Invoke-Graphify $dir @('extract', '.', '--code-only', '--no-cluster')
  if ($code -ne 0) { throw "extract завершился с кодом $code" }
  $code = Invoke-Graphify $dir @('cluster-only', '.', '--no-label')
  if ($code -ne 0) { throw "cluster-only завершился с кодом $code" }
}

function Save-Snapshot([string]$source, [string]$label) {
  $target = Join-Path $versionsDir $label
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  foreach ($name in @('graph.json', 'graph.html', 'GRAPH_REPORT.md')) {
    $from = Join-Path (Join-Path $source 'graphify-out') $name
    if (Test-Path $from) { Copy-Item $from (Join-Path $target $name) -Force }
  }
  Write-Host "Снимок: $target" -ForegroundColor Green
}

function Build-Current {
  $label = "v$(Get-AppVersion)"
  Write-Host "Пересобираю граф текущей версии ($label)..." -ForegroundColor Cyan
  Invoke-GraphBuild $root
  Save-Snapshot $root $label
  return $label
}

function Build-Tag([string]$tag) {
  $git = Get-Git
  $work = Join-Path $env:TEMP ("anitier-graph-" + ($tag -replace '[^\w.-]', '_'))
  if (Test-Path $work) { Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue }
  Write-Host "Готовлю worktree для $tag..." -ForegroundColor Cyan
  Invoke-Git $git @('worktree', 'prune') | Out-Null
  $code = Invoke-Git $git @('worktree', 'add', '--detach', '--force', $work, $tag)
  if ($code -ne 0) { throw "Не удалось создать worktree для $tag" }
  try {
    Invoke-GraphBuild $work
    Save-Snapshot $work $tag
  } finally {
    Invoke-Git $git @('worktree', 'remove', '--force', $work) | Out-Null
  }
  return $tag
}

function Get-Graph([string]$label) {
  $path = Join-Path (Join-Path $versionsDir $label) 'graph.json'
  if (-not (Test-Path $path)) {
    throw "Нет снимка $label. Соберите его: .\graph-versions.ps1 -Tag $label"
  }
  return (Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function New-Diff([string]$from, [string]$to) {
  $a = Get-Graph $from
  $b = Get-Graph $to

  $aNodes = @{}
  foreach ($node in $a.nodes) { $aNodes[$node.id] = $node }
  $bNodes = @{}
  foreach ($node in $b.nodes) { $bNodes[$node.id] = $node }

  $added = @($b.nodes | Where-Object { -not $aNodes.ContainsKey($_.id) })
  $removed = @($a.nodes | Where-Object { -not $bNodes.ContainsKey($_.id) })

  $aLinks = New-Object System.Collections.Generic.HashSet[string]
  foreach ($link in $a.links) { [void]$aLinks.Add("$($link.source)|$($link.relation)|$($link.target)") }
  $bLinks = New-Object System.Collections.Generic.HashSet[string]
  foreach ($link in $b.links) { [void]$bLinks.Add("$($link.source)|$($link.relation)|$($link.target)") }

  $newLinks = @($b.links | Where-Object { -not $aLinks.Contains("$($_.source)|$($_.relation)|$($_.target)") })
  $goneLinks = @($a.links | Where-Object { -not $bLinks.Contains("$($_.source)|$($_.relation)|$($_.target)") })

  $aCommunities = @($a.nodes | Where-Object { $_.community -ne $null } | Select-Object -ExpandProperty community -Unique)
  $bCommunities = @($b.nodes | Where-Object { $_.community -ne $null } | Select-Object -ExpandProperty community -Unique)

  $movedFiles = @($b.nodes | Where-Object {
      $aNodes.ContainsKey($_.id) -and $aNodes[$_.id].source_file -ne $_.source_file
    })

  function Format-Links($links) {
    if (-not $links.Count) { return '_нет_' }
    $lines = @()
    foreach ($group in ($links | Group-Object relation | Sort-Object Count -Descending)) {
      $lines += "- $($group.Name): $($group.Count)"
    }
    return ($lines -join "`n")
  }

  function Format-Nodes($nodes) {
    if (-not $nodes.Count) { return '_нет_' }
    $lines = @()
    foreach ($node in ($nodes | Sort-Object source_file, label)) {
      $file = if ($node.source_file) { $node.source_file } else { '—' }
      $lines += "- ``$($node.label)`` — ``$file``"
    }
    return ($lines -join "`n")
  }

  $fileNames = @($a.nodes.source_file) + @($b.nodes.source_file) | Where-Object { $_ } | Sort-Object -Unique
  $fileRows = foreach ($file in $fileNames) {
    $before = @($a.nodes | Where-Object { $_.source_file -eq $file }).Count
    $after = @($b.nodes | Where-Object { $_.source_file -eq $file }).Count
    if ($before -ne $after) {
      $delta = if ($after -gt $before) { "+$($after - $before)" } else { "$($after - $before)" }
      "| ``$file`` | $before | $after | $delta |"
    }
  }

  function Delta($before, $after) {
    if ($after -gt $before) { return "+$($after - $before)" }
    return "$($after - $before)"
  }

  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
  $report = @"
# Изменения графа: $from → $to

Собрано: $stamp

| Показатель | $from | $to | Изменение |
|---|---|---|---|
| Узлы | $($a.nodes.Count) | $($b.nodes.Count) | $(Delta $a.nodes.Count $b.nodes.Count) |
| Связи | $($a.links.Count) | $($b.links.Count) | $(Delta $a.links.Count $b.links.Count) |
| Сообщества | $($aCommunities.Count) | $($bCommunities.Count) | $(Delta $aCommunities.Count $bCommunities.Count) |

Сообщества нумеруются заново при каждой сборке, поэтому сравнивается только их количество, а не номера.

## Новые узлы ($($added.Count))

$(Format-Nodes $added)

## Удалённые узлы ($($removed.Count))

$(Format-Nodes $removed)

## Новые связи по типам ($($newLinks.Count))

$(Format-Links $newLinks)

## Удалённые связи по типам ($($goneLinks.Count))

$(Format-Links $goneLinks)

## Сменили файл ($($movedFiles.Count))

$(Format-Nodes $movedFiles)

## Узлы по файлам

| Файл | $from | $to | Изменение |
|---|---|---|---|
$($fileRows -join "`n")

## Как смотреть

- интерактивный граф версии ${to}: ``graphify-out/versions/$to/graph.html``
- интерактивный граф версии ${from}: ``graphify-out/versions/$from/graph.html``
- отчёт Graphify: ``graphify-out/versions/$to/GRAPH_REPORT.md``
"@

  New-Item -ItemType Directory -Force -Path $versionsDir | Out-Null
  $out = Join-Path $versionsDir "CHANGES-$from-$to.md"
  [IO.File]::WriteAllText($out, $report, $utf8)

  Write-Host "Отчёт: $out" -ForegroundColor Green
  Write-Host ("Узлы: {0} → {1} ({2}), связи: {3} → {4} ({5}), сообщества: {6} → {7}" -f `
      $a.nodes.Count, $b.nodes.Count, (Delta $a.nodes.Count $b.nodes.Count), `
      $a.links.Count, $b.links.Count, (Delta $a.links.Count $b.links.Count), `
      $aCommunities.Count, $bCommunities.Count)
  Write-Host ("Новых узлов: {0}, удалённых: {1}, новых связей: {2}" -f $added.Count, $removed.Count, $newLinks.Count)
  return $out
}

$pair = @()
if ($Diff.Count -eq 2) { $pair = $Diff }
elseif ($Diff.Count -eq 1 -and $Tag) { $pair = @($Diff[0], $Tag) }

if ($pair.Count -eq 2) {
  New-Diff $pair[0] $pair[1] | Out-Null
  return
}
if ($Diff.Count -ne 0) {
  throw 'Укажите две версии: -Diff v1.8.1 v1.9.0 (или -Diff v1.8.1,v1.9.0)'
}

if ($Tag) {
  Build-Tag $Tag | Out-Null
} else {
  Build-Current | Out-Null
}
