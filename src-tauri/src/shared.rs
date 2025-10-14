use std::{path::PathBuf, sync::LazyLock};

// codegen for oap config
include!(concat!(env!("OUT_DIR"), "/oap_config.rs"));

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
