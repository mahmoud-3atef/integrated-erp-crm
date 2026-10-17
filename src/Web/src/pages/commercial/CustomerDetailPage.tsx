import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LocationCityOutlinedIcon from '@mui/icons-material/LocationCityOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import { Box, Button, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { commercialApi, type CustomerDetail } from '../../api/commercial';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { FieldBox, FieldSection } from '../../components/FieldSection';
import { Badge, PillTabs } from '../../components/ui';
import { ContractPeriod, contractStatusTone, useCommercialFormat } from './ProjectsPage';

/** One customer: title bar, the customer's data, and their projects. */
export function CustomerDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { ar, date } = useCommercialFormat();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [tab, setTab] = useState<'projects'>('projects');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    commercialApi.customer(id!).then(setCustomer).catch((failure: unknown) => setError(errorKey(failure)));
  }, [id]);

  if (!customer) {
    return <ErrorMessage messageKey={error} />;
  }

  const c = customer.summary;
  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 2, bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: '16px 20px', mb: `${tokens.gap}px` }}>
        <Box sx={{ display: 'grid', placeItems: 'center', width: 56, height: 56, borderRadius: '16px', bgcolor: tokens.teal, color: '#fff', fontSize: 24, fontWeight: 800 }}>
          {c.name.trim().charAt(0)}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12.5, color: tokens.gray500, '& svg': { fontSize: 16 } }}>
            <BusinessOutlinedIcon />
            {t('commercial.customerDetails')}
          </Typography>
          <Typography component="h1" sx={{ fontSize: 20, fontWeight: 800, color: tokens.navy800 }}>
            {c.name}
          </Typography>
          {c.nameEn && (
            <Typography dir="ltr" sx={{ fontSize: 13, color: tokens.gray600, textAlign: 'start' }}>
              {c.nameEn}
            </Typography>
          )}
        </Box>
        <Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? t('commercial.active') : t('commercial.inactive')}</Badge>
        <Button startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate(-1)}>
          {t('common.back')}
        </Button>
      </Stack>
      <ErrorMessage messageKey={error} />

      <Box sx={{ mb: `${tokens.gap}px` }}>
        <FieldSection title={t('commercial.sections.customer')} icon={<BusinessOutlinedIcon />}>
          <FieldBox label={t('commercial.field.customerNo')} icon={<TagOutlinedIcon />}>
            <span dir="ltr">{c.customerNo ?? '—'}</span>
          </FieldBox>
          <FieldBox label={t('commercial.field.cr')} icon={<BadgeOutlinedIcon />}>
            <span dir="ltr">{c.commercialRegistration ?? '—'}</span>
          </FieldBox>
          <FieldBox label={t('commercial.field.vat')} icon={<ReceiptLongOutlinedIcon />}>
            <span dir="ltr">{c.vatNumber ?? '—'}</span>
          </FieldBox>
          <FieldBox label={t('commercial.field.laborOffice')} icon={<WorkOutlineOutlinedIcon />}>
            <span dir="ltr">{customer.laborOfficeNo ?? '—'}</span>
          </FieldBox>
          <FieldBox label={t('commercial.field.contact')} icon={<PersonOutlinedIcon />}>
            {customer.contactName ?? '—'}
          </FieldBox>
          <FieldBox label={t('commercial.field.mobile')} icon={<ContactPhoneOutlinedIcon />}>
            <span dir="ltr">{c.mobile ?? '—'}</span>
          </FieldBox>
          <FieldBox label={t('commercial.field.email')} icon={<EmailOutlinedIcon />}>
            <span dir="ltr">{customer.email ?? '—'}</span>
          </FieldBox>
          <FieldBox label={t('commercial.field.city')} icon={<LocationCityOutlinedIcon />}>
            {c.city ?? '—'}
          </FieldBox>
          <FieldBox label={t('commercial.col.created')} icon={<CalendarMonthOutlinedIcon />}>
            {date(c.createdAt)}
          </FieldBox>
        </FieldSection>
      </Box>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5 }}>
        <PillTabs value={tab} onChange={setTab} options={[{ value: 'projects', label: t('commercial.tabs.projects', { count: customer.projects.length, workers: c.workers }) }]} />
        {customer.projects.length === 0 ? (
          <Typography sx={{ py: 4, textAlign: 'center', color: tokens.gray500 }}>{t('commercial.noProjects')}</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('commercial.col.project')}</TableCell>
                  <TableCell>{t('commercial.col.manager')}</TableCell>
                  <TableCell align="center">{t('commercial.col.workers')}</TableCell>
                  <TableCell>{t('commercial.col.contractType')}</TableCell>
                  <TableCell>{t('commercial.col.period')}</TableCell>
                  <TableCell>{t('commercial.col.contractStatus')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {customer.projects.map((p) => (
                  <TableRow key={p.id} hover sx={{ cursor: 'pointer', opacity: p.isActive ? 1 : 0.6 }} onClick={() => navigate(`/commercial/projects/${p.id}`)}>
                    <TableCell>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>{p.name}</Typography>
                      <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }}>
                        {p.code}
                      </Typography>
                    </TableCell>
                    <TableCell>{p.manager ?? '—'}</TableCell>
                    <TableCell align="center">{p.workers > 0 ? <Badge tone="info">{p.workers}</Badge> : '—'}</TableCell>
                    <TableCell>{p.contractType ? t(`commercial.contractType.${p.contractType}`) : '—'}</TableCell>
                    <TableCell>
                      <ContractPeriod row={p} />
                    </TableCell>
                    <TableCell>{p.contractStatus ? <Badge tone={contractStatusTone[p.contractStatus]}>{t(`commercial.contractStatus.${p.contractStatus}`)}</Badge> : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mt: 2.5, fontSize: 12.5, color: tokens.gray500 }}>
          <InfoOutlinedIcon sx={{ fontSize: 16 }} />
          {t('commercial.readOnly')}
        </Stack>
      </Box>
    </Box>
  );
}
