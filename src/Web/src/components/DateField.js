import { jsx as _jsx } from "react/jsx-runtime";
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { useState } from 'react';
const day = (value) => {
    const d = value ? dayjs(value) : null;
    return d && d.isValid() ? d : null;
};
/**
 * The one date field of the system: a calendar that opens from the field (today and clear in its bar), typed or
 * picked, in the language of the screen (the LocalizationProvider in App). Its value and changes are ISO days.
 */
export function DateField({ label, value, onChange, required, error, helperText, size, fullWidth, disabled, autoFocus, pickOnly, sx, slotProps }) {
    const [open, setOpen] = useState(false);
    const min = day(slotProps?.htmlInput?.min);
    const max = day(slotProps?.htmlInput?.max);
    return (_jsx(DatePicker, { label: label, value: day(value), onChange: (d) => onChange?.({ target: { value: d && d.isValid() ? d.format('YYYY-MM-DD') : '' } }), format: "YYYY/MM/DD", disabled: disabled, autoFocus: autoFocus, ...(min ? { minDate: min } : {}), ...(max ? { maxDate: max } : {}), ...(pickOnly ? { open, onOpen: () => setOpen(true), onClose: () => setOpen(false) } : {}), slotProps: {
            textField: { size, fullWidth, required, error, helperText, sx, ...(pickOnly ? { onClick: () => !disabled && setOpen(true) } : {}) },
            actionBar: { actions: required || pickOnly ? ['today', 'accept'] : ['clear', 'today', 'accept'] },
            field: { clearable: !required && !pickOnly, ...(pickOnly ? { readOnly: true } : {}) },
        } }));
}
