<#
.SYNOPSIS
  Alur aman sinkronkan schema Prisma ke database Neon.

.DESCRIPTION
  Default (tanpa -Apply) = READ-ONLY. Hanya membuat diff SQL + laporan, TIDAK mengubah DB.
  Dengan -Apply = menjalankan "prisma db push" setelah Anda mengetik YA.

  WAJIB: backup dulu (Neon Console > Branches > Create branch) sebelum memakai -Apply.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/sync-db.ps1
  powershell -ExecutionPolicy Bypass -File scripts/sync-db.ps1 -Apply
#>
[CmdletBinding()]
param(
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Info($m) { Write-Host "  $m" -ForegroundColor Cyan }
function Good($m) { Write-Host "  $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  $m" -ForegroundColor Yellow }
function Bad($m)  { Write-Host "  $m" -ForegroundColor Red }
function Head($m) { Write-Host "`n=== $m ===" -ForegroundColor White }

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host " SINKRONKAN SCHEMA PRISMA -> DATABASE (NEON)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Info "Project : $root"

if (-not (Test-Path '.env'))              { Bad ".env tidak ditemukan. Hentikan."; exit 1 }
if (-not (Test-Path 'prisma/schema.prisma')) { Bad "prisma/schema.prisma tidak ditemukan."; exit 1 }

# ---- 1. Pastikan Prisma Client sinkron dengan schema (aman, hanya kode di node_modules)
Head "1/4  Generate Prisma Client"
& npx --no-install prisma generate
if ($LASTEXITCODE -ne 0) { Bad "prisma generate gagal."; exit 1 }

# ---- 2. Kondisi database saat ini (read-only)
Head "2/4  Kondisi database SEKARANG"
& node --env-file=.env scripts/check-db.cjs

# ---- 3. Diff SQL (READ-ONLY, tidak menulis ke database)
$stamp   = Get-Date -Format 'yyyyMMdd-HHmmss'
$sqlFile = Join-Path $root "sqldiff-$stamp.sql"

Head "3/4  Membuat diff SQL (READ-ONLY)"
& npx --no-install prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script -o $sqlFile
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $sqlFile)) { Bad "Gagal membuat diff SQL."; exit 1 }

$sql = Get-Content $sqlFile -Raw
if ([string]::IsNullOrWhiteSpace($sql)) {
  Good "Tidak ada perubahan skema. Database sudah sesuai dengan schema.prisma."
} else {
  $createTable = ([regex]::Matches($sql, 'CREATE TABLE')).Count
  $alterTable  = ([regex]::Matches($sql, 'ALTER TABLE')).Count
  $addColumn   = ([regex]::Matches($sql, 'ADD COLUMN')).Count
  $dropTable   = ([regex]::Matches($sql, 'DROP TABLE')).Count
  $dropColumn  = ([regex]::Matches($sql, 'DROP COLUMN')).Count

  Info "File SQL      : $sqlFile"
  Info "CREATE TABLE  : $createTable"
  Info "ALTER TABLE   : $alterTable   (ADD COLUMN: $addColumn)"
  if ($dropTable  -gt 0) { Warn "DROP TABLE   : $dropTable" }
  if ($dropColumn -gt 0) { Warn "DROP COLUMN  : $dropColumn" }

  $destructive = ([regex]::Matches($sql, '(?im)^\s*DROP\s+(TABLE|COLUMN|TYPE|SCHEMA|DATABASE)')).Count
  if ($destructive -gt 0) {
    Warn ""
    Warn "PERINGATAN: ada $destructive perintah destruktif (DROP ...)."
    Warn "WAJIB tinjau file SQL dulu :  notepad `"$sqlFile`""
  } else {
    Good "Tidak ada perintah destruktif (DROP). Aman untuk diterapkan."
  }
}

# ---- 4. Terapkan hanya jika diminta
Head "4/4  Menerapkan ke database"
if (-not $Apply) {
  Warn "Mode READ-ONLY - tidak ada perubahan ke database."
  Warn "Tinjau file SQL di atas. Kalau sudah sesuai, jalankan ulang dengan -Apply:"
  Warn "   powershell -ExecutionPolicy Bypass -File scripts/sync-db.ps1 -Apply"
  exit 0
}

if ([string]::IsNullOrWhiteSpace($sql)) { Good "Tidak ada yang perlu diterapkan."; exit 0 }

Bad "AKAN MENJALANKAN: prisma db push  (MENGUBAH skema di database)"
Warn "Pastikan Anda sudah membuat backup branch di Neon."
$conf = Read-Host "Ketik YA untuk lanjut"
if ($conf -cne 'YA') { Warn "Dibatalkan."; exit 1 }

& npx --no-install prisma db push
if ($LASTEXITCODE -ne 0) { Bad "prisma db push gagal. TIDAK otomatis ditambahkan --accept-data-loss."; exit 1 }

Head "Hasil setelah sinkron"
& node --env-file=.env scripts/check-db.cjs
Good "Selesai. File SQL tersimpan di: $sqlFile"
