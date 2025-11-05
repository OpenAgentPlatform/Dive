use std::{
    path::{Path, PathBuf},
    process::Stdio, sync::{Arc, Mutex},
};

use anyhow::Result;

use tokio::{
    fs::{create_dir_all, File},
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader, BufWriter},
};

use crate::process::command::Command;

pub const COMMAND_ALIAS_FILE: &str = "command_alias.json";
pub const CUSTOM_RULES_FILE: &str = "customrules";
pub const MCP_CONFIG_FILE: &str = "mcp_config.json";
pub const MODEL_CONFIG_FILE: &str = "model_config.json";
pub const HTTPD_CONFIG_FILE: &str = "dive_httpd.json";
pub const PLUGIN_CONFIG_FILE: &str = "plugin_config.json";

#[derive(Clone, Debug, Default)]
pub struct McpHost {
    hostname: Arc<Mutex<Option<String>>>,
}

impl McpHost {
    pub fn build_url(&self, path: impl AsRef<str>) -> Result<String> {
        let hostname = self.hostname.lock().map_err(|e| anyhow::anyhow!("failed to lock hostname: {}", e))?;
        let hostname = hostname.as_ref().ok_or(anyhow::anyhow!("hostname not set"))?;

        Ok(format!("http://{hostname}{}", path.as_ref()))
    }

    pub fn set_hostname(&self, hostname: String) -> Result<()> {
        log::info!("setting hostname: {}", hostname);
        let mut _hostname = self.hostname.lock().map_err(|e| anyhow::anyhow!("failed to lock hostname: {}", e))?;
        *_hostname = if hostname.starts_with("http://") {
            Some(hostname.replace("http://", ""))
        } else {
            Some(hostname)
        };
        Ok(())
    }
}

pub struct HostProcess {
    child_process: Option<std::process::Child>,
    file_path: PathBuf,
    host_dir: PathBuf,
}

impl HostProcess {
    pub fn new(host_dir: PathBuf) -> Self {
        let file_path = crate::shared::PROJECT_DIRS.bus.clone();
        Self {
            child_process: None,
            file_path,
            host_dir,
        }
    }

    #[cfg(debug_assertions)]
    fn get_host_cmd(&self) -> Command {
        let mut cmd = Command::new("uv");
        cmd.arg("run").arg("dive_httpd");

        cmd
    }

    #[cfg(not(debug_assertions))]
    fn get_host_cmd(&self) -> Command {
        let cache_dir = crate::shared::PROJECT_DIRS.cache.clone();
        let deps_dir = cache_dir.join("deps");
        let bin_dir = crate::shared::PROJECT_DIRS.bin.clone();
        let python_bin = if cfg!(target_os = "windows") {
            bin_dir.join("python/python.exe")
        } else {
            bin_dir.join("python/bin/python3")
        };

        let mut cmd = Command::new(python_bin);
        cmd
            .arg("-I")
            .arg("-c")
            .arg(format!(
                "import site; site.addsitedir('{}'); site.addsitedir('{}'); from dive_mcp_host.httpd._main import main; main()",
                dunce::simplified(&self.host_dir).to_string_lossy().replace('\\', "\\\\"),
                dunce::simplified(&deps_dir).to_string_lossy().replace('\\', "\\\\")
            ));

        cmd
    }

    pub async fn prepare(&mut self) -> Result<()> {
        let dirs = crate::shared::PROJECT_DIRS.clone();
        create_dir_all(&dirs.root).await?;
        create_dir_all(&dirs.config).await?;
        create_dir_all(&dirs.cache).await?;
        create_dir_all(&dirs.script).await?;

        log::info!("initing host config");
        log::info!("config: {}", dirs.config.to_string_lossy());
        Self::init_host_config(&self, &dirs.config, &dirs.config).await?;
        Ok(())
    }

    pub async fn spawn(&mut self) -> Result<()> {
        let dirs = crate::shared::PROJECT_DIRS.clone();
        let cwd = if cfg!(debug_assertions) {
            &std::env::current_dir()?.join("../mcp-host")
        } else {
            &self.host_dir
        };

        let mut cmd = self.get_host_cmd();
        cmd.arg("--port")
            .arg("0")
            .arg("--report_status_file")
            .arg(&self.file_path)
            .arg("--log_level")
            .arg("INFO")
            .envs(std::env::vars())
            .env("PATH", crate::util::get_system_path().await)
            .env("DIVE_CONFIG_DIR", dirs.config)
            .env("RESOURCE_DIR", dirs.cache)
            .current_dir(dunce::simplified(cwd))
            .stderr(Stdio::piped())
            .stdout(Stdio::piped());

        log::info!("dived execute: {:?}", cmd.get_args());
        let mut process = cmd.spawn()?;

        if let (Some(stdout), Some(stderr)) = (process.stdout.take(), process.stderr.take()) {
            tauri::async_runtime::spawn(async move {
                // Convert std::process stdio to tokio-compatible versions
                let stdout = tokio::process::ChildStdout::from_std(stdout).unwrap();
                let stderr = tokio::process::ChildStderr::from_std(stderr).unwrap();

                let stdout_reader = BufReader::new(stdout);
                let mut stdout_lines = stdout_reader.lines();
                let stderr_reader = BufReader::new(stderr);
                let mut stderr_lines = stderr_reader.lines();

                loop {
                    tokio::select! {
                        line = stdout_lines.next_line() => {
                            match line {
                                Ok(Some(line)) => {
                                    log::info!("[dived] {}", line);
                                }
                                _ => break
                            }
                        }
                        line = stderr_lines.next_line() => {
                            match line {
                                Ok(Some(line)) => {
                                    log::info!("[dived] {}", line);
                                }
                                _ => break
                            }
                        }
                    }
                }
            });
        }

        self.child_process = Some(process);
        Ok(())
    }

    async fn init_host_config(&self, config_dir: &Path, db_dir: &Path) -> Result<()> {
        // alias file
        let bin_dir = crate::shared::PROJECT_DIRS.bin.clone();
        let nodejs_bin = bin_dir.join("nodejs");
        let alias_content = if cfg!(target_os = "windows") {
            format!(
                r#"{{ "npx": "{}", "npm": "{}" }}"#,
                dunce::simplified(&nodejs_bin.join("npx.cmd"))
                    .to_string_lossy()
                    .replace('\\', "\\\\"),
                dunce::simplified(&nodejs_bin.join("npm.cmd"))
                    .to_string_lossy()
                    .replace('\\', "\\\\"),
            )
        } else {
            "{}".to_string()
        };
        create_file_if_not_exists(
            &config_dir.join(COMMAND_ALIAS_FILE),
            alias_content.as_bytes(),
        )
        .await?;

        create_file_if_not_exists(&config_dir.join(CUSTOM_RULES_FILE), b"").await?;
        create_file_if_not_exists(&config_dir.join(MCP_CONFIG_FILE), b"{\"mcpServers\":{}}")
            .await?;
        create_file_if_not_exists(
            &config_dir.join(MODEL_CONFIG_FILE),
            b"{\"activeProvider\":\"none\",\"enableTools\":true,\"disableDiveSystemPrompt\":false}",
        )
        .await?;

        create_file_if_not_exists(
            &config_dir.join(PLUGIN_CONFIG_FILE),
            r#"[
    {
        "name": "oap-platform",
        "module": "dive_mcp_host.oap_plugin",
        "config": {},
        "ctx_manager": "dive_mcp_host.oap_plugin.OAPPlugin",
        "static_callbacks": "dive_mcp_host.oap_plugin.get_static_callbacks"
    }
]"#
            .as_bytes(),
        )
        .await?;

        let db_path = dunce::simplified(db_dir)
            .to_string_lossy()
            .replace('\\', "\\\\");
        create_file_if_not_exists(
            &config_dir.join(HTTPD_CONFIG_FILE),
            format!(
                "{{
    \"db\": {{
        \"uri\": \"sqlite:///{}/db.sqlite\",
        \"pool_size\": 5,
        \"pool_recycle\": 60,
        \"max_overflow\": 10,
        \"echo\": false,
        \"pool_pre_ping\": true,
        \"migrate\": true
        }},
    \"checkpointer\": {{
        \"uri\": \"sqlite:///{}/db.sqlite\"
    }}
}}",
                &db_path, &db_path,
            )
            .trim()
            .as_bytes(),
        )
        .await?;
        Ok(())
    }

    pub fn destroy(&mut self) {
        let child = self.child_process.take();

        // remove bus
        let bus_path = crate::shared::PROJECT_DIRS.bus.clone();
        log::info!("removing bus: {}", bus_path.to_string_lossy());
        if bus_path.exists() {
            let _ = std::fs::remove_file(&bus_path);
        }

        // kill the host process
        if let Some(mut child) = child {
            #[cfg(target_os = "linux")]
            {
                use nix::sys::signal::{self, Signal};
                use nix::unistd::Pid;
                let pid = child.id() as i32;
                let _ = signal::kill(Pid::from_raw(pid), Signal::SIGTERM);
                std::thread::sleep(std::time::Duration::from_millis(50));
                let _ = signal::kill(Pid::from_raw(pid), Signal::SIGKILL);
                std::thread::sleep(std::time::Duration::from_millis(50));
            }

            log::info!("killing host process");
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl Drop for HostProcess {
    fn drop(&mut self) {
        self.destroy();
    }
}

async fn create_file_if_not_exists(path: &Path, content: &[u8]) -> Result<()> {
    if !path.exists() {
        log::info!("creating file: {}", path.to_string_lossy());
        create_dir_all(path.parent().unwrap()).await?;
        let file = File::create(path).await?;
        let mut writer = BufWriter::new(file);
        writer.write_all(content).await?;
        writer.flush().await?;
    }

    Ok(())
}
