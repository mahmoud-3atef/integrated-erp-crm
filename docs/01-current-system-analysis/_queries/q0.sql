SET NOCOUNT ON;
SELECT e.Name, e.ObjectTypeCode, (SELECT SUM(p.rows) FROM sys.partitions p JOIN sys.objects o ON o.object_id=p.object_id WHERE o.name=e.Name+'Base' AND p.index_id IN (0,1)) AS rows
FROM EntityView e WHERE e.IsCustomEntity=1 ORDER BY e.Name;
