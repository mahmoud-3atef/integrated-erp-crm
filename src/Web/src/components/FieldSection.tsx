import { Box, Typography } from '@mui/material';
import { createContext, useContext, type ReactNode } from 'react';
import { tokens } from '../app/theme';

type SectionTone = 'teal' | 'green' | 'sky' | 'gold';

const sectionTones: Record<SectionTone, { border: string; icon: string; soft: string }> = {
  teal: { border: tokens.teal, icon: tokens.navy700, soft: tokens.navy50 },
  green: { border: '#1f9d55', icon: '#1f9d55', soft: '#e9f7ef' },
  sky: { border: tokens.info, icon: tokens.info, soft: '#e6f5fb' },
  gold: { border: tokens.gold, icon: tokens.gold, soft: '#fbf4dc' },
};

/**
 * A titled group of fields as in the portal's forms (.cp-sections fieldset.cp-box): a coloured border with the title
 * and an icon square sitting on it, and the fields in two columns.
 */
export function FieldSection({ title, icon, tone = 'teal', columns = 2, children }: { title: string; icon: ReactNode; tone?: SectionTone; columns?: 1 | 2; children: ReactNode }) {
  const look = sectionTones[tone];
  const inline = useContext(InlineFields);
  return (
    <Box
      component="fieldset"
      sx={{ m: 0, minWidth: 0, border: `1.5px solid ${look.border}`, borderRadius: `${tokens.radiusLg}px`, p: '20px 18px 14px', bgcolor: '#fff' }}
    >
      <Box component="legend" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, mx: 0.5 }}>
        <Box aria-hidden sx={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: '8px', bgcolor: look.icon, color: '#fff', '& svg': { fontSize: 17 } }}>
          {icon}
        </Box>
        <Typography component="span" sx={{ fontWeight: 800, fontSize: 14.5, color: tokens.navy800 }}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: inline ? (columns === 2 ? 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))' : '1fr') : { xs: '1fr', md: columns === 2 ? '1fr 1fr' : '1fr' }, gap: inline ? '10px 18px' : '14px 18px' }}>{children}</Box>
    </Box>
  );
}

/**
 * Inside, every field shows its label beside its value instead of above it (the worker file, the user's request of
 * 2026-10-25: «اسم الحقل جمب القيمة … عشان نقلل المسافات»). Other pages keep the label above.
 */
export const InlineFields = createContext(false);

/**
 * One field as in the portal (.cp-sec-field): an icon square, a small grey label, and the value in a soft box.
 * <paramref name="wide"/> spans both columns; <paramref name="highlight"/> is for totals (larger, tinted).
 */
export function FieldBox({ label, icon, children, wide, highlight, multiline, required, input }: { label: string; icon: ReactNode; children: ReactNode; wide?: boolean; highlight?: boolean; multiline?: boolean; required?: boolean; input?: boolean }) {
  const inline = useContext(InlineFields);
  return (
    <Box sx={{ display: 'flex', gap: inline ? 1 : 1.25, alignItems: inline && !multiline ? 'center' : 'flex-start', gridColumn: wide ? '1 / -1' : undefined, minWidth: 0 }}>
      <Box
        aria-hidden
        sx={{ flex: '0 0 auto', display: 'grid', placeItems: 'center', width: inline ? 30 : 34, height: inline ? 30 : 34, mt: inline ? (multiline ? '4px' : 0) : '18px', borderRadius: '10px', bgcolor: tokens.navy50, color: tokens.navy700, '& svg': { fontSize: inline ? 16 : 18 } }}
      >
        {icon}
      </Box>
      <Box sx={inline ? { flex: 1, minWidth: 0, display: 'flex', alignItems: multiline ? 'flex-start' : 'center', gap: 1.25 } : { flex: 1, minWidth: 0 }}>
        <Typography
          component={input ? 'label' : 'p'}
          sx={inline ? { flex: '0 0 104px', fontSize: 12, color: '#7b8a98', fontWeight: 600, lineHeight: 1.35, mt: multiline ? 1 : 0 } : { display: 'block', fontSize: 11.5, color: '#7b8a98', fontWeight: 600, mb: 0.5 }}
        >
          {label}
          {required && <Box component="span" sx={{ color: tokens.danger }}> *</Box>}
        </Typography>
        {input ? (
          <Box sx={{ ...inputLook, flex: 1, minWidth: 0 }}>{children}</Box>
        ) : (
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: inline ? 34 : 38,
            display: 'flex',
            alignItems: multiline ? 'flex-start' : 'center',
            px: 1.5,
            py: inline ? 0.6 : 0.9,
            border: '1px solid #e1e8ee',
            borderRadius: '10px',
            bgcolor: highlight ? '#e9f7ef' : '#f6f8fa',
            color: highlight ? '#1f9d55' : tokens.navy800,
            fontSize: highlight ? 18 : 14,
            fontWeight: 700,
            whiteSpace: multiline ? 'pre-wrap' : undefined,
            lineHeight: multiline ? 1.8 : 1.4,
            wordBreak: 'break-word',
          }}
        >
          {children}
        </Box>
        )}
      </Box>
    </Box>
  );
}

// An editable field keeps the look of a value box (soft background, light border, radius 10).
const inputLook = {
  '& .MuiInputBase-root': { bgcolor: '#f6f8fa', borderRadius: '10px', fontSize: 14, fontWeight: 600, color: tokens.navy800 },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e1e8ee' },
  '& .MuiInputBase-input': { py: 1 },
  '& .MuiInputBase-multiline': { py: 1 },
  '& .MuiInputBase-inputMultiline': { py: 0 },
};
