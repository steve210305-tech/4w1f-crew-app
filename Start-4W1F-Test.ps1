$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$prefix = 'http://localhost:8787/'

function Get-MimeType([string]$path) {
  switch ([System.IO.Path]::GetExtension($path).ToLowerInvariant()) {
    '.html' { 'text/html; charset=utf-8' }
    '.js' { 'text/javascript; charset=utf-8' }
    '.css' { 'text/css; charset=utf-8' }
    '.json' { 'application/json; charset=utf-8' }
    '.webmanifest' { 'application/manifest+json; charset=utf-8' }
    '.png' { 'image/png' }
    '.jpg' { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.svg' { 'image/svg+xml' }
    '.webp' { 'image/webp' }
    '.ico' { 'image/x-icon' }
    default { 'application/octet-stream' }
  }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "4W1F Testserver laeuft: $prefix" -ForegroundColor Magenta
Write-Host "Dieses Fenster offen lassen. Strg+C beendet den Testserver." -ForegroundColor DarkGray

Start-Process $prefix

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
      $raw = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
      if ([string]::IsNullOrWhiteSpace($raw)) { $raw = 'index.html' }

      $candidate = [System.IO.Path]::GetFullPath((Join-Path $root $raw))
      $rootFull = [System.IO.Path]::GetFullPath($root + [System.IO.Path]::DirectorySeparatorChar)
      if (-not $candidate.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        $ctx.Response.StatusCode = 403
        $ctx.Response.Close()
        continue
      }

      if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        $candidate = Join-Path $root 'index.html'
      }

      $bytes = [System.IO.File]::ReadAllBytes($candidate)
      $ctx.Response.StatusCode = 200
      $ctx.Response.ContentType = Get-MimeType $candidate
      $ctx.Response.Headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
      $ctx.Response.Headers['Pragma'] = 'no-cache'
      $ctx.Response.Headers['Access-Control-Allow-Origin'] = '*'
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      $ctx.Response.OutputStream.Close()
    } catch {
      try {
        $ctx.Response.StatusCode = 500
        $msg = [Text.Encoding]::UTF8.GetBytes('4W1F local server error')
        $ctx.Response.ContentLength64 = $msg.Length
        $ctx.Response.OutputStream.Write($msg,0,$msg.Length)
        $ctx.Response.Close()
      } catch {}
    }
  }
} finally {
  if ($listener.IsListening) { $listener.Stop() }
  $listener.Close()
}
