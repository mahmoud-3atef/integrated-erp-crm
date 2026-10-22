import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { workflowApi } from '../../api/workflow';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
/**
 * "Run an approval process" on one record, for administrators of processes (like "Run workflow" in the old CRM):
 * pick an active process of the screen and start it on the record, whatever its start condition.
 */
export function RunProcessButton({ screen, recordId, title, onStarted }) {
    const { t, i18n } = useTranslation();
    const { can } = useSession();
    const [open, setOpen] = useState(false);
    const [processes, setProcesses] = useState(null);
    const [processId, setProcessId] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    if (!can('workflow.processes.manage', true)) {
        return null;
    }
    const show = async () => {
        setOpen(true);
        setError(null);
        try {
            const list = (await workflowApi.processes()).filter((p) => p.screen === screen && p.isActive);
            setProcesses(list);
            setProcessId(list[0]?.id ?? '');
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    };
    const run = async () => {
        setBusy(true);
        setError(null);
        try {
            await workflowApi.startInstance(screen, recordId, processId, title);
            setOpen(false);
            onStarted();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outlined", startIcon: _jsx(PlayCircleOutlinedIcon, {}), onClick: () => void show(), children: t('process.run.button') }), open && (_jsxs(Dialog, { open: true, onClose: () => setOpen(false), fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: t('process.run.title') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Alert, { severity: "info", sx: { mb: 2 }, children: t('process.run.hint') }), processes && processes.length === 0 ? (_jsx(Alert, { severity: "warning", children: t('process.run.none') })) : (_jsx(TextField, { select: true, fullWidth: true, label: t('process.run.process'), value: processId, onChange: (e) => setProcessId(e.target.value), children: (processes ?? []).map((p) => (_jsxs(MenuItem, { value: p.id, children: [localName(p, i18n.language), " \u2014 v", p.currentVersion] }, p.id))) }))] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setOpen(false), children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: busy || !processId, onClick: () => void run(), children: t('process.run.start') })] })] }))] }));
}
