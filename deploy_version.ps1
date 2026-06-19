# deploy_version.ps1 - Automate version tagging, changelog updating, and deployment

$git = "C:\Users\Michael Guralnik\.gemini\antigravity\mingit\cmd\git.exe"
$changelogPath = "CHANGELOG.md"

Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host "Pause & Move Release & Deployment Automator" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan

# 1. Check Git Status
Write-Host "Checking git status..." -ForegroundColor Gray
$status = & $git status --porcelain
if (-not $status) {
    Write-Host "No changes detected in working directory. Make sure you have synced copy or code changes first." -ForegroundColor Yellow
} else {
    Write-Host "Pending changes to commit:" -ForegroundColor Yellow
    Write-Host $status
}

# 2. Get Last Tag
$tags = & $git tag
if ($tags) {
    # Sort tags numerically by parsing major.minor
    $lastTag = $tags | ForEach-Object {
        if ($_ -match '^v(\d+)\.(\d+)$') {
            [PSCustomObject]@{
                Tag = $_
                Major = [int]$Matches[1]
                Minor = [int]$Matches[2]
            }
        }
    } | Sort-Object Major, Minor -Descending | Select-Object -First 1
    
    $suggestedNext = "$($lastTag.Major).$($lastTag.Minor + 1)"
    Write-Host "Last release version: $($lastTag.Tag)" -ForegroundColor Green
    Write-Host "Suggested next version: $suggestedNext" -ForegroundColor Green
} else {
    $suggestedNext = "1.0"
    Write-Host "No previous release tags found. Starting at 1.0." -ForegroundColor Green
}

Write-Host ""

# 3. Prompt for Next Version
$version = Read-Host "Enter the next version number (e.g. 1.1, 2.0) [Default: $suggestedNext]"
if (-not $version) {
    $version = $suggestedNext
}

# Clean input (remove leading 'v' if user typed it)
if ($version.StartsWith("v")) {
    $version = $version.Substring(1)
}

if ($version -notmatch '^\d+\.\d+$') {
    Write-Host "Error: Version must be in format Major.Minor (e.g. 1.1)" -ForegroundColor Red
    Exit 1
}

# 4. Check Major Release Authorization
if ($tags) {
    $versionParts = $version.Split('.')
    $newMajor = [int]$versionParts[0]
    $oldMajor = $lastTag.Major
    
    if ($newMajor -gt $oldMajor) {
        Write-Host "WARNING: You are about to increment the major version from $oldMajor.x to $newMajor.x." -ForegroundColor Yellow
        $confirm = Read-Host "Are you sure you want to release this major version? (y/N)"
        if ($confirm -ne "y" -and $confirm -ne "yes") {
            Write-Host "Release cancelled." -ForegroundColor Red
            Exit 1
        }
    }
}

# 5. Prompt for Release Comments
$comments = Read-Host "Enter human-readable comments/notes for this release"
if (-not $comments) {
    $comments = "General website copy and code updates."
}

Write-Host ""
Write-Host "Preparing release v$version..." -ForegroundColor Cyan

# 6. Update CHANGELOG.md
if (Test-Path $changelogPath) {
    Write-Host "Updating CHANGELOG.md..." -ForegroundColor Gray
    $content = [System.IO.File]::ReadAllText($changelogPath, [System.Text.Encoding]::UTF8)
    $dateString = Get-Date -Format "yyyy-MM-dd"
    
    $newEntry = "## [$version] - $dateString`r`n### Developer & Copy Updates`r`n- Synchronized latest copy modifications and codebase enhancements.`r`n`r`n### Reviewer Comments / Notes`r`n- $comments"
    
    $divider = "This log documents all stable versions of the website. `r`n`r`n---"
    $dividerAlt = "This log documents all stable versions of the website. `r`n`r`n---"
    
    # Try with both CRLF and LF dividers
    if ($content.Contains("This log documents all stable versions of the website. `r`n`r`n---")) {
        $content = $content.Replace("This log documents all stable versions of the website. `r`n`r`n---", "This log documents all stable versions of the website. `r`n`r`n---`r`n`r`n$newEntry`r`n`r`n")
    } elseif ($content.Contains("This log documents all stable versions of the website. `n`n---")) {
        $content = $content.Replace("This log documents all stable versions of the website. `n`n---", "This log documents all stable versions of the website. `n`n---`n`n" + $newEntry.Replace("`r`n", "`n") + "`n`n")
    } else {
        # General match or append
        $content = $content + "`r`n`r`n" + $newEntry
    }
    
    $utf8NoBOM = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($changelogPath, $content, $utf8NoBOM)
}

# 7. Commit & Tag
try {
    Write-Host "Staging changes..." -ForegroundColor Gray
    & $git add content.json CHANGELOG.md index.html config.json index.js index.css blog.json translations_template.csv
    
    Write-Host "Committing release v$version..." -ForegroundColor Gray
    $commitMsg = "Release v${version}: $comments"
    & $git commit -m $commitMsg
    
    Write-Host "Creating tag v$version..." -ForegroundColor Gray
    & $git tag -a "v$version" -m "Release v$version"
    
    Write-Host "Pushing changes and tag to GitHub..." -ForegroundColor Cyan
    & $git push origin main --tags
    
    Write-Host "--------------------------------------------------------" -ForegroundColor Green
    Write-Host "SUCCESS: Version v$version has been deployed and pushed!" -ForegroundColor Green
    Write-Host "--------------------------------------------------------" -ForegroundColor Green
} catch {
    Write-Host "Error: Git operations failed." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Exit 1
}
