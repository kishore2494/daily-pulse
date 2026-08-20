#!/usr/bin/env python3
"""Score an eval run and print the actionable findings, worst first."""
import json, sys, collections
rows = json.load(open(sys.argv[1]))
W = {'error': 10, 'warn': 3}
by_type = collections.Counter()
by_sev = collections.Counter()
detail = collections.defaultdict(set)
tall = []
for row in rows:
    r = row['r']
    tall.append((row['screen'], row['w'], r.get('screensTall', 0)))
    for f in r.get('findings', []):
        key = (f['type'], f['sel'])
        by_type[f['type']] += 1
        by_sev[f['sev']] += 1
        detail[key].add('%dw %s: %s' % (row['w'], row['screen'], f['detail']))
score = sum(W.get(s, 1) * n for s, n in by_sev.items())
print('=' * 72)
print('LAYOUT EVAL  ·  %d screen/viewport combos' % len(rows))
print('  errors: %-4d warns: %-4d   PENALTY SCORE: %d   (lower is better, 0 = clean)'
      % (by_sev['error'], by_sev['warn'], score))
print('=' * 72)
if by_type:
    print('\nBy type:')
    for t, n in by_type.most_common():
        print('  %-22s %d' % (t, n))
    print('\nTop findings (unique element+type, worst first):')
    ranked = sorted(detail.items(), key=lambda kv: -len(kv[1]))
    for (typ, sel), where in ranked[:18]:
        print('\n  [%s]  %s' % (typ, sel))
        for w in sorted(where)[:3]:
            print('      %s' % w)
        if len(where) > 3: print('      … +%d more combos' % (len(where) - 3))
else:
    print('\n  no findings — clean.')
print('\nTallest screens (viewport-heights of scrolling):')
for s, w, t in sorted(tall, key=lambda x: -x[2])[:8]:
    print('  %-16s %dw  %.2f screens' % (s, w, t))
