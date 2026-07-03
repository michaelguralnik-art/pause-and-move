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

    $currentDir = (Get-Location).Path

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
        
        # Handle HTTP POST for saving files (specifically blog.json or templates)
        if ($request.HttpMethod -eq "POST") {
            if ($localPath.StartsWith($currentDir)) {
                try {
                    $encoding = if ($request.ContentEncoding) { $request.ContentEncoding } else { [System.Text.Encoding]::UTF8 }
                    $reader = New-Object System.IO.StreamReader($request.InputStream, $encoding)
                    $postBody = $reader.ReadToEnd()
                    $reader.Close()
                    
                    [System.IO.File]::WriteAllText($localPath, $postBody, $encoding)
                    
                    $response.StatusCode = 200
                    $response.ContentType = "text/plain; charset=utf-8"
                    $response.Headers.Add("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
                    $response.Headers.Add("Pragma", "no-cache")
                    $response.Headers.Add("Expires", "0")
                    
                    $resBytes = [System.Text.Encoding]::UTF8.GetBytes("Saved successfully")
                    $response.ContentLength64 = $resBytes.Length
                    $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                    Write-Host "POST 200 - Saved: $rawPath" -ForegroundColor Green
                } catch {
                    $response.StatusCode = 500
                    $resBytes = [System.Text.Encoding]::UTF8.GetBytes("Error saving file: $_")
                    $response.ContentLength64 = $resBytes.Length
                    $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                    Write-Host "500 - Error saving: $rawPath - $_" -ForegroundColor Red
                }
            } else {
                $response.StatusCode = 403
                Write-Host "403 - Forbidden: $rawPath" -ForegroundColor Red
            }
            $response.Close()
            continue
        }
        
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
            elseif ($ext -eq ".webp") { $mime = "image/webp" }
            elseif ($ext -eq ".gif") { $mime = "image/gif" }
            elseif ($ext -eq ".avif") { $mime = "image/avif" }
            elseif ($ext -eq ".svg") { $mime = "image/svg+xml" }
            elseif ($ext -eq ".ico") { $mime = "image/x-icon" }
            elseif ($ext -eq ".woff") { $mime = "font/woff" }
            elseif ($ext -eq ".woff2") { $mime = "font/woff2" }
            elseif ($ext -eq ".ttf") { $mime = "font/ttf" }
            
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.Headers.Add("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            $response.Headers.Add("Pragma", "no-cache")
            $response.Headers.Add("Expires", "0")
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
