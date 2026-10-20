import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { Alert, Box, Button, GlobalStyles, MenuItem, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { payslipMax, payslipsApi, type Payslip, type PayslipBatch, type PayslipItem, type PayslipKind } from '../../api/payslips';
import { ErrorMessage } from '../../auth/AuthLayout';
import i18n from '../../i18n';
import { amountInArabic, amountInEnglish } from '../../utils/amountWords';

type Lang = 'both' | 'ar';

const navy = '#082B49';
const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const day = (value: string) => value.slice(0, 10).replaceAll('-', '/');
const ar = (k: string, o?: Record<string, unknown>) => i18n.t(k, { ...o, lng: 'ar' });
const en = (k: string, o?: Record<string, unknown>) => i18n.t(k, { ...o, lng: 'en' });

/** A label in Arabic with its English beside it (or Arabic only). */
function L({ k, o, lang, block }: { k: string; o?: Record<string, unknown>; lang: Lang; block?: boolean }) {
  return (
    <>
      <span>{ar(k, o)}</span>
      {lang === 'both' && (
        <>
          {block ? null : ' '}
          <Box component="bdi" dir="ltr" sx={{ display: block ? 'block' : 'inline', fontSize: '0.82em', color: '#64748B', fontWeight: 500 }}>
            {block ? en(k, o) : `/ ${en(k, o)}`}
          </Box>
        </>
      )}
    </>
  );
}

/**
 * The payslips of a run (docs/03-migration-plan/13): one A4 page each, in Arabic with English (or Arabic only),
 * built by the server from the run's saved lines; before approval each carries a «draft» mark. Nothing is kept in the
 * browser, and the address holds the run and the grid's filters only, never an amount.
 */
export function PayslipsPrintPage({ kind }: { kind: PayslipKind }) {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const [batch, setBatch] = useState<PayslipBatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('both');
  useEffect(() => {
    payslipsApi(kind, id, params)
      .then(setBatch)
      .catch((f) => setError(errorKey(f)));
  }, [kind, id, params]);
  useEffect(() => {
    if (batch) document.title = `${ar('payslip.title')} · ${batch.runNo}`;
  }, [batch]);

  return (
    <Box dir="rtl" sx={{ bgcolor: '#E9EEF5', minHeight: '100vh', color: '#0F2747', fontFamily: '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif', '@media print': { bgcolor: '#fff' } }}>
      <GlobalStyles styles={{ '@page': { size: 'A4', margin: '9mm' }, '@media print': { body: { background: '#fff' } } }} />
      <Stack
        direction="row"
        sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: '#fff', borderBottom: '1px solid #E2E8F0', px: 3, py: 1.25, gap: 1.5, alignItems: 'center', flexWrap: 'wrap', '@media print': { display: 'none' } }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
          {ar('payslip.title')}
          {batch && (
            <>
              {' · '}
              <bdi>{batch.runNo}</bdi> · {batch.legalEntityNameAr} · <bdi>{`${day(batch.from)} – ${day(batch.to)}`}</bdi>
            </>
          )}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {batch && <Typography sx={{ fontSize: 13, color: '#64748B' }}>{ar('payslip.count', { shown: batch.items.length, total: batch.total })}</Typography>}
        <TextField select size="small" value={lang} onChange={(e) => setLang(e.target.value as Lang)} sx={{ width: 170 }} slotProps={{ htmlInput: { 'aria-label': ar('payslip.language') } }}>
          <MenuItem value="both">{ar('payslip.languageBoth')}</MenuItem>
          <MenuItem value="ar">{ar('payslip.languageAr')}</MenuItem>
        </TextField>
        <Button variant="contained" disabled={!batch || batch.items.length === 0} startIcon={<PrintOutlinedIcon />} onClick={() => window.print()} sx={{ bgcolor: '#2563EB', borderRadius: '8px' }}>
          {ar('payslip.print')}
        </Button>
      </Stack>
      <Box sx={{ px: 2, '@media print': { px: 0 } }}>
        {error ? (
          <Box sx={{ maxWidth: 600, mx: 'auto', pt: 4 }}>
            <ErrorMessage messageKey={error} />
          </Box>
        ) : !batch ? (
          <Box sx={{ width: '210mm', maxWidth: '100%', mx: 'auto', pt: 3 }}>
            <Skeleton variant="rounded" height={900} />
          </Box>
        ) : batch.items.length === 0 ? (
          <Typography sx={{ textAlign: 'center', pt: 6, color: '#64748B' }}>{ar('payslip.none')}</Typography>
        ) : (
          <>
            {batch.total > batch.items.length && (
              <Alert severity="warning" sx={{ maxWidth: '210mm', mx: 'auto', mt: 2, '@media print': { display: 'none' } }}>
                {ar('payslip.limit', { max: payslipMax, total: batch.total })}
              </Alert>
            )}
            {batch.items.map((p) => (
              <Sheet key={p.lineId} batch={batch} slip={p} lang={lang} />
            ))}
          </>
        )}
      </Box>
    </Box>
  );
}

function Fact({ k, lang, children }: { k: string; lang: Lang; children: ReactNode }) {
  return (
    <Box sx={{ p: '6px 10px', borderInlineStart: '1px solid #E6ECF4', borderBottom: '1px solid #E6ECF4', fontSize: 12.5, minWidth: 0 }}>
      <Box sx={{ color: '#64748B', fontSize: 10.5 }}>
        <L k={k} lang={lang} />
      </Box>
      <Box component="b" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
        {children}
      </Box>
    </Box>
  );
}

function itemLabel(i: PayslipItem, lng: 'ar' | 'en') {
  const t = (k: string, o?: Record<string, unknown>) => i18n.t(k, { ...o, lng });
  const base = t(`payslip.items.${i.code}`, { defaultValue: i.code });
  const qtyText = i.quantity ? t(`payslip.qty.${i.code}`, { value: qty(i.quantity), defaultValue: '' }) : '';
  return [base, i.reference, qtyText ? `(${qtyText})` : '', i.note ? `— ${i.note}` : ''].filter(Boolean).join(' ');
}

function Items({ title, items, total, lang, tone }: { title: string; items: PayslipItem[]; total: number; lang: Lang; tone: 'earn' | 'cut' }) {
  const look = tone === 'earn' ? { bg: '#E3F6EC', fg: '#047857' } : { bg: '#FDF1DC', fg: '#B45309' };
  return (
    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, alignSelf: 'start', '& td': { p: '5px 10px', borderBottom: '1px solid #EEF2F7' } }}>
      <thead>
        <tr>
          <Box component="th" sx={{ textAlign: 'start', p: '7px 10px', bgcolor: look.bg, color: look.fg, fontSize: 12 }}>
            <L k={title} lang={lang} />
          </Box>
          <Box component="th" sx={{ textAlign: 'left', p: '7px 10px', bgcolor: look.bg, color: look.fg, fontSize: 12 }}>
            {ar('hr.sar')}
          </Box>
        </tr>
      </thead>
      <tbody>
        {items.map((i, n) => (
          <tr key={`${i.code}-${n}`}>
            <td>
              <bdi>{itemLabel(i, 'ar')}</bdi>
              {lang === 'both' && (
                <Box dir="ltr" sx={{ fontSize: 10.5, color: '#64748B', textAlign: 'end' }}>
                  {itemLabel(i, 'en')}
                </Box>
              )}
            </td>
            <Box component="td" dir="ltr" sx={{ textAlign: 'left', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {money(i.amount)}
            </Box>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <Box component="tr" sx={{ '& td': { fontWeight: 800, borderTop: '2px solid #D7E0EC', bgcolor: '#F8FAFC' } }}>
          <td>
            <L k="payslip.total" lang={lang} />
          </td>
          <Box component="td" dir="ltr" sx={{ textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>
            {money(total)}
          </Box>
        </Box>
      </tfoot>
    </Box>
  );
}

function Row({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, py: '3px' }}>
      <span>{label}</span>
      <Box component="b" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {value}
      </Box>
    </Stack>
  );
}

const box = { border: '1px solid #D7E0EC', borderRadius: '8px', p: '10px 12px', fontSize: 12 } as const;

/** One payslip, one A4 page. */
function Sheet({ batch, slip: p, lang }: { batch: PayslipBatch; slip: Payslip; lang: Lang }) {
  const staff = batch.kind === 'Staff';
  const dash = '—';
  return (
    <Box
      sx={{
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
      }}
    >
      {batch.draft && (
        <Box aria-hidden sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 110, fontWeight: 800, color: 'rgba(220,38,38,.08)', transform: 'rotate(-24deg)', pointerEvents: 'none' }}>
          {ar('payslip.draftMark')}
        </Box>
      )}
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `3px solid ${navy}`, pb: 1.5 }}>
        <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
          <Box component="img" src="/brand/carepro-logo.png" alt="" sx={{ height: 52 }} />
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 15 }}>{batch.legalEntityNameAr}</Typography>
            <Typography dir="ltr" sx={{ fontSize: 12, color: '#64748B', textAlign: 'end' }}>
              {batch.legalEntityNameEn}
              {batch.commercialRegistrationNo && ` · CR ${batch.commercialRegistrationNo}`}
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ textAlign: 'end' }}>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: navy }}>{ar('payslip.title')}</Typography>
          {lang === 'both' && (
            <Typography dir="ltr" sx={{ fontSize: 14, fontWeight: 700, color: '#64748B', textAlign: 'end' }}>
              {en('payslip.title')}
            </Typography>
          )}
          <Typography sx={{ fontWeight: 700, mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
            <bdi>{`${day(batch.from)} – ${day(batch.to)}`}</bdi>
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', border: '1px solid #D7E0EC', borderRadius: '8px', overflow: 'hidden' }}>
        <Fact k={staff ? 'payslip.employee' : 'payslip.worker'} lang={lang}>
          <bdi>{p.name}</bdi>
        </Fact>
        <Fact k="payslip.no" lang={lang}>
          <bdi>{p.no}</bdi>
        </Fact>
        <Fact k={staff ? 'payslip.idNumber' : 'payslip.iqama'} lang={lang}>
          {p.idLast4 ? <bdi>{`••••••${p.idLast4}`}</bdi> : dash}
        </Fact>
        {staff ? (
          <>
            <Fact k="payslip.department" lang={lang}>
              {p.departmentAr ?? dash}
            </Fact>
            <Fact k="payslip.job" lang={lang}>
              {p.jobAr ?? dash}
            </Fact>
            <Fact k="payslip.gosi" lang={lang}>
              {p.gosiNo ? <bdi>{p.gosiNo}</bdi> : dash}
              {p.gosiCategory && ` · ${ar(`payslip.gosiCategory.${p.gosiCategory}`)}`}
            </Fact>
            <Fact k="payslip.serviceDays" lang={lang}>
              {qty(p.serviceDays)}
            </Fact>
            <Fact k="payslip.paidDays" lang={lang}>
              {qty(p.paidDays)}
            </Fact>
            <Fact k="payslip.account" lang={lang}>
              {p.iban ? <bdi>{p.iban}</bdi> : dash}
              {p.bankName && ` · ${p.bankName}`}
            </Fact>
          </>
        ) : (
          <>
            <Fact k="payslip.profession" lang={lang}>
              {p.jobAr ?? dash}
            </Fact>
            <Fact k="payslip.project" lang={lang}>
              {p.projectName ?? dash}
            </Fact>
            <Fact k="payslip.status" lang={lang}>
              {p.statusAr ?? dash}
            </Fact>
            <Fact k="payslip.workDays" lang={lang}>
              {qty(p.paidDays)}
            </Fact>
            <Fact k="payslip.absence" lang={lang}>
              {qty(p.absenceDays)}
            </Fact>
            <Fact k="payslip.gosi" lang={lang}>
              {p.gosiCategory ? ar(`payslip.gosiCategory.${p.gosiCategory}`) : dash}
            </Fact>
          </>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.75 }}>
        <Items title="payslip.earnings" items={p.earnings} total={p.totalEarnings} lang={lang} tone="earn" />
        <Items title="payslip.deductions" items={p.deductions} total={p.totalDeductions} lang={lang} tone="cut" />
      </Box>

      <Box>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', bgcolor: navy, color: '#fff', borderRadius: '10px', p: '12px 18px', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
            {ar('payslip.net')}
            {lang === 'both' && <span style={{ opacity: 0.75, fontSize: 12 }}> / {en('payslip.net')}</span>}
          </Typography>
          <Typography dir="ltr" sx={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {money(p.net)} <span style={{ fontSize: 13 }}>{ar('hr.sar')}</span>
          </Typography>
        </Stack>
        <Typography sx={{ fontSize: 12, color: '#475569', mt: 0.5 }}>{amountInArabic(p.net)}</Typography>
        {lang === 'both' && (
          <Typography dir="ltr" sx={{ fontSize: 11.5, color: '#64748B', textAlign: 'end' }}>
            {amountInEnglish(p.net)}
          </Typography>
        )}
      </Box>

      {staff ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.75 }}>
          <Box sx={box}>
            <Typography sx={{ fontWeight: 700, fontSize: 12.5, color: navy, mb: 0.5 }}>
              <L k="payslip.advances" lang={lang} />
            </Typography>
            {p.advances.length === 0 ? (
              <Typography sx={{ fontSize: 12, color: '#64748B' }}>{ar('payslip.noAdvances')}</Typography>
            ) : (
              p.advances.map((a) => <Row key={a.advanceNo} label={<>{ar('payslip.advanceLeft')} <bdi>{a.advanceNo}</bdi> ({ar('payslip.installments', { value: a.installments })})</>} value={money(a.remaining)} />)
            )}
          </Box>
          <Box sx={box}>
            <Typography sx={{ fontWeight: 700, fontSize: 12.5, color: navy, mb: 0.5 }}>
              <L k="payslip.leave" lang={lang} />
            </Typography>
            <Row label={ar('payslip.leaveBalance', { on: day(batch.to) })} value={p.leaveBalance == null ? dash : qty(p.leaveBalance)} />
            <Row label={ar('payslip.leaveTaken')} value={p.leaveTaken == null ? dash : qty(p.leaveTaken)} />
            {p.gosiEmployer > 0 && <Row label={ar('payslip.gosiEmployer')} value={money(p.gosiEmployer)} />}
          </Box>
        </Box>
      ) : (
        p.sources.length > 0 && (
          <Box sx={box}>
            <Typography sx={{ fontWeight: 700, fontSize: 12.5, color: navy, mb: 0.5 }}>
              <L k="payslip.sources" lang={lang} />
            </Typography>
            {p.sources.map((s) => (
              <Row key={s.timesheetNo + s.from} label={<><bdi>{s.timesheetNo}</bdi> · {s.projectName} · <bdi>{`${day(s.from)} – ${day(s.to)}`}</bdi></>} value={ar('payslip.daysValue', { value: qty(s.days) })} />
            ))}
          </Box>
        )
      )}

      <Box sx={{ ...box, bgcolor: batch.draft ? '#FEF2F2' : '#F8FAFC', color: batch.draft ? '#991B1B' : undefined }}>
        {batch.draft ? (
          ar('payslip.draftNote', { run: batch.runNo })
        ) : (
          <>
            {ar('payslip.approvedNote', { run: batch.runNo, on: batch.approvedAt ? day(batch.approvedAt) : dash })}
            {batch.approvedByName && ` · ${batch.approvedByName}`}
          </>
        )}
      </Box>

      <Box sx={{ flex: 1 }} />
      <Stack direction="row" sx={{ justifyContent: 'space-between', fontSize: 10.5, color: '#64748B', borderTop: '1px solid #E2E8F0', pt: 1 }}>
        <span>
          <L k="payslip.footer" lang={lang} />
        </span>
        <bdi>{ar('payslip.printed', { at: `${day(batch.printedAt)} ${new Date(batch.printedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, by: batch.printedBy })}</bdi>
      </Stack>
    </Box>
  );
}
