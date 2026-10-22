import { jsx as _jsx } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { Badge } from '../../components/ui';
export const timesheetTone = { Draft: 'neutral', InApproval: 'warning', Returned: 'info', Approved: 'success' };
const sourceTone = { Company: 'primary', Supplier: 'info', Unknown: 'warning' };
export function TimesheetStatusBadge({ status }) {
    const { t } = useTranslation();
    return _jsx(Badge, { tone: timesheetTone[status], children: t(`timesheets.status.${status}`) });
}
export function SourceBadge({ source, supplier }) {
    const { t } = useTranslation();
    return _jsx(Badge, { tone: sourceTone[source], children: source === 'Supplier' && supplier ? supplier : t(`timesheets.source.${source}`) });
}
