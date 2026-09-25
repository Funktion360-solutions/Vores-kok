#!/usr/bin/env node
/**
 * LOCAL DEVELOPMENT / E2E EMULATOR — NOT FOR PRODUCTION.
 *
 * A small, dependency-light stand-in for the Supabase HTTP APIs, used where
 * Docker (and therefore `supabase start`) is unavailable. It implements only
 * the subset of Auth / PostgREST / Storage that @vores-kok/database uses, but
 * executes every data request exactly like PostgREST does: inside a
 * transaction, `SET LOCAL ROLE <jwt role>` + `request.jwt.claims`, so all RLS
 * policies and grants in supabase/migrations are exercised for real.
 *
 *   node scripts/dev/local-supabase.mjs           (after scripts/dev/pg.sh pg_reset)
 *
 * Env: PORT (54321), DATABASE_URL, JWT_SECRET, STORAGE_DIR
 */
import { createServer } from 'node:http';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { SignJWT, jwtVerify } from 'jose';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const PORT = Number(process.env.PORT ?? 54321);
const DATABASE_URL = process.env.DATABASE_URL ?? `postgresql://postgres@127.0.0.1:${process.env.PGPORT ?? 54329}/voreskok`;
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'local-dev-secret-local-dev-secret-0123456789');
const STORAGE_DIR = process.env.STORAGE_DIR ?? join(ROOT, '.dev/storage');
const ACCESS_TTL = 3600;

// Return DATE columns as 'YYYY-MM-DD' strings, like PostgREST does.
pg.types.setTypeParser(1082, (v) => v);
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 10 });
const refreshTokens = new Map(); // token -> userId

export async function makeKey(role) {
  return new SignJWT({ role, iss: 'supabase-local' }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setIssuedAt().setExpirationTime('10y').sign(SECRET);
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function send(res, status, body, headers = {}) {
  const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range', ...headers };
  if (body === undefined || body === null && status === 204) {
    res.writeHead(status, h);
    return res.end();
  }
  if (Buffer.isBuffer(body)) {
    res.writeHead(status, h);
    return res.end(body);
  }
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...h });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}
async function readJson(req) {
  const b = await readBody(req);
  if (!b.length) return {};
  return JSON.parse(b.toString('utf8'));
}

async function claimsFrom(req) {
  const auth = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers.apikey;
  if (!auth) return { role: 'anon' };
  try {
    const { payload } = await jwtVerify(auth, SECRET);
    return payload;
  } catch {
    return null;
  }
}

async function withRole(claims, fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const role = ['anon', 'authenticated', 'service_role'].includes(claims.role) ? claims.role : 'anon';
    await client.query(`set local role ${role}`);
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

function pgError(res, e) {
  const code = e.code ?? 'XX000';
  const status = code === '42501' ? 403 : code === '23505' ? 409 : code === 'P0002' ? 404 : code.startsWith('PGRST') ? 406 : 400;
  send(res, status, { code, message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
}

// ─── Auth ────────────────────────────────────────────────────────────────────
function userJson(u) {
  return {
    id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email,
    email_confirmed_at: u.email_confirmed_at, confirmed_at: u.email_confirmed_at,
    user_metadata: u.raw_user_meta_data ?? {}, app_metadata: { provider: 'email', providers: ['email'] },
    identities: [], created_at: u.created_at, updated_at: u.updated_at,
  };
}
async function session(u) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = await new SignJWT({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, session_id: randomUUID() })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setIssuedAt(now).setExpirationTime(now + ACCESS_TTL).sign(SECRET);
  const refresh_token = randomBytes(24).toString('hex');
  refreshTokens.set(refresh_token, u.id);
  return { access_token, token_type: 'bearer', expires_in: ACCESS_TTL, expires_at: now + ACCESS_TTL, refresh_token, user: userJson(u) };
}
const authErr = (res, status, code, msg) => send(res, status, { code: status, error_code: code, msg, error: code, error_description: msg });

async function handleAuth(req, res, url) {
  const path = url.pathname.replace(/^\/auth\/v1/, '');
  if (path === '/health') return send(res, 200, { name: 'local-auth' });
  if (path === '/settings') return send(res, 200, { external: { email: true }, disable_signup: false, mailer_autoconfirm: true });
  if (path === '/signup' && req.method === 'POST') {
    const b = await readJson(req);
    const email = String(b.email ?? '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return authErr(res, 400, 'validation_failed', 'Unable to validate email address: invalid format');
    if (String(b.password ?? '').length < 6) return authErr(res, 422, 'weak_password', 'Password should be at least 6 characters.');
    const exists = await pool.query('select 1 from auth.users where email = $1', [email]);
    if (exists.rowCount) return authErr(res, 422, 'user_already_exists', 'User already registered');
    const { rows } = await pool.query(
      `insert into auth.users (email, encrypted_password, raw_user_meta_data, email_confirmed_at)
       values ($1, extensions.crypt($2, extensions.gen_salt('bf', 8)), $3, now()) returning *`,
      [email, b.password, b.data ?? {}],
    );
    return send(res, 200, await session(rows[0]));
  }
  if (path === '/token' && req.method === 'POST') {
    const grant = url.searchParams.get('grant_type');
    const b = await readJson(req);
    if (grant === 'password') {
      const { rows } = await pool.query(
        `select * from auth.users where email = $1 and encrypted_password = extensions.crypt($2, encrypted_password)`,
        [String(b.email ?? '').trim().toLowerCase(), String(b.password ?? '')],
      );
      if (!rows[0]) return authErr(res, 400, 'invalid_credentials', 'Invalid login credentials');
      return send(res, 200, await session(rows[0]));
    }
    if (grant === 'refresh_token') {
      const uid = refreshTokens.get(b.refresh_token);
      if (!uid) return authErr(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
      refreshTokens.delete(b.refresh_token);
      const { rows } = await pool.query('select * from auth.users where id = $1', [uid]);
      return send(res, 200, await session(rows[0]));
    }
    return authErr(res, 400, 'unsupported_grant_type', 'unsupported grant');
  }
  const claims = await claimsFrom(req);
  if (path === '/user') {
    if (!claims?.sub) return authErr(res, 401, 'no_authorization', 'This endpoint requires a Bearer token');
    if (req.method === 'PUT') {
      const b = await readJson(req);
      if (b.password) await pool.query(`update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf', 8)) where id = $1`, [claims.sub, b.password]);
      if (b.data) await pool.query(`update auth.users set raw_user_meta_data = raw_user_meta_data || $2 where id = $1`, [claims.sub, b.data]);
    }
    const { rows } = await pool.query('select * from auth.users where id = $1', [claims.sub]);
    if (!rows[0]) return authErr(res, 403, 'user_not_found', 'User from sub claim in JWT does not exist');
    return send(res, 200, userJson(rows[0]));
  }
  if (path === '/logout') return send(res, 204, null);
  if (path === '/recover' || path === '/otp' || path === '/resend') return send(res, 200, {});
  return authErr(res, 404, 'not_found', `Not implemented in local emulator: ${path}`);
}

// ─── PostgREST subset ────────────────────────────────────────────────────────
const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Object.assign(new Error(`bad identifier ${s}`), { code: 'PGRST100' });
  return `"${s}"`;
};
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function parseFilters(params, values) {
  const where = [];
  for (const [key, raw] of params) {
    if (RESERVED.has(key)) continue;
    const m = /^(not\.)?(eq|neq|gt|gte|lt|lte|is|in|like|ilike)\.(.*)$/s.exec(raw);
    if (!m) throw Object.assign(new Error(`unsupported filter ${key}=${raw}`), { code: 'PGRST100' });
    const [, not, op, val] = m;
    const col = ident(key);
    let clause;
    if (op === 'is') clause = `${col} is ${val === 'null' ? 'null' : val === 'true' ? 'true' : 'false'}`;
    else if (op === 'in') {
      const items = val.replace(/^\(|\)$/g, '').split(',').map((v) => v.replace(/^"|"$/g, ''));
      values.push(items);
      clause = `${col}::text = any($${values.length}::text[])`;
    } else {
      values.push(val);
      const sqlOp = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' }[op];
      clause = `${col}::text ${sqlOp} $${values.length}`;
      if (['gt', 'gte', 'lt', 'lte'].includes(op)) clause = `${col} ${sqlOp} $${values.length}`;
    }
    where.push(not ? `not (${clause})` : clause);
  }
  return where.length ? ` where ${where.join(' and ')}` : '';
}

function selectList(sel) {
  if (!sel || sel === '*') return '*';
  return sel.split(',').map((c) => c.trim()).filter(Boolean).map((c) => {
    if (c.includes('(')) throw Object.assign(new Error('embedded resources are not supported by the local emulator'), { code: 'PGRST100' });
    const [alias, col] = c.includes(':') ? c.split(':') : [null, c];
    return alias ? `${ident(col)} as ${ident(alias)}` : ident(col);
  }).join(', ');
}

function orderBy(order) {
  if (!order) return '';
  return ' order by ' + order.split(',').map((o) => {
    const [col, dir, nulls] = o.split('.');
    return `${ident(col)} ${dir === 'desc' ? 'desc' : 'asc'}${nulls === 'nullsfirst' ? ' nulls first' : nulls === 'nullslast' ? ' nulls last' : ''}`;
  }).join(', ');
}

async function tableColumns(client, table) {
  const { rows } = await client.query(
    `select a.attname, format_type(a.atttypid, a.atttypmod) as type from pg_attribute a
     where a.attrelid = ('public.' || quote_ident($1))::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''`, [table]);
  return new Map(rows.map((r) => [r.attname, r.type]));
}

function respondRows(req, res, rows, status = 200) {
  const single = /vnd\.pgrst\.object/.test(req.headers.accept ?? '');
  if (single) {
    if (rows.length !== 1) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null });
    return send(res, status, rows[0]);
  }
  send(res, status, rows, { 'content-range': `0-${Math.max(rows.length - 1, 0)}/*` });
}

async function handleRest(req, res, url, claims) {
  const path = url.pathname.replace(/^\/rest\/v1\/?/, '');
  if (path.startsWith('rpc/')) {
    const fn = path.slice(4);
    const args = req.method === 'GET' ? Object.fromEntries(url.searchParams) : await readJson(req);
    return withRole(claims, async (client) => {
      const { rows: procs } = await client.query(
        `select p.proretset, p.prorettype::regtype::text as rettype, p.proargnames, p.proargmodes::text[] as proargmodes,
                array(select format_type(t, null) from unnest(p.proargtypes) t) as argtypes,
                (select count(*) from unnest(coalesce(p.proargmodes, '{}')) m where m = 't') > 0 as is_table
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = $1`, [fn]);
      if (!procs.length) throw Object.assign(new Error(`Could not find the function public.${fn}`), { code: 'PGRST202' });
      const p = procs[0];
      const inNames = (p.proargnames ?? []).filter((_, i) => !p.proargmodes || ['i', 'b', 'v'].includes(p.proargmodes[i]));
      const values = [];
      const named = Object.entries(args).map(([k, v]) => {
        const idx = inNames.indexOf(k);
        if (idx < 0) throw Object.assign(new Error(`unknown argument ${k}`), { code: 'PGRST202' });
        const t = p.argtypes[idx];
        values.push(t === 'jsonb' || t === 'json' ? JSON.stringify(v) : v);
        return `${ident(k)} => $${values.length}::${t}`;
      });
      const call = `public.${ident(fn)}(${named.join(', ')})`;
      if (p.proretset || p.is_table) {
        const composite = p.is_table || !['jsonb', 'json', 'text', 'uuid', 'integer', 'boolean'].includes(p.rettype);
        const { rows } = await client.query(composite ? `select * from ${call}` : `select ${call} as v`, values);
        return composite ? rows : rows.map((r) => r.v);
      }
      const { rows } = await client.query(`select ${call} as v`, values);
      return p.rettype === 'void' ? null : rows[0].v;
    }).then((data) => (data === null ? send(res, 200, null) : send(res, 200, data)), (e) => pgError(res, e));
  }

  const table = path;
  ident(table);
  const values = [];
  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const where = parseFilters(url.searchParams, values);
      const limit = url.searchParams.get('limit') ? ` limit ${Number(url.searchParams.get('limit'))}` : '';
      const offset = url.searchParams.get('offset') ? ` offset ${Number(url.searchParams.get('offset'))}` : '';
      const rows = await withRole(claims, (c) => c.query(`select ${selectList(url.searchParams.get('select'))} from public.${ident(table)}${where}${orderBy(url.searchParams.get('order'))}${limit}${offset}`, values).then((r) => r.rows));
      return respondRows(req, res, rows);
    }
    const returning = /return=representation/.test(req.headers.prefer ?? '') ? ` returning ${selectList(url.searchParams.get('select'))}` : '';
    if (req.method === 'POST') {
      const body = await readJson(req);
      const items = Array.isArray(body) ? body : [body];
      const rows = await withRole(claims, async (c) => {
        const cols = await tableColumns(c, table);
        const out = [];
        for (const item of items) {
          const keys = Object.keys(item);
          const vals = keys.map((k) => { const t = cols.get(k); return t && /json/.test(t) ? JSON.stringify(item[k]) : item[k]; });
          const q = `insert into public.${ident(table)} (${keys.map(ident).join(', ')}) values (${keys.map((k, i) => `$${i + 1}::${cols.get(k) ?? 'text'}`).join(', ')})${returning}`;
          out.push(...(await c.query(q, vals)).rows);
        }
        return out;
      });
      return returning ? respondRows(req, res, rows, 201) : send(res, 201, null);
    }
    if (req.method === 'PATCH') {
      const body = await readJson(req);
      const rows = await withRole(claims, async (c) => {
        const cols = await tableColumns(c, table);
        const keys = Object.keys(body);
        for (const k of keys) values.push(cols.get(k) && /json/.test(cols.get(k)) ? JSON.stringify(body[k]) : body[k]);
        const sets = keys.map((k, i) => `${ident(k)} = $${i + 1}::${cols.get(k) ?? 'text'}`).join(', ');
        const where = parseFilters(url.searchParams, values);
        return (await c.query(`update public.${ident(table)} set ${sets}${where}${returning}`, values)).rows;
      });
      return returning ? respondRows(req, res, rows) : send(res, 204, null);
    }
    if (req.method === 'DELETE') {
      const where = parseFilters(url.searchParams, values);
      const rows = await withRole(claims, (c) => c.query(`delete from public.${ident(table)}${where}${returning}`, values).then((r) => r.rows));
      return returning ? respondRows(req, res, rows) : send(res, 204, null);
    }
    send(res, 405, { message: 'method not allowed' });
  } catch (e) {
    pgError(res, e);
  }
}

// ─── Storage subset ──────────────────────────────────────────────────────────
function safeKey(p) {
  const key = decodeURIComponent(p);
  if (key.includes('..') || key.startsWith('/')) throw Object.assign(new Error('invalid key'), { code: '42501' });
  return key;
}
async function signToken(bucket, key, expiresIn) {
  return new SignJWT({ url: `${bucket}/${key}` }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime(Math.floor(Date.now() / 1000) + Number(expiresIn || 60)).sign(SECRET);
}
const MIME_BY_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf' };

async function handleStorage(req, res, url, claims) {
  const path = url.pathname.replace(/^\/storage\/v1/, '');
  try {
    let m;
    if ((m = /^\/object\/sign\/([^/]+)\/(.+)$/.exec(path)) && req.method === 'GET') {
      const { payload } = await jwtVerify(url.searchParams.get('token') ?? '', SECRET);
      const key = safeKey(m[2]);
      if (payload.url !== `${m[1]}/${key}`) return send(res, 400, { statusCode: '400', error: 'InvalidSignature', message: 'Invalid signature' });
      const data = await readFile(join(STORAGE_DIR, m[1], key));
      return send(res, 200, data, { 'content-type': MIME_BY_EXT[key.split('.').pop()] ?? 'application/octet-stream', 'cache-control': 'private, max-age=3600' });
    }
    if ((m = /^\/object\/sign\/([^/]+)$/.exec(path)) && req.method === 'POST') {
      const b = await readJson(req);
      const visible = await withRole(claims, (c) => c.query('select name from storage.objects where bucket_id = $1 and name = any($2)', [m[1], b.paths]).then((r) => new Set(r.rows.map((x) => x.name))));
      const out = [];
      for (const p of b.paths) {
        out.push(visible.has(p)
          ? { path: p, signedURL: `/object/sign/${m[1]}/${p}?token=${await signToken(m[1], p, b.expiresIn)}`, error: null }
          : { path: p, signedURL: null, error: 'Either the object does not exist or you do not have access to it' });
      }
      return send(res, 200, out);
    }
    if ((m = /^\/object\/sign\/([^/]+)\/(.+)$/.exec(path)) && req.method === 'POST') {
      const key = safeKey(m[2]);
      const b = await readJson(req);
      const ok = await withRole(claims, (c) => c.query('select 1 from storage.objects where bucket_id = $1 and name = $2', [m[1], key]).then((r) => r.rowCount));
      if (!ok) return send(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
      return send(res, 200, { signedURL: `/object/sign/${m[1]}/${key}?token=${await signToken(m[1], key, b.expiresIn)}` });
    }
    if ((m = /^\/object\/([^/]+)\/(.+)$/.exec(path)) && (req.method === 'POST' || req.method === 'PUT')) {
      const bucket = m[1];
      const key = safeKey(m[2]);
      let body = await readBody(req);
      let contentType = req.headers['content-type'] ?? 'application/octet-stream';
      if (contentType.startsWith('multipart/form-data')) {
        const boundary = /boundary=(.+)$/.exec(contentType)?.[1];
        const raw = body.toString('latin1');
        const part = raw.split(`--${boundary}`).find((p) => /name="(file|)"/.test(p) && p.includes('\r\n\r\n')) ?? '';
        const headerEnd = part.indexOf('\r\n\r\n');
        contentType = /content-type:\s*([^\r\n]+)/i.exec(part.slice(0, headerEnd))?.[1] ?? contentType;
        body = Buffer.from(part.slice(headerEnd + 4, part.length - 2), 'latin1');
      }
      const { rows: [b] } = await pool.query('select * from storage.buckets where id = $1', [bucket]);
      if (!b) return send(res, 400, { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' });
      if (b.file_size_limit && body.length > Number(b.file_size_limit)) return send(res, 413, { statusCode: '413', error: 'Payload too large', message: 'The object exceeded the maximum allowed size' });
      if (b.allowed_mime_types && !b.allowed_mime_types.includes(contentType)) return send(res, 415, { statusCode: '415', error: 'invalid_mime_type', message: `mime type ${contentType} is not supported` });
      await withRole(claims, (c) => c.query(
        `insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, $4)` +
          (req.headers['x-upsert'] === 'true' ? ' on conflict (bucket_id, name) do update set metadata = excluded.metadata, updated_at = now()' : ''),
        [bucket, key, claims.sub ?? null, { mimetype: contentType, size: body.length }]));
      const file = join(STORAGE_DIR, bucket, key);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, body);
      return send(res, 200, { Key: `${bucket}/${key}`, Id: randomUUID() });
    }
    if ((m = /^\/object\/([^/]+)$/.exec(path)) && req.method === 'DELETE') {
      const b = await readJson(req);
      const deleted = await withRole(claims, (c) => c.query('delete from storage.objects where bucket_id = $1 and name = any($2) returning name', [m[1], b.prefixes ?? []]).then((r) => r.rows));
      for (const d of deleted) await rm(join(STORAGE_DIR, m[1], d.name), { force: true });
      return send(res, 200, deleted.map((d) => ({ name: d.name })));
    }
    if ((m = /^\/object\/authenticated\/([^/]+)\/(.+)$/.exec(path)) && req.method === 'GET') {
      const key = safeKey(m[2]);
      const ok = await withRole(claims, (c) => c.query('select 1 from storage.objects where bucket_id = $1 and name = $2', [m[1], key]).then((r) => r.rowCount));
      if (!ok) return send(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
      return send(res, 200, await readFile(join(STORAGE_DIR, m[1], key)));
    }
    send(res, 404, { statusCode: '404', error: 'not_found', message: `Not implemented in local emulator: ${req.method} ${path}` });
  } catch (e) {
    if (e.code === '42501') return send(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
    send(res, 400, { statusCode: '400', error: 'error', message: e.message });
  }
}

// ─── server ──────────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, null);
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/auth/v1')) return await handleAuth(req, res, url);
    const claims = await claimsFrom(req);
    if (!claims) return send(res, 401, { code: 'PGRST301', message: 'JWT expired or invalid' });
    if (url.pathname.startsWith('/rest/v1')) return await handleRest(req, res, url, claims);
    if (url.pathname.startsWith('/storage/v1')) return await handleStorage(req, res, url, claims);
    send(res, 404, { message: 'not found' });
  } catch (e) {
    console.error(e);
    send(res, 500, { message: 'internal error' });
  }
});

if (process.argv.includes('--print-keys')) {
  console.log(JSON.stringify({ anon: await makeKey('anon'), service_role: await makeKey('service_role') }));
  process.exit(0);
}
server.listen(PORT, '127.0.0.1', () => console.log(`local-supabase listening on http://127.0.0.1:${PORT}`));
