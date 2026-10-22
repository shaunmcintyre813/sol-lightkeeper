param(
    [string] $SdkRoot = "$env:USERPROFILE\AppData\Local\Android\Sdk",
    [string] $JavaRoot = 'C:\Program Files\Android\Android Studio\jbr'
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$build = Join-Path $PSScriptRoot 'build'
$tools = Join-Path $SdkRoot 'build-tools\36.0.0'
$platform = Join-Path $SdkRoot 'platforms\android-37.0\android.jar'
$java = Join-Path $JavaRoot 'bin'
$env:JAVA_HOME = $JavaRoot
$env:PATH = "$java;$env:PATH"
$assets = Join-Path $build 'assets\www'
$res = Join-Path $build 'res\drawable-nodpi'
$classes = Join-Path $build 'classes'
$dex = Join-Path $build 'dex'
$unsigned = Join-Path $build 'unsigned.apk'
$aligned = Join-Path $build 'aligned.apk'
$keystore = Join-Path $repo 'release\sol-lightkeeper.jks'
$passwordFile = Join-Path $repo 'release\keystore-pass.txt'
$output = Join-Path $repo 'dist\downloads\Sol-Lightkeeper-v1.0.1.apk'

function Check-Exit([string] $step) {
    if ($LASTEXITCODE -ne 0) { throw "$step failed with exit code $LASTEXITCODE" }
}

foreach ($path in @($assets, $res, $classes, $dex, (Split-Path $keystore), (Split-Path $output))) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
}
Get-ChildItem (Join-Path $repo 'dist') -File | Copy-Item -Destination $assets -Force
New-Item -ItemType Directory -Force -Path (Join-Path $assets 'icons') | Out-Null
Copy-Item (Join-Path $repo 'dist\icons\*') (Join-Path $assets 'icons') -Force
Copy-Item (Join-Path $repo 'dist\icons\icon-192.png') (Join-Path $res 'icon.png') -Force

& (Join-Path $java 'javac.exe') -source 8 -target 8 -classpath $platform -d $classes `
    (Join-Path $PSScriptRoot 'src\com\shaunmcintyre\sol\lightkeeper\MainActivity.java')
Check-Exit 'Java compilation'

& (Join-Path $tools 'aapt.exe') package -f -M (Join-Path $PSScriptRoot 'AndroidManifest.xml') `
    -S (Join-Path $build 'res') -A (Join-Path $build 'assets') -I $platform -F $unsigned
Check-Exit 'Android resource packaging'

$classFiles = @(Get-ChildItem $classes -Recurse -Filter '*.class' | ForEach-Object FullName)
& (Join-Path $tools 'd8.bat') --lib $platform --output $dex $classFiles
Check-Exit 'DEX compilation'

Push-Location $dex
try {
    & (Join-Path $tools 'aapt.exe') add $unsigned 'classes.dex'
    Check-Exit 'DEX packaging'
} finally { Pop-Location }

& (Join-Path $tools 'zipalign.exe') -f 4 $unsigned $aligned
Check-Exit 'APK alignment'

if (!(Test-Path $keystore)) {
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $passwordBytes = New-Object byte[] 32
    $random.GetBytes($passwordBytes)
    $random.Dispose()
    $password = [Convert]::ToBase64String($passwordBytes)
    Set-Content -Path $passwordFile -Value $password -Encoding Ascii
    & (Join-Path $java 'keytool.exe') -genkeypair -keystore $keystore -storetype PKCS12 `
        -alias sol-lightkeeper -keyalg RSA -keysize 3072 -validity 10000 `
        -dname 'CN=Sol Lightkeeper, OU=Personal, O=Shaun McIntyre, C=US' `
        -storepass $password -keypass $password -noprompt
    Check-Exit 'Signing key generation'
}
if (!(Test-Path $passwordFile)) { throw 'Signing key password file is missing.' }
$password = (Get-Content -Raw -Path $passwordFile).Trim()
Set-Content -Path $passwordFile -Value $password -Encoding Ascii

& (Join-Path $tools 'apksigner.bat') sign --ks $keystore --ks-type PKCS12 `
    --ks-key-alias sol-lightkeeper --ks-pass "file:$passwordFile" `
    --v4-signing-enabled false --out $output $aligned
Check-Exit 'APK signing'
& (Join-Path $tools 'apksigner.bat') verify --verbose $output
Check-Exit 'APK signature verification'
$sha256 = (Get-FileHash -Algorithm SHA256 -Path $output).Hash.ToLowerInvariant()
Set-Content -Path "$output.sha256" -Value "$sha256  Sol-Lightkeeper-v1.0.1.apk" -Encoding Ascii
& (Join-Path $tools 'aapt.exe') dump badging $output | Select-Object -First 5
Write-Output "Built $output"
