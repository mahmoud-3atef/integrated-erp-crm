import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workflowApi } from '../../api/workflow';
import { ErrorMessage } from '../../auth/AuthLayout';
import { ApprovalBar, ApprovalLog } from '../../components/workflow/RecordApproval';
import { PageHeader, Panel } from '../../components/ui';
/**
 * An approval opened from the inbox or the monitor: the approval lives on the record's own page (stage bar and the
 * approval tab), so this opens that page; it shows the approval alone only for a record without a page.
 */
export function ApprovalDetailPage() {
    const { i18n } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const [detail, setDetail] = useState(null);
    const [error, setError] = useState(null);
    const load = async () => {
        try {
            const value = await workflowApi.instance(id);
            if (value.summary.link) {
                navigate(value.summary.link, { replace: true });
                return;
            }
            setDetail(value);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    };
    useEffect(() => {
        void load();
    }, [id]);
    if (!detail) {
        return _jsx(ErrorMessage, { messageKey: error });
    }
    const ar = i18n.language === 'ar';
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: detail.summary.title, subtitle: ar ? detail.summary.screenNameAr : detail.summary.screenNameEn }), _jsx(ApprovalBar, { status: detail.status, detail: detail, onChanged: () => void load() }), _jsx(Panel, { padding: 2.5, children: _jsx(ApprovalLog, { status: detail.status, detail: detail }) })] }));
}
