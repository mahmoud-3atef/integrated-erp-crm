import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { PackageRow, WorkerPrice, WorkerPriceKind } from '../../api/commercial';
import { tokens } from '../../app/theme';
import { Badge, type Tone } from '../../components/ui';
import { useCommercialFormat } from './ProjectsPage';

const kindTone: Record<WorkerPriceKind, Tone> = { Package: 'success', Special: 'warning', Missing: 'danger' };

export const money = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** The package's monthly price: a fixed total, or "salary + fee" on Cost Plus. */
export function PackagePrice({ row }: { row: PackageRow }) {
  const { t } = useTranslation();
  return row.basis === 'FixedTotal' ? (
    <Typography component="span" sx={{ fontWeight: 800, color: tokens.navy800 }}>
      {money(row.totalPrice)}
    </Typography>
  ) : (
    <Typography component="span" sx={{ fontWeight: 800, color: tokens.navy800 }}>
      {t('commercial.prices.salaryPlus', { fee: money(row.serviceFee) })}
    </Typography>
  );
}

/** "Housing 200 · Transport 100" under a price, when the price has those parts. */
function PriceParts({ housing, transport }: { housing: number; transport: number }) {
  const { t } = useTranslation();
  const parts = [housing ? `${t('commercial.prices.col.housing')} ${money(housing)}` : null, transport ? `${t('commercial.prices.col.transport')} ${money(transport)}` : null].filter(Boolean);
  return parts.length ? <Typography sx={{ fontSize: 11.5, color: tokens.gray500, whiteSpace: 'nowrap' }}>{parts.join(' · ')}</Typography> : null;
}

/** Profession over nationality, in one cell. */
function Who({ profession, nationality }: { profession: string | null; nationality: string | null }) {
  return (
    <>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.navy800 }}>{profession ?? '—'}</Typography>
      <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{nationality ?? '—'}</Typography>
    </>
  );
}

export function PriceKindBadge({ kind }: { kind: WorkerPriceKind }) {
  const { t } = useTranslation();
  return <Badge tone={kindTone[kind]}>{t(`commercial.prices.kind.${kind}`)}</Badge>;
}

/** Packages (project × profession × nationality): price, its housing and transport parts, and the workers on it. */
export function PackagesTable({ rows, showProject }: { rows: PackageRow[]; showProject?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ar, date } = useCommercialFormat();
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            {showProject && <TableCell>{t('commercial.col.project')}</TableCell>}
            <TableCell>{t('commercial.prices.col.who')}</TableCell>
            <TableCell>{t('commercial.prices.col.price')}</TableCell>
            <TableCell>{t('commercial.prices.col.basis')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.onPackage')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.special')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.missing')}</TableCell>
            <TableCell>{t('commercial.prices.col.since')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} hover={showProject} sx={{ cursor: showProject ? 'pointer' : 'default' }} onClick={showProject ? () => navigate(`/commercial/projects/${r.projectId}?tab=packages`) : undefined}>
              {showProject && (
                <TableCell sx={{ minWidth: 220 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>{r.projectName}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{r.customerName ?? t('commercial.noCustomer')}</Typography>
                </TableCell>
              )}
              <TableCell>
                <Who profession={ar ? r.professionAr : r.professionEn} nationality={ar ? r.nationalityAr : r.nationalityEn} />
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                <PackagePrice row={r} />
                <PriceParts housing={r.housing} transport={r.transport} />
              </TableCell>
              <TableCell>
                <Badge tone={r.basis === 'FixedTotal' ? 'primary' : 'info'}>{t(`commercial.prices.basis.${r.basis}`)}</Badge>
              </TableCell>
              <TableCell align="center">
                <Badge tone="success">{r.workers}</Badge>
              </TableCell>
              <TableCell align="center">{r.specialWorkers > 0 ? <Badge tone="warning">{r.specialWorkers}</Badge> : '—'}</TableCell>
              <TableCell align="center">{r.missingWorkers > 0 ? <Badge tone="danger">{r.missingWorkers}</Badge> : '—'}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{date(r.since)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** Workers' current prices, as the old "تحديث سعر الخدمة" page, with how each compares to its package. */
export function WorkerPricesTable({ rows, showProject }: { rows: WorkerPrice[]; showProject?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ar, date } = useCommercialFormat();
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('workforce.col.name')}</TableCell>
            {showProject && <TableCell>{t('commercial.col.project')}</TableCell>}
            <TableCell>{t('commercial.prices.col.who')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.salary')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.servicePrice')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.packagePrice')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.difference')}</TableCell>
            <TableCell>{t('commercial.prices.col.kind')}</TableCell>
            <TableCell>{t('commercial.prices.col.workStart')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((w) => (
            <TableRow key={w.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/workforce/workers/${w.workerId}`)}>
              <TableCell sx={{ minWidth: 180 }}>
                <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }}>
                  {w.name}
                </Typography>
                <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }}>
                  {w.workerNo}
                </Typography>
              </TableCell>
              {showProject && <TableCell sx={{ minWidth: 180 }}>{w.projectName}</TableCell>}
              <TableCell>
                <Who profession={ar ? w.professionAr : w.professionEn} nationality={ar ? w.nationalityAr : w.nationalityEn} />
              </TableCell>
              <TableCell align="center">{money(w.salary)}</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800, color: tokens.navy800 }}>
                {w.fromWorkerDefault ? (
                  <Tooltip title={t('commercial.prices.fromWorkerDefault')}>
                    <Box component="span" sx={{ borderBottom: `1px dashed ${tokens.gray500}` }}>
                      {money(w.servicePrice)}
                    </Box>
                  </Tooltip>
                ) : (
                  money(w.servicePrice)
                )}
                <PriceParts housing={w.housing} transport={w.transport} />
              </TableCell>
              <TableCell align="center">{money(w.packagePrice)}</TableCell>
              <TableCell align="center" dir="ltr" sx={{ fontWeight: 700, color: !w.difference ? tokens.gray500 : w.difference > 0 ? '#1f9d55' : tokens.danger }}>
                {w.difference ? `${w.difference > 0 ? '+' : ''}${money(w.difference)}` : '—'}
              </TableCell>
              <TableCell>
                <PriceKindBadge kind={w.kind} />
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                <Typography dir="ltr" sx={{ fontSize: 12.5, textAlign: 'start' }}>
                  {w.workStartNo ?? '—'}
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{date(w.startedOn)}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
