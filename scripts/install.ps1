$ErrorActionPreference = "Stop"

$Repo = "getmatterapp/matter-cli"
$InstallDir = "$env:USERPROFILE\.config\matter\bin"
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

# Check PATH
$CurrentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($CurrentPath -notlike "*$InstallDir*") {
    Write-Host ""
    Write-Host "$InstallDir is not in your PATH."
    Write-Host "Add it by running:"
    Write-Host "  [Environment]::SetEnvironmentVariable('Path', '$InstallDir;' + [Environment]::GetEnvironmentVariable('Path', 'User'), 'User')"
}

Write-Host ""
Write-Host "Run 'matter --help' to get started."
Write-Host "Run 'matter login' to authenticate."
