import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { setupApi, type ModuleStatus } from '../../api/setup';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { PageHeader, StatusDot } from '../../components/ui';

/** Modules of this installation and whether each is switched on (Modules:{Name}:Enabled in the settings). */
export function ModulesPage() {
  const { t, i18n } = useTranslation();
  const [modules, setModules] = useState<ModuleStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setupApi.modules().then(setModules).catch((failure: unknown) => setError(errorKey(failure)));
  }, []);

  const text = (name: string, part: 'name' | 'description') => (i18n.exists(`modules.${name}.${part}`) ? t(`modules.${name}.${part}`) : part === 'name' ? name : '');

  return (
    <Box>
      <PageHeader title={t('modules.title')} subtitle={t('modules.intro')} />
      <ErrorMessage messageKey={error} />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: `${tokens.gap}px` }}>
        {modules.map((module) => (
          <Box
            key={module.name}
            sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, p: 2.5, pb: 1.75, bgcolor: '#fff', borderRadius: `${tokens.radius}px`, boxShadow: tokens.shadowSm }}
          >
            <ExtensionOutlinedIcon sx={{ fontSize: 30, color: tokens.navy700, mb: 1.5 }} />
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: tokens.navy800 }}>{text(module.name, 'name')}</Typography>
            <Typography sx={{ fontSize: 12.5, color: tokens.gray600, flex: 1 }}>{text(module.name, 'description')}</Typography>
            <Box sx={{ pt: 1, mt: 0.5, borderTop: `1px solid ${tokens.border}` }}>
              <StatusDot tone={module.enabled ? 'success' : 'neutral'} label={module.enabled ? t('modules.enabled') : t('modules.disabled')} />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
