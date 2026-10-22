import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { commercialApi } from '../../api/commercial';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { FieldBox, FieldSection } from '../../components/FieldSection';
import { Badge, PillTabs } from '../../components/ui';
import { ContractPeriod, contractStatusTone, useCommercialFormat } from './ProjectsPage';
import { useCrumb } from '../../app/breadcrumbs';
/** One customer: title bar, the customer's data, and their projects. */
export function CustomerDetailPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const { ar, date } = useCommercialFormat();
    const [customer, setCustomer] = useState(null);
    useCrumb(customer?.summary.name);
    const [tab, setTab] = useState('projects');
    const [error, setError] = useState(null);
    useEffect(() => {
        commercialApi.customer(id).then(setCustomer).catch((failure) => setError(errorKey(failure)));
    }, [id]);
    if (!customer) {
        return _jsx(ErrorMessage, { messageKey: error });
    }
    const c = customer.summary;
    return (_jsxs(Box, { children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 2, bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: '16px 20px', mb: `${tokens.gap}px` }, children: [_jsx(Box, { sx: { display: 'grid', placeItems: 'center', width: 56, height: 56, borderRadius: '16px', bgcolor: tokens.teal, color: '#fff', fontSize: 24, fontWeight: 800 }, children: c.name.trim().charAt(0) }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsxs(Typography, { sx: { display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12.5, color: tokens.gray500, '& svg': { fontSize: 16 } }, children: [_jsx(BusinessOutlinedIcon, {}), t('commercial.customerDetails')] }), _jsx(Typography, { component: "h1", sx: { fontSize: 20, fontWeight: 800, color: tokens.navy800 }, children: c.name }), c.nameEn && (_jsx(Typography, { dir: "ltr", sx: { fontSize: 13, color: tokens.gray600, textAlign: 'start' }, children: c.nameEn }))] }), _jsx(Badge, { tone: c.isActive ? 'success' : 'neutral', children: c.isActive ? t('commercial.active') : t('commercial.inactive') }), _jsx(Button, { startIcon: _jsx(ArrowBackIcon, { sx: { transform: ar ? 'scaleX(-1)' : 'none' } }), onClick: () => navigate(-1), children: t('common.back') })] }), _jsx(ErrorMessage, { messageKey: error }), _jsx(Box, { sx: { mb: `${tokens.gap}px` }, children: _jsxs(FieldSection, { title: t('commercial.sections.customer'), icon: _jsx(BusinessOutlinedIcon, {}), children: [_jsx(FieldBox, { label: t('commercial.field.customerNo'), icon: _jsx(TagOutlinedIcon, {}), children: _jsx("span", { dir: "ltr", children: c.customerNo ?? '—' }) }), _jsx(FieldBox, { label: t('commercial.field.cr'), icon: _jsx(BadgeOutlinedIcon, {}), children: _jsx("span", { dir: "ltr", children: c.commercialRegistration ?? '—' }) }), _jsx(FieldBox, { label: t('commercial.field.vat'), icon: _jsx(ReceiptLongOutlinedIcon, {}), children: _jsx("span", { dir: "ltr", children: c.vatNumber ?? '—' }) }), _jsx(FieldBox, { label: t('commercial.field.laborOffice'), icon: _jsx(WorkOutlineOutlinedIcon, {}), children: _jsx("span", { dir: "ltr", children: customer.laborOfficeNo ?? '—' }) }), _jsx(FieldBox, { label: t('commercial.field.contact'), icon: _jsx(PersonOutlinedIcon, {}), children: customer.contactName ?? '—' }), _jsx(FieldBox, { label: t('commercial.field.mobile'), icon: _jsx(ContactPhoneOutlinedIcon, {}), children: _jsx("span", { dir: "ltr", children: c.mobile ?? '—' }) }), _jsx(FieldBox, { label: t('commercial.field.email'), icon: _jsx(EmailOutlinedIcon, {}), children: _jsx("span", { dir: "ltr", children: customer.email ?? '—' }) }), _jsx(FieldBox, { label: t('commercial.field.city'), icon: _jsx(LocationCityOutlinedIcon, {}), children: c.city ?? '—' }), _jsx(FieldBox, { label: t('commercial.col.created'), icon: _jsx(CalendarMonthOutlinedIcon, {}), children: date(c.createdAt) })] }) }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5 }, children: [_jsx(PillTabs, { value: tab, onChange: setTab, options: [{ value: 'projects', label: t('commercial.tabs.projects', { count: customer.projects.length, workers: c.workers }) }] }), customer.projects.length === 0 ? (_jsx(Typography, { sx: { py: 4, textAlign: 'center', color: tokens.gray500 }, children: t('commercial.noProjects') })) : (_jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('commercial.col.project') }), _jsx(TableCell, { children: t('commercial.col.manager') }), _jsx(TableCell, { align: "center", children: t('commercial.col.workers') }), _jsx(TableCell, { children: t('commercial.col.contractType') }), _jsx(TableCell, { children: t('commercial.col.period') }), _jsx(TableCell, { children: t('commercial.col.contractStatus') })] }) }), _jsx(TableBody, { children: customer.projects.map((p) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer', opacity: p.isActive ? 1 : 0.6 }, onClick: () => navigate(`/commercial/projects/${p.id}`), children: [_jsxs(TableCell, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: p.name }), _jsx(Typography, { dir: "ltr", sx: { fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }, children: p.code })] }), _jsx(TableCell, { children: p.manager ?? '—' }), _jsx(TableCell, { align: "center", children: p.workers > 0 ? _jsx(Badge, { tone: "info", children: p.workers }) : '—' }), _jsx(TableCell, { children: p.contractType ? t(`commercial.contractType.${p.contractType}`) : '—' }), _jsx(TableCell, { children: _jsx(ContractPeriod, { row: p }) }), _jsx(TableCell, { children: p.contractStatus ? _jsx(Badge, { tone: contractStatusTone[p.contractStatus], children: t(`commercial.contractStatus.${p.contractStatus}`) }) : '—' })] }, p.id))) })] }) })), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mt: 2.5, fontSize: 12.5, color: tokens.gray500 }, children: [_jsx(InfoOutlinedIcon, { sx: { fontSize: 16 } }), t('commercial.readOnly')] })] })] }));
}
