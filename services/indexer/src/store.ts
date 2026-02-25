import { Pool } from "pg";
import { SssEvent } from "../../shared/types";

export async function storeEvent(pool: Pool, event: SssEvent): Promise<void> {
  await pool.query(
    `INSERT INTO events (name, authority, timestamp, signature, slot, data)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (signature, name) DO NOTHING`,
    [
      event.name,
      event.authority,
      new Date(event.timestamp),
      event.signature,
      event.slot,
      JSON.stringify(event.data),
    ]
  );
}

export async function getEvents(
  pool: Pool,
  opts: { name?: string; limit?: number; offset?: number }
): Promise<SssEvent[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (opts.name) {
    conditions.push(`name = $${idx++}`);
    params.push(opts.name);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts.limit || 100;
  const offset = opts.offset || 0;

  params.push(limit, offset);

  const result = await pool.query(
    `SELECT id, name, authority, timestamp, signature, slot, data
     FROM events ${where}
     ORDER BY timestamp DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    params
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    authority: row.authority,
    timestamp: new Date(row.timestamp).getTime(),
    signature: row.signature,
    slot: row.slot,
    data: row.data,
    created_at: new Date(row.timestamp).toISOString(),
  }));
}
