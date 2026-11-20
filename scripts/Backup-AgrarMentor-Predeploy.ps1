#requires -version 5.1
<#
  Fresh, read-only production backup immediately before the AgrarMentor release.
  Runs on Windows with Docker Desktop and an authenticated Supabase CLI v3.
  Creates a NEW directory; never overwrites the November 19 backup.
  This script does NOT restore, migrate, deploy or back up Storage object bytes.
#>
[CmdletBinding()]
param(
    [string]$DestinationRoot = (Join-Path ([Environment]::GetFolderPath('UserProfile')) 'AgrarMentor-friss-mentesek')
)

$ErrorActionPreference = 'Stop'
$projectRef = 'qkezhvtwirdsvhzjyvfi'
$cliPackage = 'supabase@3.2.0'

if (-not (Get-Command npx.cmd -ErrorAction SilentlyContinue)) {
    throw 'Az npx.cmd nem található. Ellenőrizd a Node.js telepítést.'
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'A Docker nem található. Indítsd el a Docker Desktopot.'
}
& docker info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'A Docker Desktop nem fut.' }

$backupRoot = [System.IO.Path]::GetFullPath($DestinationRoot)
if (-not (Test-Path -LiteralPath $backupRoot)) {
    New-Item -ItemType Directory -Path $backupRoot | Out-Null
}
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupDir = Join-Path $backupRoot "AgrarMentor_predeploy_$stamp"
if (Test-Path -LiteralPath $backupDir) {
    throw "Létező mentési mappát nem írunk felül: $backupDir"
}
New-Item -ItemType Directory -Path $backupDir | Out-Null

Write-Host "AgrarMentor: CSAK OLVASÓ távoli mentés. Projekt: $projectRef"
Write-Host "Új mentési mappa: $backupDir"

$dumpSpecs = @(
    @{ File = 'roles.sql'; Extra = @('--role-only'); MinimumBytes = 40 },
    @{ File = 'schema.sql'; Extra = @(); MinimumBytes = 100 },
    @{ File = 'data.sql'; Extra = @('--data-only', '--use-copy'); MinimumBytes = 1024 }
)
foreach ($spec in $dumpSpecs) {
    $targetFile = Join-Path $backupDir $spec.File
    $cliArgs = @('--yes', $cliPackage, 'db', 'dump', "--remote=$projectRef") + $spec.Extra + @('-f', $targetFile)
    Write-Host "Mentés: $($spec.File)"
    & npx.cmd @cliArgs
    if ($LASTEXITCODE -ne 0) { throw "A távoli mentés sikertelen: $($spec.File)" }
    if (-not (Test-Path -LiteralPath $targetFile -PathType Leaf)) {
        throw "Nem jött létre a mentés: $targetFile"
    }
    if ((Get-Item -LiteralPath $targetFile).Length -lt $spec.MinimumBytes) {
        throw "A mentés váratlanul kicsi: $targetFile"
    }
}

# Validate COPY block boundaries and a few critical Supabase/application tables
# without displaying any personal data from the backup.
$dataFile = Join-Path $backupDir 'data.sql'
$reader = [System.IO.File]::OpenText($dataFile)
$rowsByTable = @{}
$opened = 0
$closed = 0
$copyTable = $null
$copyRows = 0
try {
    while (($line = $reader.ReadLine()) -ne $null) {
        if ($line -match '^COPY\s+"([^"]+)"\."([^"]+)"\s+.*FROM stdin;$') {
            if ($null -ne $copyTable) { throw 'Egymásba ágyazott COPY blokkok.' }
            $copyTable = "$($Matches[1]).$($Matches[2])"
            $copyRows = 0
            $opened++
        } elseif ($null -ne $copyTable -and $line -eq '\.') {
            $rowsByTable[$copyTable] = $copyRows
            $copyTable = $null
            $closed++
        } elseif ($null -ne $copyTable) {
            $copyRows++
        }
    }
} finally {
    $reader.Dispose()
}
if ($null -ne $copyTable -or $opened -ne $closed -or $opened -lt 60) {
    throw "Hibás vagy hiányos COPY blokkok: nyitott=$opened, zárt=$closed"
}
$requiredTables = @('auth.users', 'public.tasks', 'public.field_operations', 'public.inspections', 'storage.objects')
foreach ($table in $requiredTables) {
    if (-not $rowsByTable.ContainsKey($table) -or $rowsByTable[$table] -lt 1) {
        throw "Hiányzik vagy üres egy kritikus tábla: $table"
    }
}

$fileChecks = @()
foreach ($spec in $dumpSpecs) {
    $file = Join-Path $backupDir $spec.File
    $fileChecks += [ordered]@{
        file = $spec.File
        bytes = (Get-Item -LiteralPath $file).Length
        sha256 = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}
$tableSummary = [ordered]@{}
foreach ($table in $requiredTables) { $tableSummary[$table] = $rowsByTable[$table] }
$manifest = [ordered]@{
    project_ref = $projectRef
    captured_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    cli = $cliPackage
    files = $fileChecks
    copy_blocks = $opened
    critical_table_rows = $tableSummary
    storage_object_bytes_included = $false
    production_modified = $false
}
$manifestPath = Join-Path $backupDir 'manifest.json'
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Host "FRISS AGRARMENTOR DB-MENTES: SIKERES – $opened lezárt COPY blokk."
foreach ($table in $requiredTables) { Write-Host "${table}: $($rowsByTable[$table]) sor" }
Write-Host "Mentési mappa: $backupDir"
Write-Host 'FONTOS: ez adatbázis-dump. A Storage fájlok tartalmát külön kell őrizni; éles migráció vagy telepítés NEM történt.'
