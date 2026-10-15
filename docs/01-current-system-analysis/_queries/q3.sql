SET NOCOUNT ON;
PRINT '== WORKFLOWS (activated, definitions)';
SELECT w.PrimaryEntity, w.Name, w.Category, w.Mode, w.Scope, w.OnDemand, w.TriggerOnCreate, w.TriggerOnDelete, w.TriggerOnUpdateAttributeList, w.StateCode
FROM WorkflowBase w WHERE w.Type=1 AND w.StateCode=1 AND w.Category IN (0,2) ORDER BY w.PrimaryEntity, w.Name;
PRINT '== PLUGIN STEPS';
SELECT pa.Name AS asm, pt.TypeName, m.Name AS msg, f.PrimaryObjectTypeCode AS ent, s.Stage, s.Mode, s.StateCode, s.FilteringAttributes, s.Name
FROM SdkMessageProcessingStepBase s JOIN SdkMessageBase m ON m.SdkMessageId=s.SdkMessageId
LEFT JOIN SdkMessageFilterBase f ON f.SdkMessageFilterId=s.SdkMessageFilterId
JOIN PluginTypeBase pt ON pt.PluginTypeId=s.EventHandler JOIN PluginAssemblyBase pa ON pa.PluginAssemblyId=pt.PluginAssemblyId
WHERE s.IsHidden=0 AND pa.Name NOT LIKE 'Microsoft%' ORDER BY pa.Name, ent, msg;
PRINT '== ASSEMBLIES';
SELECT Name, Version, IsolationMode, SourceType, CreatedOn, ModifiedOn FROM PluginAssemblyBase WHERE Name NOT LIKE 'Microsoft%' AND ComponentState=0;
