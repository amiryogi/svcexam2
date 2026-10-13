<#
.SYNOPSIS
  Exports the tables of the old Access exam database to UTF-8 CSV files (read-only) and zips them
  into out\svi-import.zip for upload. See "Importing the old Access database" in README.md.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\import-access\export-accdb.ps1 -Database ".\Final Exam XI (2081).accdb"

  Then check the CSVs (no database needed):
  npm run import:access:check -w @svi/api -- --dir ../../tools/import-access/out --year 2081
#>
param(
  [Parameter(Mandatory = $true)][string]$Database,
  [string]$OutDir = ''
)
$ErrorActionPreference = 'Stop'
# $PSScriptRoot is not available in parameter defaults on Windows PowerShell 5.1.
if (-not $OutDir) { $OutDir = Join-Path $PSScriptRoot 'out' }

New-Item -ItemType Directory -Force $OutDir | Out-Null
$engine = New-Object -ComObject DAO.DBEngine.120
# OpenDatabase(path, exclusive = false, readOnly = true): the Access file is never modified.
$db = $engine.OpenDatabase((Resolve-Path $Database).Path, $false, $true)
try {
  foreach ($table in 'StudentDetails', 'NEB_Details', 'Subject', 'Scores') {
    $rs = $db.OpenRecordset("SELECT * FROM [$table]", 4)
    $rows = New-Object System.Collections.Generic.List[object]
    while (-not $rs.EOF) {
      $row = [ordered]@{}
      foreach ($f in $rs.Fields) {
        $v = $f.Value
        # Invariant culture: B.S. dates stored in Date fields must keep their digits as typed.
        if ($v -is [datetime]) { $v = $v.ToString('yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture) }
        elseif ($null -eq $v -or $v -is [System.DBNull]) { $v = '' }
        $row[$f.Name] = $v
      }
      $rows.Add([pscustomobject]$row)
      $rs.MoveNext()
    }
    $rs.Close()
    $rows | Export-Csv -Path (Join-Path $OutDir "$table.csv") -NoTypeInformation -Encoding UTF8
    Write-Host ("{0,-15} {1,5} rows" -f $table, $rows.Count)
  }
}
finally {
  $db.Close()
}
Write-Host "CSV files written to $OutDir"

$zip = Join-Path $OutDir 'svi-import.zip'
Compress-Archive -Path (Join-Path $OutDir '*.csv') -DestinationPath $zip -Force
Write-Host "Upload file: $zip (contains student personal data - delete it after the import)"
