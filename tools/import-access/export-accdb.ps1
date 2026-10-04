<#
.SYNOPSIS
  Exports the tables of the old Access exam database to UTF-8 CSV files (read-only).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\import-access\export-accdb.ps1 -Database .\StudentsDBforwebsite.accdb

  Then on any machine with the API configured:
  npm run import:access -w @svi/api -- --dir tools/import-access/out --year 2081 --grade 11 --exam "Final" --exam-year-bs 2081 --exam-year-ad 2024 --dry-run
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
        if ($v -is [datetime]) { $v = $v.ToString('yyyy-MM-dd') }
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
