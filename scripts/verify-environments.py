#!/usr/bin/env python3
"""Read-only DEV/local TEST/hosted TEST parity audit; no records or credentials in output."""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import urllib.request

PROTECTED = (
    'app_users', 'app_user_activity', 'app_user_cemetery_access', 'access_requests',
    'field_operations', 'audit_events', 'system_events', 'databasechangelog',
    'databasechangeloglock', 'app_roles', 'audit_retention_policies',
    'system_event_retention_policies',
)


def snapshot_sql():
    excluded = ','.join("'" + name + "'" for name in (*PROTECTED, 'spatial_ref_sys'))
    return r"""BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT format($audit$SELECT json_build_object('table',%L,'rows',count(*),'hash',md5(coalesce(string_agg(h,'' ORDER BY h),''))) FROM (SELECT md5((to_jsonb(t)%s)::text) h FROM %I.%I t) s;$audit$,c.relname,coalesce((SELECT ' || jsonb_build_object(' || string_agg(format('%L,encode(ST_AsEWKB(t.%I::geometry),''hex'')',a.attname,a.attname),',' ORDER BY a.attnum)||')' FROM pg_attribute a JOIN pg_type typ ON typ.oid=a.atttypid WHERE a.attrelid=c.oid AND NOT a.attisdropped AND a.attnum>0 AND typ.typname IN ('geometry','geography')),''),n.nspname,c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname NOT IN (EXCLUDED) ORDER BY c.relname
\gexec
SELECT json_build_object('columns',md5(string_agg(row_to_json(c)::text,'' ORDER BY table_name,ordinal_position))) FROM (SELECT table_name,column_name,ordinal_position,column_default,is_nullable,data_type,udt_name FROM information_schema.columns WHERE table_schema='public') c;
SELECT json_build_object('functions',md5(string_agg(pg_get_functiondef(p.oid),'' ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f';
SELECT json_build_object('postgresql',current_setting('server_version'),'postgis',postgis_lib_version(),'extensions',(SELECT jsonb_object_agg(extname,extversion) FROM pg_extension));
COMMIT;
""".replace('EXCLUDED', excluded)


def execute(target, args, data=None):
    command = args
    if target.get('ssh'):
        command = [*target['ssh'], shlex.join(args)]
    result = subprocess.run(command, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError('Environment command failed; inspect connection/container availability (command output withheld).')
    return result.stdout


def file_inventory(root):
    root = Path(root)
    if not root.is_dir():
        raise RuntimeError('Media/source root does not exist.')
    files = {}
    for path in sorted(root.rglob('*')):
        if path.is_symlink():
            raise RuntimeError('Symlink in inventory; resolve explicitly before verifying.')
        if path.is_file():
            with path.open('rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            files[str(path.relative_to(root))] = {'bytes': path.stat().st_size, 'sha256': digest}
    return files


def inventory(target, key):
    # Send this maintained inventory implementation over stdin, without installing remote code.
    code = 'import hashlib,json\nfrom pathlib import Path\n' + __import__('inspect').getsource(file_inventory)
    if key == 'media':
        code += '\nprint(json.dumps(file_inventory(' + repr(target['media']) + ')))\n'
    else:
        code += '\nr=Path(' + repr(target['source']) + ')\n'
        code += "files={p:v for d in ['src','server','shared','public'] for p,v in ((d+'/'+k,v) for k,v in file_inventory(r/d).items())}\n"
        # Compare dependency/runtime configuration, independent of operator-only npm scripts.
        code += "p=json.loads((r/'package.json').read_text()); files['dependencies']=hashlib.sha256(json.dumps({k:p.get(k) for k in ['version','dependencies','devDependencies','overrides','engines']},sort_keys=True).encode()).hexdigest()\nprint(json.dumps(files))\n"
    return json.loads(execute(target, ['python3', '-'], code.encode()))


def audit(target):
    records = [json.loads(line) for line in execute(target, ['docker', 'exec', '-i', target['container'], 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', target.get('user', 'cemetery_app'), '-d', target['database']], snapshot_sql().encode()).splitlines()]
    # Probe the hosted origin over the already-authorized SSH channel. Public
    # Cloudflare Access is a separate interactive check, not an anonymous bypass.
    probe = '''import json,urllib.request,urllib.error
base=BASE
with urllib.request.urlopen(base+'/api/health',timeout=20) as response: health=json.load(response)
try:
    urllib.request.urlopen(base+'/api/me',timeout=20)
except urllib.error.HTTPError as error:
    status=error.code
else:
    status=200
print(json.dumps({'health':health,'anonymousIdentityStatus':status}))
'''.replace('BASE', repr(target['url'].rstrip('/')))
    response = json.loads(execute(target, ['python3', '-'], probe.encode()))
    health = response['health']
    if health.get('status') != 'ok':
        raise RuntimeError('An environment is unhealthy.')
    if response['anonymousIdentityStatus'] != 401:
        raise RuntimeError('Anonymous identity request did not return 401.')
    return {'database': records, 'media': inventory(target, 'media'), 'code': inventory(target, 'code'), 'release': health['version']}


def compare(results):
    if set(results) != {'dev', 'local-test', 'hosted-test'}:
        raise ValueError('Exactly dev, local-test and hosted-test are required.')
    baseline = results['dev']
    checks = {name: {key: result[key] == baseline[key] for key in ('database', 'media', 'code')} for name, result in results.items()}
    return {'passed': all(all(check.values()) for check in checks.values()), 'checks': checks,
            'businessTables': sum('table' in row for row in baseline['database']),
            'businessRows': sum(row.get('rows', 0) for row in baseline['database']),
            'mediaFiles': len(baseline['media']), 'mediaBytes': sum(row['bytes'] for row in baseline['media'].values()),
            'releases': {name: result['release'] for name, result in results.items()},
            'excludedTables': PROTECTED, 'note': 'Users, access, operational history, migration ledger and extension catalog are intentionally not business-data sync targets. Release metadata is reported separately.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', default='.runtime/environments.json')
    parser.add_argument('--output', required=True, help='New private report directory under db/backups; must not exist')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    output = Path(args.output).resolve()
    if not output.is_relative_to(root / 'db/backups'):
        parser.error('Reports must be stored under ignored db/backups.')
    os.umask(0o077)
    targets = json.loads(Path(args.config).read_text())
    if set(targets) != {'dev', 'local-test', 'hosted-test'}:
        parser.error('Config requires dev, local-test and hosted-test.')
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        results = dict(zip(targets, executor.map(audit, targets.values())))
    report = compare(results)
    (output / 'fingerprints.json').write_text(json.dumps(results, indent=2))
    (output / 'summary.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(2)
