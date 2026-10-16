import { TextField } from '@mui/material';

/** 6-digit one-time code input: digits only, numeric keyboard on phones, always left-to-right. */
export function CodeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      autoComplete="one-time-code"
      autoFocus
      required
      slotProps={{
        htmlInput: { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6, dir: 'ltr', style: { letterSpacing: '0.4em', textAlign: 'center', fontSize: '1.4rem' } },
      }}
    />
  );
}
