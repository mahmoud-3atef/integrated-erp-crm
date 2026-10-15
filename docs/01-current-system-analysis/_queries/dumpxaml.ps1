# Read-only: SELECT workflow definitions (XAML) for the entities the portal uses
$cs = "Data Source=SQLCRM;Initial Catalog=Care_Pro_MSCRM;Integrated Security=True"
$out = "C:\Cl\anl\xaml"
Remove-Item -Recurse -Force $out -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $out | Out-Null
$conn = New-Object System.Data.SqlClient.SqlConnection $cs
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = @"
SELECT w.PrimaryEntity, w.Name, w.Xaml
FROM WorkflowBase w
WHERE w.Type=1 AND w.StateCode=1 AND w.Category=0
  AND w.PrimaryEntity IN (4212,10011,10017,10032,10056,10066,10079,10085,10105,10113,10136,10047,10104,10015,10016)
ORDER BY w.PrimaryEntity, w.Name
"@
$r = $cmd.ExecuteReader()
$i = 0
$index = New-Object System.Collections.Generic.List[string]
while ($r.Read()) {
    $i++
    $ent = $r.GetValue(0); $name = $r.GetString(1); $x = $r.GetString(2)
    $file = Join-Path $out ("{0}_{1:D2}.xaml" -f $ent, $i)
    [System.IO.File]::WriteAllText($file, $x, [System.Text.Encoding]::UTF8)
    $index.Add("{0}_{1:D2}|{2}" -f $ent, $i, $name)
}
$r.Close(); $conn.Close()
[System.IO.File]::WriteAllLines((Join-Path $out "index.txt"), $index, [System.Text.Encoding]::UTF8)
"dumped $i"
