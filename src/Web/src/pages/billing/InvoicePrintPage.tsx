import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { Box, Button, GlobalStyles, Typography } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { invoiceApi, type InvoiceDetail, type InvoiceKind, type Party } from '../../api/billing';
import { ErrorMessage } from '../../auth/AuthLayout';
import i18n from '../../i18n';

/** Both languages, as the tax invoice prints: the Arabic, and the English under it (each in its own direction). */
function Bi({ k, options, size = 0.86 }: { k: string; options?: Record<string, unknown>; size?: number }) {
  return (
    <>
      <span>{i18n.t(k, { ...options, lng: 'ar' })}</span>
      <span dir="ltr" style={{ display: 'block', fontSize: `${size}em`, opacity: 0.8 }}>
        {i18n.t(k, { ...options, lng: 'en' })}
      </span>
    </>
  );
}
const money = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (value: string) => value.slice(0, 10);

const titles: Record<InvoiceKind, [string, string]> = {
  Invoice: ['فاتورة ضريبية', 'Tax Invoice'],
  CreditNote: ['إشعار دائن', 'Credit Note'],
  DebitNote: ['إشعار مدين', 'Debit Note'],
};

const cell = { border: '1px solid #c9d3e0', padding: '5px 7px', fontSize: 11.5 } as const;
const head = { ...cell, background: '#1f3a5f', color: '#fff', fontWeight: 700, textAlign: 'center' as const };

/** Both languages on one line, each isolated in its own direction. */
function BiInline({ k }: { k: string }) {
  return (
    <>
      <bdi>{i18n.t(k, { lng: 'ar' })}</bdi> / <bdi>{i18n.t(k, { lng: 'en' })}</bdi>
    </>
  );
}

function PartyBox({ title, party }: { title: ReactNode; party: Party | null }) {
  return (
    <Box sx={{ flex: 1, border: '1px solid #c9d3e0', borderRadius: '6px', p: 1.25 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#1f3a5f', mb: 0.5 }}>{title}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{party?.name ?? '—'}</Typography>
      {party?.nameEn && (
        <Typography dir="ltr" sx={{ fontSize: 12, textAlign: 'start' }}>
          {party.nameEn}
        </Typography>
      )}
      <Typography sx={{ fontSize: 11.5, mt: 0.5 }}>
        <BiInline k="invoices.print.vatNo" />: <b dir="ltr">{party?.vatNumber ?? '—'}</b>
      </Typography>
      <Typography sx={{ fontSize: 11.5 }}>
        <BiInline k="invoices.print.crNo" />: <b dir="ltr">{party?.commercialRegistration ?? '—'}</b>
      </Typography>
      {party?.city && <Typography sx={{ fontSize: 11.5 }}><BiInline k="invoices.print.city" />: {party.city}</Typography>}
    </Box>
  );
}

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ border: '1px solid #c9d3e0', borderRadius: '6px', px: 1, py: 0.6 }}>
      <Typography sx={{ fontSize: 10, color: '#5b6b80' }}>{label}</Typography>
      <Typography sx={{ fontSize: 12.5, fontWeight: 800 }}>{children}</Typography>
    </Box>
  );
}

/** The invoice or note as it prints on A4 (bilingual), then the detailed attachment of its workers. A draft prints with a "draft" mark. */
export function InvoicePrintPage() {
  const { id } = useParams();
  const [inv, setInv] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoiceApi
      .get(id!)
      .then((value) => {
        setInv(value);
        document.title = `${value.invoiceNo ?? 'DRAFT'} — ${value.projectName}`;
      })
      .catch((failure: unknown) => setError(errorKey(failure)));
  }, [id]);

  if (!inv) {
    return (
      <Box sx={{ p: 3 }}>
        <ErrorMessage messageKey={error} />
      </Box>
    );
  }

  const [titleAr, titleEn] = titles[inv.kind];
  const lines = inv.items.filter((i) => i.component !== 'Discount');
  const discount = inv.items.find((i) => i.component === 'Discount');
  const gross = lines.reduce((s, i) => s + i.amount, 0);
  const draft = inv.status !== 'Issued';

  return (
    <Box dir="rtl" sx={{ bgcolor: '#eef1f5', minHeight: '100vh', py: 3, '@media print': { bgcolor: '#fff', py: 0 } }}>
      <GlobalStyles styles={{ '@page': { size: 'A4', margin: '10mm' }, body: { background: '#eef1f5' }, '@media print': { body: { background: '#fff' } } }} />
      <Box sx={{ textAlign: 'center', mb: 2, '@media print': { display: 'none' } }}>
        <Button variant="contained" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
          <BiInline k="invoices.print.button" />
        </Button>
      </Box>

      <Box sx={{ position: 'relative', width: '190mm', mx: 'auto', bgcolor: '#fff', p: '8mm', boxShadow: '0 2px 12px rgba(0,0,0,.08)', color: '#14243a', '@media print': { boxShadow: 'none', p: 0, width: 'auto' } }}>
        {draft && (
          <Typography sx={{ position: 'absolute', top: '40%', left: 0, right: 0, textAlign: 'center', fontSize: 72, fontWeight: 900, color: 'rgba(200,40,40,.12)', transform: 'rotate(-20deg)', pointerEvents: 'none' }}>
            مسودة · DRAFT
          </Typography>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #1f3a5f', pb: 1, mb: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#1f3a5f' }}>{titleAr}</Typography>
            <Typography dir="ltr" sx={{ fontSize: 16, fontWeight: 800, color: '#1f3a5f', textAlign: 'start' }}>
              {titleEn}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'left' }}>
            <Typography dir="ltr" sx={{ fontSize: 18, fontWeight: 900 }}>
              {inv.invoiceNo ?? 'DRAFT'}
            </Typography>
            {inv.originalInvoiceNo && (
              <Typography sx={{ fontSize: 11.5 }}>
                <BiInline k="invoices.print.onInvoice" />: <b dir="ltr">{inv.originalInvoiceNo}</b>
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
          <PartyBox title={<Bi k='invoices.print.seller' />} party={inv.seller} />
          <PartyBox title={<Bi k='invoices.print.buyer' />} party={inv.customer} />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mb: 1.5 }}>
          <Field label={<Bi k='invoices.print.date' />}>{day(inv.invoiceDate)}</Field>
          <Field label={<Bi k='invoices.print.due' />}>{day(inv.dueDate)}</Field>
          <Field label={<Bi k='invoices.print.period' />}>
            {day(inv.periodFrom)} — {day(inv.periodTo)}
          </Field>
          <Field label={<Bi k='invoices.print.project' />}>{inv.projectCode}</Field>
        </Box>
        <Typography sx={{ fontSize: 12, mb: 1 }}>
          <BiInline k="invoices.print.project" />: <b>{inv.projectName}</b>
          {inv.kind === 'Invoice' && (
            <>
              {' · '}
              <BiInline k="invoices.print.workers" />: {new Set(inv.workers.map((w) => w.workerId)).size}
            </>
          )}
        </Typography>
        {inv.reason && (
          <Typography sx={{ fontSize: 12, mb: 1 }}>
            <BiInline k="invoices.print.reason" />: <b>{inv.reason}</b>
          </Typography>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
          <thead>
            <tr>
              <th style={{ ...head, width: 30 }}>#</th>
              <th style={head}><Bi k="invoices.print.description" /></th>
              <th style={{ ...head, width: 110 }}><Bi k="invoices.print.amount" /></th>
              <th style={{ ...head, width: 60 }}><Bi k="invoices.print.rate" /></th>
              <th style={{ ...head, width: 90 }}><Bi k="invoices.print.vat" /></th>
              <th style={{ ...head, width: 110 }}><Bi k="invoices.print.total" /></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((i, n) => {
              const vat = Math.round(i.amount * inv.vatRate * 100) / 100;
              return (
                <tr key={i.lineNo}>
                  <td style={{ ...cell, textAlign: 'center' }}>{n + 1}</td>
                  <td style={cell}>
                    <Bi k={`invoices.components.${i.component}`} />
                    {i.description && <div style={{ fontSize: 10.5, color: '#5b6b80' }}>{i.description}</div>}
                  </td>
                  <td style={{ ...cell, textAlign: 'center' }}>{money(i.amount)}</td>
                  <td style={{ ...cell, textAlign: 'center' }}>{Math.round(inv.vatRate * 100)}%</td>
                  <td style={{ ...cell, textAlign: 'center' }}>{money(vat)}</td>
                  <td style={{ ...cell, textAlign: 'center' }}>{money(i.amount + vat)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <table style={{ width: '62%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={cell}><Bi k="invoices.print.gross" /></td>
                <td style={{ ...cell, textAlign: 'center', width: 130 }}>{money(gross)}</td>
              </tr>
              {discount && (
                <tr>
                  <td style={cell}><Bi k="invoices.components.Discount" /></td>
                  <td style={{ ...cell, textAlign: 'center', color: '#b42318' }}>{money(discount.amount)}</td>
                </tr>
              )}
              <tr>
                <td style={cell}><Bi k="invoices.print.taxable" /></td>
                <td style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{money(inv.amount)}</td>
              </tr>
              <tr>
                <td style={cell}><Bi k="invoices.print.vatTotal" options={{ rate: Math.round(inv.vatRate * 100) }} /></td>
                <td style={{ ...cell, textAlign: 'center' }}>{money(inv.vat)}</td>
              </tr>
              <tr>
                <td style={{ ...cell, background: '#1f3a5f', color: '#fff', fontWeight: 800 }}><Bi k="invoices.print.grand" /></td>
                <td style={{ ...cell, background: '#1f3a5f', color: '#fff', fontWeight: 900, textAlign: 'center', fontSize: 13 }}>{money(inv.total)} SAR</td>
              </tr>
            </tbody>
          </table>
        </Box>
        {inv.remarks && <Typography sx={{ fontSize: 11.5, mt: 1.5 }}><BiInline k="invoices.print.remarks" />: {inv.remarks}</Typography>}
        <Typography sx={{ fontSize: 10, color: '#5b6b80', mt: 2 }}><BiInline k="invoices.print.zatcaLater" /></Typography>

        {inv.kind === 'Invoice' && inv.workers.length > 0 && (
          <Box sx={{ pageBreakBefore: 'always', breakBefore: 'page', mt: 4, '@media print': { mt: 0 } }}>
            <Typography sx={{ fontSize: 15, fontWeight: 900, color: '#1f3a5f', mb: 1 }}>
              <BiInline k="invoices.print.attachment" /> — <span dir="ltr">{inv.invoiceNo ?? 'DRAFT'}</span>
            </Typography>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                {[4, 10, 23, 12, 6, 9, 9, 9, 9, 9].map((w, n) => (
                  <col key={n} style={{ width: `${w}%` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {['#', 'workerNo', 'name', 'period', 'days', 'salary', 'fees', 'adjustments', 'amount', 'total'].map((k) => (
                    <th key={k} style={{ ...head, fontSize: 9, padding: '4px 3px' }}>
                      {k === '#' ? '#' : <Bi k={`invoices.print.cols.${k}`} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inv.workers.map((w, n) => (
                  <tr key={`${w.workerId}-${n}`}>
                    <td style={{ ...cell, padding: '4px 3px', fontSize: 9.5, textAlign: 'center' }}>{n + 1}</td>
                    <td style={{ ...cell, padding: '4px 3px', fontSize: 9.5 }} dir="ltr">
                      {w.workerNo}
                    </td>
                    <td style={{ ...cell, padding: '4px 3px', fontSize: 9.5 }} dir="ltr">
                      {w.name}
                    </td>
                    <td style={{ ...cell, padding: '4px 3px', fontSize: 9.5, textAlign: 'center' }} dir="ltr">
                      {day(w.lineFrom)}
                      <br />
                      {day(w.lineTo)}
                    </td>
                    <td style={{ ...cell, padding: '4px 3px', fontSize: 9.5, textAlign: 'center' }}>{w.workDays - w.absenceDays}</td>
                    <td style={{ ...cell, padding: '4px 3px', fontSize: 9.5, textAlign: 'center' }}>{money(w.dueSalary - w.absenceAmount)}</td>
                    <td style={{ ...cell, padding: '4px 3px', fontSize: 9.5, textAlign: 'center' }}>{money(w.dueFees)}</td>
                    <td style={{ ...cell, padding: '4px 3px', fontSize: 9.5, textAlign: 'center' }}>{money(w.overtime + w.clientAdditions - w.clientDeductions - w.customerLoans + w.otherCosts + w.gosi)}</td>
                    <td style={{ ...cell, padding: '4px 3px', fontSize: 9.5, textAlign: 'center' }}>{money(w.amount)}</td>
                    <td style={{ ...cell, padding: '4px 3px', fontSize: 9.5, textAlign: 'center', fontWeight: 700 }}>{money(w.total)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={8} style={{ ...cell, fontWeight: 800 }}>
                    <Bi k="invoices.print.grand" />
                  </td>
                  <td style={{ ...cell, textAlign: 'center', fontWeight: 800 }}>{money(inv.amount)}</td>
                  <td style={{ ...cell, textAlign: 'center', fontWeight: 800 }}>{money(inv.total)}</td>
                </tr>
              </tbody>
            </table>
          </Box>
        )}
      </Box>
    </Box>
  );
}
