import re, os, sys, collections
# Generates Markdown tables for 02 (entities/fields) and 03 (option sets) from extracted metadata.
A = r'C:\Cl\anl'
CODE = r'C:\Cl\Project-Update\project05-10-2026\project19042026'

def rows(path, skip=2):
    out = []
    for i, l in enumerate(open(path, encoding='utf-8-sig')):
        if i < skip:
            continue
        l = l.rstrip('\n').rstrip('\r')
        if l.strip():
            out.append(l.split('|'))
    return out

# code files
files = {}
for d, _, fs in os.walk(CODE):
    parts = re.split(r'[\\/]', d)
    if 'obj' in parts or 'bin' in parts or 'carepro_mobile' in parts:
        continue
    for f in fs:
        if f.endswith(('.cs', '.ashx')) and 'designer' not in f and 'Copy' not in f:
            files[f] = open(os.path.join(d, f), encoding='utf-8-sig', errors='ignore').read().lower()

def short(name):
    return re.sub(r'\.(aspx\.cs|cs|ashx)$', '', name)

def where(attr):
    a = attr.lower()
    pat = re.compile(r'\b' + re.escape(a) + r'(name)?\b')
    hits = [short(f) for f, t in files.items() if pat.search(t)]
    hits.sort()
    if len(hits) > 4:
        return ', '.join(hits[:4]) + f' (+{len(hits)-4})'
    return ', '.join(hits)

counts = {}
for r in rows(os.path.join(A, 'entities.txt')):
    if len(r) >= 3:
        counts[r[0].lower()] = r[2]

TYPE = {'nvarchar': 'نص', 'ntext': 'نص طويل', 'lookup': 'Lookup', 'picklist': 'OptionSet', 'datetime': 'تاريخ/وقت (UTC)',
        'money': 'مبلغ (Money)', 'decimal': 'رقم عشري', 'int': 'رقم صحيح', 'bit': 'نعم/لا', 'status': 'Status',
        'state': 'State', 'owner': 'Owner', 'float': 'رقم عشري (float)', 'customer': 'Customer', 'uniqueidentifier': 'GUID',
        'primarykey': 'PK'}

ents = collections.OrderedDict()
for r in rows(os.path.join(A, 'used2.txt'), skip=0):
    ent, attr, typ, length, custom, ar, en, target = (r + [''] * 8)[:8]
    ents.setdefault(ent.lower(), []).append((attr, typ, length, ar, en, target))

out = open(os.path.join(A, 'gen_02_tables.md'), 'w', encoding='utf-8')
order = ['new_employee', 'new_project', 'new_deliverorder', 'new_empwork', 'mw_lodginorderdetails', 'mw_housing',
         'mw_housingapartments', 'new_ajeercontract', 'new_thijridate', 'new_attendance', 'new_invoice', 'new_invoicdetail',
         'hr_vicrequest', 'new_leaverequest', 'new_agent', 'new_candidate', 'new_attachments', 'new_profession', 'new_country']
for e in order:
    if e not in ents:
        continue
    out.write(f'\n#### `{e}` — {counts.get(e, "?")} سجل\n\n')
    out.write('| الحقل | النوع | الاسم العربي | الاسم الإنجليزي | يشير إلى | مستخدم في |\n|---|---|---|---|---|---|\n')
    for attr, typ, length, ar, en, target in sorted(ents[e], key=lambda x: (x[0] not in ('statuscode', 'statecode', 'createdon', 'createdby', 'ownerid'), x[0])):
        t = TYPE.get(typ, typ)
        if typ == 'nvarchar' and length not in ('', 'NULL'):
            t += f' ({int(length)//2 if length.isdigit() else length})'
        ar = '' if ar == 'NULL' else ar.replace('|', '/')
        en = '' if en == 'NULL' else en.replace('|', '/')
        target = '' if target == 'NULL' else target
        out.write(f'| `{attr}` | {t} | {ar} | {en} | {target} | {where(attr)} |\n')
out.close()

# option sets
opts = collections.OrderedDict()
for r in rows(os.path.join(A, 'options.txt')):
    if len(r) < 5:
        continue
    ent, attr, val, ar, en = r[:5]
    opts.setdefault((ent.lower(), attr.lower()), []).append((val, ar, en))

used_tokens = set(l.strip() for l in open(os.path.join(A, 'codetokens.txt'), encoding='utf-8'))
out = open(os.path.join(A, 'gen_03_tables.md'), 'w', encoding='utf-8')
oorder = ['new_employee', 'new_empwork', 'new_deliverorder', 'mw_lodginorderdetails', 'mw_housing', 'new_invoice', 'new_invoicdetail',
          'hr_vicrequest', 'new_leaverequest', 'new_attendance', 'new_project', 'new_agent', 'new_candidate', 'new_ajeercontract', 'task']
for e in oorder:
    for (oe, attr), vals in opts.items():
        if oe != e:
            continue
        if attr not in ('statuscode',) and attr not in used_tokens:
            continue
        if attr == 'statuscode' and e == 'task':
            pass
        out.write(f'\n#### `{e}.{attr}`\n\n| القيمة | العربي | English |\n|---|---|---|\n')
        for val, ar, en in vals:
            ar = '—' if ar == 'NULL' else ar.strip().replace('|', '/')
            en = '—' if en == 'NULL' else en.strip().replace('|', '/')
            out.write(f'| {val} | {ar} | {en} |\n')
out.close()
print('ok')
