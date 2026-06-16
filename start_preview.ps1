$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "----------------------------------------------------" -ForegroundColor Green
    Write-Host "Local Preview Server is running at http://localhost:$port/" -ForegroundColor Green
    Write-Host "To stop the server, simply close this window." -ForegroundColor Yellow
    Write-Host "----------------------------------------------------" -ForegroundColor Green

    # Open the browser automatically to the index page
    Start-Process "http://localhost:$port/index.html"

    $currentDir = Get-Location

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $rawPath = $request.Url.LocalPath
        if ($rawPath -eq "/") {
            $rawPath = "/index.html"
        }
        
        # Build path to local file and replace URL forward slashes with Windows backslashes
        $localPath = Join-Path $currentDir $rawPath.Replace('/', '\')
        
        if (Test-Path $localPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            
            # Determine MIME type
            $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
            $mime = "application/octet-stream"
            if ($ext -eq ".html") { $mime = "text/html; charset=utf-8" }
            elseif ($ext -eq ".css") { $mime = "text/css; charset=utf-8" }
            elseif ($ext -eq ".js") { $mime = "application/javascript; charset=utf-8" }
            elseif ($ext -eq ".json") { $mime = "application/json; charset=utf-8" }
            elseif ($ext -eq ".jpg" -or $ext -eq ".jpeg") { $mime = "image/jpeg" }
            elseif ($ext -eq ".png") { $mime = "image/png" }
            elseif ($ext -eq ".svg") { $mime = "image/svg+xml" }
            
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            Write-Host "404 - Not Found: $rawPath" -ForegroundColor Red
        }
        $response.Close()
    }
} catch {
    Write-Host "Failed to start listener: $_" -ForegroundColor Red
} finally {
    $listener.Stop()
}
