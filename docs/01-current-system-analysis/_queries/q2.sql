SET NOCOUNT ON;
SELECT e.Name AS ent, s.AttributeName AS attr, s.AttributeValue AS val,
 MAX(CASE WHEN s.LangId=1025 THEN s.Value END) AS ar, MAX(CASE WHEN s.LangId=1033 THEN s.Value END) AS en
FROM StringMap s JOIN EntityView e ON e.ObjectTypeCode=s.ObjectTypeCode
WHERE e.Name IN ('new_employee','new_project','mw_lodginorderdetails','new_invoice','new_invoicdetail','new_empwork','new_attendance','new_deliverorder','new_leaverequest','mw_housing','mw_housingapartments','hr_vicrequest','new_candidate','new_agent','new_ajeercontract','task')
GROUP BY e.Name, s.AttributeName, s.AttributeValue ORDER BY 1,2,3;
