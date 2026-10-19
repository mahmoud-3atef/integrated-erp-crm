import Add from '@mui/icons-material/Add';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import { Box, Button, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { payrollApi, type PayrollRunItem } from '../../api/payroll';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrEmptyState, HrPageHeader, HrScope, hr, hrCard } from '../../components/hr/Hr';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { money, RunStatusBadge, useMonthName } from './payroll';
import { NewRunDialog, SponsorsDialog, useLegalEntities } from './RunDialogs';

/** The payroll runs of the company's workers, latest first, by commercial registration. */
export function PayrollRunsPage({ creating = false }: { creating?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const { date } = useCommercialFormat();
  const monthName = useMonthName();
  const entities = useLegalEntities();
  const [entity, setEntity] = useState('');
  const [runs, setRuns] = useState<PayrollRunItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newRun, setNewRun] = useState(creating);
  const [sponsors, setSponsors] = useState(false);
  const canManage = can('payroll.workers.manage', true);

  const reload = useCallback(async () => {
    try {
      setRuns(await payrollApi.runs(entity || undefined));
      setError(null);
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [entity]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <HrScope>
      <HrPageHeader
        icon={<RequestQuoteOutlinedIcon />}
        title={t('payroll.title')}
        subtitle={t('payroll.intro')}
        actions={
          <>
            {can('payroll.settings.manage', true) && (
              <Button variant="outlined" startIcon={<LinkOutlinedIcon />} onClick={() => setSponsors(true)}>
                {t('payroll.sponsors')}
              </Button>
            )}
            {canManage && (
              <Button variant="contained" startIcon={<Add />} onClick={() => setNewRun(true)}>
                {t('payroll.new')}
              </Button>
            )}
          </>
        }
      />
      <ErrorMessage messageKey={error} />
      <Box sx={{ ...(hrCard as object), p: 2 }}>
        <Stack direction="row" sx={{ mb: 1.5, gap: 1 }}>
          <TextField
            select
            size="small"
            label={t('payroll.cols.legalEntity')}
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            sx={{ width: 300 }}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          >
            <MenuItem value="">{t('payroll.all')}</MenuItem>
            {entities.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {localName(e, i18n.language)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        {runs === null ? (
          <LinearProgress />
        ) : runs.length === 0 ? (
          <HrEmptyState
            icon={<RequestQuoteOutlinedIcon />}
            title={t('payroll.empty')}
            hint={t('payroll.emptyHint')}
            action={
              canManage && (
                <Button variant="contained" startIcon={<Add />} onClick={() => setNewRun(true)}>
                  {t('payroll.new')}
                </Button>
              )
            }
          />
        ) : (
          <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
            <Table size="small" sx={{ '& th': { bgcolor: hr.muted, color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }, '& td': { height: 46 } }}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('payroll.cols.run')}</TableCell>
                  <TableCell>{t('payroll.cols.legalEntity')}</TableCell>
                  <TableCell>{t('payroll.cols.period')}</TableCell>
                  <TableCell align="right">{t('payroll.cols.workers')}</TableCell>
                  <TableCell align="right">{t('payroll.cols.excluded')}</TableCell>
                  <TableCell align="right">{t('payroll.cols.net')}</TableCell>
                  <TableCell>{t('payroll.cols.status')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/payroll/runs/${r.id}`)}>
                    <TableCell>
                      <Box sx={{ fontWeight: 700, color: hr.text }}>{monthName(r.to)}</Box>
                      <Box component="bdi" sx={{ fontSize: 12, color: hr.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                        {r.runNo}
                      </Box>
                    </TableCell>
                    <TableCell>{r.legalEntityName}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <bdi>
                        {date(r.from)} – {date(r.to)}
                      </bdi>
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {r.workers.toLocaleString('en-US')}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: r.excluded ? '#B45309' : hr.textMuted }}>
                      {r.excluded.toLocaleString('en-US')}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {money(r.net)}
                    </TableCell>
                    <TableCell>
                      <RunStatusBadge status={r.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
      <NewRunDialog
        open={newRun}
        defaultEntity={entity || undefined}
        onClose={() => {
          setNewRun(false);
          if (creating) navigate('/payroll/runs');
        }}
        onCreated={(id) => navigate(`/payroll/runs/${id}`)}
        onLinkSponsors={() => setSponsors(true)}
      />
      <SponsorsDialog open={sponsors} onClose={() => setSponsors(false)} />
    </HrScope>
  );
}
