# Проверка живого контракта AniList для франшизы.
# Мок-тесты ловят логику, но не форму ответа API; этот скрипт идёт в настоящий
# AniList и проверяет поля, на которые опирается карточка сезонов.
#
# Запуск: powershell -ExecutionPolicy Bypass -File .\smoke-api.ps1
# Нужен интернет; ключи не требуются.

param(
  [int]$AniListId = 21,
  [int]$TimeoutSec = 20
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$endpoint = 'https://graphql.anilist.co'

function Read-ApiQuery([string]$name) {
  $text = [IO.File]::ReadAllText((Join-Path $root 'app-api.js'), [Text.Encoding]::UTF8)
  $marker = 'const ' + $name + ' = `'
  $start = $text.IndexOf($marker)
  if ($start -lt 0) { throw "В app-api.js не найдена константа $name." }
  $from = $start + $marker.Length
  $to = $text.IndexOf('`;', $from)
  if ($to -lt 0) { throw "Не найден конец запроса $name." }
  return $text.Substring($from, $to - $from)
}

function Invoke-AniList([string]$query, [hashtable]$variables) {
  $json = @{ query = $query; variables = $variables } | ConvertTo-Json -Depth 12 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  return Invoke-RestMethod -Uri $endpoint -Method Post -ContentType 'application/json' `
    -Body $bytes -TimeoutSec $TimeoutSec
}

$failures = @()
function Check([bool]$condition, [string]$message) {
  if ($condition) {
    Write-Host "  OK  $message" -ForegroundColor Green
  } else {
    $script:failures += $message
    Write-Host "  FAIL $message" -ForegroundColor Red
  }
}

Write-Host "AniList: проверяем форму ответа франшизы (id=$AniListId)…" -ForegroundColor Cyan
$query = Read-ApiQuery 'ANILIST_FRANCHISE_QUERY'
$response = Invoke-AniList $query @{ id = $AniListId }

if ($response.errors) {
  Write-Host ('  FAIL GraphQL вернул ошибки: ' + ($response.errors | ConvertTo-Json -Compress)) -ForegroundColor Red
  exit 1
}

$media = $response.data.Page.media
Check ($media.Count -eq 1) 'Page.media содержит ровно один тайтл'

$item = $media[0]
Check ([bool]$item.id) 'У тайтла есть id'
Check ([bool]($item.title.romaji -or $item.title.english -or $item.title.native)) 'У тайтла есть хотя бы одно название'
Check ($null -ne $item.relations) 'Поле relations присутствует'
Check ($null -ne $item.relations.edges) 'relations.edges — массив'

$edges = @($item.relations.edges)
Check ($edges.Count -gt 0) 'У проверочного тайтла есть связанные части'

if ($edges.Count -gt 0) {
  $edge = $edges[0]
  Check ([bool]$edge.relationType) 'У связи есть relationType'
  Check ([bool]$edge.node.id) 'У связанной части есть id'
  Check ([bool]($edge.node.title.romaji -or $edge.node.title.english -or $edge.node.title.native)) 'У связанной части есть название'
  Check ($null -ne $edge.node.coverImage) 'У связанной части есть обложка'
  Check ($null -ne $edge.node.startDate) 'У связанной части есть дата выхода'
  $foreign = @($edges | Where-Object { $_.node.id -ne $item.id })
  Check ($foreign.Count -gt 0) 'Среди связей есть другие тайтлы'
}

# Известная особенность AniList: idMal = null вместе с id считается фильтром
# «без MAL ID» и даёт пустую страницу. Если поведение изменится, скрипт
# подскажет, что комментарий в app-api.js устарел.
Write-Host 'AniList: проверяем особенность idMal = null…' -ForegroundColor Cyan
$edgeCase = Invoke-AniList $query @{ id = $AniListId; idMal = $null }
if ($edgeCase.data.Page.media.Count -eq 0) {
  Write-Host '  OK  idMal = null вместе с id по-прежнему даёт пустую страницу' -ForegroundColor Green
} else {
  Write-Host '  ВНИМАНИЕ: idMal = null больше не ломает запрос — обновите комментарий в fetchAnimeRelations.' -ForegroundColor Yellow
}

if ($failures.Count -gt 0) {
  Write-Host ("ПРОВЕРКА НЕ ПРОЙДЕНА: " + $failures.Count) -ForegroundColor Red
  exit 1
}
Write-Host 'Контракт AniList в порядке.' -ForegroundColor Green
