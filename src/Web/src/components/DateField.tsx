import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import type { SxProps, Theme } from '@mui/material';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';

/** A change in the same shape as a date text field's, so the forms keep their handlers. */
export type DateChange = { target: { value: string } };

export interface DateFieldProps {
  label?: ReactNode;
  /** The day as "YYYY-MM-DD" (empty or null: none). */
  value: string | null | undefined;
  onChange?: (change: DateChange) => void;
  required?: boolean;
  error?: boolean;
  helperText?: ReactNode;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  sx?: SxProps<Theme>;
  /** As a date text field takes them: the first and last days that can be picked (min/max on htmlInput). */
  slotProps?: { htmlInput?: { min?: string; max?: string }; inputLabel?: unknown };
}

const day = (value: string | null | undefined) => {
  const d = value ? dayjs(value) : null;
  return d && d.isValid() ? d : null;
};

/**
 * The one date field of the system: a calendar that opens from the field (today and clear in its bar), typed or
 * picked, in the language of the screen (the LocalizationProvider in App). Its value and changes are ISO days.
 */
export function DateField({ label, value, onChange, required, error, helperText, size, fullWidth, disabled, autoFocus, sx, slotProps }: DateFieldProps) {
  const min = day(slotProps?.htmlInput?.min);
  const max = day(slotProps?.htmlInput?.max);
  return (
    <DatePicker
      label={label}
      value={day(value)}
      onChange={(d) => onChange?.({ target: { value: d && d.isValid() ? d.format('YYYY-MM-DD') : '' } })}
      format="YYYY/MM/DD"
      disabled={disabled}
      autoFocus={autoFocus}
      {...(min ? { minDate: min } : {})}
      {...(max ? { maxDate: max } : {})}
      slotProps={{
        textField: { size, fullWidth, required, error, helperText, sx },
        actionBar: { actions: required ? ['today', 'accept'] : ['clear', 'today', 'accept'] },
        field: { clearable: !required },
      }}
    />
  );
}
