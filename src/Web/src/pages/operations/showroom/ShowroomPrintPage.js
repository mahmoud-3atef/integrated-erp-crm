import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { Box, Button, GlobalStyles, LinearProgress, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { photoUrl, showroomApi } from '../../../api/showroom';
import { tokens } from '../../../app/theme';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { Flag } from '../../../components/workforce/Flag';
import { initialsOf, specialtyIcon, tintOf, useShowroomText } from './showroomParts';
/**
 * The chosen workers as a list for a customer (A4, to print or save as PDF): always the presentation's data, so nothing
 * internal reaches the customer.
 */
export function ShowroomPrintPage() {
    const { t } = useTranslation();
    const x = useShowroomText();
    const [params] = useSearchParams();
    const ids = (params.get('ids') ?? '').split(',').filter(Boolean);
    const [workers, setWorkers] = useState(null);
    const [error, setError] = useState(null);
    const key = ids.join(',');
    useEffect(() => {
        showroomApi
            .get(true)
            .then((d) => setWorkers(d.workers.filter((w) => key.split(',').includes(w.id))))
            .catch((f) => setError(errorKey(f)));
    }, [key]);
    const today = new Intl.DateTimeFormat(x.ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'long' }).format(new Date());
    return (_jsxs(Box, { sx: { maxWidth: 900, mx: 'auto' }, children: [_jsx(GlobalStyles, { styles: {
                    '@page': { size: 'A4', margin: '12mm' },
                    '@media print': { aside: { display: 'none !important' }, header: { display: 'none !important' }, '.no-print': { display: 'none !important' }, body: { background: '#fff' }, '.sheet': { boxShadow: 'none !important' } },
                } }), _jsx(Stack, { direction: "row", className: "no-print", sx: { justifyContent: 'flex-end', mb: 1.5 }, children: _jsx(Button, { variant: "contained", startIcon: _jsx(PrintOutlinedIcon, {}), onClick: () => window.print(), disabled: !workers, children: t('showroom.print.print') }) }), _jsx(ErrorMessage, { messageKey: error }), !workers ? (!error && _jsx(LinearProgress, {})) : (_jsxs(Box, { className: "sheet", sx: { bgcolor: '#fff', borderRadius: '16px', boxShadow: tokens.shadowSm, p: 4 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '3px solid #082B49', pb: 1.5, mb: 2.5 }, children: [_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 22, fontWeight: 800, color: '#082B49' }, children: t('showroom.print.title') }), _jsx(Typography, { sx: { fontSize: 13, color: tokens.gray500 }, children: t('showroom.print.subtitle', { count: workers.length }) })] }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: today })] }), _jsx(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }, children: workers.map((w) => (_jsxs(Stack, { direction: "row", sx: { gap: 1.75, p: 1.5, border: `1px solid ${tokens.gray200}`, borderRadius: '14px', breakInside: 'avoid' }, children: [_jsx(Box, { sx: { width: 110, flex: '0 0 auto', aspectRatio: '4 / 5', borderRadius: '10px', overflow: 'hidden', bgcolor: tintOf(w.nationalityCode), color: '#fff', display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 800, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }, children: w.photos[0] ? _jsx(Box, { component: "img", src: photoUrl(w.id, w.photos[0]), alt: "", sx: { width: '100%', height: '100%', objectFit: 'cover' } }) : initialsOf(w.name) }), _jsxs(Box, { sx: { minWidth: 0, flex: 1 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.75 }, children: [_jsx(Flag, { code: w.nationalityCode, size: 20 }), _jsx(Typography, { dir: "auto", noWrap: true, sx: { fontSize: 16, fontWeight: 800, unicodeBidi: 'plaintext' }, children: w.name })] }), _jsxs(Typography, { sx: { fontSize: 11.5, color: tokens.gray500, mb: 0.75 }, children: [_jsx("bdi", { children: w.workerNo }), " \u00B7 ", x.nationality(w), w.age ? ` · ${t('showroom.card.age', { count: w.age })}` : ''] }), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.5, mb: 0.75, color: '#082B49', fontWeight: 800, fontSize: 13, '& svg': { fontSize: 16 } }, children: [specialtyIcon(w.specialty?.code), w.specialty ? x.name(w.specialty) : t('showroom.noSpecialty'), w.hotelExperience && _jsx(StarRoundedIcon, { sx: { color: '#F59E0B' } })] }), _jsxs(Typography, { sx: { fontSize: 12 }, children: [_jsxs("b", { children: [t('showroom.card.withUs'), ":"] }), " ", x.experience(w), w.projects ? ` · ${t('showroom.print.projects', { count: w.projects })}` : '', w.priorExperienceYears ? ` · ${t('showroom.file.prior', { count: w.priorExperienceYears })}` : ''] }), w.languages.length > 0 && (_jsxs(Typography, { sx: { fontSize: 12 }, children: [_jsxs("b", { children: [t('showroom.print.languages'), ":"] }), " ", x.list(w.languages)] })), w.skills.length > 0 && (_jsxs(Typography, { sx: { fontSize: 12 }, children: [_jsxs("b", { children: [t('showroom.print.skills'), ":"] }), " ", x.list(w.skills)] }))] })] }, w.id))) }), workers.length < ids.length && _jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500, mt: 2 }, children: t('showroom.print.missing') })] }))] }));
}
