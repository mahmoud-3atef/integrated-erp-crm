import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { Alert, Box, Button, GlobalStyles, MenuItem, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { payslipMax, payslipsApi } from '../../api/payslips';
import { ErrorMessage } from '../../auth/AuthLayout';
import i18n from '../../i18n';
import { amountInArabic, amountInEnglish } from '../../utils/amountWords';
const navy = '#082B49';
const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const day = (value) => value.slice(0, 10).replaceAll('-', '/');
const ar = (k, o) => i18n.t(k, { ...o, lng: 'ar' });
const en = (k, o) => i18n.t(k, { ...o, lng: 'en' });
/** A label in Arabic with its English beside it (or Arabic only). */
function L({ k, o, lang, block }) {
    return (_jsxs(_Fragment, { children: [_jsx("span", { children: ar(k, o) }), lang === 'both' && (_jsxs(_Fragment, { children: [block ? null : ' ', _jsx(Box, { component: "bdi", dir: "ltr", sx: { display: block ? 'block' : 'inline', fontSize: '0.82em', color: '#64748B', fontWeight: 500 }, children: block ? en(k, o) : `/ ${en(k, o)}` })] }))] }));
}
/**
 * The payslips of a run (docs/03-migration-plan/13): one A4 page each, in Arabic with English (or Arabic only),
 * built by the server from the run's saved lines; before approval each carries a «draft» mark. Nothing is kept in the
 * browser, and the address holds the run and the grid's filters only, never an amount.
 */
export function PayslipsPrintPage({ kind }) {
    const { id = '' } = useParams();
    const [params] = useSearchParams();
    const [batch, setBatch] = useState(null);
    const [error, setError] = useState(null);
    const [lang, setLang] = useState('both');
    useEffect(() => {
        payslipsApi(kind, id, params)
            .then(setBatch)
            .catch((f) => setError(errorKey(f)));
    }, [kind, id, params]);
    useEffect(() => {
        if (batch)
            document.title = `${ar('payslip.title')} · ${batch.runNo}`;
    }, [batch]);
    return (_jsxs(Box, { dir: "rtl", sx: { bgcolor: '#E9EEF5', minHeight: '100vh', color: '#0F2747', fontFamily: '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif', '@media print': { bgcolor: '#fff' } }, children: [_jsx(GlobalStyles, { styles: { '@page': { size: 'A4', margin: '9mm' }, '@media print': { body: { background: '#fff' } } } }), _jsxs(Stack, { direction: "row", sx: { position: 'sticky', top: 0, zIndex: 2, bgcolor: '#fff', borderBottom: '1px solid #E2E8F0', px: 3, py: 1.25, gap: 1.5, alignItems: 'center', flexWrap: 'wrap', '@media print': { display: 'none' } }, children: [_jsxs(Typography, { sx: { fontWeight: 700, fontSize: 15 }, children: [ar('payslip.title'), batch && (_jsxs(_Fragment, { children: [' · ', _jsx("bdi", { children: batch.runNo }), " \u00B7 ", batch.legalEntityNameAr, " \u00B7 ", _jsx("bdi", { children: `${day(batch.from)} – ${day(batch.to)}` })] }))] }), _jsx(Box, { sx: { flex: 1 } }), batch && _jsx(Typography, { sx: { fontSize: 13, color: '#64748B' }, children: ar('payslip.count', { shown: batch.items.length, total: batch.total }) }), _jsxs(TextField, { select: true, size: "small", value: lang, onChange: (e) => setLang(e.target.value), sx: { width: 170 }, slotProps: { htmlInput: { 'aria-label': ar('payslip.language') } }, children: [_jsx(MenuItem, { value: "both", children: ar('payslip.languageBoth') }), _jsx(MenuItem, { value: "ar", children: ar('payslip.languageAr') })] }), _jsx(Button, { variant: "contained", disabled: !batch || batch.items.length === 0, startIcon: _jsx(PrintOutlinedIcon, {}), onClick: () => window.print(), sx: { bgcolor: '#2563EB', borderRadius: '8px' }, children: ar('payslip.print') })] }), _jsx(Box, { sx: { px: 2, '@media print': { px: 0 } }, children: error ? (_jsx(Box, { sx: { maxWidth: 600, mx: 'auto', pt: 4 }, children: _jsx(ErrorMessage, { messageKey: error }) })) : !batch ? (_jsx(Box, { sx: { width: '210mm', maxWidth: '100%', mx: 'auto', pt: 3 }, children: _jsx(Skeleton, { variant: "rounded", height: 900 }) })) : batch.items.length === 0 ? (_jsx(Typography, { sx: { textAlign: 'center', pt: 6, color: '#64748B' }, children: ar('payslip.none') })) : (_jsxs(_Fragment, { children: [batch.total > batch.items.length && (_jsx(Alert, { severity: "warning", sx: { maxWidth: '210mm', mx: 'auto', mt: 2, '@media print': { display: 'none' } }, children: ar('payslip.limit', { max: payslipMax, total: batch.total }) })), batch.items.map((p) => (_jsx(Sheet, { batch: batch, slip: p, lang: lang }, p.lineId)))] })) })] }));
}
function Fact({ k, lang, children }) {
    return (_jsxs(Box, { sx: { p: '6px 10px', borderInlineStart: '1px solid #E6ECF4', borderBottom: '1px solid #E6ECF4', fontSize: 12.5, minWidth: 0 }, children: [_jsx(Box, { sx: { color: '#64748B', fontSize: 10.5 }, children: _jsx(L, { k: k, lang: lang }) }), _jsx(Box, { component: "b", sx: { display: 'block', overflowWrap: 'anywhere' }, children: children })] }));
}
function itemLabel(i, lng) {
    const t = (k, o) => i18n.t(k, { ...o, lng });
    const base = t(`payslip.items.${i.code}`, { defaultValue: i.code });
    const qtyText = i.quantity ? t(`payslip.qty.${i.code}`, { value: qty(i.quantity), defaultValue: '' }) : '';
    return [base, i.reference, qtyText ? `(${qtyText})` : '', i.note ? `— ${i.note}` : ''].filter(Boolean).join(' ');
}
function Items({ title, items, total, lang, tone }) {
    const look = tone === 'earn' ? { bg: '#E3F6EC', fg: '#047857' } : { bg: '#FDF1DC', fg: '#B45309' };
    return (_jsxs(Box, { component: "table", sx: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5, alignSelf: 'start', '& td': { p: '5px 10px', borderBottom: '1px solid #EEF2F7' } }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx(Box, { component: "th", sx: { textAlign: 'start', p: '7px 10px', bgcolor: look.bg, color: look.fg, fontSize: 12 }, children: _jsx(L, { k: title, lang: lang }) }), _jsx(Box, { component: "th", sx: { textAlign: 'left', p: '7px 10px', bgcolor: look.bg, color: look.fg, fontSize: 12 }, children: ar('hr.sar') })] }) }), _jsx("tbody", { children: items.map((i, n) => (_jsxs("tr", { children: [_jsxs("td", { children: [_jsx("bdi", { children: itemLabel(i, 'ar') }), lang === 'both' && (_jsx(Box, { dir: "ltr", sx: { fontSize: 10.5, color: '#64748B', textAlign: 'end' }, children: itemLabel(i, 'en') }))] }), _jsx(Box, { component: "td", dir: "ltr", sx: { textAlign: 'left', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }, children: money(i.amount) })] }, `${i.code}-${n}`))) }), _jsx("tfoot", { children: _jsxs(Box, { component: "tr", sx: { '& td': { fontWeight: 800, borderTop: '2px solid #D7E0EC', bgcolor: '#F8FAFC' } }, children: [_jsx("td", { children: _jsx(L, { k: "payslip.total", lang: lang }) }), _jsx(Box, { component: "td", dir: "ltr", sx: { textAlign: 'left', fontVariantNumeric: 'tabular-nums' }, children: money(total) })] }) })] }));
}
function Row({ label, value }) {
    return (_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', gap: 1, py: '3px' }, children: [_jsx("span", { children: label }), _jsx(Box, { component: "b", sx: { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }, children: value })] }));
}
const box = { border: '1px solid #D7E0EC', borderRadius: '8px', p: '10px 12px', fontSize: 12 };
/** One payslip, one A4 page. */
function Sheet({ batch, slip: p, lang }) {
    const staff = batch.kind === 'Staff';
    const dash = '—';
    return (_jsxs(Box, { sx: {
            position: 'relative',
            width: '210mm',
            maxWidth: '100%',
            minHeight: '277mm',
            mx: 'auto',
            my: 2.5,
            bgcolor: '#fff',
            boxShadow: '0 2px 14px rgba(15,39,71,.12)',
            p: '10mm 11mm',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.75,
            breakAfter: 'page',
            '@media print': { boxShadow: 'none', my: 0, width: 'auto', minHeight: 'auto', p: 0 },
            '&:last-of-type': { breakAfter: 'auto' },
        }, children: [batch.draft && (_jsx(Box, { "aria-hidden": true, sx: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 110, fontWeight: 800, color: 'rgba(220,38,38,.08)', transform: 'rotate(-24deg)', pointerEvents: 'none' }, children: ar('payslip.draftMark') })), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `3px solid ${navy}`, pb: 1.5 }, children: [_jsxs(Stack, { direction: "row", sx: { gap: 1.5, alignItems: 'center' }, children: [_jsx(Box, { component: "img", src: "/brand/carepro-logo.png", alt: "", sx: { height: 52 } }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 800, fontSize: 15 }, children: batch.legalEntityNameAr }), _jsxs(Typography, { dir: "ltr", sx: { fontSize: 12, color: '#64748B', textAlign: 'end' }, children: [batch.legalEntityNameEn, batch.commercialRegistrationNo && ` · CR ${batch.commercialRegistrationNo}`] })] })] }), _jsxs(Box, { sx: { textAlign: 'end' }, children: [_jsx(Typography, { sx: { fontSize: 22, fontWeight: 800, color: navy }, children: ar('payslip.title') }), lang === 'both' && (_jsx(Typography, { dir: "ltr", sx: { fontSize: 14, fontWeight: 700, color: '#64748B', textAlign: 'end' }, children: en('payslip.title') })), _jsx(Typography, { sx: { fontWeight: 700, mt: 0.5, fontVariantNumeric: 'tabular-nums' }, children: _jsx("bdi", { children: `${day(batch.from)} – ${day(batch.to)}` }) })] })] }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', border: '1px solid #D7E0EC', borderRadius: '8px', overflow: 'hidden' }, children: [_jsx(Fact, { k: staff ? 'payslip.employee' : 'payslip.worker', lang: lang, children: _jsx("bdi", { children: p.name }) }), _jsx(Fact, { k: "payslip.no", lang: lang, children: _jsx("bdi", { children: p.no }) }), _jsx(Fact, { k: staff ? 'payslip.idNumber' : 'payslip.iqama', lang: lang, children: p.idLast4 ? _jsx("bdi", { children: `••••••${p.idLast4}` }) : dash }), staff ? (_jsxs(_Fragment, { children: [_jsx(Fact, { k: "payslip.department", lang: lang, children: p.departmentAr ?? dash }), _jsx(Fact, { k: "payslip.job", lang: lang, children: p.jobAr ?? dash }), _jsxs(Fact, { k: "payslip.gosi", lang: lang, children: [p.gosiNo ? _jsx("bdi", { children: p.gosiNo }) : dash, p.gosiCategory && ` · ${ar(`payslip.gosiCategory.${p.gosiCategory}`)}`] }), _jsx(Fact, { k: "payslip.serviceDays", lang: lang, children: qty(p.serviceDays) }), _jsx(Fact, { k: "payslip.paidDays", lang: lang, children: qty(p.paidDays) }), _jsxs(Fact, { k: "payslip.account", lang: lang, children: [p.iban ? _jsx("bdi", { children: p.iban }) : dash, p.bankName && ` · ${p.bankName}`] })] })) : (_jsxs(_Fragment, { children: [_jsx(Fact, { k: "payslip.profession", lang: lang, children: p.jobAr ?? dash }), _jsx(Fact, { k: "payslip.project", lang: lang, children: p.projectName ?? dash }), _jsx(Fact, { k: "payslip.status", lang: lang, children: p.statusAr ?? dash }), _jsx(Fact, { k: "payslip.workDays", lang: lang, children: qty(p.paidDays) }), _jsx(Fact, { k: "payslip.absence", lang: lang, children: qty(p.absenceDays) }), _jsx(Fact, { k: "payslip.gosi", lang: lang, children: p.gosiCategory ? ar(`payslip.gosiCategory.${p.gosiCategory}`) : dash })] }))] }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.75 }, children: [_jsx(Items, { title: "payslip.earnings", items: p.earnings, total: p.totalEarnings, lang: lang, tone: "earn" }), _jsx(Items, { title: "payslip.deductions", items: p.deductions, total: p.totalDeductions, lang: lang, tone: "cut" })] }), _jsxs(Box, { children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', alignItems: 'center', bgcolor: navy, color: '#fff', borderRadius: '10px', p: '12px 18px', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }, children: [_jsxs(Typography, { sx: { fontWeight: 700, fontSize: 15 }, children: [ar('payslip.net'), lang === 'both' && _jsxs("span", { style: { opacity: 0.75, fontSize: 12 }, children: [" / ", en('payslip.net')] })] }), _jsxs(Typography, { dir: "ltr", sx: { fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }, children: [money(p.net), " ", _jsx("span", { style: { fontSize: 13 }, children: ar('hr.sar') })] })] }), _jsx(Typography, { sx: { fontSize: 12, color: '#475569', mt: 0.5 }, children: amountInArabic(p.net) }), lang === 'both' && (_jsx(Typography, { dir: "ltr", sx: { fontSize: 11.5, color: '#64748B', textAlign: 'end' }, children: amountInEnglish(p.net) }))] }), staff ? (_jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.75 }, children: [_jsxs(Box, { sx: box, children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 12.5, color: navy, mb: 0.5 }, children: _jsx(L, { k: "payslip.advances", lang: lang }) }), p.advances.length === 0 ? (_jsx(Typography, { sx: { fontSize: 12, color: '#64748B' }, children: ar('payslip.noAdvances') })) : (p.advances.map((a) => _jsx(Row, { label: _jsxs(_Fragment, { children: [ar('payslip.advanceLeft'), " ", _jsx("bdi", { children: a.advanceNo }), " (", ar('payslip.installments', { value: a.installments }), ")"] }), value: money(a.remaining) }, a.advanceNo)))] }), _jsxs(Box, { sx: box, children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 12.5, color: navy, mb: 0.5 }, children: _jsx(L, { k: "payslip.leave", lang: lang }) }), _jsx(Row, { label: ar('payslip.leaveBalance', { on: day(batch.to) }), value: p.leaveBalance == null ? dash : qty(p.leaveBalance) }), _jsx(Row, { label: ar('payslip.leaveTaken'), value: p.leaveTaken == null ? dash : qty(p.leaveTaken) }), p.gosiEmployer > 0 && _jsx(Row, { label: ar('payslip.gosiEmployer'), value: money(p.gosiEmployer) })] })] })) : (p.sources.length > 0 && (_jsxs(Box, { sx: box, children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 12.5, color: navy, mb: 0.5 }, children: _jsx(L, { k: "payslip.sources", lang: lang }) }), p.sources.map((s) => (_jsx(Row, { label: _jsxs(_Fragment, { children: [_jsx("bdi", { children: s.timesheetNo }), " \u00B7 ", s.projectName, " \u00B7 ", _jsx("bdi", { children: `${day(s.from)} – ${day(s.to)}` })] }), value: ar('payslip.daysValue', { value: qty(s.days) }) }, s.timesheetNo + s.from)))] }))), _jsx(Box, { sx: { ...box, bgcolor: batch.draft ? '#FEF2F2' : '#F8FAFC', color: batch.draft ? '#991B1B' : undefined }, children: batch.draft ? (ar('payslip.draftNote', { run: batch.runNo })) : (_jsxs(_Fragment, { children: [ar('payslip.approvedNote', { run: batch.runNo, on: batch.approvedAt ? day(batch.approvedAt) : dash }), batch.approvedByName && ` · ${batch.approvedByName}`] })) }), _jsx(Box, { sx: { flex: 1 } }), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', fontSize: 10.5, color: '#64748B', borderTop: '1px solid #E2E8F0', pt: 1 }, children: [_jsx("span", { children: _jsx(L, { k: "payslip.footer", lang: lang }) }), _jsx("bdi", { children: ar('payslip.printed', { at: `${day(batch.printedAt)} ${new Date(batch.printedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, by: batch.printedBy }) })] })] }));
}
