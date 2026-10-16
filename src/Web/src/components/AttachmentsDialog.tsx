import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../api/access';
import { errorKey } from '../api/auth';
import { acceptedFiles, documentsApi, type Attachment, type DocumentType } from '../api/documents';
import { tokens } from '../app/theme';
import { ErrorMessage } from '../auth/AuthLayout';
import { Badge, EmptyState } from './ui';

interface AttachmentsDialogProps {
  title: string;
  ownerType: string;
  ownerId: string;
  canManage: boolean;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Files on one record: list, download, and (with the record's manage permission) upload and remove. */
export function AttachmentsDialog({ title, ownerType, ownerId, canManage, onClose }: AttachmentsDialogProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Attachment[]>([]);
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [type, setType] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [expiresOn, setExpiresOn] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await documentsApi.attachments(ownerType, ownerId));
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [ownerType, ownerId]);

  useEffect(() => {
    void load();
    documentsApi
      .documentTypes()
      .then((list) => {
        setTypes(list);
        setType((current) => current || list[0]?.code || '');
      })
      .catch((failure: unknown) => setError(errorKey(failure)));
  }, [load]);

  const typeName = (code: string) => {
    const found = types.find((x) => x.code === code);
    return found ? localName(found, i18n.language) : code;
  };
  const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'Asia/Riyadh' }).format(new Date(value));

  const submit = async () => {
    if (!file) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await documentsApi.upload({ ownerType, ownerId, documentType: type, file, expiresOn: expiresOn || null, notes });
      setFile(null);
      setExpiresOn('');
      setNotes('');
      if (fileInput.current) {
        fileInput.current.value = '';
      }
      await load();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: Attachment) => {
    if (!window.confirm(t('attachments.confirmRemove', { name: item.fileName }))) {
      return;
    }
    try {
      await documentsApi.remove(item.id);
      await load();
    } catch (failure) {
      setError(errorKey(failure));
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" fullScreen={phone}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AttachFileIcon sx={{ color: tokens.navy700 }} />
        {t('attachments.title')} — {title}
      </DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        {canManage && (
          <Box sx={{ p: 2, mb: 2, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50, border: `1px dashed ${tokens.gray300}` }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
              <TextField select size="small" label={t('attachments.type')} value={type} onChange={(e) => setType(e.target.value)} sx={{ flex: 1 }}>
                {types.map((x) => (
                  <MenuItem key={x.code} value={x.code}>
                    {localName(x, i18n.language)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                type="date"
                label={t('attachments.expiresOn')}
                value={expiresOn}
                onChange={(e) => setExpiresOn(e.target.value)}
                sx={{ flex: 1 }}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today() } }}
              />
            </Stack>
            <TextField size="small" label={t('attachments.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} sx={{ mb: 1.5 }} slotProps={{ htmlInput: { maxLength: 500 } }} />
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
                {t('attachments.choose')}
                <input ref={fileInput} hidden type="file" accept={acceptedFiles} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </Button>
              <Typography sx={{ flex: 1, minWidth: 120, fontSize: 13, color: file ? tokens.gray900 : tokens.gray500 }} noWrap>
                {file ? `${file.name} (${size(file.size)})` : t('attachments.allowed')}
              </Typography>
              <Button variant="contained" onClick={() => void submit()} disabled={busy || !file || !type}>
                {busy ? t('common.loading') : t('attachments.upload')}
              </Button>
            </Stack>
          </Box>
        )}
        <TableContainer sx={{ borderRadius: '6px' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('attachments.file')}</TableCell>
                <TableCell>{t('attachments.type')}</TableCell>
                <TableCell>{t('attachments.expiresOn')}</TableCell>
                <TableCell>{t('attachments.uploaded')}</TableCell>
                <TableCell align="center">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const expired = item.expiresOn !== null && item.expiresOn < today();
                return (
                  <TableRow key={item.id} hover>
                    <TableCell sx={{ maxWidth: 260 }}>
                      <Typography noWrap sx={{ fontSize: 13, fontWeight: 500, color: tokens.gray900 }} title={item.fileName}>
                        {item.fileName}
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{size(item.size)}</Typography>
                    </TableCell>
                    <TableCell>{typeName(item.documentType)}</TableCell>
                    <TableCell>
                      {item.expiresOn ? <Badge tone={expired ? 'danger' : 'neutral'}>{expired ? t('attachments.expired') : date(item.expiresOn)}</Badge> : '—'}
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 12.5 }}>{item.uploadedBy}</Typography>
                      <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{date(item.uploadedAt)}</Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title={t('attachments.download')}>
                        <IconButton size="small" component="a" href={documentsApi.contentUrl(item.id)} aria-label={`${t('attachments.download')} ${item.fileName}`}>
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {canManage && (
                        <Tooltip title={t('attachments.remove')}>
                          <IconButton size="small" onClick={() => void remove(item)} aria-label={`${t('attachments.remove')} ${item.fileName}`}>
                            <DeleteOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        {items.length === 0 && <EmptyState text={t('attachments.empty')} />}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
