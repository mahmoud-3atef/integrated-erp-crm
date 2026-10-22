import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import StarOutlineRoundedIcon from '@mui/icons-material/StarOutlineRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import WcOutlinedIcon from '@mui/icons-material/WcOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { educations, photoUrl, profileApi, religions } from '../../api/showroom';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { FieldBox, FieldSection } from '../../components/FieldSection';
import { specialtyIcon } from '../operations/showroom/showroomParts';
import { DateField } from '../../components/DateField';
/**
 * A worker's marketing profile (docs/03-migration-plan/15): the photos and what the showroom tells a customer —
 * specialty, skills, languages and a few personal facts. Marketing or the housing officer edit it.
 */
export function WorkerProfileTab({ workerId }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { can } = useSession();
    const ar = i18n.language === 'ar';
    const editor = can('workforce.workers.profile', true);
    const [profile, setProfile] = useState(null);
    const [lists, setLists] = useState(null);
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [current, setCurrent] = useState(0);
    const input = useRef(null);
    const load = useCallback(() => {
        profileApi.get(workerId).then(setProfile).catch((f) => setError(errorKey(f)));
    }, [workerId]);
    useEffect(() => {
        load();
        profileApi.lists().then(setLists).catch((f) => setError(errorKey(f)));
    }, [load]);
    if (!profile || !lists)
        return error ? _jsx(ErrorMessage, { messageKey: error }) : _jsx(CircularProgress, { size: 28, sx: { m: 3 } });
    const label = (list, code) => {
        const item = list.find((i) => i.code === code);
        return item ? (ar ? item.nameAr : item.nameEn) : code ?? '—';
    };
    const age = profile.birthDate ? Math.floor((Date.now() - new Date(profile.birthDate).getTime()) / (365.25 * 86400000)) : null;
    const photos = profile.photos;
    const shown = photos[Math.min(current, photos.length - 1)];
    const act = async (job) => {
        setBusy(true);
        setError(null);
        try {
            await job();
            load();
        }
        catch (f) {
            setError(errorKey(f));
        }
        finally {
            setBusy(false);
        }
    };
    const upload = (files) => files &&
        act(async () => {
            for (const file of Array.from(files).slice(0, 8 - photos.length))
                await profileApi.addPhoto(workerId, file);
        });
    return (_jsxs(Box, { children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'flex-end', gap: 1, mb: 2 }, children: [can('operations.showroom.view', true) && (_jsx(Button, { startIcon: _jsx(StorefrontOutlinedIcon, {}), onClick: () => navigate('/housing/showroom'), children: t('workerProfile.toShowroom') })), editor && (_jsx(Button, { variant: "contained", startIcon: _jsx(EditOutlinedIcon, {}), onClick: () => setEditing(true), children: t('workerProfile.edit') }))] }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '380px 1fr' }, gap: 2.5, alignItems: 'start' }, children: [_jsxs(FieldSection, { title: t('workerProfile.photos', { count: photos.length }), icon: _jsx(CollectionsOutlinedIcon, {}), columns: 1, children: [_jsxs(Box, { sx: { position: 'relative', aspectRatio: '4 / 5', borderRadius: '14px', overflow: 'hidden', bgcolor: tokens.navy50, display: 'grid', placeItems: 'center' }, children: [shown ? (_jsx(Box, { component: "img", src: photoUrl(workerId, shown), alt: "", sx: { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' } })) : (_jsxs(Stack, { sx: { alignItems: 'center', gap: 1, color: tokens.gray500, p: 3, textAlign: 'center' }, children: [_jsx(AddPhotoAlternateOutlinedIcon, { sx: { fontSize: 48, color: tokens.navy600 } }), _jsx(Typography, { sx: { fontSize: 13 }, children: t('workerProfile.noPhotos') })] })), shown && current === 0 && (_jsx(Box, { sx: { position: 'absolute', top: 10, insetInlineStart: 10, px: 1, py: 0.3, borderRadius: 99, bgcolor: '#FCD34D', color: '#082B49', fontSize: 11.5, fontWeight: 800 }, children: t('workerProfile.main') })), busy && _jsx(CircularProgress, { sx: { position: 'absolute' } })] }), _jsxs(Stack, { direction: "row", sx: { gap: 1, flexWrap: 'wrap' }, children: [photos.map((p, i) => (_jsxs(Box, { sx: { position: 'relative', width: 72, height: 72, borderRadius: '10px', overflow: 'hidden', outline: i === current ? '2.5px solid #F59E0B' : `1px solid ${tokens.gray200}`, outlineOffset: 1, '&:hover .tools': { opacity: 1 } }, children: [_jsx(Box, { component: "button", type: "button", onClick: () => setCurrent(i), "aria-label": t('workerProfile.view', { n: i + 1 }), sx: { p: 0, border: 0, cursor: 'pointer', width: '100%', height: '100%' }, children: _jsx(Box, { component: "img", src: photoUrl(workerId, p), alt: "", sx: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } }) }), editor && (_jsxs(Stack, { className: "tools", direction: "row", sx: { position: 'absolute', insetInline: 0, bottom: 0, justifyContent: 'space-between', bgcolor: 'rgba(8,43,73,.75)', opacity: 0, transition: 'opacity .2s', '&:focus-within': { opacity: 1 } }, children: [_jsx(Tooltip, { title: t('workerProfile.makeMain'), children: _jsx("span", { children: _jsx(IconButton, { size: "small", disabled: i === 0 || busy, onClick: () => act(() => profileApi.makeMain(workerId, p)).then(() => setCurrent(0)), sx: { color: '#FCD34D' }, "aria-label": t('workerProfile.makeMain'), children: i === 0 ? _jsx(StarRoundedIcon, { fontSize: "small" }) : _jsx(StarOutlineRoundedIcon, { fontSize: "small" }) }) }) }), _jsx(Tooltip, { title: t('workerProfile.deletePhoto'), children: _jsx(IconButton, { size: "small", disabled: busy, onClick: () => window.confirm(t('workerProfile.deleteConfirm')) && act(() => profileApi.deletePhoto(workerId, p)).then(() => setCurrent(0)), sx: { color: '#fff' }, "aria-label": t('workerProfile.deletePhoto'), children: _jsx(DeleteOutlineIcon, { fontSize: "small" }) }) })] }))] }, p))), editor && photos.length < 8 && (_jsx(Box, { component: "button", type: "button", disabled: busy, onClick: () => input.current?.click(), sx: { width: 72, height: 72, borderRadius: '10px', border: `1.5px dashed ${tokens.navy600}`, bgcolor: tokens.navy50, color: tokens.navy700, cursor: 'pointer', display: 'grid', placeItems: 'center' }, "aria-label": t('workerProfile.addPhotos'), children: _jsx(AddPhotoAlternateOutlinedIcon, {}) }))] }), _jsx("input", { ref: input, type: "file", accept: "image/jpeg,image/png,image/webp", multiple: true, hidden: true, onChange: (e) => { void upload(e.target.files); e.target.value = ''; } }), editor && _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: t('workerProfile.photoHint') })] }), _jsxs(Stack, { spacing: 2.5, children: [_jsxs(FieldSection, { title: t('workerProfile.marketing'), icon: _jsx(StorefrontOutlinedIcon, {}), tone: "gold", children: [_jsx(FieldBox, { label: t('workerProfile.specialty'), icon: specialtyIcon(profile.specialty ?? profile.suggestedSpecialty), wide: true, children: profile.specialty ? (label(lists.specialties, profile.specialty)) : profile.suggestedSpecialty ? (_jsxs(_Fragment, { children: [label(lists.specialties, profile.suggestedSpecialty), ' ', _jsx(Box, { component: "span", sx: { fontSize: 12, color: tokens.gold, fontWeight: 600 }, children: t('workerProfile.suggested') })] })) : ('—') }), _jsx(FieldBox, { label: t('workerProfile.skills'), icon: _jsx(PsychologyOutlinedIcon, {}), wide: true, children: profile.skills.length ? (_jsx(Stack, { direction: "row", sx: { gap: 0.5, flexWrap: 'wrap' }, children: profile.skills.map((s) => (_jsx(Chip, { size: "small", label: label(lists.skills, s), sx: { bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 600 } }, s))) })) : ('—') }), _jsx(FieldBox, { label: t('workerProfile.languages'), icon: _jsx(TranslateOutlinedIcon, {}), wide: true, children: profile.languages.length ? profile.languages.map((l) => label(lists.languages, l)).join(ar ? '، ' : ', ') : '—' }), _jsx(FieldBox, { label: t('workerProfile.prior'), icon: _jsx(WorkspacePremiumOutlinedIcon, {}), children: profile.priorExperienceYears !== null ? t('showroom.card.years', { count: profile.priorExperienceYears }) : '—' }), _jsx(FieldBox, { label: t('workerProfile.education'), icon: _jsx(SchoolOutlinedIcon, {}), children: profile.education ? t(`workerProfile.educations.${profile.education}`) : '—' }), _jsx(FieldBox, { label: t('workerProfile.bio'), icon: _jsx(HistoryEduOutlinedIcon, {}), wide: true, multiline: true, children: (ar ? profile.bioAr ?? profile.bioEn : profile.bioEn ?? profile.bioAr) ?? '—' })] }), _jsxs(FieldSection, { title: t('workerProfile.personal'), icon: _jsx(WcOutlinedIcon, {}), tone: "sky", children: [_jsx(FieldBox, { label: t('workerProfile.gender'), icon: _jsx(WcOutlinedIcon, {}), children: profile.gender ? t(`showroom.gender.${profile.gender}`) : '—' }), _jsx(FieldBox, { label: t('workerProfile.birthDate'), icon: _jsx(CakeOutlinedIcon, {}), children: profile.birthDate ? (_jsxs(_Fragment, { children: [_jsx("bdi", { children: profile.birthDate.replaceAll('-', '/') }), age !== null && _jsxs(_Fragment, { children: [" \u00B7 ", t('showroom.card.age', { count: age })] })] })) : ('—') }), _jsx(FieldBox, { label: t('workerProfile.religion'), icon: _jsx(WcOutlinedIcon, {}), children: profile.religion ? t(`workerProfile.religions.${profile.religion}`) : '—' })] }), profile.updatedBy && (_jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: t('workerProfile.updated', { by: profile.updatedBy, on: (profile.updatedAt ?? '').slice(0, 10).replaceAll('-', '/') }) }))] })] }), editing && _jsx(ProfileDialog, { workerId: workerId, profile: profile, lists: lists, onClose: () => setEditing(false), onSaved: () => { setEditing(false); load(); } })] }));
}
function ProfileDialog({ workerId, profile, lists, onClose, onSaved }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const [v, setV] = useState({
        specialty: profile.specialty ?? profile.suggestedSpecialty,
        skills: profile.skills,
        languages: profile.languages,
        gender: profile.gender,
        birthDate: profile.birthDate,
        religion: profile.religion,
        education: profile.education,
        priorExperienceYears: profile.priorExperienceYears,
        bioAr: profile.bioAr,
        bioEn: profile.bioEn,
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const name = (o) => (ar ? o.nameAr : o.nameEn);
    const pick = (list, codes) => codes.map((c) => list.find((o) => o.code === c)).filter((o) => !!o);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await profileApi.save(workerId, v);
            onSaved();
        }
        catch (f) {
            setError(errorKey(f));
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, maxWidth: "md", fullWidth: true, children: [_jsx(DialogTitle, { sx: { fontWeight: 800 }, children: t('workerProfile.editTitle') }), _jsxs(DialogContent, { children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, pt: 1 }, children: [_jsxs(TextField, { select: true, label: t('workerProfile.specialty'), value: v.specialty ?? '', onChange: (e) => setV({ ...v, specialty: e.target.value || null }), helperText: !profile.specialty && profile.suggestedSpecialty ? t('workerProfile.suggestedHelp') : ' ', children: [_jsx(MenuItem, { value: "", children: "\u2014" }), lists.specialties.map((o) => (_jsx(MenuItem, { value: o.code, children: name(o) }, o.code)))] }), _jsx(TextField, { type: "number", label: t('workerProfile.prior'), value: v.priorExperienceYears ?? '', onChange: (e) => setV({ ...v, priorExperienceYears: e.target.value === '' ? null : Math.max(0, Math.min(40, Number(e.target.value))) }), slotProps: { htmlInput: { min: 0, max: 40 } }, helperText: t('workerProfile.priorHelp') }), _jsx(Autocomplete, { multiple: true, options: lists.skills, value: pick(lists.skills, v.skills), onChange: (_, items) => setV({ ...v, skills: items.map((o) => o.code) }), getOptionLabel: name, isOptionEqualToValue: (a, b) => a.code === b.code, renderInput: (p) => _jsx(TextField, { ...p, label: t('workerProfile.skills') }), sx: { gridColumn: '1 / -1' } }), _jsx(Autocomplete, { multiple: true, options: lists.languages, value: pick(lists.languages, v.languages), onChange: (_, items) => setV({ ...v, languages: items.map((o) => o.code) }), getOptionLabel: name, isOptionEqualToValue: (a, b) => a.code === b.code, renderInput: (p) => _jsx(TextField, { ...p, label: t('workerProfile.languages'), helperText: t('workerProfile.languagesHelp') }), sx: { gridColumn: '1 / -1' } }), _jsxs(TextField, { select: true, label: t('workerProfile.gender'), value: v.gender ?? '', onChange: (e) => setV({ ...v, gender: (e.target.value || null) }), children: [_jsx(MenuItem, { value: "", children: "\u2014" }), _jsx(MenuItem, { value: "M", children: t('showroom.gender.M') }), _jsx(MenuItem, { value: "F", children: t('showroom.gender.F') })] }), _jsx(DateField, { label: t('workerProfile.birthDate'), value: v.birthDate ?? '', onChange: (e) => setV({ ...v, birthDate: e.target.value || null }), slotProps: { inputLabel: { shrink: true } } }), _jsxs(TextField, { select: true, label: t('workerProfile.religion'), value: v.religion ?? '', onChange: (e) => setV({ ...v, religion: e.target.value || null }), children: [_jsx(MenuItem, { value: "", children: "\u2014" }), religions.map((r) => (_jsx(MenuItem, { value: r, children: t(`workerProfile.religions.${r}`) }, r)))] }), _jsxs(TextField, { select: true, label: t('workerProfile.education'), value: v.education ?? '', onChange: (e) => setV({ ...v, education: e.target.value || null }), children: [_jsx(MenuItem, { value: "", children: "\u2014" }), educations.map((r) => (_jsx(MenuItem, { value: r, children: t(`workerProfile.educations.${r}`) }, r)))] }), _jsx(TextField, { multiline: true, minRows: 3, label: t('workerProfile.bioAr'), value: v.bioAr ?? '', onChange: (e) => setV({ ...v, bioAr: e.target.value }), slotProps: { htmlInput: { maxLength: 600 } }, helperText: `${(v.bioAr ?? '').length}/600` }), _jsx(TextField, { multiline: true, minRows: 3, label: t('workerProfile.bioEn'), value: v.bioEn ?? '', onChange: (e) => setV({ ...v, bioEn: e.target.value }), slotProps: { htmlInput: { maxLength: 600, dir: 'ltr' } }, helperText: `${(v.bioEn ?? '').length}/600` })] })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2 }, children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", onClick: save, disabled: busy, children: t('common.save') })] })] }));
}
