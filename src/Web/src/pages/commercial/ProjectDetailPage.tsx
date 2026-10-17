import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LocationCityOutlinedIcon from '@mui/icons-material/LocationCityOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import { Box, Button, Link, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { commercialApi, type PackageRow, type ProjectDetail, type ProjectPrices } from '../../api/commercial';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { FieldBox, FieldSection } from '../../components/FieldSection';
import { Badge, PillTabs } from '../../components/ui';
import { placementLook } from '../../components/workforce/placement';
import { draftFromSuggestion, PackageDialog, PackagesTable, SuggestionsTable, WorkerPricesTable, type PackageDraft } from './pricing';
import { contractStatusTone, DaysLeft, useCommercialFormat } from './ProjectsPage';

/** One project, as the old project page: title bar, project and contract sections, then its workers, price packages and worker prices. */
export function ProjectDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { ar, date } = useCommercialFormat();
  const { can } = useSession();
  const canPrices = can('commercial.prices.view', true);
  const canManage = can('commercial.prices.manage', true);
  const [dialog, setDialog] = useState<{ package?: PackageRow; draft?: PackageDraft } | null>(null);
  const [reload, setReload] = useState(0);
  const [params] = useSearchParams();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [prices, setPrices] = useState<ProjectPrices | null>(null);
  const [tab, setTab] = useState<'workers' | 'packages' | 'prices'>(() => (params.get('tab') === 'packages' ? 'packages' : 'workers'));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    commercialApi.project(id!).then(setProject).catch((failure: unknown) => setError(errorKey(failure)));
  }, [id]);

  useEffect(() => {
    if (canPrices) {
      commercialApi.projectPrices(id!).then(setPrices).catch((failure: unknown) => setError(errorKey(failure)));
    }
  }, [id, canPrices, reload]);

  const toggle = async (row: PackageRow) => {
    try {
      await commercialApi.setPackageActive(row.id, !row.isActive);
      setReload((n) => n + 1);
    } catch (failure) {
      setError(errorKey(failure));
    }
  };

  if (!project) {
    return <ErrorMessage messageKey={error} />;
  }

  const p = project.summary;
  const months = p.startsOn && p.endsOn ? Math.round((new Date(p.endsOn).getTime() - new Date(p.startsOn).getTime()) / (30.44 * 86400000)) : null;
  const working = project.workers.filter((w) => w.placement === 'Working').length;

  return (
    <Box>
      {/* Title bar (.cp-prj-titlebar). */}
      <Stack direction="row" sx={{ alignItems: 'center', gap: 2, bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: '16px 20px', mb: `${tokens.gap}px` }}>
        <Box sx={{ display: 'grid', placeItems: 'center', width: 56, height: 56, borderRadius: '16px', bgcolor: tokens.navy700, color: '#fff', fontSize: 24, fontWeight: 800 }}>
          {p.name.trim().charAt(0).toUpperCase()}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12.5, color: tokens.gray500, '& svg': { fontSize: 16 } }}>
            <AccountTreeOutlinedIcon />
            {t('commercial.projectDetails')}
          </Typography>
          <Typography component="h1" sx={{ fontSize: 20, fontWeight: 800, color: tokens.navy800 }}>
            {p.name}
          </Typography>
        </Box>
        {p.contractStatus && <Badge tone={contractStatusTone[p.contractStatus]}>{t(`commercial.contractStatus.${p.contractStatus}`)}</Badge>}
        {!p.isActive && <Badge tone="neutral">{t('commercial.inactive')}</Badge>}
        <Button startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate(-1)}>
          {t('common.back')}
        </Button>
      </Stack>
      <ErrorMessage messageKey={error} />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'start', mb: `${tokens.gap}px` }}>
        <FieldSection title={t('commercial.sections.project')} icon={<BusinessOutlinedIcon />}>
          <FieldBox label={t('commercial.field.code')} icon={<TagOutlinedIcon />}>
            <span dir="ltr">{p.code}</span>
          </FieldBox>
          <FieldBox label={t('commercial.field.cr')} icon={<BadgeOutlinedIcon />}>
            <span dir="ltr">{project.commercialRegistration ?? '—'}</span>
          </FieldBox>
          <FieldBox label={t('commercial.col.customer')} icon={<BusinessOutlinedIcon />} wide>
            {p.customerId ? (
              <Link component={RouterLink} to={`/commercial/customers/${p.customerId}`} underline="hover">
                {p.customerName}
              </Link>
            ) : (
              <Badge tone="danger">{t('commercial.noCustomer')}</Badge>
            )}
          </FieldBox>
          <FieldBox label={t('commercial.col.manager')} icon={<ManageAccountsOutlinedIcon />}>
            {p.manager ?? '—'}
          </FieldBox>
          <FieldBox label={t('commercial.field.contact')} icon={<PersonOutlinedIcon />}>
            {project.contactName ?? '—'}
          </FieldBox>
          <FieldBox label={t('commercial.field.mobile')} icon={<ContactPhoneOutlinedIcon />}>
            <span dir="ltr">{project.contactMobile ?? '—'}</span>
          </FieldBox>
          <FieldBox label={t('commercial.field.city')} icon={<LocationCityOutlinedIcon />}>
            {project.city ?? '—'}
          </FieldBox>
          <FieldBox label={t('commercial.field.sector')} icon={<CategoryOutlinedIcon />}>
            {project.sector ?? '—'}
          </FieldBox>
          <FieldBox label={t('commercial.col.created')} icon={<CalendarMonthOutlinedIcon />}>
            {date(p.createdAt)}
          </FieldBox>
          {project.contactEmails && (
            <FieldBox label={t('commercial.field.emails')} icon={<EmailOutlinedIcon />} wide multiline>
              <span dir="ltr">{project.contactEmails}</span>
            </FieldBox>
          )}
        </FieldSection>

        <FieldSection title={t('commercial.sections.contract')} icon={<DescriptionOutlinedIcon />} tone="sky">
          <FieldBox label={t('commercial.col.contractStatus')} icon={<VerifiedOutlinedIcon />}>
            {p.contractStatus ? t(`commercial.contractStatus.${p.contractStatus}`) : '—'}
          </FieldBox>
          <FieldBox label={t('commercial.col.contractType')} icon={<CategoryOutlinedIcon />}>
            {p.contractType ? t(`commercial.contractType.${p.contractType}`) : '—'}
          </FieldBox>
          <FieldBox label={t('commercial.field.start')} icon={<EventAvailableOutlinedIcon />}>
            {date(p.startsOn)}
          </FieldBox>
          <FieldBox label={t('commercial.field.end')} icon={<EventBusyOutlinedIcon />}>
            {date(p.endsOn)}
          </FieldBox>
          <FieldBox label={t('commercial.field.duration')} icon={<HourglassBottomOutlinedIcon />} wide>
            {months !== null ? t('commercial.months', { count: months }) : '—'}
            <Box component="span" sx={{ marginInlineStart: 1.5 }}>
              <DaysLeft days={p.daysLeft} />
            </Box>
          </FieldBox>
          <FieldBox label={t('commercial.field.contractNo')} icon={<TagOutlinedIcon />} wide>
            <span dir="ltr">{project.contractNo}</span>
          </FieldBox>
        </FieldSection>
      </Box>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5 }}>
        <PillTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'workers', label: t('commercial.tabs.workers', { count: working, total: project.workers.length }) },
            ...(prices
              ? [
                  { value: 'packages' as const, label: t('commercial.tabs.packages', { count: prices.packages.length }) },
                  { value: 'prices' as const, label: t('commercial.tabs.prices', { count: prices.workers.filter((w) => w.status !== 'Package').length }) },
                ]
              : []),
          ]}
        />
        {tab === 'packages' && prices ? (
          <>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
              <Typography sx={{ fontSize: 13, color: tokens.gray600 }}>{t('commercial.prices.projectPackagesIntro')}</Typography>
              {canManage && (
                <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setDialog({ draft: { projectId: p.id } })}>
                  {t('commercial.prices.new')}
                </Button>
              )}
            </Stack>
            {prices.packages.length === 0 ? (
              <Typography sx={{ py: 3, textAlign: 'center', color: tokens.gray500 }}>{t('commercial.prices.noPackages')}</Typography>
            ) : (
              <PackagesTable
                rows={prices.packages}
                showProject
                onEdit={canManage ? (row) => setDialog({ package: row }) : undefined}
                onToggle={canManage ? (row) => void toggle(row) : undefined}
              />
            )}
            {prices.suggestions.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.navy800 }}>{t('commercial.prices.tabs.suggestions')}</Typography>
                <Typography sx={{ fontSize: 13, color: tokens.gray600, mb: 1 }}>{t('commercial.prices.suggestionsIntro')}</Typography>
                <SuggestionsTable rows={prices.suggestions} onCreate={canManage ? (row) => setDialog({ draft: draftFromSuggestion(row) }) : undefined} />
              </Box>
            )}
          </>
        ) : tab === 'prices' && prices ? (
          prices.workers.length === 0 ? (
            <Typography sx={{ py: 4, textAlign: 'center', color: tokens.gray500 }}>{t('commercial.noWorkers')}</Typography>
          ) : (
            <WorkerPricesTable rows={prices.workers} />
          )
        ) : project.workers.length === 0 ? (
          <Typography sx={{ py: 4, textAlign: 'center', color: tokens.gray500 }}>{t('commercial.noWorkers')}</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('workforce.col.name')}</TableCell>
                  <TableCell>{t('workforce.col.number')}</TableCell>
                  <TableCell>{t('workforce.col.status')}</TableCell>
                  <TableCell>{t('workforce.col.profession')}</TableCell>
                  <TableCell>{t('workforce.col.nationality')}</TableCell>
                  <TableCell>{t('workforce.col.joined')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {project.workers.map((w) => {
                  const look = placementLook[w.placement];
                  return (
                    <TableRow key={w.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/workforce/workers/${w.id}`)}>
                      <TableCell dir="ltr" sx={{ fontWeight: 600, color: tokens.navy800, textAlign: 'start' }}>
                        {w.name}
                      </TableCell>
                      <TableCell dir="ltr">{w.workerNo}</TableCell>
                      <TableCell>
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.25, borderRadius: 999, fontSize: 12, fontWeight: 700, color: look.tone, bgcolor: look.soft }}>
                          {(ar ? w.statusAr : w.statusEn) ?? t(`workforce.placement.${w.placement}`)}
                        </Box>
                      </TableCell>
                      <TableCell>{(ar ? w.professionAr : w.professionEn) ?? '—'}</TableCell>
                      <TableCell>{(ar ? w.nationalityAr : w.nationalityEn) ?? '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{date(w.joinedOn)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mt: 2.5, fontSize: 12.5, color: tokens.gray500 }}>
          <InfoOutlinedIcon sx={{ fontSize: 16 }} />
          {tab === 'prices' ? t('commercial.prices.workersNote') : t('commercial.readOnly')}
        </Stack>
      </Box>
      {dialog && <PackageDialog package={dialog.package} draft={dialog.draft} onClose={() => setDialog(null)} onSaved={() => (setDialog(null), setReload((n) => n + 1))} />}
    </Box>
  );
}
