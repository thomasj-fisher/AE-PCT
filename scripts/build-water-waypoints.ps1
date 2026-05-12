# Build water-waypoint coordinate lookup from Halfmile's free GPX downloads.
# Source: https://pctmap.net/gps/ (Copyright Halfmile Media — free personal use)
# Run from anywhere. Outputs data/water-waypoints.js with all waypoints whose
# <sym> indicates water, plus names matching common water prefixes.

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$outFile  = Join-Path $repoRoot 'data\water-waypoints.js'

$temp = Join-Path $env:TEMP 'pct-water-build'
if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
New-Item -ItemType Directory -Path $temp -Force | Out-Null

$urls = @(
  'https://pctmap.net/wp-content/uploads/2023/11/s_ca_halfmile_gpx.zip',
  'https://pctmap.net/wp-content/uploads/2023/11/n_ca_halfmile_gpx.zip',
  'https://pctmap.net/wp-content/uploads/2023/11/or_halfmile_gpx.zip',
  'https://pctmap.net/wp-content/uploads/2023/11/wa_halfmile_gpx.zip'
)

foreach ($url in $urls) {
  $name = Split-Path $url -Leaf
  $dest = Join-Path $temp $name
  Write-Output "Downloading $name ..."
  Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
  Expand-Archive -Path $dest -DestinationPath $temp -Force
}

$wptFiles = Get-ChildItem $temp -Recurse -Filter '*waypoints*.gpx'
Write-Output "Parsing $($wptFiles.Count) waypoint files ..."

$wptRx  = [regex]'<wpt\s+lat="([-\d.]+)"\s+lon="([-\d.]+)"[^>]*>([\s\S]*?)</wpt>'
$nameRx = [regex]'<name>([^<]+)</name>'
$symRx  = [regex]'<sym>([^<]+)</sym>'
$descRx = [regex]'<desc>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?</desc>'

$wp = @{}
foreach ($f in $wptFiles) {
  $content = [System.IO.File]::ReadAllText($f.FullName)
  foreach ($m in $wptRx.Matches($content)) {
    $lat  = [math]::Round([double]$m.Groups[1].Value, 5)
    $lon  = [math]::Round([double]$m.Groups[2].Value, 5)
    $body = $m.Groups[3].Value
    $nm   = $nameRx.Match($body)
    if (-not $nm.Success) { continue }
    $key  = $nm.Groups[1].Value.Trim()
    $sym  = $symRx.Match($body)
    $desc = $descRx.Match($body)
    $entry = [ordered]@{ lat = $lat; lon = $lon }
    if ($sym.Success)  { $entry.sym  = $sym.Groups[1].Value.Trim() }
    if ($desc.Success) {
      $d = $desc.Groups[1].Value.Trim()
      # Strip newlines and any HTML — keep it short
      $d = $d -replace '\s+', ' '
      if ($d.Length -gt 200) { $d = $d.Substring(0,197) + '...' }
      $entry.desc = $d
    }
    $wp[$key] = $entry
  }
}

Write-Output "Total waypoints parsed: $($wp.Count)"

# Keep ALL waypoints — the pctwater CSV references both water codes (WR###)
# and descriptive landmark names (MexBorder, PCTAID_1208, RD0009B etc).
# Filtering would drop legitimate water reports.
$water = [ordered]@{}
foreach ($k in $wp.Keys | Sort-Object) { $water[$k] = $wp[$k] }
Write-Output "Embedded waypoints: $($water.Count)"

$dateStamp = Get-Date -Format 'yyyy-MM-dd'
$headerLines = @(
  '// Halfmile PCT waypoint coordinates for water sources.',
  '// Source: Halfmile''s PCT Maps -- https://pctmap.net/gps/ (Copyright 2020 Halfmile Media)',
  "// Generated $dateStamp by scripts/build-water-waypoints.ps1",
  '// Keys match the pctwater.com Google Sheets Waypoint column.',
  'window.PCT_WATER_WAYPOINTS = '
)
$header = ($headerLines -join "`n")

$json = $water | ConvertTo-Json -Compress -Depth 4
$body = $header + $json + ";`n"
[System.IO.File]::WriteAllText($outFile, $body, [System.Text.UTF8Encoding]::new($false))

$fi = Get-Item $outFile
Write-Output "Wrote $outFile ($([math]::Round($fi.Length/1KB,1)) KB)"
