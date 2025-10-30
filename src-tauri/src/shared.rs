use std::{path::PathBuf, sync::LazyLock};

pub const OAP_ROOT_URL: &str = "https://oaphub.ai";

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

pub static CLIENT_ID: LazyLock<&'static str> = LazyLock::new(|| {
    let id_path = PROJECT_DIRS.root.join(".client");
    if id_path.exists() {
        std::fs::read_to_string(id_path).unwrap_or_default().leak()
    } else {
        std::fs::create_dir_all(&PROJECT_DIRS.root).unwrap();
        let id = nanoid::nanoid!(16);
        let _ = std::fs::write(id_path, &id);
        id.leak()
    }
});

pub static PROJECT_DIRS: LazyLock<Dirs> = LazyLock::new(|| {
    let home = dirs::home_dir().unwrap();
    Dirs {
        root: home.join(".dive"),
        cache: home.join(".dive/host_cache"),
        bus: home.join(".dive/host_cache/bus"),
        log: home.join(".dive/log"),
        bin: home.join(".dive/bin"),
        script: home.join(".dive/scripts"),

        #[cfg(debug_assertions)]
        config: std::env::current_dir().unwrap().join("../.config"),
        #[cfg(not(debug_assertions))]
        config: home.join(".dive/config"),
    }
});

#[derive(Debug, Clone)]
pub struct Dirs {
    pub root: PathBuf,
    pub config: PathBuf,
    pub cache: PathBuf,
    pub bus: PathBuf,
    pub log: PathBuf,
    pub bin: PathBuf,
    pub script: PathBuf,
}
