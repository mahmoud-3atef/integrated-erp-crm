import re, os, sys, collections
root = sys.argv[1]
out = open(sys.argv[2], 'w', encoding='utf-8')
files = []
for d, _, fs in os.walk(root):
    parts = re.split(r'[\\/]', d)
    if 'obj' in parts or 'bin' in parts:
        continue
    for f in fs:
        if (f.endswith('.cs') or f.endswith('.ashx')) and 'designer' not in f and 'Copy' not in f:
            files.append(os.path.join(d, f))

pat = re.compile(r"getOptionSetDisplay(en)?\(\s*'([A-Za-z_]+)'\s*,\s*'([A-Za-z_]+)'[^\n]*?(NOT LIKE|LIKE|<>|=)\s*(N?'[^']*')", re.I)
agg = collections.defaultdict(lambda: [0, set()])
for p in files:
    for i, line in enumerate(open(p, encoding='utf-8-sig', errors='ignore'), 1):
        for m in pat.finditer(line):
            key = (m.group(3).lower(), m.group(2).lower(), ('en' if m.group(1) else 'ar'), m.group(4).upper(), m.group(5))
            agg[key][0] += 1
            agg[key][1].add(os.path.basename(p))
for k, v in sorted(agg.items()):
    out.write(f"{k[0]}.{k[1]}|{k[2]}|{k[3]} {k[4]}|{v[0]}|{', '.join(sorted(v[1]))}\n")

# C# side label matching (Contains/StartsWith on status text)
pat2 = re.compile(r"\.\s*(Contains|StartsWith|EndsWith|IndexOf)\(\s*\"([^\"]*[؀-ۿ][^\"]*)\"")
agg2 = collections.defaultdict(set)
for p in files:
    for i, line in enumerate(open(p, encoding='utf-8-sig', errors='ignore'), 1):
        for m in pat2.finditer(line):
            agg2[m.group(2)].add(os.path.basename(p))
out.write("\n== C# Arabic text checks (Contains/StartsWith)\n")
for k, v in sorted(agg2.items()):
    out.write(f"{k}|{', '.join(sorted(v))}\n")
out.close()
