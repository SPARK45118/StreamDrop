param (
    [string]$OutputDir = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'
$extensionDir = Join-Path (Get-Location).Path 'extension'
$zipPath = Join-Path $OutputDir 'streamdrop-chrome-extension-v1.0.0.zip'

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)

$files = Get-ChildItem -Path $extensionDir -Recurse -File
foreach ($file in $files) {
    $relative = $file.FullName.Substring($extensionDir.Length).TrimStart('\', '/').Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $relative) | Out-Null
    Write-Host "Added: $relative"
}

$zip.Dispose()

$zipInfo = Get-Item $zipPath
Write-Host "`nSuccessfully packaged extension for Chrome Web Store:"
Write-Host "Archive: $($zipInfo.FullName)"
Write-Host "Size: $([math]::Round($zipInfo.Length / 1024, 2)) KB"
