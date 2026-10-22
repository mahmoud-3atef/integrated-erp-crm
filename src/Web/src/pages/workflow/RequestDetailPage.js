import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import SendIcon from '@mui/icons-material/Send';
import SubjectOutlinedIcon from '@mui/icons-material/SubjectOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workflowApi } from '../../api/workflow';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { FieldBox, FieldSection } from '../../components/FieldSection';
import { ApprovalBar, ApprovalLog, useRecordApproval } from '../../components/workflow/RecordApproval';
import { PageHeader, Panel, PillTabs, StatusDot } from '../../components/ui';
import { requestTone } from './RequestsPage';
import { useCrumb } from '../../app/breadcrumbs';
const none = 'none';
export const categories = ['GENERAL', 'PURCHASE', 'ADVANCE', 'LEAVE', 'OTHER'];
/**
 * One internal request: edit while a draft or returned, send for approval, and follow and decide its approval on the
 * same page (the stage bar above the request, and an approval tab with the full log).
 */
export function RequestDetailPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { me } = useSession();
    const { id } = useParams();
    const isNew = id === 'new';
    const [request, setRequest] = useState(null);
    useCrumb(request?.number);
    const [subject, setSubject] = useState('');
    const [details, setDetails] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('GENERAL');
    const [manager, setManager] = useState(none);
    const [people, setPeople] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);
    const [tab, setTab] = useState('data');
    const approval = useRecordApproval(request?.approval?.instanceId);
    const show = useCallback((value) => {
        setRequest(value);
        setSubject(value.subject);
        setDetails(value.details);
        setAmount(value.amount === null ? '' : String(value.amount));
        setCategory(value.category);
        setManager(value.directManagerId ?? none);
    }, []);
    const reload = useCallback(async () => {
        if (id && !isNew) {
            try {
                show(await workflowApi.request(id));
            }
            catch (failure) {
                setError(errorKey(failure));
            }
        }
    }, [id, isNew, show]);
    useEffect(() => {
        workflowApi.people().then(setPeople).catch(() => setPeople([]));
        void reload();
    }, [reload]);
    const editable = isNew || request?.canEdit === true;
    const input = () => ({
        subject,
        details,
        amount: amount.trim() === '' ? null : Number(amount),
        legalEntityId: request?.legalEntityId ?? null,
        category,
        directManagerId: manager === none ? null : manager,
    });
    const save = async () => {
        setBusy(true);
        setError(null);
        setSaved(false);
        try {
            if (isNew) {
                const created = await workflowApi.createRequest(input());
                navigate(`/workflow/requests/${created.id}`, { replace: true });
            }
            else {
                show(await workflowApi.updateRequest(request.id, input()));
                setSaved(true);
            }
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    const submit = async () => {
        setBusy(true);
        setError(null);
        setSaved(false);
        try {
            await workflowApi.updateRequest(request.id, input());
            show(await workflowApi.submitRequest(request.id));
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    const ar = i18n.language === 'ar';
    const money = (value) => new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US', { minimumFractionDigits: 2 }).format(value);
    const date = (value) => new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'Asia/Riyadh' }).format(new Date(value));
    const personName = (userId) => people.find((p) => p.userAccountId === userId)?.displayName ?? '—';
    const flip = { transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' };
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: isNew ? t('requests.new') : (request?.number ?? '…'), subtitle: request ? request.subject : t('requests.newIntro'), actions: _jsxs(Stack, { direction: "row", sx: { gap: 1.5, alignItems: 'center' }, children: [request && _jsx(StatusDot, { tone: requestTone[request.status], label: t(`requests.status.${request.status}`) }), _jsx(Button, { startIcon: _jsx(ArrowBackIcon, { sx: flip }), onClick: () => navigate('/workflow/requests'), children: t('common.back') })] }) }), _jsx(ErrorMessage, { messageKey: error }), request?.approval && (_jsx(ApprovalBar, { status: request.approval, detail: approval.detail, loading: approval.loading, onChanged: () => {
                    void approval.reload();
                    void reload();
                } })), request?.approval && (_jsx(PillTabs, { value: tab, onChange: setTab, options: [
                    { value: 'data', label: t('requests.tabs.data') },
                    { value: 'approval', label: t('requests.tabs.approval') },
                ] })), request?.status === 'Returned' && request.lastComment && (_jsx(Alert, { severity: "warning", sx: { mb: 2 }, children: t('requests.returnedBecause', { reason: request.lastComment }) })), saved && (_jsx(Alert, { severity: "success", sx: { mb: 2 }, children: t('requests.saved') })), tab === 'approval' && request?.approval ? (_jsx(Panel, { padding: 2.5, children: _jsx(ApprovalLog, { status: request.approval, detail: approval.detail }) })) : (_jsx(Panel, { padding: 2.5, children: _jsx(Stack, { spacing: 2.5, children: editable ? (_jsxs(_Fragment, { children: [_jsxs(FieldSection, { title: t('requests.sections.main'), icon: _jsx(DescriptionOutlinedIcon, {}), children: [_jsx(FieldBox, { label: t('requests.subject'), icon: _jsx(SubjectOutlinedIcon, {}), input: true, required: true, wide: true, children: _jsx(TextField, { fullWidth: true, size: "small", value: subject, onChange: (e) => setSubject(e.target.value), slotProps: { htmlInput: { maxLength: 200, 'aria-label': t('requests.subject') } } }) }), _jsx(FieldBox, { label: t('requests.category'), icon: _jsx(CategoryOutlinedIcon, {}), input: true, children: _jsx(TextField, { select: true, fullWidth: true, size: "small", value: category, onChange: (e) => setCategory(e.target.value), slotProps: { htmlInput: { 'aria-label': t('requests.category') } }, children: categories.map((c) => (_jsx(MenuItem, { value: c, children: t(`requests.categories.${c}`) }, c))) }) }), _jsx(FieldBox, { label: t('requests.amountSar'), icon: _jsx(PaymentsOutlinedIcon, {}), input: true, children: _jsx(TextField, { fullWidth: true, size: "small", value: amount, onChange: (e) => setAmount(e.target.value.replace(/[^\d.]/g, '')), slotProps: { htmlInput: { dir: 'ltr', inputMode: 'decimal', 'aria-label': t('requests.amountSar') } } }) })] }), _jsx(FieldSection, { title: t('requests.sections.people'), icon: _jsx(PersonOutlinedIcon, {}), tone: "sky", children: _jsx(FieldBox, { label: t('requests.directManager'), icon: _jsx(ManageAccountsOutlinedIcon, {}), input: true, wide: true, children: _jsxs(TextField, { select: true, fullWidth: true, size: "small", value: manager, onChange: (e) => setManager(e.target.value), helperText: t('requests.directManagerHint'), slotProps: { htmlInput: { 'aria-label': t('requests.directManager') } }, children: [_jsx(MenuItem, { value: none, children: t('requests.noManager') }), people
                                                .filter((p) => p.userAccountId !== me.userId)
                                                .map((p) => (_jsx(MenuItem, { value: p.userAccountId, children: p.displayName }, p.userAccountId)))] }) }) }), _jsx(FieldSection, { title: t('requests.details'), icon: _jsx(NotesOutlinedIcon, {}), tone: "gold", columns: 1, children: _jsx(FieldBox, { label: t('requests.details'), icon: _jsx(NotesOutlinedIcon, {}), input: true, children: _jsx(TextField, { fullWidth: true, multiline: true, minRows: 5, value: details, onChange: (e) => setDetails(e.target.value), slotProps: { htmlInput: { maxLength: 4000, 'aria-label': t('requests.details') } } }) }) }), _jsxs(Stack, { direction: "row", sx: { flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }, children: [_jsx(Button, { variant: "outlined", onClick: () => void save(), disabled: busy || !subject.trim(), children: isNew ? t('requests.saveDraft') : t('common.save') }), !isNew && request && (_jsx(Button, { variant: "contained", startIcon: _jsx(SendIcon, { sx: flip }), onClick: () => void submit(), disabled: busy || !subject.trim(), children: t('requests.send') })), !isNew && _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: t('requests.sendHint') })] })] })) : (request && (_jsxs(_Fragment, { children: [_jsxs(FieldSection, { title: t('requests.sections.main'), icon: _jsx(DescriptionOutlinedIcon, {}), children: [_jsx(FieldBox, { label: t('requests.number'), icon: _jsx(TagOutlinedIcon, {}), children: request.number }), _jsx(FieldBox, { label: t('requests.category'), icon: _jsx(CategoryOutlinedIcon, {}), children: t(`requests.categories.${request.category}`) }), _jsx(FieldBox, { label: t('requests.subject'), icon: _jsx(SubjectOutlinedIcon, {}), wide: true, children: request.subject }), _jsx(FieldBox, { label: t('requests.amount'), icon: _jsx(PaymentsOutlinedIcon, {}), highlight: request.amount !== null, children: request.amount !== null ? money(request.amount) : '—' })] }), _jsxs(FieldSection, { title: t('requests.sections.people'), icon: _jsx(PersonOutlinedIcon, {}), tone: "sky", children: [_jsxs(FieldBox, { label: t('requests.createdBy'), icon: _jsx(PersonOutlinedIcon, {}), children: [request.createdByName, " \u2014 ", date(request.createdAt)] }), _jsx(FieldBox, { label: t('requests.directManager'), icon: _jsx(ManageAccountsOutlinedIcon, {}), children: personName(request.directManagerId) })] }), (request.details || request.approverNotes) && (_jsxs(FieldSection, { title: t('requests.details'), icon: _jsx(NotesOutlinedIcon, {}), tone: "gold", columns: 1, children: [request.details && (_jsx(FieldBox, { label: t('requests.details'), icon: _jsx(NotesOutlinedIcon, {}), multiline: true, children: request.details })), request.approverNotes && (_jsx(FieldBox, { label: t('requests.approverNotes'), icon: _jsx(RateReviewOutlinedIcon, {}), multiline: true, children: request.approverNotes }))] })), !request.approval && _jsx(Typography, { sx: { color: tokens.gray500, fontSize: 13 }, children: t('approval.notSubmitted') })] }))) }) }))] }));
}
