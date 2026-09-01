$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$index = Join-Path $root 'index.html'

Write-Host ''
Write-Host 'Guia eXeLearning - servidor local' -ForegroundColor Cyan
Write-Host '=================================' -ForegroundColor Cyan

if (-not (Test-Path $index -PathType Leaf)) {
    Write-Host 'ERROR: No se encontro index.html en esta carpeta.' -ForegroundColor Red
    Write-Host 'Copie ABRIR_GUIA.bat y SERVIDOR_GUIA.ps1 junto al index.html exportado por eXeLearning.' -ForegroundColor Yellow
    exit 1
}

$listener = $null
$port = 8000

while ($port -le 8015) {
    try {
        $listener = [System.Net.Sockets.TcpListener]::new(
            [System.Net.IPAddress]::Loopback,
            $port
        )
        $listener.Start()
        break
    }
    catch {
        if ($listener) {
            try { $listener.Stop() } catch {}
        }
        $listener = $null
        $port++
    }
}

if (-not $listener) {
    Write-Host 'ERROR: No se encontro un puerto libre entre 8000 y 8015.' -ForegroundColor Red
    Write-Host 'Cierre otros prototipos o servidores locales y vuelva a intentarlo.' -ForegroundColor Yellow
    exit 1
}

$url = "http://localhost:$port/"
Write-Host "Servidor iniciado correctamente: $url" -ForegroundColor Green
Write-Host 'Mantenga esta ventana abierta mientras usa la guia.' -ForegroundColor Yellow
Write-Host 'Para detener el servidor, cierre esta ventana o presione Ctrl+C.' -ForegroundColor Yellow
Write-Host ''

$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.mjs'  = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.webp' = 'image/webp'
    '.ico'  = 'image/x-icon'
    '.pdf'  = 'application/pdf'
    '.woff' = 'font/woff'
    '.woff2'= 'font/woff2'
    '.ttf'  = 'font/ttf'
    '.txt'  = 'text/plain; charset=utf-8'
}

function Send-Response {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$StatusCode,
        [string]$StatusText,
        [byte[]]$Body,
        [string]$ContentType = 'text/plain; charset=utf-8'
    )

    $header = "HTTP/1.1 $StatusCode $StatusText`r`n" +
              "Content-Type: $ContentType`r`n" +
              "Content-Length: $($Body.Length)`r`n" +
              "Cache-Control: no-cache`r`n" +
              "Connection: close`r`n`r`n"

    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($Body.Length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }
    $Stream.Flush()
}

Start-Process $url

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = New-Object System.IO.StreamReader(
                $stream,
                [System.Text.Encoding]::ASCII,
                $false,
                8192,
                $true
            )

            $requestLine = $reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($requestLine)) {
                continue
            }

            while ($true) {
                $line = $reader.ReadLine()
                if ([string]::IsNullOrEmpty($line)) { break }
            }

            $parts = $requestLine.Split(' ')
            if ($parts.Length -lt 2 -or $parts[0] -ne 'GET') {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Metodo no permitido')
                Send-Response $stream 405 'Method Not Allowed' $body
                continue
            }

            $rawPath = $parts[1].Split('?')[0]
            $relative = [System.Uri]::UnescapeDataString($rawPath).TrimStart('/')

            if ([string]::IsNullOrWhiteSpace($relative)) {
                $relative = 'index.html'
            }

            $relative = $relative -replace '/', [System.IO.Path]::DirectorySeparatorChar
            $candidate = Join-Path $root $relative
            $full = [System.IO.Path]::GetFullPath($candidate)
            $base = [System.IO.Path]::GetFullPath($root + [System.IO.Path]::DirectorySeparatorChar)

            if (-not $full.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Ruta no permitida')
                Send-Response $stream 403 'Forbidden' $body
                continue
            }

            if (Test-Path $full -PathType Container) {
                $full = Join-Path $full 'index.html'
            }

            if (-not (Test-Path $full -PathType Leaf)) {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Archivo no encontrado')
                Send-Response $stream 404 'Not Found' $body
                continue
            }

            $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
            $contentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
            $body = [System.IO.File]::ReadAllBytes($full)
            Send-Response $stream 200 'OK' $body $contentType
        }
        catch {
            try {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Error interno del servidor')
                Send-Response $stream 500 'Internal Server Error' $body
            }
            catch {}
        }
        finally {
            try { $client.Close() } catch {}
        }
    }
}
finally {
    try { $listener.Stop() } catch {}
}
