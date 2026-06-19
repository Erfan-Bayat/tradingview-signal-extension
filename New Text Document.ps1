$output = "project_dump.txt"

tree /F /A > $output

Get-ChildItem -Recurse -File -Include *.js,*.json,*.html,*.css -Exclude $output | ForEach-Object {
    Add-Content $output "`n`n===== FILE: $($_.FullName) =====`n"
    Get-Content $_.FullName | Add-Content $output
}
