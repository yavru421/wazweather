param(
    [switch]$Query,
    [switch]$Export,
    [int]$Limit = 50
)

$DBPath = "c:\dev\wazweather\backend\wazweather_analytics.db"

if (-not (Test-Path $DBPath)) {
    Write-Host "Analytics database not found at $DBPath. Please ensure the backend worker has run at least once." -ForegroundColor Red
    exit
}

$queryText = "SELECT * FROM analytics ORDER BY timestamp DESC LIMIT $Limit;"

if ($Export) {
    $exportFile = "c:\dev\wazweather\backend\analytics_export_$(Get-Date -Format 'yyyyMMdd_HHmmss').csv"
    sqlite3 -header -csv $DBPath $queryText > $exportFile
    Write-Host "Exported analytics to $exportFile" -ForegroundColor Green
} elseif ($Query) {
    sqlite3 -header -column $DBPath $queryText
} else {
    Write-Host "WazWeather Analytics CLI"
    Write-Host "Usage:"
    Write-Host "  .\analytics_cli.ps1 -Query           (View the last 50 logs)"
    Write-Host "  .\analytics_cli.ps1 -Query -Limit 100 (View the last 100 logs)"
    Write-Host "  .\analytics_cli.ps1 -Export          (Export the last 50 logs to CSV)"
}
