SET NOCOUNT ON;
SELECT e.Name AS ent, a.Name AS attr, t.Description AS typ, a.Length, a.IsCustomField,
 (SELECT TOP 1 l.Label FROM LocalizedLabelView l WHERE l.ObjectId=a.AttributeId AND l.ObjectColumnName='DisplayName' AND l.LanguageId=1025) AS ar,
 (SELECT TOP 1 l.Label FROM LocalizedLabelView l WHERE l.ObjectId=a.AttributeId AND l.ObjectColumnName='DisplayName' AND l.LanguageId=1033) AS en,
 (SELECT TOP 1 re.Name FROM RelationshipView r JOIN EntityView re ON re.EntityId=r.ReferencedEntityId WHERE r.ReferencingAttributeId=a.AttributeId) AS target
FROM AttributeView a JOIN EntityView e ON e.EntityId=a.EntityId JOIN AttributeTypes t ON t.AttributeTypeId=a.AttributeTypeId
WHERE e.Name IN ('new_employee','new_project','mw_lodginorderdetails','new_invoice','new_invoicdetail','new_empwork','new_attendance','new_deliverorder','new_leaverequest','mw_housing','mw_housingapartments','hr_vicrequest','new_candidate','new_thijridate','new_profession','new_country','new_agent','new_attachments','new_ajeercontract','new_projtransfer','new_laborsback','new_replacelabor')
 AND (a.IsCustomField=1 OR a.Name IN ('statuscode','statecode','createdon','createdby','ownerid','modifiedon'))
 AND a.AttributeOf IS NULL AND a.IsLogical=0
ORDER BY e.Name, a.Name;
