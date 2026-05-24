import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }

  return pool
}

export type DbTransaction = {
  query: <T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]) => Promise<QueryResult<T>>
}

export function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values)
}

export async function withTransaction<T>(callback: (tx: DbTransaction) => Promise<T>): Promise<T> {
  const client: PoolClient = await getPool().connect()
  try {
    await client.query('begin')
    const result = await callback({ query: (text, values = []) => client.query(text, values) })
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}
