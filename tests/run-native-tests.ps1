param([string] $JavaRoot = 'C:\Program Files\Android\Android Studio\jbr')
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$classes = Join-Path $repo 'android\build\native-tests'
New-Item -ItemType Directory -Force -Path $classes | Out-Null
& (Join-Path $JavaRoot 'bin\javac.exe') --release 11 -d $classes `
    (Join-Path $repo 'android\src\com\shaunmcintyre\sol\lightkeeper\UpdateStore.java') `
    (Join-Path $PSScriptRoot 'UpdateStoreTest.java')
if ($LASTEXITCODE -ne 0) { throw 'Native update test compilation failed' }
& (Join-Path $JavaRoot 'bin\java.exe') -cp $classes UpdateStoreTest
if ($LASTEXITCODE -ne 0) { throw 'Native update tests failed' }
