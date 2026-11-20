#requires -version 5.1
<#
  Runs the five pending AgrarMentor migrations against the already-restored
  *local Docker* database in ONE transaction, which is always rolled back.
  No live Supabase connection, credentials, database dump, or GitHub upload.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$containerName = 'supabase_db_AgrarMentor-mentes-2026-11-19'
$remoteDir = '/tmp/agrar_release_migration_check_20261119'
$repoRoot = Split-Path -Parent $PSScriptRoot
$migrationNames = @(
    '20261119080000_general_task_attestation_review.sql',
    '20261119093000_authorized_advisor_notifications.sql',
    '20261119110000_verified_task_proof_rpc_guard.sql',
    '20261119123000_field_boundary_proposals.sql',
    '20261119211340_notification_email_send_quota.sql'
)
$checkFile = Join-Path $PSScriptRoot 'verify_staged_migrations.sql'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'A Docker parancs nem található. Indítsd el a Docker Desktopot.'
}
if (-not (Test-Path -LiteralPath $checkFile -PathType Leaf)) {
    throw "Hiányzik az ellenőrző SQL: $checkFile"
}
foreach ($name in $migrationNames) {
    $path = Join-Path (Join-Path $repoRoot 'supabase\migrations') $name
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Hiányzik a migráció: $path"
    }
}

# Deliberately restrict the target: this helper must not accept a remote DB URL
# or silently run against another Supabase project/container.
$inspection = & docker inspect --format '{{.Name}}|{{.State.Running}}' $containerName 2>$null
if ($LASTEXITCODE -ne 0 -or $inspection.Trim() -ne "/$containerName|true") {
    throw "A visszaállított helyi konténer nem fut: $containerName"
}

Write-Host 'Ellenőrzés: kizárólag a visszaállított HELYI Docker-adatbázis.'
Write-Host 'Az ot migracio egyetlen tranzakcioban fut, a vegen ROLLBACK tortenik.'

& docker exec $containerName mkdir -p $remoteDir
if ($LASTEXITCODE -ne 0) { throw 'A helyi ellenőrző könyvtár nem hozható létre.' }
foreach ($name in $migrationNames) {
    $path = Join-Path (Join-Path $repoRoot 'supabase\migrations') $name
    & docker cp $path "${containerName}:${remoteDir}/$name"
    if ($LASTEXITCODE -ne 0) { throw "Nem másolható a helyi konténerbe: $name" }
}
& docker cp $checkFile "${containerName}:${remoteDir}/verify_staged_migrations.sql"
if ($LASTEXITCODE -ne 0) { throw 'Az ellenőrző SQL nem másolható a konténerbe.' }

& docker exec -i $containerName psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f "$remoteDir/verify_staged_migrations.sql"
if ($LASTEXITCODE -ne 0) {
    throw 'A HELYI migrációteszt HIBÁS. Az adatbázis-tranzakció visszagörgetődött; az éles környezethez nem nyúltunk.'
}

Write-Host 'HELYI MIGRÁCIÓPRÓBA: SIKERES – minden séma/jogosultság-ellenőrzés átment, a tranzakció visszagörgetve.'
