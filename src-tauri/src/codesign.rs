use anyhow::{anyhow, Result};
use std::path::Path;
use std::process::Stdio;
use std::sync::Arc;
use tokio::fs;
use tokio::process::Command;
use tokio::sync::Semaphore;
use walkdir::WalkDir;

const MAX_CONCURRENT_SIGNING: usize = 5;

/// Check if a file is a Mach-O binary
async fn is_mach_o_binary(file_path: &Path) -> bool {
    if !file_path.is_file() {
        return false;
    }

    // Check if executable
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let Ok(metadata) = fs::metadata(file_path).await else {
            return false;
        };

        let mode = metadata.permissions().mode();
        if mode & 0o111 == 0 {
            return false;
        }
    }

    // Check if it's Mach-O
    let Ok(output) = Command::new("file").arg(file_path).output().await else {
        return false;
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.contains("Mach-O")
}

/// Check if a file is already signed
async fn is_already_signed(file_path: &Path) -> bool {
    Command::new("codesign")
        .args(["-dv", &file_path.to_string_lossy()])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|status| status.success())
        .unwrap_or(false)
}

/// Apply ad-hoc signature to a file
async fn sign_file_adhoc(file_path: &Path) -> Result<()> {
    log::info!("Signing: {}", file_path.display());

    let output = Command::new("codesign")
        .args(["--sign", "-", "--force", &file_path.to_string_lossy()])
        .output()
        .await?;

    if output.status.success() {
        log::info!("✓ Success: {}", file_path.display());
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(anyhow!("Failed to sign {}: {}", file_path.display(), stderr))
    }
}

/// Sign all binaries in a directory with ad-hoc signatures (concurrent)
pub async fn sign_directory(dir_path: &Path) -> Result<()> {
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err(anyhow!("Directory does not exist: {}", dir_path.display()));
    }

    log::info!("Starting to sign directory: {}", dir_path.display());

    // Create semaphore to limit concurrent signing to 5 files
    let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_SIGNING));
    let mut tasks = Vec::new();

    // Collect all Mach-O binaries that need signing
    for entry in WalkDir::new(dir_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();

        // Only process files (not directories)
        if path.is_file() && is_mach_o_binary(path).await {
            let path_buf = path.to_path_buf();
            let semaphore_clone = semaphore.clone();

            // Spawn concurrent signing task
            let task = tokio::spawn(async move {
                // Check if already signed
                if is_already_signed(&path_buf).await {
                    log::info!("Skipped (already signed): {}", path_buf.display());
                    return Ok(());
                }

                let _permit = semaphore_clone.acquire().await.unwrap();
                sign_file_adhoc(&path_buf).await
            });

            tasks.push(task);
        }
    }

    // Wait for all signing tasks to complete and count results
    let mut signed_count = 0;
    let mut failed_count = 0;

    for task in tasks {
        match task.await {
            Ok(Ok(())) => signed_count += 1,
            Ok(Err(e)) => {
                log::error!("✗ Signing failed: {}", e);
                failed_count += 1;
            }
            Err(e) => {
                log::error!("✗ Task failed: {}", e);
                failed_count += 1;
            }
        }
    }

    log::info!("Signing completed! Signed: {signed_count}, Failed: {failed_count}");
    Ok(())
}