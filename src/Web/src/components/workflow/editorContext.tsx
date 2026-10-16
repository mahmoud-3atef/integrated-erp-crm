import { MenuItem, TextField } from '@mui/material';
import { createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import type { LegalEntityRecord } from '../../api/setup';
import type { ApproverOptions, RecordField, Screen } from '../../api/workflow';

/** What every part of the process editor needs: the screen's fields and the people, roles and registrations to pick. */
export interface EditorData {
  screen: Screen;
  options: ApproverOptions;
  legalEntities: LegalEntityRecord[];
  readOnly: boolean;
}

export const EditorContext = createContext<EditorData | null>(null);

export function useEditor(): EditorData {
  const data = useContext(EditorContext);
  if (!data) {
    throw new Error('useEditor must be used inside the process editor');
  }
  return data;
}

export function useFieldLabel() {
  const { i18n } = useTranslation();
  const { screen } = useEditor();
  return (key: string | null | undefined) => {
    const field = screen.fields.find((f) => f.key === key);
    return field ? localName(field, i18n.language) : (key ?? '');
  };
}

/** Shows a stored value in words (choice name, user name, registration code). */
export function useValueLabel() {
  const { t, i18n } = useTranslation();
  const { options, legalEntities } = useEditor();
  return (field: RecordField | undefined, value: string | null | undefined) => {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    switch (field?.type) {
      case 'Choice': {
        const option = field.options?.find((o) => o.value === value);
        return option ? localName(option, i18n.language) : value;
      }
      case 'User':
        return options.members.find((m) => m.userAccountId === value)?.displayName ?? value;
      case 'LegalEntity':
        return legalEntities.find((e) => e.id === value)?.code ?? value;
      case 'Boolean':
        return value === 'true' ? t('common.yes') : t('common.no');
      default:
        return value;
    }
  };
}

/** The right input for a field's type; values are invariant strings, as the server stores them. */
export function FieldValueInput({ field, value, onChange, label }: { field: RecordField | undefined; value: string | null | undefined; onChange: (value: string) => void; label: string }) {
  const { t, i18n } = useTranslation();
  const { options, legalEntities, readOnly } = useEditor();
  const common = { size: 'small' as const, label, value: value ?? '', disabled: readOnly || !field, onChange: (e: { target: { value: string } }) => onChange(e.target.value) };

  switch (field?.type) {
    case 'Choice':
      return (
        <TextField select {...common}>
          {(field.options ?? []).map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {localName(o, i18n.language)}
            </MenuItem>
          ))}
        </TextField>
      );
    case 'User':
      return (
        <TextField select {...common}>
          {options.members.map((m) => (
            <MenuItem key={m.userAccountId} value={m.userAccountId}>
              {m.displayName}
            </MenuItem>
          ))}
        </TextField>
      );
    case 'LegalEntity':
      return (
        <TextField select {...common}>
          {legalEntities.map((e) => (
            <MenuItem key={e.id} value={e.id}>{`${e.code} — ${localName(e, i18n.language)}`}</MenuItem>
          ))}
        </TextField>
      );
    case 'Boolean':
      return (
        <TextField select {...common}>
          <MenuItem value="true">{t('common.yes')}</MenuItem>
          <MenuItem value="false">{t('common.no')}</MenuItem>
        </TextField>
      );
    case 'Date':
      return <TextField {...common} type="date" slotProps={{ inputLabel: { shrink: true } }} />;
    case 'Number':
    case 'Money':
      return <TextField {...common} onChange={(e) => onChange(e.target.value.replace(/[^\d.-]/g, ''))} slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal' } }} />;
    default:
      return <TextField {...common} />;
  }
}
