SET NOCOUNT ON;
-- READ ONLY statistics for the analysis docs
PRINT '== status distribution';
SELECT 'new_employee' ent, statuscode, COUNT(*) n FROM new_employee GROUP BY statuscode
UNION ALL SELECT 'new_empwork', statuscode, COUNT(*) FROM new_empwork GROUP BY statuscode
UNION ALL SELECT 'new_deliverorder', statuscode, COUNT(*) FROM new_deliverorder GROUP BY statuscode
UNION ALL SELECT 'mw_lodginorderdetails', statuscode, COUNT(*) FROM mw_lodginorderdetails GROUP BY statuscode
UNION ALL SELECT 'new_invoice', statuscode, COUNT(*) FROM new_invoice GROUP BY statuscode
UNION ALL SELECT 'hr_vicrequest', statuscode, COUNT(*) FROM hr_vicrequest GROUP BY statuscode
UNION ALL SELECT 'new_leaverequest', statuscode, COUNT(*) FROM new_leaverequest GROUP BY statuscode
UNION ALL SELECT 'new_project', statuscode, COUNT(*) FROM new_project GROUP BY statuscode
UNION ALL SELECT 'new_agent', statuscode, COUNT(*) FROM new_agent GROUP BY statuscode
UNION ALL SELECT 'new_attendance', statuscode, COUNT(*) FROM new_attendance GROUP BY statuscode
ORDER BY 1,2;

PRINT '== invoice types';
SELECT new_invoicetype, COUNT(*) n, SUM(ISNULL(new_totalamount,0)) total, SUM(ISNULL(new_totalpaidamount,0)) paid FROM new_invoice GROUP BY new_invoicetype;

PRINT '== housing enter types / housing status';
SELECT 'entertype' k, new_entertype v, COUNT(*) n FROM mw_lodginorderdetails GROUP BY new_entertype
UNION ALL SELECT 'housingstatus', new_housingstatus, COUNT(*) FROM mw_lodginorderdetails GROUP BY new_housingstatus
UNION ALL SELECT 'backreason', new_backreason, COUNT(*) FROM mw_lodginorderdetails GROUP BY new_backreason
ORDER BY 1,2;

PRINT '== empwork quality';
SELECT COUNT(*) total,
 SUM(CASE WHEN new_serviceprice IS NULL THEN 1 ELSE 0 END) null_serviceprice,
 SUM(CASE WHEN ISNULL(new_serviceprice,0)=0 THEN 1 ELSE 0 END) zero_or_null_price,
 SUM(CASE WHEN new_startdate IS NULL THEN 1 ELSE 0 END) null_start,
 SUM(CASE WHEN new_deliverorderid IS NULL THEN 1 ELSE 0 END) no_deliverorder,
 SUM(CASE WHEN new_projectid IS NULL THEN 1 ELSE 0 END) no_project,
 SUM(CASE WHEN DATEPART(HOUR,new_startdate)=21 THEN 1 ELSE 0 END) start_at_21utc,
 SUM(CASE WHEN DATEPART(HOUR,new_startdate) NOT IN (21,0) THEN 1 ELSE 0 END) start_other_hour,
 MIN(new_startdate) minstart, MAX(new_startdate) maxstart
FROM new_empwork;
SELECT 'empwork_null_price_created_2026' k, COUNT(*) FROM new_empwork WHERE new_serviceprice IS NULL AND createdon >= '2026-01-01';

PRINT '== empwork overlapping (same employee, next start before previous end not modelled -> count employees with >1 open work)';
SELECT COUNT(*) employees_with_multiple_work FROM (SELECT new_employeeid FROM new_empwork GROUP BY new_employeeid HAVING COUNT(*)>1) x;
SELECT COUNT(*) sameday_dup_work FROM (SELECT new_employeeid, CAST(new_startdate AS date) d FROM new_empwork WHERE new_startdate IS NOT NULL GROUP BY new_employeeid, CAST(new_startdate AS date) HAVING COUNT(*)>1) x;

PRINT '== housing quality';
SELECT COUNT(*) total,
 SUM(CASE WHEN new_entertype IS NULL THEN 1 ELSE 0 END) null_entertype,
 SUM(CASE WHEN new_leavedate IS NULL THEN 1 ELSE 0 END) null_leavedate,
 SUM(CASE WHEN new_leavedate IS NOT NULL AND CAST(new_leavedate AS date)=CAST(mw_arrivedate AS date) THEN 1 ELSE 0 END) leave_eq_arrive,
 SUM(CASE WHEN new_leavedate < mw_arrivedate THEN 1 ELSE 0 END) leave_before_arrive,
 SUM(CASE WHEN mw_housing IS NULL THEN 1 ELSE 0 END) no_building,
 SUM(CASE WHEN mw_housingapartments IS NULL THEN 1 ELSE 0 END) no_apartment,
 SUM(CASE WHEN new_projectid IS NULL THEN 1 ELSE 0 END) no_project,
 SUM(CASE WHEN createdby = ownerid THEN 0 ELSE 1 END) created_ne_owner
FROM mw_lodginorderdetails;
SELECT 'employees_with_2plus_open_housing' k, COUNT(*) FROM (SELECT mw_empid FROM mw_lodginorderdetails WHERE new_leavedate IS NULL AND statuscode<>100000004 GROUP BY mw_empid HAVING COUNT(*)>1) x;

PRINT '== deliver orders';
SELECT COUNT(*) total,
 SUM(CASE WHEN new_laborsnumber IS NULL OR LTRIM(new_laborsnumber)='' THEN 1 ELSE 0 END) no_laborsnumber,
 SUM(CASE WHEN new_laborsnumber LIKE '%,%' OR new_laborsnumber LIKE '%-%' OR new_laborsnumber LIKE '% %' THEN 1 ELSE 0 END) multi_token,
 SUM(CASE WHEN new_employeeid IS NULL THEN 1 ELSE 0 END) no_employee_lookup,
 SUM(CASE WHEN new_startworkdate IS NULL THEN 1 ELSE 0 END) no_startwork
FROM new_deliverorder;
SELECT TOP 8 new_laborsnumber FROM new_deliverorder WHERE new_laborsnumber LIKE '%[^0-9]%' ORDER BY createdon DESC;

PRINT '== employees';
SELECT COUNT(*) total,
 SUM(CASE WHEN new_projectid IS NULL THEN 1 ELSE 0 END) no_project,
 SUM(CASE WHEN new_idnumber IS NULL OR new_idnumber='' THEN 1 ELSE 0 END) no_iqama,
 SUM(CASE WHEN ISNULL(new_totalsalary,0)=0 THEN 1 ELSE 0 END) zero_salary,
 SUM(CASE WHEN ISNULL(new_totalservices,0)=0 THEN 1 ELSE 0 END) zero_serviceprice
FROM new_employee;
SELECT 'dup_iqama' k, COUNT(*) FROM (SELECT new_idnumber FROM new_employee WHERE ISNULL(new_idnumber,'')<>'' GROUP BY new_idnumber HAVING COUNT(*)>1) x
UNION ALL SELECT 'dup_empidnumber', COUNT(*) FROM (SELECT new_empidnumber FROM new_employee WHERE ISNULL(new_empidnumber,'')<>'' GROUP BY new_empidnumber HAVING COUNT(*)>1) x
UNION ALL SELECT 'dup_passport', COUNT(*) FROM (SELECT new_passportnumber FROM new_employee WHERE ISNULL(new_passportnumber,'')<>'' GROUP BY new_passportnumber HAVING COUNT(*)>1) x;
SELECT TOP 1 'headoffice_employees' k, COUNT(*) FROM new_employee e JOIN new_project p ON p.new_projectid=e.new_projectid WHERE p.new_name='HeadOffice';

PRINT '== system users';
SELECT COUNT(*) total, SUM(CASE WHEN IsDisabled=0 THEN 1 ELSE 0 END) enabled FROM SystemUserBase;
SELECT 'dup_fullname_enabled' k, COUNT(*) FROM (SELECT FullName FROM SystemUser WHERE IsDisabled=0 GROUP BY FullName HAVING COUNT(*)>1) x
UNION ALL SELECT 'dup_domain_tail_enabled', COUNT(*) FROM (SELECT LOWER(SUBSTRING(DomainName, CHARINDEX('\',DomainName)+1, 200)) t FROM SystemUser WHERE IsDisabled=0 GROUP BY LOWER(SUBSTRING(DomainName, CHARINDEX('\',DomainName)+1, 200)) HAVING COUNT(*)>1) x
UNION ALL SELECT 'dup_domain_tail_all', COUNT(*) FROM (SELECT LOWER(SUBSTRING(DomainName, CHARINDEX('\',DomainName)+1, 200)) t FROM SystemUser GROUP BY LOWER(SUBSTRING(DomainName, CHARINDEX('\',DomainName)+1, 200)) HAVING COUNT(*)>1) x;
SELECT T.Name, COUNT(TM.SystemUserId) members FROM Team T LEFT JOIN TeamMembership TM ON TM.TeamId=T.TeamId WHERE T.Name IN ('TopApproval','HeadEmp','HeadSalary','CareAdmin','CarePayroll','EditDeliver','ProjectAdmin','ChangeStatus') GROUP BY T.Name;

PRINT '== tasks';
SELECT new_approvestatus, statecode, COUNT(*) n FROM Task GROUP BY new_approvestatus, statecode ORDER BY 1,2;
SELECT TOP 15 o.Name regarding, COUNT(*) n FROM ActivityPointerBase a JOIN EntityView o ON o.ObjectTypeCode=a.RegardingObjectTypeCode WHERE a.ActivityTypeCode=4212 GROUP BY o.Name ORDER BY 2 DESC;

PRINT '== housing master';
SELECT (SELECT COUNT(*) FROM mw_housing) buildings, (SELECT COUNT(*) FROM mw_housingapartments) apartments;

PRINT '== attendance & invoice details';
SELECT COUNT(*) attendance_rows, MIN(createdon) mn, MAX(createdon) mx FROM new_attendance;
SELECT COUNT(*) invdetail, COUNT(DISTINCT new_invoiceid) invoices, SUM(CASE WHEN new_employeeid IS NULL THEN 1 ELSE 0 END) no_emp FROM new_invoicdetail;
SELECT YEAR(new_fromdate) y, COUNT(*) n FROM new_invoice GROUP BY YEAR(new_fromdate) ORDER BY 1;
