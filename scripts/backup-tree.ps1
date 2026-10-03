# Downloads the family tree JSON from the live site and saves a dated copy.
# Needs the user environment variable FAMILY_TREE_PASSWORD (same value as FAMILY_PASSWORD in Vercel).
$ErrorActionPreference = 'Stop'

$url    = 'https://family-tree-tau-eosin.vercel.app/api/tree'
$folder = 'C:\dev\2026-family-tree'
$pw     = [Environment]::GetEnvironmentVariable('FAMILY_TREE_PASSWORD', 'User')
if (-not $pw) { throw 'FAMILY_TREE_PASSWORD user environment variable is not set.' }

$resp = Invoke-WebRequest -Uri $url -Headers @{ 'x-password' = $pw } -UseBasicParsing
$data = $resp.Content | ConvertFrom-Json
if (-not $data.people -or $data.people.Count -eq 0) { throw 'Download returned no people; not saving.' }

$file = Join-Path $folder ("family-tree-{0}.json" -f (Get-Date -Format 'yyyy-MM-dd'))
[IO.File]::WriteAllText($file, $resp.Content, (New-Object Text.UTF8Encoding($false)))
Write-Output "Saved $($data.people.Count) people to $file"
