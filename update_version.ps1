# PowerShell script to update npm version and corresponding version in index.ts

# Get current version from package.json
$packageJsonPath = Join-Path $PSScriptRoot "package.json"
$currentVersion = (Get-Content $packageJsonPath | ConvertFrom-Json).version
Write-Host "Current version: $currentVersion"

# Run npm version patch to update package.json and create git tag
npm version patch

# Get the new version from package.json after patch
$newVersion = (Get-Content $packageJsonPath | ConvertFrom-Json).version
Write-Host "New version: $newVersion"

# Read the content of src/index.ts
$indexPath = Join-Path $PSScriptRoot "src\index.ts"
$content = Get-Content $indexPath -Raw

# Replace the version in the content
$updatedContent = $content -replace "\.version\('$currentVersion'\)", ".version('$newVersion')"

# Write the updated content back to src/index.ts
Set-Content -Path $indexPath -Value $updatedContent

Write-Host "Version updated successfully in both package.json and src/index.ts"