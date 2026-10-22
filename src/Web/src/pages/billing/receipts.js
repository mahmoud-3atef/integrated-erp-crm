import { jsx as _jsx } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { Badge } from '../../components/ui';
export const receiptTone = { Draft: 'neutral', AccountantReview: 'warning', FinanceReview: 'warning', Returned: 'info', Approved: 'success' };
export function ReceiptStatusBadge({ status }) {
    const { t } = useTranslation();
    return _jsx(Badge, { tone: receiptTone[status], children: t(`receipts.status.${status}`) });
}
export const monthStart = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
export const monthEnd = (first) => {
    const d = new Date(`${first}T00:00:00`);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
};
