use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryEntry {
    pub id: String,
    pub content: String,
    pub agent_role: String,
    pub tags: Vec<String>,
    pub project_id: Option<String>,
    pub timestamp: i64,
    pub embedding: Option<String>,
}

pub fn open_memory_db(path: &str) -> Result<Connection> {
    Connection::open(path)
}

pub fn init_memory_db(conn: &Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS memory_entries (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            agent_role TEXT NOT NULL,
            tags TEXT NOT NULL,
            project_id TEXT,
            timestamp INTEGER NOT NULL,
            embedding TEXT
        )",
        [],
    )?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_memory_timestamp ON memory_entries(timestamp)", [],)?;
    Ok(())
}

pub fn save_memory_entry(conn: &Connection, entry: MemoryEntry) -> Result<()> {
    let tags_json = serde_json::to_string(&entry.tags).unwrap_or_else(|_| "[]".into());
    conn.execute(
        "INSERT INTO memory_entries (id, content, agent_role, tags, project_id, timestamp, embedding)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
            content = excluded.content,
            agent_role = excluded.agent_role,
            tags = excluded.tags,
            project_id = excluded.project_id,
            timestamp = excluded.timestamp,
            embedding = excluded.embedding",
        params![
            entry.id,
            entry.content,
            entry.agent_role,
            tags_json,
            entry.project_id,
            entry.timestamp,
            entry.embedding,
        ],
    )?;
    Ok(())
}

pub fn list_memory_entries(conn: &Connection) -> Result<Vec<MemoryEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, content, agent_role, tags, project_id, timestamp, embedding FROM memory_entries ORDER BY timestamp DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        let tags_json: String = row.get(3)?;
        let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

        Ok(MemoryEntry {
            id: row.get(0)?,
            content: row.get(1)?,
            agent_role: row.get(2)?,
            tags,
            project_id: row.get(4)?,
            timestamp: row.get(5)?,
            embedding: row.get(6)?,
        })
    })?;

    rows.collect()
}

pub fn query_memory_entries(conn: &Connection, query: &str, limit: usize) -> Result<Vec<MemoryEntry>> {
    let like_query = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT id, content, agent_role, tags, project_id, timestamp, embedding
         FROM memory_entries
         WHERE content LIKE ?1 OR tags LIKE ?1
         ORDER BY timestamp DESC
         LIMIT ?2",
    )?;
    let rows = stmt.query_map(params![like_query, limit as i64], |row| {
        let tags_json: String = row.get(3)?;
        let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

        Ok(MemoryEntry {
            id: row.get(0)?,
            content: row.get(1)?,
            agent_role: row.get(2)?,
            tags,
            project_id: row.get(4)?,
            timestamp: row.get(5)?,
            embedding: row.get(6)?,
        })
    })?;

    rows.collect()
}
