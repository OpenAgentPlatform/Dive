// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tokio::main]
async fn main() {
    let _ = fix_path_env::fix();

    #[cfg(target_os = "linux")]
    {
        if let Some(backend_note) = configure_display_backend() {
            eprintln!("{backend_note:?}");
        }
    }

    dive_lib::run();
}

// TODO: Remove this workaround when the tauri issue is resolved
// tauri Issue: https://github.com/tauri-apps/tauri/issues/9394
// borrowed from https://github.com/skyline69/balatro-mod-manager
#[cfg(target_os = "linux")]
fn configure_display_backend() -> Option<String> {
    use std::env;

    let set_env_if_absent = |key: &str, value: &str| {
        if env::var_os(key).is_none() {
            // Safety: called during startup before any threads are spawned, so mutating the
            // process environment is safe.
            unsafe { env::set_var(key, value) };
        }
    };

    let on_wayland = env::var_os("WAYLAND_DISPLAY").is_some()
        || matches!(
            env::var("XDG_SESSION_TYPE"),
            Ok(v) if v.eq_ignore_ascii_case("wayland")
        );

    if !on_wayland {
        set_env_if_absent("__NV_DISABLE_EXPLICIT_SYNC", "1");
        set_env_if_absent("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        set_env_if_absent("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        return Some("X11 session detected;".into());
    }

    // Prefer XWayland when available to avoid Wayland protocol errors seen during startup.
    if env::var_os("DISPLAY").is_some() {
        set_env_if_absent("WINIT_UNIX_BACKEND", "x11");
        set_env_if_absent("GDK_BACKEND", "x11");
        set_env_if_absent("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        return Some(
            "Wayland session detected; forcing X11 backend to avoid compositor protocol errors."
                .into(),
        );
    }

    set_env_if_absent("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    Some(
        "Wayland session detected without X11; leaving Wayland enabled (set WINIT_UNIX_BACKEND/GDK_BACKEND manually if needed)."
            .into(),
    )
}
