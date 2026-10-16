import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { Box, Button, IconButton, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import type { ConditionGroup, ConditionRule, FieldType, Operator } from '../../api/workflow';
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

/** Rows of "field — operator — value", joined by AND (all) or OR (any). Only declared fields and fixed operators. */
export function ConditionEditor({ value, onChange }: { value: ConditionGroup; onChange: (value: ConditionGroup) => void }) {
  const { t, i18n } = useTranslation();
  const { screen, readOnly } = useEditor();

  const update = (index: number, change: Partial<ConditionRule>) =>
    onChange({ ...value, rules: value.rules.map((r, i) => (i === index ? { ...r, ...change } : r)) });

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
          const field = screen.fields.find((f) => f.key === rule.fieldKey);
          const operators = operatorsFor(field?.type);
          const needsValue = rule.operator !== 'IsEmpty' && rule.operator !== 'IsNotEmpty';
          return (
            <Stack key={index} direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ alignItems: { md: 'center' } }}>
              {index > 0 && (
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.navy600, minWidth: 28 }}>{value.matchAll ? t('process.and') : t('process.or')}</Typography>
              )}
              <TextField
                select
                size="small"
                label={t('process.field')}
                value={rule.fieldKey}
                disabled={readOnly}
                onChange={(e) => update(index, { fieldKey: e.target.value, operator: 'Equals', value: null, values: null })}
                sx={{ minWidth: 170 }}
              >
                {screen.fields.map((f) => (
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
                onChange={(e) => update(index, { operator: e.target.value as Operator, value: null, values: null })}
                sx={{ minWidth: 150 }}
              >
                {operators.map((op) => (
                  <MenuItem key={op} value={op}>
                    {t(`process.op.${op}`)}
                  </MenuItem>
                ))}
              </TextField>
              {needsValue && rule.operator !== 'In' && (
                <Box sx={{ flex: 1, minWidth: 160 }}>
                  <FieldValueInput field={field} value={rule.value} label={t('process.value')} onChange={(v) => update(index, { value: v })} />
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
