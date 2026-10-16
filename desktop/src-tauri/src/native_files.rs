use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

const MAX_PROJECT_BYTES: usize = 5_000_000;
const MAX_RECENT: usize = 12;

#[derive(Default)]
struct Inner {
    paths: HashMap<String, PathBuf>,
    pending: HashMap<String, PathBuf>,
    recent: Vec<PathBuf>,
}

#[derive(Default)]
struct DesktopState(Mutex<Inner>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenedProject {
    token: String,
    name: String,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SavedProject {
    name: String,
    path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RecentProject {
    index: usize,
    name: String,
    path: String,
}

#[derive(Deserialize)]
struct RecentFile {
    paths: Vec<PathBuf>,
}

fn recent_file(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join("recent-projects.json"))
        .map_err(|error| error.to_string())
}

fn load_recent(app: &tauri::AppHandle) -> Vec<PathBuf> {
    recent_file(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str::<RecentFile>(&text).ok())
        .map(|file| file.paths.into_iter().take(MAX_RECENT).collect())
        .unwrap_or_default()
}

fn remember_path(app: &tauri::AppHandle, inner: &mut Inner, path: &Path) -> Result<(), String> {
    inner.recent.retain(|existing| existing != path);
    inner.recent.insert(0, path.to_path_buf());
    inner.recent.truncate(MAX_RECENT);
    let target = recent_file(app)?;
    let content = serde_json::to_vec(&serde_json::json!({"paths": inner.recent}))
        .map_err(|error| error.to_string())?;
    atomic_write(&target, &content)
}

fn read_project(path: &Path) -> Result<String, String> {
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    if metadata.len() > MAX_PROJECT_BYTES as u64 {
        return Err("O arquivo excede o limite de 5 MB.".into());
    }
    let file = File::open(path).map_err(|error| error.to_string())?;
    let mut content = Vec::new();
    file.take((MAX_PROJECT_BYTES + 1) as u64)
        .read_to_end(&mut content)
        .map_err(|error| error.to_string())?;
    if content.len() > MAX_PROJECT_BYTES {
        return Err("O arquivo excede o limite de 5 MB.".into());
    }
    serde_json::from_slice::<serde_json::Value>(&content)
        .map_err(|error| format!("O JSON é inválido: {error}"))?;
    String::from_utf8(content).map_err(|error| error.to_string())
}

fn opened(state: &DesktopState, path: PathBuf) -> Result<OpenedProject, String> {
    let content = read_project(&path)?;
    let token = uuid::Uuid::new_v4().to_string();
    let name = path.file_name().unwrap_or_default().to_string_lossy().into_owned();
    state.0.lock().map_err(|error| error.to_string())?.pending.insert(token.clone(), path);
    Ok(OpenedProject { token, name, content })
}

#[tauri::command]
async fn open_project(app: tauri::AppHandle, state: State<'_, DesktopState>) -> Result<Option<OpenedProject>, String> {
    let selected = app.dialog().file().add_filter("Projeto JSON", &["json"]).blocking_pick_file();
    selected.map(|file| opened(&state, file.into_path().map_err(|error| error.to_string())?)).transpose()
}

#[tauri::command]
async fn open_recent_project(state: State<'_, DesktopState>, index: usize) -> Result<OpenedProject, String> {
    let path = state.0.lock().map_err(|error| error.to_string())?
        .recent.get(index).cloned().ok_or("Projeto recente não encontrado.")?;
    opened(&state, path)
}

#[tauri::command]
fn attach_opened_project(app: tauri::AppHandle, state: State<'_, DesktopState>, token: String, project_key: String) -> Result<(), String> {
    if project_key.is_empty() || project_key.len() > 200 { return Err("Identidade de projeto inválida.".into()); }
    let mut inner = state.0.lock().map_err(|error| error.to_string())?;
    let path = inner.pending.remove(&token).ok_or("A seleção do arquivo expirou.")?;
    inner.paths.insert(project_key, path.clone());
    remember_path(&app, &mut inner, &path)
}

#[tauri::command]
fn list_recent_projects(state: State<'_, DesktopState>) -> Result<Vec<RecentProject>, String> {
    let inner = state.0.lock().map_err(|error| error.to_string())?;
    Ok(inner.recent.iter().enumerate().filter(|(_, path)| path.is_file()).map(|(index, path)| RecentProject {
        index,
        name: path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
        path: path.to_string_lossy().into_owned(),
    }).collect())
}

#[tauri::command]
async fn save_project(
    app: tauri::AppHandle,
    state: State<'_, DesktopState>,
    project_key: String,
    content: String,
    suggested_name: String,
    save_as: bool,
) -> Result<Option<SavedProject>, String> {
    if project_key.is_empty() || project_key.len() > 200 { return Err("Identidade de projeto inválida.".into()); }
    if content.len() > MAX_PROJECT_BYTES { return Err("O projeto excede o limite de 5 MB.".into()); }
    serde_json::from_str::<serde_json::Value>(&content).map_err(|error| format!("O JSON é inválido: {error}"))?;
    let existing = if save_as { None } else {
        state.0.lock().map_err(|error| error.to_string())?.paths.get(&project_key).cloned()
    };
    let path = if let Some(path) = existing { path } else {
        let safe_name = suggested_name.replace(['/', '\\'], "-");
        let selected = app.dialog().file().add_filter("Projeto JSON", &["json"])
            .set_file_name(if safe_name.ends_with(".json") { safe_name } else { format!("{safe_name}.json") })
            .blocking_save_file();
        match selected {
            Some(file) => file.into_path().map_err(|error| error.to_string())?,
            None => return Ok(None),
        }
    };
    if path.extension().and_then(|extension| extension.to_str()) != Some("json") {
        return Err("Escolha um arquivo com extensão .json.".into());
    }
    atomic_write(&path, content.as_bytes())?;
    let mut inner = state.0.lock().map_err(|error| error.to_string())?;
    inner.paths.insert(project_key, path.clone());
    remember_path(&app, &mut inner, &path)?;
    Ok(Some(SavedProject {
        name: path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
        path: path.to_string_lossy().into_owned(),
    }))
}

fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("O arquivo precisa estar em um diretório.")?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let temporary = parent.join(format!(".brmodelo-{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut file = OpenOptions::new().write(true).create_new(true).open(&temporary)
            .map_err(|error| error.to_string())?;
        file.write_all(content).map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
        if path.exists() {
            let backup = path.with_extension("json.bak");
            fs::copy(path, &backup).map_err(|error| format!("Falha ao criar cópia de recuperação: {error}"))?;
            File::open(&backup).and_then(|backup_file| backup_file.sync_all())
                .map_err(|error| error.to_string())?;
        }
        replace_file(&temporary, path)?;
        #[cfg(unix)]
        File::open(parent).and_then(|directory| directory.sync_all()).map_err(|error| error.to_string())?;
        Ok(())
    })();
    if result.is_err() { let _ = fs::remove_file(&temporary); }
    result
}

#[cfg(not(windows))]
fn replace_file(source: &Path, destination: &Path) -> Result<(), String> {
    fs::rename(source, destination).map_err(|error| error.to_string())
}

#[cfg(windows)]
fn replace_file(source: &Path, destination: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH};
    let source_wide: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let destination_wide: Vec<u16> = destination.as_os_str().encode_wide().chain(Some(0)).collect();
    let result = unsafe { MoveFileExW(source_wide.as_ptr(), destination_wide.as_ptr(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH) };
    if result == 0 { Err(std::io::Error::last_os_error().to_string()) } else { Ok(()) }
}

#[tauri::command]
fn quit_desktop(app: tauri::AppHandle) {
    app.exit(0);
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(DesktopState::default())
        .setup(|app| {
            let handle = app.handle();
            {
                let state = app.state::<DesktopState>();
                state.0.lock().unwrap_or_else(|error| error.into_inner()).recent = load_recent(handle);
            }
            let file = SubmenuBuilder::new(handle, "Arquivo")
                .text("new", "Novo projeto")
                .text("open", "Abrir arquivo…")
                .text("recent", "Projetos recentes…")
                .text("save", "Salvar")
                .text("saveAs", "Salvar como…")
                .text("export", "Exportar…")
                .separator()
                .text("quit", "Sair")
                .build()?;
            app.set_menu(MenuBuilder::new(handle).item(&file).build()?)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let _ = app.emit("brmodelo-menu", event.id().as_ref());
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.emit("brmodelo-close-requested", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_project, open_recent_project, attach_opened_project,
            list_recent_projects, save_project, quit_desktop
        ])
        .run(tauri::generate_context!())
        .expect("Não foi possível iniciar o ARQON Software Engineering Studio desktop.");
}
