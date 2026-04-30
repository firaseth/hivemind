mod memory;

use tauri::Emitter;
use std::process::{Child, Command};
use std::sync::Mutex;
use rusqlite::Connection;
use memory::MemoryEntry;
use lettre::{Message, SmtpTransport, Transport, transport::smtp::authentication::Credentials};
use lettre::transport::smtp::client::{Tls, TlsParameters};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn start_ollama(state: tauri::State<'_, AppState>, port: Option<u16>) -> Result<String, String> {
    let mut process_lock = state.ollama_process.lock().map_err(|err| err.to_string())?;
    if process_lock.is_some() {
        return Ok("Ollama service already running".into());
    }
    let port = port.unwrap_or(11434);
    let child = Command::new("ollama")
        .arg("serve")
        .arg("--port")
        .arg(port.to_string())
        .arg("--host")
        .arg("127.0.0.1")
        .spawn()
        .map_err(|err| format!("Failed to start Ollama: {}", err))?;
    *process_lock = Some(child);
    Ok(format!("Ollama started on http://127.0.0.1:{}", port))
}

#[tauri::command]
fn stop_ollama(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let mut process_lock = state.ollama_process.lock().map_err(|err| err.to_string())?;
    if let Some(mut child) = process_lock.take() {
        child.kill().map_err(|err| format!("Failed to stop Ollama: {}", err))?;
        child.wait().map_err(|err| format!("Failed to wait for Ollama shutdown: {}", err))?;
        return Ok("Ollama stopped".into());
    }
    Ok("Ollama was not running".into())
}

#[tauri::command]
fn ollama_status(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let process_lock = state.ollama_process.lock().map_err(|err| err.to_string())?;
    Ok(if process_lock.is_some() {
        "running".into()
    } else {
        "stopped".into()
    })
}

#[tauri::command]
fn save_memory_entry(state: tauri::State<'_, AppState>, entry: MemoryEntry) -> Result<String, String> {
    let conn = state.db.lock().map_err(|err| err.to_string())?;
    memory::save_memory_entry(&conn, entry).map_err(|err| err.to_string())?;
    Ok("Memory entry saved".into())
}

#[tauri::command]
fn query_memory_entries(state: tauri::State<'_, AppState>, query: String, limit: Option<usize>) -> Result<Vec<MemoryEntry>, String> {
    let conn = state.db.lock().map_err(|err| err.to_string())?;
    let results = memory::query_memory_entries(&conn, &query, limit.unwrap_or(20)).map_err(|err| err.to_string())?;
    Ok(results)
}

#[tauri::command]
fn list_memory_entries(state: tauri::State<'_, AppState>) -> Result<Vec<MemoryEntry>, String> {
    let conn = state.db.lock().map_err(|err| err.to_string())?;
    let results = memory::list_memory_entries(&conn).map_err(|err| err.to_string())?;
    Ok(results)
}

// ============================================================================
// NEW SWARM ORCHESTRATION COMMANDS
// ============================================================================

#[tauri::command]
fn execute_agent_swarm(goal: String, project_id: Option<String>, window: tauri::Window) -> Result<String, String> {
    // This spawns a Node.js worker that runs the TypeScript orchestrator
    // For now, we'll return a placeholder that the frontend can handle
    
    let session_id = format!("swarm-{}-{}", 
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        uuid::Uuid::new_v4()
    );
    
    println!("[HiveMind] Swarm session started: {}", session_id);
    println!("[HiveMind] Goal: {}", goal);
    
    // Emit event to frontend indicating swarm started
    let _ = window.emit("swarm_started", serde_json::json!({
        "sessionId": session_id,
        "goal": goal,
        "projectId": project_id,
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    }));
    
    Ok(session_id)
}

#[tauri::command]
fn get_swarm_status(session_id: String) -> Result<serde_json::Value, String> {
    // Return current swarm status
    Ok(serde_json::json!({
        "sessionId": session_id,
        "status": "running",
        "activeAgents": ["planner", "researcher", "executor"],
        "messagesCount": 0,
        "consensusReached": false
    }))
}

#[tauri::command]
fn approve_swarm_action(session_id: String, action_id: String) -> Result<String, String> {
    println!("[HiveMind] Approved action {} in session {}", action_id, session_id);
    Ok(format!("Action {} approved", action_id))
}

#[tauri::command]
fn reject_swarm_action(session_id: String, action_id: String, reason: String) -> Result<String, String> {
    println!("[HiveMind] Rejected action {} in session {}: {}", action_id, session_id, reason);
    Ok(format!("Action {} rejected", action_id))
}

#[tauri::command]
fn get_decision_log(_session_id: String, _limit: Option<usize>) -> Result<Vec<serde_json::Value>, String> {
    // Return decision log for Decision Replay UI
    Ok(vec![
        serde_json::json!({
            "action": "Analyzed goal for task breakdown",
            "model": "gemma2:9b",
            "confidence": 94,
            "reasoning": "Identified 5 key phases",
            "timestamp": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        })
    ])
}

#[tauri::command]
async fn send_email(
    recipient: String, 
    subject: String, 
    body: String,
    smtp_host: String,
    smtp_port: u16,
    smtp_user: String,
    smtp_pass: String
) -> Result<String, String> {
    let email = Message::builder()
        .from(smtp_user.parse().map_err(|e| format!("Invalid sender: {}", e))?)
        .to(recipient.parse().map_err(|e| format!("Invalid recipient: {}", e))?)
        .subject(subject)
        .body(body)
        .map_err(|e| format!("Failed to build email: {}", e))?;

    let creds = Credentials::new(smtp_user, smtp_pass);

    let mailer = SmtpTransport::relay(&smtp_host)
        .map_err(|e| format!("Invalid SMTP host: {}", e))?
        .port(smtp_port)
        .credentials(creds)
        .tls(Tls::Opportunistic(TlsParameters::new(smtp_host.clone()))) // Use opportunistic TLS for STARTTLS support
        .build();

    match mailer.send(&email) {
        Ok(_) => Ok("Email sent successfully".into()),
        Err(e) => Err(format!("Could not send email: {}", e)),
    }
}

// ============================================================================
// STATE AND APP INITIALIZATION
// ============================================================================

struct AppState {
    ollama_process: Mutex<Option<Child>>,
    db: Mutex<Connection>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = memory::open_memory_db("hivemind_memory.db").expect("Failed to open SQLite memory store");
    memory::init_memory_db(&db).expect("Failed to initialize memory database");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            ollama_process: Mutex::new(None),
            db: Mutex::new(db),
        })
        .invoke_handler(
            tauri::generate_handler![
                // Existing commands
                greet,
                start_ollama,
                stop_ollama,
                ollama_status,
                save_memory_entry,
                query_memory_entries,
                list_memory_entries,
                // New swarm commands
                execute_agent_swarm,
                get_swarm_status,
                approve_swarm_action,
                reject_swarm_action,
                get_decision_log,
                send_email,
            ],
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
