SET NOCOUNT ON;
SELECT YEAR(createdon) y, COUNT(*) n, SUM(CASE WHEN new_projectid IS NULL THEN 1 ELSE 0 END) noproj, SUM(CASE WHEN new_serviceprice IS NULL THEN 1 ELSE 0 END) nullprice, SUM(CASE WHEN new_deliverorderid IS NULL THEN 1 ELSE 0 END) nodo FROM new_empwork GROUP BY YEAR(createdon) ORDER BY 1;
SELECT 'since_2026-09' k, COUNT(*) n, SUM(CASE WHEN new_serviceprice IS NULL THEN 1 ELSE 0 END) nullprice FROM new_empwork WHERE createdon>='2026-09-01';
SELECT TOP 5 REPLACE(REPLACE(new_laborsnumber,CHAR(13),'\r'),CHAR(10),'\n') s FROM new_deliverorder WHERE LEN(new_laborsnumber)>12 ORDER BY createdon DESC;
SELECT 'do_with_multiple' k, COUNT(*) FROM new_deliverorder WHERE LEN(new_laborsnumber)>12;
SELECT a.Name FROM AttributeView a JOIN EntityView e ON e.EntityId=a.EntityId WHERE e.Name='new_deliverorder' AND a.IsCustomField=1 AND a.AttributeOf IS NULL ORDER BY 1;
SELECT YEAR(createdon) y, COUNT(*) FROM mw_lodginorderdetails GROUP BY YEAR(createdon) ORDER BY 1;
SELECT YEAR(createdon) y, COUNT(*) FROM new_deliverorder GROUP BY YEAR(createdon) ORDER BY 1;
SELECT YEAR(createdon) y, COUNT(*) FROM new_employee GROUP BY YEAR(createdon) ORDER BY 1;
