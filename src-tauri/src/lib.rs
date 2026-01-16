use std::collections::HashMap;
use std::fs::create_dir_all;
use std::sync::Arc;
use std::sync::Mutex;

use futures::executor::block_on;
use tauri::AppHandle;
use tauri::RunEvent;
use tauri::{Emitter, Manager};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_http::reqwest;
use tauri_plugin_store::StoreExt;
use tokio::sync::mpsc;

use enclose::enclose;

use crate::event::MCPInstallParam;
use crate::event::IPC_MCP_ELICITATION_REQUEST;
use crate::event::{EMIT_MCP_INSTALL, EMIT_OAP_LOGOUT, EMIT_OAP_REFRESH};
use crate::host::HostProcess;
use crate::host::McpHost;
use crate::state::oap::OAPState;
use crate::state::AppState;
use crate::state::DownloadDependencyEvent;

#[cfg(target_os = "macos")]
mod codesign;

mod command;
mod dependency;
mod event;
mod host;
mod oap;
mod process;
mod shared;
mod state;
mod tray;
mod util;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let host_handle = Arc::new(Mutex::new(None::<host::HostProcess>));

    let log_level = if cfg!(debug_assertions) {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    };

    tauri::async_runtime::set(tokio::runtime::Handle::current());
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd: String| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Folder {
                        path: shared::PROJECT_DIRS.log.clone(),
                        file_name: Some("main-tauri".to_string()),
                    },
                ))
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .level(log_level)
                .max_file_size(1024 * 100)
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .setup(enclose!((host_handle) move |app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            // Initialize Job Object for Windows process management
            #[cfg(windows)]
            process::init_job_object();

            let app_handle = app.handle();
            let mcp_host = McpHost::default();

            // register oap listener
            let store = app.store("oap.json")?;
            let oap_state: anyhow::Result<OAPState> = block_on(enclose!((app_handle, mcp_host) async move {
                let oap_state = OAPState::new(app_handle.clone(), store, mcp_host);
                oap_state.on_recv_ws_event(move |event| {
                    let _ = match event {
                        oap::OAPWebSocketHandlerEvent::Disconnect => {
                            app_handle.emit(EMIT_OAP_LOGOUT, "")
                        },
                        oap::OAPWebSocketHandlerEvent::Refresh => {
                            app_handle.emit(EMIT_OAP_REFRESH, "")
                        },
                    };
                }).await;

                Ok(oap_state)
            }));

            let oap_state = Arc::new(oap_state?);
            let mcp_state = state::mcp::McpState::default();

            // local ipc handler
            // handle_local_ipc(app_handle.clone(), mcp_state.clone());

            // deep link
            let deep_link = app.deep_link();
            deep_link.on_open_url(enclose!((app_handle, mcp_host, oap_state) move |event| {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.set_focus();
                }

                let _ = handle_deep_link(app_handle.clone(), mcp_host.clone(), oap_state.clone(), event.urls());
            }));

            if let Ok(Some(urls)) = deep_link.get_current() {
                log::info!("deep link open from cli: {:?}", &urls);
                let _ = handle_deep_link(app_handle.clone(), mcp_host.clone(), oap_state.clone(), urls);
            }

            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                deep_link.register_all()?;
            }

            // system tray
            tray::init_system_tray(app)?;

            // replace old bus file with empty file
            create_dir_all(shared::PROJECT_DIRS.bus.parent().unwrap())?;
            if let Err(e) = std::fs::write(&shared::PROJECT_DIRS.bus, "") {
                log::warn!("failed to replace bus file: {e}");
            }

            // init mcp host services
            let download_deps_rx = init_mcp_host_service(app_handle.clone(), host_handle)?;
            let download_deps_state = state::DownloadDependencyState {
                rx: Mutex::new(Some(download_deps_rx)),
            };

            // global state
            let store = app.store("preferences.json")?;
            let state = state::AppState { store, mcp_host };

            app.manage(state);
            app.manage(mcp_state);
            app.manage(oap_state);
            app.manage(download_deps_state);

            Ok(())
        }))
        .invoke_handler(tauri::generate_handler![
            command::start_recv_download_dependency_log,
            command::copy_image,
            command::download_file,
            command::set_host,
            command::save_clipboard_image_to_cache,
            command::get_client_info,
            command::check_command_exist,
            command::get_mime_type,
            // llm
            command::llm::llm_openai_model_list,
            command::llm::llm_openai_compatible_model_list,
            command::llm::llm_openai_azure_model_list,
            command::llm::llm_anthropic_model_list,
            command::llm::llm_ollama_model_list,
            command::llm::llm_bedrock_model_list,
            command::llm::llm_mistralai_model_list,
            command::llm::llm_google_genai_model_list,
            // system
            command::system::system_get_minimize_to_tray,
            command::system::system_set_minimize_to_tray,
            // host
            command::host::host_refresh_config,
            // oap
            command::oap::oap_login,
            command::oap::oap_logout,
            command::oap::oap_get_mcp_servers,
            command::oap::oap_search_mcp_server,
            command::oap::oap_apply_mcp_server,
            command::oap::oap_get_me,
            command::oap::oap_get_usage,
            command::oap::open_oap_login_page,
            command::oap::oap_get_token,
            command::oap::oap_get_model_description,
            command::oap::oap_limiter_check,
            // lipc
            command::lipc::response_mcp_elicitation,
            command::oap::oap_get_mcp_tags,
            // path
            command::path::path_search,
        ])
        .append_invoke_initialization_script(include_str!("../../shared/preload.js"))
        .build(tauri::generate_context!());

    let destroy_host = move || {
        if let Some(mut host) = host_handle.lock().unwrap().take() {
            log::info!("kill mcp-host process");
            host.destroy();
        }
    };

    match app {
        Ok(app) => {
            app.run(move |_app_handle, _event| {
                match &_event {
                    RunEvent::Exit => {
                        destroy_host();
                    }
                    RunEvent::WindowEvent {
                        event: tauri::WindowEvent::CloseRequested { api, .. },
                        ..
                    } => {
                        let settings = _app_handle.state::<AppState>();

                        if settings.get_minimize_to_tray() {
                            // if minimize to tray, hide the window
                            api.prevent_close();
                            if let Some(window) = _app_handle.get_webview_window("main") {
                                match window.hide() {
                                    Ok(_) => log::info!("Window minimized to tray"),
                                    Err(e) => log::warn!("Failed to hide window: {}", e),
                                }
                            };
                        } else {
                            // if not minimize to tray, close the window and clean up the host
                            destroy_host();
                        }
                    }
                    _ => (),
                }
            });
        }
        Err(e) => {
            log::error!("failed to build tauri application: {e}");
            destroy_host();
        }
    }
}

async fn upgrade_from_electron() -> anyhow::Result<()> {
    let tauri_flag_file = shared::PROJECT_DIRS.root.join(".tauri");
    if tauri_flag_file.exists() {
        return Ok(());
    }

    // set tauri flag file
    tokio::fs::write(tauri_flag_file, "").await?;
    log::info!("upgrading from electron");

    // ready to upgrade
    let alias_file = shared::PROJECT_DIRS.config.join(host::COMMAND_ALIAS_FILE);
    if alias_file.exists() {
        tokio::fs::remove_file(alias_file).await?;
    }

    log::info!("upgrade from electron done");
    Ok(())
}

fn handle_deep_link(
    app_handle: AppHandle,
    mcp_host: McpHost,
    oap_state: Arc<OAPState>,
    urls: Vec<url::Url>,
) -> anyhow::Result<()> {
    let url = urls.first().cloned();
    if let Some(url) = url {
        let host = url.host_str();

        match host {
            Some("signin") => {
                let path = url.path();
                let token = &path[1..].to_string();

                if token.len() < 4 {
                    log::warn!("invalid oap login token: {:?}", &token);
                    return Ok(());
                }

                let _token = token.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = oap_state.login(_token).await;
                });

                log::info!("oap login via deep link: {:?}*******", &token[..4]);
            }
            Some("refresh") => {
                let _ = app_handle.emit(EMIT_OAP_REFRESH, "");
                log::info!("oap refresh via deep link");
            }
            Some("mcp.install") => {
                log::info!("oap mcp install via deep link");
                let Some(query) = url.query() else {
                    log::warn!("invalid oap mcp apply url: {:?}", &url);
                    return Ok(());
                };

                let query_map: HashMap<String, String> = query
                    .split('&')
                    .filter_map(|pair| {
                        let (key, value) = pair.split_once('=')?;
                        Some((key.to_string(), value.to_string()))
                    })
                    .collect();

                let Some(name) = query_map.get("name") else {
                    log::warn!("missing mcp name");
                    return Ok(());
                };

                let Some(config) = query_map.get("config") else {
                    log::warn!("missing mcp config");
                    return Ok(());
                };

                let _ = app_handle.emit(
                    EMIT_MCP_INSTALL,
                    MCPInstallParam {
                        name: name.clone(),
                        config: config.clone(),
                    },
                );
            }
            Some("mcp.oauth.redirect") => {
                let client = reqwest::Client::new();
                if let Ok(url) = mcp_host.build_url(format!(
                    "/api/tools/login/oauth/callback?{}",
                    url.query().unwrap_or("")
                )) {
                    tauri::async_runtime::spawn(async move {
                        let _ = client.get(url).send().await;
                    });
                };
            }
            Some("open") => {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {
                log::warn!("unknown deep link url: {:?}", &url);
            }
        }
    }

    Ok(())
}

fn init_mcp_host_service(app_handle: AppHandle, host_handle: Arc<Mutex<Option<HostProcess>>>) -> anyhow::Result<tokio::sync::mpsc::Receiver<DownloadDependencyEvent>> {
    let (tx, rx) = mpsc::channel(20);
    let host_dir = app_handle
        .path()
        .resolve("resources/mcp-host", tauri::path::BaseDirectory::Resource)?;

    let prebuilt_dir = app_handle
        .path()
        .resolve("resources/prebuilt", tauri::path::BaseDirectory::Resource)?;

    log::info!("host dir: {}", host_dir.display());
    tauri::async_runtime::spawn(async move {
        if let Err(e) = upgrade_from_electron().await {
            log::error!("failed to upgrade from electron: {e}");
        }

        let mut host = host::HostProcess::new(host_dir.clone(), prebuilt_dir);
        if let Err(e) = host.prepare().await {
            tx.send(state::DownloadDependencyEvent::Error(format!(
                "failed to prepare host: {e}"
            )))
            .await
            .unwrap();
            log::error!("failed to prepare host: {e}");
        }

        let downloader = dependency::DependencyDownloader::new(tx.clone(), host_dir);
        if let Err(e) = downloader.start().await {
            tx.send(state::DownloadDependencyEvent::Error(format!("failed to start dependency downloader: {e}")))
                .await
                .unwrap();
            log::error!("failed to start dependency downloader: {e}");
        }

        if let Err(e) = host.spawn().await {
            tx.send(state::DownloadDependencyEvent::Error(format!("failed to start host: {e}")))
                .await
                .unwrap();
            log::error!("failed to start host: {e}");
        }

        if let Ok(mut host_handle) = host_handle.lock() {
            *host_handle = Some(host);
        }
    });

    Ok(rx)
}

// fn handle_local_ipc(app_handle: AppHandle, mcp_state: state::mcp::McpState) {
//     dive_core::listen_ipc_mcp_elicitation(mcp_state.0, enclose!((app_handle) move |elicitation| {
//         app_handle.emit(IPC_MCP_ELICITATION_REQUEST, serde_json::to_string(&elicitation)?)?;
//         Ok(())
//     }));
// }
