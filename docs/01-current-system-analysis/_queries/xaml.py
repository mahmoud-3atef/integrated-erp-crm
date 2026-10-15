import re, os, sys, glob, html, collections
d = sys.argv[1]
names = [l.rstrip('\n') for l in open(sys.argv[2], encoding='utf-8-sig')]
out = open(sys.argv[3], 'w', encoding='utf-8')
files = sorted(glob.glob(os.path.join(d, '*.xaml')))
for idx, f in enumerate(files):
    x = open(f, encoding='utf-8-sig', errors='ignore').read()
    x = html.unescape(x)
    n = int(re.search(r'_(\d+)\.xaml', f).group(1)); title = names[n-1] if n-1 < len(names) else ''
    out.write(f"\n### {os.path.basename(f)} | {title}\n")
    created = collections.Counter(re.findall(r'CreateEntity[^>]*EntityName="([a-z_A-Z]+)"', x))
    updated = collections.Counter(re.findall(r'UpdateEntity[^>]*EntityName="([a-z_A-Z]+)"', x))
    setprops = collections.defaultdict(set)
    for m in re.finditer(r'SetEntityProperty[^>]*Attribute="([a-z_A-Z0-9]+)"[^>]*EntityName="([a-z_A-Z]+)"', x):
        setprops[m.group(2)].add(m.group(1))
    states = re.findall(r'SetState[^>]*EntityName="([a-z_A-Z]+)"', x)
    custom = collections.Counter(re.findall(r'AssemblyQualifiedName="([^,"]+)', x))
    custom = {k: v for k, v in custom.items() if not k.startswith('Microsoft.') and not k.startswith('System.')}
    conds = collections.Counter(re.findall(r'GetEntityProperty[^>]*Attribute="([a-z_A-Z0-9]+)"[^>]*EntityName="([a-z_A-Z]+)"', x))
    emails = len(re.findall(r'EntityName="email"', x))
    statusvals = sorted(set(re.findall(r'OptionSetValue[^>]*>\s*(\d{6,9})', x)))
    statusvals2 = sorted(set(re.findall(r'new OptionSetValue\((\d+)\)', x)))
    waits = len(re.findall(r'WaitCondition|Postpone|Timeout', x))
    descr = re.findall(r'DisplayName="([^"]{3,80})"', x)
    descr = [s for s in descr if not re.match(r'^(ConditionStep|ConditionBranchStep|SetEntityProperty|CreateStep|UpdateStep|SetStateStep|StepLabel|EvaluateCondition|EvaluateExpression|GetEntityProperty|Sequence)\d*', s)]
    if created: out.write("  create: " + ", ".join(f"{k}x{v}" for k, v in created.items()) + "\n")
    if updated: out.write("  update: " + ", ".join(f"{k}x{v}" for k, v in updated.items()) + "\n")
    for k, v in setprops.items():
        out.write(f"  set[{k}]: {', '.join(sorted(v))}\n")
    st = []
    for m in re.finditer(r'<mxswa:SetState [^>]*EntityName="([a-zA-Z_]+)"[^>]*>(.*?)</mxswa:SetState>', x, re.S):
        v = re.findall(r'OptionSetValue ExtensionData="\{x:Null\}" Value="(-?\d+)"', m.group(2))
        st.append(m.group(1) + '=' + '/'.join(v))
    if st: out.write("  setstate: " + ", ".join(dict.fromkeys(st)) + "\n")
    if custom: out.write("  custom: " + ", ".join(f"{k}" for k in custom) + "\n")
    if emails: out.write(f"  email-refs: {emails}\n")
    if statusvals or statusvals2: out.write("  optionvals: " + ", ".join(statusvals + statusvals2) + "\n")
    if waits: out.write(f"  waits/timeouts: {waits}\n")
    reads = sorted(set(f"{e}.{a}" for a, e in conds))
    if reads: out.write("  reads: " + ", ".join(reads[:60]) + "\n")
    if descr: out.write("  steps: " + " / ".join(dict.fromkeys(descr).keys())[:900] + "\n")
out.close()
