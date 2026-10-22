import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { keyframes } from '@emotion/react';
import { Box, Button, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { movementsApi } from '../../../api/movements';
import { tokens } from '../../../app/theme';
import { MovementWizard } from './MovementWizard';
import { gradient, Transition, TypeIcon, useStateName } from './movementMeta';
const pop = keyframes `
  0% { opacity: 0; transform: translateY(18px) scale(.97); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
`;
const tick = keyframes `
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); }
`;
/**
 * "New action" (or editing a returned one) as the guided popup, then — for a new one — a confirmation of what was sent
 * and what happens next. From a worker's or an employee's page the worker is already chosen.
 */
export function ActionDialog({ id, workerId, onClose, onSent }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const theme = useTheme();
    const phone = useMediaQuery(theme.breakpoints.down('md'));
    const stateName = useStateName();
    const [sent, setSent] = useState(null);
    const saved = async (savedId) => {
        onSent?.();
        if (id) {
            onClose();
            return;
        }
        try {
            setSent(await movementsApi.get(savedId));
        }
        catch {
            navigate(`/operations/movements/${savedId}`);
        }
    };
    return (_jsx(MovementWizard, { id: id, workerId: workerId, onClose: onClose, onSaved: (savedId) => void saved(savedId), done: sent && (_jsxs(Box, { sx: { py: { xs: 3, md: 5 }, textAlign: 'center', animation: `${pop} .4s ease both` }, children: [_jsx(Box, { sx: { mx: 'auto', mb: 2, width: 84, height: 84, borderRadius: '50%', display: 'grid', placeItems: 'center', background: gradient(sent.type), animation: `${tick} .55s cubic-bezier(.2,.8,.2,1) both` }, children: _jsx(TypeIcon, { type: sent.type, size: 56 }) }), _jsx(Typography, { sx: { fontSize: 21, fontWeight: 800, color: tokens.navy800 }, children: t('movements.sentTitle') }), _jsxs(Typography, { sx: { fontSize: 13.5, color: tokens.gray600, mb: 3 }, children: [t(`movements.types.${sent.type}`), " \u00B7 ", _jsx("b", { dir: "ltr", children: sent.movementNo }), " \u00B7 ", t('movements.sentHint')] }), _jsx(Box, { sx: { maxWidth: 620, mx: 'auto', p: 2.5, borderRadius: `${tokens.radius + 4}px`, bgcolor: '#fff', border: `1px solid ${tokens.gray100}`, mb: 3 }, children: _jsx(Transition, { big: !phone, from: sent.fromPlacement, fromLabel: stateName(sent.fromPlacement), fromSub: sent.fromProjectName, to: sent.opensPeriod, toLabel: stateName(sent.opensPeriod), toSub: sent.opensPeriod === 'Work' || sent.opensPeriod === 'ClientVacation' ? (sent.projectName ?? sent.fromProjectName) : sent.place }) }), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'center', gap: 1.5 }, children: [_jsx(Button, { variant: "contained", endIcon: _jsx(OpenInNewIcon, {}), onClick: () => navigate(`/operations/movements/${sent.id}`), sx: { background: gradient(sent.type), px: 3 }, children: t('movements.openSent') }), _jsx(Button, { variant: "outlined", onClick: onClose, sx: { px: 3 }, children: t('common.close') })] })] })) }));
}
