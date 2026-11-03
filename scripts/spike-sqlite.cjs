/**
 * T-13 / P-05 冒烟：Electron 33 下 better-sqlite3 的 ABI 可加载并执行 SELECT。
 *
 * 用法：
 *   # 1) ABI 冒烟（直接在 Electron 主进程里加载原生模块）
 *   pnpm exec electron scripts/spike-sqlite.cjs
 *
 *   # 2) 检查应用启动后生成的 DB（先以 --user-data-dir 启动应用）
 *   $env:SPIKE_DB_FILE = '<userData 目录>\bluu.db'; pnpm exec electron scripts/spike-sqlite.cjs
 *
 * 退出码：0 = 全部检查通过；1 = 任一检查失败。
 * 仅用于本地验证，不写入应用代码。
 */
const fs = require('node:fs');

const Database = require('better-sqlite3');

const failures = [];
const log = (message) => process.stdout.write(`${message}\n`);
const check = (ok, label, detail = '') => {
  log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures.push(label);
};

function abiProbe() {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE probe (id INTEGER PRIMARY KEY, name TEXT)');
  db.prepare('INSERT INTO probe (id, name) VALUES (?, ?)').run(1, 'ok');
  const row = db.prepare('SELECT name FROM probe WHERE id = 1').get();
  check(
    row && row.name === 'ok',
    '加载 better-sqlite3 并执行 SELECT',
    `ABI=${process.versions.modules} result=${JSON.stringify(row)}`
  );

  // 与 storage/db.ts#withTransaction 相同的显式事务写法，验证真实驱动的回滚语义
  db.exec('BEGIN IMMEDIATE');
  db.prepare('INSERT INTO probe (id, name) VALUES (?, ?)').run(2, 'rolled-back');
  db.exec('ROLLBACK');
  const count = db.prepare('SELECT COUNT(*) AS count FROM probe').get().count;
  check(count === 1, 'ROLLBACK 后写入未落库', `count=${count}`);

  db.close();
}

function inspectDatabase(file) {
  check(fs.existsSync(file), 'DB 文件存在', file);

  const db = new Database(file, { readonly: true });
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => row.name);
  check(
    ['posts', 'post_views', 'tag_cache', 'schema_migrations'].every((name) => tables.includes(name)),
    '迁移后表齐全',
    tables.join(', ')
  );

  const migrations = db
    .prepare('SELECT id, name FROM schema_migrations ORDER BY id')
    .all()
    .map((row) => `${row.id}:${row.name}`);
  check(migrations.length === 2, '迁移记录不重复（启动幂等）', migrations.join(', '));

  const createdAt = db
    .prepare('PRAGMA table_info(posts)')
    .all()
    .find((column) => column.name === 'created_at');
  check(
    Boolean(createdAt) && createdAt.type === 'INTEGER',
    'posts.created_at 为 INTEGER',
    createdAt ? createdAt.type : 'missing'
  );

  db.close();
}

try {
  if (process.env.SPIKE_DB_FILE) {
    inspectDatabase(process.env.SPIKE_DB_FILE);
  } else {
    abiProbe();
  }
  log(`RESULT: ${failures.length === 0 ? 'PASS' : 'FAIL'} failures=${failures.length}`);
  process.exit(failures.length === 0 ? 0 : 1);
} catch (error) {
  log(`RESULT: FAIL error=${error && error.stack ? error.stack : error}`);
  process.exit(1);
}
