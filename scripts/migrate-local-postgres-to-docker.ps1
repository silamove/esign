# Migrate local (host) Postgres database into Docker Postgres 17
# Usage: pwsh -File scripts/migrate-local-postgres-to-docker.ps1
$ErrorActionPreference = 'Stop'

function Test-DockerRunning {
  try {
    docker info | Out-Null
  } catch {
    throw 'Docker Desktop is not running. Please start Docker and retry.'
  }
}

function Get-DotEnvMap {
  param([string]$Path)
  $map = @{}
  if (Test-Path $Path) {
    Get-Content -Raw -Path $Path -Encoding UTF8 | ForEach-Object {
      $_ -split "`n"
    } | ForEach-Object {
      $line = $_.Trim()
      if (-not $line -or $line.StartsWith('#')) { return }
      $eq = $line.IndexOf('=')
      if ($eq -gt 0) {
        $k = $line.Substring(0, $eq).Trim()
        $v = $line.Substring($eq+1).Trim()
        # strip surrounding quotes if present
        if ($v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Trim('"') }
        if ($v.StartsWith("'") -and $v.EndsWith("'")) { $v = $v.Trim("'") }
        $map[$k] = $v
      }
    }
  }
  return $map
}

function Wait-PostgresReady {
  param(
    [int]$TimeoutSec = 60
  )
  $pgUser = $env:PGUSER
  if ([string]::IsNullOrWhiteSpace($pgUser)) { $pgUser = 'sign' }
  $pgDb = $env:PGDATABASE
  if ([string]::IsNullOrWhiteSpace($pgDb)) { $pgDb = 'sign' }

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      docker compose exec -T postgres sh -lc "pg_isready -h localhost -U $pgUser -d $pgDb" | Out-Null
      if ($LASTEXITCODE -eq 0) { return }
    } catch {}
    Start-Sleep -Seconds 2
  }
  throw 'Postgres container did not become ready. If you previously had a pgdata volume from a different major version, run: docker compose down; docker volume rm sign_pgdata; docker compose up -d postgres'
}

# 1) Sanity checks
Test-DockerRunning

# 2) Determine host DB connection parameters (prefer env PG*, else .env DATABASE_*)
$dotenv = Get-DotEnvMap -Path (Join-Path (Get-Location) '.env')
$pgUser = if ($env:PGUSER) { $env:PGUSER } elseif ($dotenv['DATABASE_USER']) { $dotenv['DATABASE_USER'] } else { 'sign' }
$pgDb = if ($env:PGDATABASE) { $env:PGDATABASE } elseif ($dotenv['DATABASE_NAME']) { $dotenv['DATABASE_NAME'] } else { 'sign' }
$pgPass = if ($env:PGPASSWORD) { $env:PGPASSWORD } elseif ($dotenv['DATABASE_PASSWORD']) { $dotenv['DATABASE_PASSWORD'] } else { 'signpass' }
$pgHostLocal = if ($env:PGHOST) { $env:PGHOST } elseif ($dotenv['DATABASE_HOST']) { $dotenv['DATABASE_HOST'] } else { 'localhost' }
if ($pgHostLocal -ieq 'localhost') { $pgHostLocal = 'host.docker.internal' }

Write-Host "Using host DB -> host=$pgHostLocal db=$pgDb user=$pgUser"

# 3) Prepare dump target
$root = (Get-Location).Path
$migrationDir = Join-Path $root 'database/migration'
if (-not (Test-Path $migrationDir)) { New-Item -ItemType Directory -Path $migrationDir | Out-Null }
$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$dumpFileName = "sign_$ts.pgdump"
$dumpHostPath = Join-Path $migrationDir $dumpFileName

Write-Host "Creating logical dump from host Postgres to $dumpHostPath ..."
$dockerMount = "${migrationDir}:/dump"

# 4) Run pg_dump in a temporary postgres:17-alpine container
$dumpCmd = "pg_dump -h $pgHostLocal -U $pgUser -d $pgDb -F c -f /dump/$dumpFileName"
$exitCode = 0
try {
  docker run --rm -e PGPASSWORD=$pgPass -v "$dockerMount" postgres:17-alpine sh -lc "$dumpCmd"
  $exitCode = $LASTEXITCODE
} catch {
  $exitCode = 1
}
if ($exitCode -ne 0) {
  throw "pg_dump failed. Verify credentials and connectivity. Tried: host=$pgHostLocal db=$pgDb user=$pgUser"
}

if (-not (Test-Path $dumpHostPath)) {
  throw "Dump file was not created: $dumpHostPath."
}
$size = (Get-Item $dumpHostPath).Length
if ($size -lt 100) {
  throw "Dump file looks invalid (size ${size} bytes). Check credentials." 
}
Write-Host "Dump created: $dumpHostPath (${size} bytes)"

# 5) Start Postgres 17 in compose and wait
Write-Host 'Starting postgres service (Postgres 17)...'
docker compose up -d postgres | Out-Null
Wait-PostgresReady -TimeoutSec 90

# Determine container DB credentials (separate from source host creds)
$containerUser = if ($env:CONTAINER_PGUSER) { $env:CONTAINER_PGUSER } else { 'sign' }
$containerPass = if ($env:CONTAINER_PGPASSWORD) { $env:CONTAINER_PGPASSWORD } else { 'signpass' }
$containerDb   = if ($env:CONTAINER_PGDATABASE) { $env:CONTAINER_PGDATABASE } else { 'sign' }

# 6) Copy dump into the running postgres container
$cid = docker compose ps -q postgres
if (-not $cid) { throw 'Could not determine postgres container id.' }
Write-Host "Copying dump into container $cid ..."
docker cp "$dumpHostPath" "${cid}:/dump.pgdump"

# 7) Restore inside the container
Write-Host "Restoring dump inside the Postgres container (db=$containerDb user=$containerUser)..."
docker compose exec -T postgres sh -lc "PGPASSWORD=$containerPass pg_restore --clean --if-exists --no-owner --verbose -U $containerUser -d $containerDb /dump.pgdump"

# 8) Cleanup dump inside container (optional)
docker compose exec -T postgres sh -lc 'rm -f /dump.pgdump' | Out-Null

Write-Host 'Migration completed successfully.'
Write-Host 'Next: the backend in docker-compose already uses DB host=postgres (db=sign, user=sign). Run: docker compose up -d'
