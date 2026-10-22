import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { Box, Button, IconButton, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import { workflowApi, type ConditionGroup, type ConditionRule, type FieldType, type Operator } from '../../api/workflow';
import { tokens } from '../../app/theme';
import { FieldValueInput, useEditor } from './editorContext';

const operatorsFor = (type: FieldType | undefined): Operator[] => {
  const base: Operator[] = ['Equals', 'NotEquals', 'IsEmpty', 'IsNotEmpty'];
  if (type === 'Number' || type === 'Money' || type === 'Date') {
    return ['Equals', 'NotEquals', 'GreaterThan', 'GreaterOrEqual', 'LessThan', 'LessOrEqual', 'IsEmpty', 'IsNotEmpty'];
  }
  if (type === 'Choice') {
    return [...base.slice(0, 2), 'In', ...base.slice(2)];
  }
  return base;
};

/**
 * Rows of "table — field — operator — value", joined by AND (all) or OR (any): the table is the record itself or one of
 * its related tables (e.g. a transfer order's new project), and the field one of that table's. Only declared fields and
 * fixed operators.
 */
export function ConditionEditor({ value, onChange }: { value: ConditionGroup; onChange: (value: ConditionGroup) => void }) {
  const { t, i18n } = useTranslation();
  const { screen, readOnly } = useEditor();

  // Rules whose value is picked from the field's values (a list) rather than typed.
  const [picking, setPicking] = useState<Record<number, boolean>>({});
  const update = (index: number, change: Partial<ConditionRule>) =>
    onChange({ ...value, rules: value.rules.map((r, i) => (i === index ? { ...r, ...change } : r)) });
  const relations = screen.relations ?? [];
  const fieldsOf = (relation: string | null | undefined) => (relation ? (relations.find((r) => r.key === relation)?.fields ?? []) : screen.fields);
  const tables = [{ key: '', label: t('process.thisRecord') }, ...relations.map((r) => ({ key: r.key, label: localName(r, i18n.language) }))];
  // The first field of the same type: of the record, else of a related table (what a dynamic value starts with).
  const firstOfType = (type: FieldType | undefined, except: string) => {
    for (const table of tables) {
      const match = fieldsOf(table.key || null).find((f) => f.type === type && `${table.key}.${f.key}` !== except);
      if (match) return { valueFromRelation: table.key || null, valueFromField: match.key };
    }
    return null;
  };

  return (
    <Box>
      {value.rules.length > 1 && (
        <ToggleButtonGroup
          size="small"
          exclusive
          value={value.matchAll ? 'all' : 'any'}
          onChange={(_, v: string | null) => v && onChange({ ...value, matchAll: v === 'all' })}
          disabled={readOnly}
          sx={{ mb: 1 }}
        >
          <ToggleButton value="all">{t('process.matchAll')}</ToggleButton>
          <ToggleButton value="any">{t('process.matchAny')}</ToggleButton>
        </ToggleButtonGroup>
      )}
      <Stack spacing={1}>
        {value.rules.map((rule, index) => {
          const tableFields = fieldsOf(rule.relation);
          const field = tableFields.find((f) => f.key === rule.fieldKey);
          const operators = operatorsFor(field?.type);
          const needsValue = rule.operator !== 'IsEmpty' && rule.operator !== 'IsNotEmpty';
          const self = `${rule.relation ?? ''}.${rule.fieldKey}`;
          const dynamic = !!rule.valueFromField && rule.operator !== 'In';
          // A text field: its value can be picked among those it holds in the data (a list), or typed.
          const listable = field?.type === 'Text';
          const canBeDynamic = needsValue && rule.operator !== 'In' && firstOfType(field?.type, self) !== null;
          return (
            <Stack key={index} direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ alignItems: { md: 'center' } }}>
              {index > 0 && (
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.navy600, minWidth: 28 }}>{value.matchAll ? t('process.and') : t('process.or')}</Typography>
              )}
              {relations.length > 0 && (
                <TextField
                  select
                  size="small"
                  label={t('process.table')}
                  value={rule.relation ?? ''}
                  disabled={readOnly}
                  slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                  onChange={(e) => {
                    const relation = e.target.value || null;
                    update(index, { relation, fieldKey: fieldsOf(relation)[0]?.key ?? '', operator: 'Equals', value: null, values: null, valueFromField: null, valueFromRelation: null });
                  }}
                  sx={{ minWidth: 170 }}
                >
                  <MenuItem value="">{t('process.thisRecord')}</MenuItem>
                  {relations.map((r) => (
                    <MenuItem key={r.key} value={r.key}>
                      {localName(r, i18n.language)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              <TextField
                select
                size="small"
                label={t('process.field')}
                value={rule.fieldKey}
                disabled={readOnly}
                onChange={(e) => update(index, { fieldKey: e.target.value, operator: 'Equals', value: null, values: null, valueFromField: null, valueFromRelation: null })}
                sx={{ minWidth: 170 }}
              >
                {tableFields.map((f) => (
                  <MenuItem key={f.key} value={f.key}>
                    {localName(f, i18n.language)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label={t('process.operator')}
                value={operators.includes(rule.operator) ? rule.operator : 'Equals'}
                disabled={readOnly}
                onChange={(e) => {
                  const op = e.target.value as Operator;
                  // «In» and the empty tests take no other field.
                  const keep = op === 'In' || op === 'IsEmpty' || op === 'IsNotEmpty' ? { valueFromField: null, valueFromRelation: null } : {};
                  update(index, { operator: op, value: null, values: null, ...keep });
                }}
                sx={{ minWidth: 150 }}
              >
                {operators.map((op) => (
                  <MenuItem key={op} value={op}>
                    {t(`process.op.${op}`)}
                  </MenuItem>
                ))}
              </TextField>
              {canBeDynamic && (
                <TextField
                  select
                  size="small"
                  label={t('process.valueFrom')}
                  value={dynamic ? 'field' : (picking[index] ?? false) ? 'list' : 'value'}
                  disabled={readOnly}
                  onChange={(e) => {
                    setPicking((p) => ({ ...p, [index]: e.target.value === 'list' }));
                    update(
                      index,
                      e.target.value === 'field' ? { ...firstOfType(field?.type, self), value: null, values: null } : { valueFromField: null, valueFromRelation: null },
                    );
                  }}
                  sx={{ minWidth: 150 }}
                >
                  <MenuItem value="value">
                    {field?.type === 'User' ? t('process.valueUser') : field?.type === 'Choice' || field?.type === 'Boolean' ? t('process.valueList') : t('process.valueFixed')}
                  </MenuItem>
                  {listable && <MenuItem value="list">{t('process.valueList')}</MenuItem>}
                  <MenuItem value="field">{t('process.valueField')}</MenuItem>
                </TextField>
              )}
              {needsValue && dynamic && (
                <>
                  {relations.length > 0 && (
                    <TextField
                      select
                      size="small"
                      label={t('process.valueTable')}
                      value={rule.valueFromRelation ?? ''}
                      disabled={readOnly}
                      slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                      onChange={(e) => {
                        const table = e.target.value || null;
                        const first = fieldsOf(table).find((f) => f.type === field?.type && `${table ?? ''}.${f.key}` !== self);
                        update(index, { valueFromRelation: table, valueFromField: first?.key ?? null });
                      }}
                      sx={{ minWidth: 170 }}
                    >
                      {tables
                        .filter((tb) => fieldsOf(tb.key || null).some((f) => f.type === field?.type && `${tb.key}.${f.key}` !== self))
                        .map((tb) => (
                          <MenuItem key={tb.key} value={tb.key}>
                            {tb.label}
                          </MenuItem>
                        ))}
                    </TextField>
                  )}
                  <TextField
                    select
                    size="small"
                    label={t('process.valueFieldName')}
                    value={rule.valueFromField ?? ''}
                    disabled={readOnly}
                    onChange={(e) => update(index, { valueFromField: e.target.value })}
                    sx={{ flex: 1, minWidth: 170 }}
                  >
                    {fieldsOf(rule.valueFromRelation)
                      .filter((f) => f.type === field?.type && `${rule.valueFromRelation ?? ''}.${f.key}` !== self)
                      .map((f) => (
                        <MenuItem key={f.key} value={f.key}>
                          {localName(f, i18n.language)}
                        </MenuItem>
                      ))}
                  </TextField>
                </>
              )}
              {needsValue && !dynamic && rule.operator !== 'In' && listable && picking[index] && (
                <FieldValuesPicker screen={screen.code} relation={rule.relation} field={rule.fieldKey} value={rule.value ?? null} disabled={readOnly} onChange={(v) => update(index, { value: v })} />
              )}
              {needsValue && !dynamic && rule.operator !== 'In' && !(listable && picking[index]) && (
                <Box sx={{ flex: 1, minWidth: 160 }}>
                  <FieldValueInput field={field} value={rule.value} label={field?.type === 'User' ? t('process.valueUser') : t('process.value')} onChange={(v) => update(index, { value: v })} />
                </Box>
              )}
              {rule.operator === 'In' && field?.options && (
                <TextField
                  select
                  size="small"
                  label={t('process.values')}
                  disabled={readOnly}
                  value={rule.values ?? []}
                  onChange={(e) => update(index, { values: typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]) })}
                  slotProps={{ select: { multiple: true } }}
                  sx={{ flex: 1, minWidth: 160 }}
                >
                  {field.options.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {localName(o, i18n.language)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              {!readOnly && (
                <IconButton size="small" onClick={() => onChange({ ...value, rules: value.rules.filter((_, i) => i !== index) })} aria-label={t('process.removeRule')}>
                  <DeleteOutlinedIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          );
        })}
      </Stack>
      {!readOnly && (
        <Button
          size="small"
          startIcon={<AddIcon />}
          sx={{ mt: 1 }}
          onClick={() => onChange({ ...value, rules: [...value.rules, { fieldKey: screen.fields[0]?.key ?? '', operator: 'Equals', value: null }] })}
        >
          {t('process.addRule')}
        </Button>
      )}
    </Box>
  );
}

/** The values a text field holds in its table (the record's or a related one), to pick one instead of typing it. */
function FieldValuesPicker({ screen, relation, field, value, disabled, onChange }: { screen: string; relation: string | null | undefined; field: string; value: string | null; disabled: boolean; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const [values, setValues] = useState<string[] | null>(null);
  useEffect(() => {
    let live = true;
    setValues(null);
    workflowApi
      .fieldValues(screen, relation, field)
      .then((v) => live && setValues(v))
      .catch(() => live && setValues([]));
    return () => {
      live = false;
    };
  }, [screen, relation, field]);
  const options = values ?? [];
  return (
    <TextField
      select
      size="small"
      label={t('process.value')}
      value={value && options.includes(value) ? value : ''}
      disabled={disabled || values === null}
      helperText={values !== null && options.length === 0 ? t('process.noFieldValues') : undefined}
      onChange={(e) => onChange(e.target.value)}
      sx={{ flex: 1, minWidth: 180 }}
    >
      {value && !options.includes(value) && <MenuItem value={value}>{value}</MenuItem>}
      {options.map((v) => (
        <MenuItem key={v} value={v}>
          {v}
        </MenuItem>
      ))}
    </TextField>
  );
}
