"use strict";

// In-memory SQLite mock for Jest. Shares instances by DB name so that the
// module-level `db` in localMessages / localPosts refers to the same store.
const instances = new Map();

function createMockDatabase() {
  const createdTables = new Set();
  const tableData = new Map(); // tableName -> row[]

  function rows(table) {
    if (!tableData.has(table)) tableData.set(table, []);
    return tableData.get(table);
  }

  return {
    // Exposed for test assertions
    _createdTables: createdTables,
    _tableData: tableData,

    execAsync: jest.fn(async (sql) => {
      for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/gi)) {
        const name = m[1];
        createdTables.add(name);
        if (!tableData.has(name)) tableData.set(name, []);
      }
    }),

    runAsync: jest.fn(async (sql, params = []) => {
      // INSERT OR REPLACE INTO table (col1, col2, ...) VALUES (?, ?, ...)
      const insertMatch = sql.match(
        /INSERT OR REPLACE INTO (\w+)\s*\(([^)]+)\)/i
      );
      if (insertMatch) {
        const table = insertMatch[1];
        const cols = insertMatch[2].split(",").map((c) => c.trim());
        const row = {};
        cols.forEach((col, i) => {
          row[col] = params[i];
        });
        const list = rows(table);
        // Remove existing row by primary key (id)
        if (row.id !== undefined) {
          const idx = list.findIndex((r) => r.id === row.id);
          if (idx >= 0) list.splice(idx, 1);
        }
        list.push(row);
        return;
      }

      // DELETE FROM table ...
      const deleteMatch = sql.match(/DELETE FROM (\w+)/i);
      if (deleteMatch) {
        const table = deleteMatch[1];

        // WHERE cached_at < datetime('now', '-N days')
        if (/cached_at\s*<\s*datetime/i.test(sql)) {
          const dayMatch = sql.match(/-(\d+)\s*days/i);
          if (dayMatch) {
            const ms = parseInt(dayMatch[1]) * 24 * 60 * 60 * 1000;
            const cutoff = Date.now() - ms;
            tableData.set(
              table,
              rows(table).filter((r) => {
                const t = new Date(r.cached_at || "").getTime();
                return t >= cutoff;
              })
            );
          }
          return;
        }

        // WHERE expires_at < datetime('now')
        if (/expires_at\s*<\s*datetime/i.test(sql)) {
          const now = new Date().toISOString();
          tableData.set(
            table,
            rows(table).filter((r) => !r.expires_at || r.expires_at > now)
          );
          return;
        }

        // WHERE channel_id = ?
        if (/WHERE\s+channel_id\s*=\s*\?/i.test(sql)) {
          tableData.set(
            table,
            rows(table).filter((r) => r.channel_id !== params[0])
          );
          return;
        }

        // WHERE id NOT IN (SELECT id … LIMIT ?)  — 500-post cap
        if (/WHERE\s+id\s+NOT\s+IN/i.test(sql)) {
          const limitParam =
            typeof params[0] === "number" ? params[0] : 500;
          const sorted = [...rows(table)].sort(
            (a, b) =>
              new Date(b.created_at || "").getTime() -
              new Date(a.created_at || "").getTime()
          );
          tableData.set(table, sorted.slice(0, limitParam));
          return;
        }
      }
    }),

    getAllAsync: jest.fn(async (sql, params = []) => {
      const fromMatch = sql.match(/FROM\s+(\w+)/i);
      if (!fromMatch) return [];
      const table = fromMatch[1];
      let list = [...(tableData.get(table) || [])];

      // WHERE channel_id = ?
      if (/WHERE\s+channel_id\s*=\s*\?/i.test(sql) && params.length > 0) {
        list = list.filter((r) => r.channel_id === params[0]);
      }

      // ORDER BY created_at DESC
      if (/ORDER BY\s+created_at\s+DESC/i.test(sql)) {
        list.sort(
          (a, b) =>
            new Date(b.created_at || "").getTime() -
            new Date(a.created_at || "").getTime()
        );
      }

      // LIMIT ? or LIMIT N
      const limitMatch = sql.match(/LIMIT\s+(\?|\d+)/i);
      if (limitMatch) {
        const limit =
          limitMatch[1] === "?"
            ? params[params.length - 1]
            : parseInt(limitMatch[1]);
        list = list.slice(0, limit);
      }

      return list;
    }),
  };
}

const openDatabaseSync = jest.fn((name) => {
  if (!instances.has(name)) {
    instances.set(name, createMockDatabase());
  }
  return instances.get(name);
});

// Reset between tests
beforeEach(() => {
  instances.clear();
  openDatabaseSync.mockClear();
});

module.exports = { openDatabaseSync };
