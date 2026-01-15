use std::{env, fs, path::Path};

fn main() {
    let out_dir = env::var("OUT_DIR").unwrap();
    let dest_path = Path::new(&out_dir).join("file_hashes.rs");

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

    fs::write(&dest_path, generated_code).unwrap();

    tauri_build::build();
}
