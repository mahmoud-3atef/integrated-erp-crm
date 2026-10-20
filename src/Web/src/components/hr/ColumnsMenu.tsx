import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import { Box, Button, Checkbox, Menu, MenuItem } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A grid's optional columns the viewer hides or shows, remembered in their browser (a per-viewer convenience: if the
 * storage is blocked the choice lasts for the page only).
 */
export function useHiddenColumns<K extends string>(storageKey: string, optional: readonly K[], hiddenByDefault: readonly K[] = []) {
  const [hidden, setHidden] = useState<K[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === null) return [...hiddenByDefault];
      const parsed = JSON.parse(saved) as unknown;
      return Array.isArray(parsed) ? (parsed.filter((k) => optional.includes(k as K)) as K[]) : [...hiddenByDefault];
    } catch {
      return [...hiddenByDefault];
    }
  });
  const toggle = (key: K) => {
    const next = hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
    setHidden(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // The choice lasts for this page only.
    }
  };
  return { shown: (key: K) => !hidden.includes(key), toggle };
}

/** The «columns» button: a menu of the optional columns, each with its group's name. */
export function ColumnsButton<K extends string>({ columns, shown, toggle }: { columns: { key: K; label: string; group?: string }[]; shown: (key: K) => boolean; toggle: (key: K) => void }) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button variant="outlined" size="small" startIcon={<ViewColumnOutlinedIcon />} onClick={(e) => setAnchor(e.currentTarget)} sx={{ height: 34, flex: '0 0 auto' }}>
        {t('common.columns')}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {columns.map((c) => (
          <MenuItem key={c.key} dense onClick={() => toggle(c.key)}>
            <Checkbox size="small" checked={shown(c.key)} sx={{ p: 0.25, marginInlineEnd: 1 }} />
            {c.label}
            {c.group && (
              <Box component="span" sx={{ color: 'text.secondary', fontSize: 12, marginInlineStart: 0.75 }}>
                · {c.group}
              </Box>
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
