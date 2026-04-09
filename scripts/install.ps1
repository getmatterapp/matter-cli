$ErrorActionPreference = "Stop"

$Repo = "getmatterapp/matter-cli"
$InstallDir = "$env:USERPROFILE\.matter\bin"
$BinaryName = "matter.exe"
$Binary = "matter-windows-x64.exe"

Write-Host "Detected platform: windows-x64"

# Get latest release
Write-Host "Fetching latest release..."
$LatestUrl = "https://api.github.com/repos/$Repo/releases/latest"
$Release = Invoke-RestMethod -Uri $LatestUrl
$Asset = $Release.assets | Where-Object { $_.name -eq $Binary }

if (-not $Asset) {
    Write-Error "Could not find binary: $Binary"
    exit 1
}

$DownloadUrl = $Asset.browser_download_url

# Download
Write-Host "Downloading $Binary..."
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Invoke-WebRequest -Uri $DownloadUrl -OutFile "$InstallDir\$BinaryName"

Write-Host "Installed to $InstallDir\$BinaryName"

# Add to PATH if needed
$CurrentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($CurrentPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$InstallDir;$CurrentPath", "User")
    $env:Path = "$InstallDir;$env:Path"
    Write-Host "Added $InstallDir to your PATH."
}

Write-Host ""
Write-Host "Run 'matter --help' to get started."
Write-Host "Run 'matter login' to authenticate."
