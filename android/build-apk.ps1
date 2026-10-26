# Собирает Android APK из автономного AniTier-phone.html.
# Требуются JDK 17 и Android SDK build-tools/platform.
# Запуск: powershell -ExecutionPolicy Bypass -File .\android\build-apk.ps1

param(
  [string]$Jdk = "$env:LOCALAPPDATA\AniTierAndroid\jdk",
  [string]$Sdk = "$env:LOCALAPPDATA\AniTierAndroid\sdk",
  [string]$Out = (Join-Path (Split-Path -Parent $PSScriptRoot) 'AniTier.apk')
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$projectRoot = Split-Path -Parent $root
$buildTools = Join-Path $Sdk 'build-tools\34.0.0'
$platformJar = Join-Path $Sdk 'platforms\android-34\android.jar'
$java = Join-Path $Jdk 'bin\java.exe'
$javac = Join-Path $Jdk 'bin\javac.exe'
$jar = Join-Path $Jdk 'bin\jar.exe'
$keytool = Join-Path $Jdk 'bin\keytool.exe'
$aapt2 = Join-Path $buildTools 'aapt2.exe'
$d8 = Join-Path $buildTools 'd8.bat'
$zipalign = Join-Path $buildTools 'zipalign.exe'
$apksigner = Join-Path $buildTools 'apksigner.bat'

foreach ($tool in @($java, $javac, $jar, $keytool, $aapt2, $d8, $zipalign, $apksigner, $platformJar)) {
  if (-not (Test-Path $tool)) { throw "Не найден компонент сборки: $tool" }
}

$phoneFile = Join-Path $projectRoot 'AniTier-phone.html'
if (-not (Test-Path $phoneFile)) { throw 'Нет AniTier-phone.html. Сначала запустите build-phone.ps1' }

$work = Join-Path ([System.IO.Path]::GetTempPath()) ('anitier-apk-' + [Guid]::NewGuid().ToString('N'))
$assets = Join-Path $work 'assets'
$compiled = Join-Path $work 'compiled.zip'
$unsigned = Join-Path $work 'unsigned.apk'
$aligned = Join-Path $work 'aligned.apk'
$classesDir = Join-Path $work 'classes'
$classesJar = Join-Path $work 'classes.jar'
$dexDir = Join-Path $work 'dex'
$genDir = Join-Path $work 'gen'

New-Item -ItemType Directory -Force -Path $work, $assets, $classesDir, $dexDir, $genDir | Out-Null
Copy-Item $phoneFile (Join-Path $assets 'index.html') -Force

$env:JAVA_HOME = $Jdk
$env:Path = (Join-Path $Jdk 'bin') + ';' + $env:Path

try {
  Write-Host '1/6 Компиляция ресурсов...' -ForegroundColor Cyan
  & $aapt2 compile --dir (Join-Path $root 'res') -o $compiled
  if ($LASTEXITCODE -ne 0) { throw 'aapt2 compile завершился с ошибкой' }

  Write-Host '2/6 Сборка ресурсов и assets...' -ForegroundColor Cyan
  & $aapt2 link `
    -o $unsigned `
    -I $platformJar `
    --manifest (Join-Path $root 'AndroidManifest.xml') `
    -A $assets `
    --java $genDir `
    --min-sdk-version 23 `
    --target-sdk-version 34 `
    $compiled
  if ($LASTEXITCODE -ne 0) { throw 'aapt2 link завершился с ошибкой' }

  Write-Host '3/6 Компиляция Java...' -ForegroundColor Cyan
  $sources = Get-ChildItem (Join-Path $root 'src') -Recurse -Filter *.java | ForEach-Object { $_.FullName }
  $generatedR = Get-ChildItem $genDir -Recurse -Filter R.java -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }
  if ($generatedR) { $sources = @($sources) + @($generatedR) }
  & $javac -encoding UTF-8 -source 1.8 -target 1.8 -Xlint:-options -classpath $platformJar -d $classesDir $sources
  if ($LASTEXITCODE -ne 0) { throw 'javac завершился с ошибкой' }

  Write-Host '4/6 Dex и упаковка...' -ForegroundColor Cyan
  & $jar --create --file $classesJar -C $classesDir .
  if ($LASTEXITCODE -ne 0) { throw 'jar завершился с ошибкой' }
  & $d8 --lib $platformJar --min-api 23 --output $dexDir $classesJar
  if ($LASTEXITCODE -ne 0) { throw 'd8 завершился с ошибкой' }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::Open($unsigned, 'Update')
  try {
    $old = $zip.GetEntry('classes.dex')
    if ($old) { $old.Delete() }
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $zip,
      (Join-Path $dexDir 'classes.dex'),
      'classes.dex',
      [System.IO.Compression.CompressionLevel]::Optimal
    )
  } finally {
    $zip.Dispose()
  }

  & $zipalign -f 4 $unsigned $aligned
  if ($LASTEXITCODE -ne 0) { throw 'zipalign завершился с ошибкой' }

  Write-Host '5/6 Подпись...' -ForegroundColor Cyan
  $keystore = Join-Path $root 'anitier.keystore'
  if (-not (Test-Path $keystore)) {
    & $keytool -genkeypair -v `
      -keystore $keystore `
      -storepass anitier `
      -alias anitier `
      -keypass anitier `
      -keyalg RSA `
      -keysize 2048 `
      -validity 10000 `
      -dname 'CN=AniTier, OU=Mobile, O=AniTier, L=Local, C=RU'
    if ($LASTEXITCODE -ne 0) { throw 'keytool завершился с ошибкой' }
  }

  & $apksigner sign `
    --ks $keystore `
    --ks-key-alias anitier `
    --ks-pass pass:anitier `
    --key-pass pass:anitier `
    --out $Out `
    $aligned
  if ($LASTEXITCODE -ne 0) { throw 'apksigner завершился с ошибкой' }

  Write-Host '6/6 Проверка...' -ForegroundColor Cyan
  & $apksigner verify --verbose $Out
  if ($LASTEXITCODE -ne 0) { throw 'Подпись APK не прошла проверку' }

  $size = [Math]::Round((Get-Item $Out).Length / 1MB, 2)
  Write-Host "Готово: $Out ($size МБ)" -ForegroundColor Green
} finally {
  Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}
