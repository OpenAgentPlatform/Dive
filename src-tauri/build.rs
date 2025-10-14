use std::{collections::HashMap, env, fs, path::Path};

fn main() {
    let out_dir = env::var("OUT_DIR").unwrap();
    let out_dir = Path::new(&out_dir);
    let hash_dest_path = &out_dir.join("file_hashes.rs");

    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let uv_lock_path = Path::new(&manifest_dir).join("../mcp-host/uv.lock");
    let file_content = fs::read(&uv_lock_path).expect("Failed to read file");
    let hash_string = md5::compute(&file_content);

    // codegen
    let generated_code = format!(
        r#"
pub const UV_LOCK_MD5: &str = "{}";
"#,
        hash_string
            .to_vec()
            .iter()
            .map(|b| format!("{:02x}", b))
            .collect::<Vec<String>>()
            .join("")
    );

    let oap_config_path = Path::new(&manifest_dir).join("../shared/oap.json");
    let oap_config_content = fs::read(&oap_config_path).expect("Failed to read file");
    let oap_config: HashMap<String, String> = serde_json::from_slice(&oap_config_content).expect("Failed to parse oap.json");
    let oap_root_url = oap_config.get("OAP_ROOT_URL").expect("Failed to get OAP_ROOT_URL");
    let oap_proxy_url = oap_config.get("OAP_PROXY_URL").expect("Failed to get OAP_PROXY_URL");
    let oap_config_code = format!(
        r#"
pub const OAP_ROOT_URL: &str = "{}";
pub const OAP_PROXY_URL: &str = "{}";
"#,
        oap_root_url, oap_proxy_url
    );

    fs::write(&hash_dest_path, generated_code).unwrap();
    fs::write(Path::new(&out_dir).join("oap_config.rs"), oap_config_code).unwrap();

    println!("cargo:rerun-if-changed={}", uv_lock_path.display());
    println!("cargo:rerun-if-changed={}", oap_config_path.display());

    tauri_build::build();
}
