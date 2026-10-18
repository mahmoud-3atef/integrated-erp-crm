import CloseIcon from '@mui/icons-material/Close';
import MultipleStopOutlinedIcon from '@mui/icons-material/MultipleStopOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { keyframes } from '@emotion/react';
import { Box, Button, Dialog, IconButton, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { movementsApi, type MovementDetail } from '../../../api/movements';
import { tokens } from '../../../app/theme';
import { MovementWizard } from './MovementFormPage';
import { gradient, Transition, TypeIcon, useStateName } from './movementMeta';

const pop = keyframes`
  0% { opacity: 0; transform: translateY(18px) scale(.97); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
`;

const tick = keyframes`
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); }
`;

/**
 * "New action" as a popup (as on the old system's worker page): the wizard in a dialog with the worker in its header,
 * then a confirmation of what was sent. From a worker's or an employee's page the worker is already chosen.
 */
export function ActionDialog({ workerId, workerName, workerNo, onClose, onSent }: { workerId?: string; workerName?: string; workerNo?: string; onClose: () => void; onSent?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('md'));
  const stateName = useStateName();
  const [sent, setSent] = useState<MovementDetail | null>(null);

  const saved = async (id: string) => {
    onSent?.();
    try {
      setSent(await movementsApi.get(id));
    } catch {
      navigate(`/operations/movements/${id}`);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      fullScreen={phone}
      slotProps={{ paper: { sx: { borderRadius: phone ? 0 : '22px', overflow: 'hidden', bgcolor: tokens.gray50, animation: `${pop} .35s cubic-bezier(.2,.8,.2,1) both` } } }}
    >
      {/* The header: what this is, and for whom. */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
          px: { xs: 2.5, md: 3.5 },
          py: 2.5,
          color: '#fff',
          background: sent ? gradient(sent.type) : 'linear-gradient(120deg, #0b3954 0%, #0d6e8c 60%, #1aa39a 100%)',
          transition: 'background .4s ease',
          '&::after': { content: '""', position: 'absolute', width: 260, height: 260, borderRadius: '50%', top: -150, insetInlineEnd: -60, background: 'rgba(255,255,255,.09)' },
        }}
      >
        <Stack direction="row" sx={{ position: 'relative', zIndex: 1, alignItems: 'center', gap: 1.75 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: '30%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.18)', '& svg': { fontSize: 26 } }}>
            <MultipleStopOutlinedIcon />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 19, fontWeight: 800 }}>{t('movements.new')}</Typography>
            <Typography sx={{ fontSize: 13, opacity: 0.88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {workerName ? (
                <>
                  {workerName} · <span dir="ltr">{workerNo}</span>
                </>
              ) : (
                t('movements.wizardHint')
              )}
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label={t('common.close')} sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,.14)', '&:hover': { bgcolor: 'rgba(255,255,255,.26)' } }}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </Box>

      <Box sx={{ p: { xs: 2, md: 3 }, overflowY: 'auto' }}>
        {!sent && <MovementWizard workerId={workerId} inDialog onSaved={(id) => void saved(id)} />}

        {/* Sent: what happens next. */}
        {sent && (
          <Box sx={{ py: { xs: 3, md: 5 }, textAlign: 'center', animation: `${pop} .4s ease both` }}>
            <Box sx={{ mx: 'auto', mb: 2, width: 84, height: 84, borderRadius: '50%', display: 'grid', placeItems: 'center', background: gradient(sent.type), animation: `${tick} .55s cubic-bezier(.2,.8,.2,1) both` }}>
              <TypeIcon type={sent.type} size={56} />
            </Box>
            <Typography sx={{ fontSize: 21, fontWeight: 800, color: tokens.navy800 }}>{t('movements.sentTitle')}</Typography>
            <Typography sx={{ fontSize: 13.5, color: tokens.gray600, mb: 3 }}>
              {t(`movements.types.${sent.type}`)} · <b dir="ltr">{sent.movementNo}</b> · {t('movements.sentHint')}
            </Typography>
            <Box sx={{ maxWidth: 620, mx: 'auto', p: 2.5, borderRadius: `${tokens.radius + 4}px`, bgcolor: '#fff', border: `1px solid ${tokens.gray100}`, mb: 3 }}>
              <Transition
                big={!phone}
                from={sent.fromPlacement}
                fromLabel={stateName(sent.fromPlacement)}
                fromSub={sent.fromProjectName}
                to={sent.opensPeriod}
                toLabel={stateName(sent.opensPeriod)}
                toSub={sent.opensPeriod === 'Work' || sent.opensPeriod === 'ClientVacation' ? (sent.projectName ?? sent.fromProjectName) : sent.place}
              />
            </Box>
            <Stack direction="row" sx={{ justifyContent: 'center', gap: 1.5 }}>
              <Button variant="contained" endIcon={<OpenInNewIcon />} onClick={() => navigate(`/operations/movements/${sent.id}`)} sx={{ background: gradient(sent.type), px: 3 }}>
                {t('movements.openSent')}
              </Button>
              <Button variant="outlined" onClick={onClose} sx={{ px: 3 }}>
                {t('common.close')}
              </Button>
            </Stack>
          </Box>
        )}
      </Box>
    </Dialog>
  );
}
