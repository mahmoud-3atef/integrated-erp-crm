import AddIcon from '@mui/icons-material/Add';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Button, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workflowApi, type InternalRequest, type RequestStatus } from '../../api/workflow';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { EmptyState, PageHeader, Panel, StatusDot, type Tone } from '../../components/ui';
import { PillTabs } from './TasksPage';

export const requestTone: Record<RequestStatus, Tone> = { Draft: 'neutral', InApproval: 'info', Approved: 'success', Rejected: 'danger', Returned: 'warning' };

export function RequestsPage() {
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const navigate = useNavigate();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [rows, setRows] = useState<InternalRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canCreate = can('workflow.requests.create');
  const canSeeAll = can('workflow.requests.view');

  const load = useCallback(async () => {
    try {
      setRows(await workflowApi.requests(scope === 'all'));
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'Asia/Riyadh' }).format(new Date(value));
  const money = (value: number) => new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

  return (
    <Box>
      <PageHeader
        title={t('requests.title')}
        subtitle={t('requests.intro')}
        actions={
          canCreate && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/workflow/requests/new')}>
              {t('requests.new')}
            </Button>
          )
        }
      />
      {canSeeAll && (
        <PillTabs
          value={scope}
          onChange={setScope}
          options={[
            { value: 'mine', label: t('requests.mine') },
            { value: 'all', label: t('requests.all') },
          ]}
        />
      )}
      <ErrorMessage messageKey={error} />
      <Panel>
        <TableContainer sx={{ borderRadius: '6px' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('requests.number')}</TableCell>
                <TableCell>{t('requests.subject')}</TableCell>
                <TableCell>{t('requests.amount')}</TableCell>
                <TableCell>{t('requests.createdBy')}</TableCell>
                <TableCell>{t('common.status')}</TableCell>
                <TableCell align="center">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/workflow/requests/${row.id}`)}>
                  <TableCell sx={{ fontWeight: 600, color: tokens.navy800 }} dir="ltr">
                    {row.number}
                  </TableCell>
                  <TableCell sx={{ color: tokens.gray900, whiteSpace: 'normal', minWidth: 200 }}>{row.subject}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{row.amount === null ? '—' : money(row.amount)}</TableCell>
                  <TableCell>
                    {row.createdByName}
                    <Box sx={{ fontSize: 11.5, color: tokens.gray500 }}>{date(row.createdAt)}</Box>
                  </TableCell>
                  <TableCell>
                    <StatusDot tone={requestTone[row.status]} label={t(`requests.status.${row.status}`)} />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={t('tasks.open')}>
                      <IconButton size="small" aria-label={`${t('tasks.open')} ${row.number}`}>
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {rows.length === 0 && <EmptyState text={t('requests.empty')} />}
      </Panel>
    </Box>
  );
}
