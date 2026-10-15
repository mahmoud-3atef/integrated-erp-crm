SET NOCOUNT ON;
SELECT TOP 12 t.Subject, COUNT(*) n, MIN(t.CreatedOn) first, MAX(t.CreatedOn) last FROM Task t JOIN EntityView e ON e.ObjectTypeCode=t.RegardingObjectTypeCode WHERE e.Name='new_deliverorder' AND t.CreatedOn>='2026-01-01' GROUP BY t.Subject ORDER BY n DESC;
SELECT TOP 12 t.Subject, COUNT(*) n FROM Task t JOIN EntityView e ON e.ObjectTypeCode=t.RegardingObjectTypeCode WHERE e.Name='mw_lodginorderdetails' AND t.CreatedOn>='2026-01-01' GROUP BY t.Subject ORDER BY n DESC;
SELECT TOP 12 t.Subject, COUNT(*) n FROM Task t JOIN EntityView e ON e.ObjectTypeCode=t.RegardingObjectTypeCode WHERE e.Name='new_invoice' AND t.CreatedOn>='2026-01-01' GROUP BY t.Subject ORDER BY n DESC;
SELECT TOP 12 t.Subject, COUNT(*) n FROM Task t JOIN EntityView e ON e.ObjectTypeCode=t.RegardingObjectTypeCode WHERE e.Name='hr_vicrequest' AND t.CreatedOn>='2025-01-01' GROUP BY t.Subject ORDER BY n DESC;
SELECT w.Name, w.StateCode, w.TriggerOnCreate, w.TriggerOnUpdateAttributeList, w.OnDemand, w.Scope FROM WorkflowBase w WHERE w.Type=1 AND w.PrimaryEntity=10066 AND w.Category=0 ORDER BY w.StateCode DESC, w.Name;
