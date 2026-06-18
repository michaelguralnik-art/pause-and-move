param(
    [string]$CsvPath = ""
)

$configFile = "config.json"
$targetFile = "content.json"
$csv = $null

if ($CsvPath -and (Test-Path $CsvPath)) {
    Write-Host "Reading translations from local file: $CsvPath" -ForegroundColor Cyan
    try {
        $csvText = [System.IO.File]::ReadAllText((Resolve-Path $CsvPath), [System.Text.Encoding]::UTF8)
        $csv = ConvertFrom-Csv $csvText
    } catch {
        Write-Host "Error: Failed to read or parse local CSV file: $CsvPath" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Exit 1
    }
} else {
    if (-not (Test-Path $configFile)) {
        Write-Host "Error: config.json not found." -ForegroundColor Red
        Exit 1
    }

    $config = Get-Content $configFile -Raw | ConvertFrom-Json
    $url = $config.googleSheetCsvUrl

    if (-not $url) {
        if (Test-Path "translations_template.csv") {
            Write-Host "No Google Sheet URL configured. Falling back to local translations_template.csv..." -ForegroundColor Yellow
            try {
                $csvText = [System.IO.File]::ReadAllText((Resolve-Path "translations_template.csv"), [System.Text.Encoding]::UTF8)
                $csv = ConvertFrom-Csv $csvText
            } catch {
                Write-Host "Error: Failed to read or parse local translations_template.csv" -ForegroundColor Red
                Write-Host $_.Exception.Message -ForegroundColor Red
                Exit 1
            }
        } else {
            Write-Host "--------------------------------------------------------" -ForegroundColor Yellow
            Write-Host "Google Sheet CSV URL is not configured yet." -ForegroundColor Yellow
            Write-Host "Please do the following:" -ForegroundColor Green
            Write-Host "1. Open your Google Sheet with the translations." -ForegroundColor White
            Write-Host "2. Go to File > Share > Publish to web." -ForegroundColor White
            Write-Host "3. Select 'Entire Document' (or your sheet tab) and change 'Web page' to 'Comma-separated values (.csv)'." -ForegroundColor White
            Write-Host "4. Click Publish and copy the generated URL." -ForegroundColor White
            Write-Host "5. Paste that URL inside the 'googleSheetCsvUrl' field in config.json." -ForegroundColor White
            Write-Host "--------------------------------------------------------" -ForegroundColor Yellow
            Exit 1
        }
    } else {
        Write-Host "Fetching latest translations from Google Sheet..." -ForegroundColor Cyan
        try {
            $client = New-Object System.Net.WebClient
            $client.Encoding = [System.Text.Encoding]::UTF8
            $csvText = $client.DownloadString($url)
            $csv = ConvertFrom-Csv $csvText
        } catch {
            if (Test-Path "translations_template.csv") {
                Write-Host "Failed to fetch from Google Sheet. Falling back to local translations_template.csv..." -ForegroundColor Yellow
                try {
                    $csvText = [System.IO.File]::ReadAllText((Resolve-Path "translations_template.csv"), [System.Text.Encoding]::UTF8)
                    $csv = ConvertFrom-Csv $csvText
                } catch {
                    Write-Host "Error: Failed to read or parse local translations_template.csv" -ForegroundColor Red
                    Write-Host $_.Exception.Message -ForegroundColor Red
                    Exit 1
                }
            } else {
                Write-Host "Error: Failed to fetch or parse CSV from Google Sheet." -ForegroundColor Red
                Write-Host $_.Exception.Message -ForegroundColor Red
                Exit 1
            }
        }
    }
}

# Function to recursively set values in nested hashtables and arraylists
function Set-NestedValue {
    param(
        [hashtable]$Hash,
        [string]$Path,
        $Value
    )
    $parts = $Path.Split('.')
    $current = $Hash
    for ($i = 0; $i -lt $parts.Length - 1; $i++) {
        $part = $parts[$i]
        $nextPart = $parts[$i+1]
        $nextIndex = 0
        $partIndex = 0
        $nextIsInt = [int]::TryParse($nextPart, [ref]$nextIndex)
        $partIsInt = [int]::TryParse($part, [ref]$partIndex)
        
        if ($partIsInt) {
            while ($current.Count -le $partIndex) {
                $null = $current.Add($null)
            }
            if ($current[$partIndex] -eq $null) {
                if ($nextIsInt) {
                    $current[$partIndex] = New-Object System.Collections.ArrayList
                } else {
                    $current[$partIndex] = @{}
                }
            }
            $current = $current[$partIndex]
        } else {
            if (-not $current.ContainsKey($part)) {
                if ($nextIsInt) {
                    $current[$part] = New-Object System.Collections.ArrayList
                } else {
                    $current[$part] = @{}
                }
            }
            $current = $current[$part]
        }
    }
    
    $lastPart = $parts[-1]
    $lastIndex = 0
    $lastIsInt = [int]::TryParse($lastPart, [ref]$lastIndex)
    if ($lastIsInt) {
        while ($current.Count -le $lastIndex) {
            $null = $current.Add($null)
        }
        $current[$lastIndex] = $Value
    } else {
        $current[$lastPart] = $Value
    }
}

# Construct the nested translation dictionary
$translations = @{
    en = @{}
    de = @{}
}

foreach ($row in $csv) {
    if (-not $row.Key) { continue }
    
    # Clean cell values (remove carriage returns, ensure correct quotes)
    $key = $row.Key.Trim()
    $enText = if ($row.English) { $row.English.Trim() } else { "" }
    $deText = if ($row.German) { $row.German.Trim() } else { "" }
    
    Set-NestedValue -Hash $translations -Path "en.$key" -Value $enText
    Set-NestedValue -Hash $translations -Path "de.$key" -Value $deText
}

# Convert hashtable to JSON
$json = ConvertTo-Json $translations -Depth 100

# Write content.json using UTF-8 (No BOM)
$utf8NoBOM = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($targetFile, $json, $utf8NoBOM)

Write-Host "Success: Translations synchronized and written to content.json." -ForegroundColor Green
