use std::{
    ffi::OsStr,
    fmt::{Debug, Display},
    ops::{Deref, DerefMut},
};

/// Custom Command wrapper that provides selective Job Object management on Windows
///
/// Usage examples:
/// ```rust
/// // Regular managed process (default) - will be killed when main app exits
/// let mut cmd = Command::new("mcp-host.exe");
/// let child = cmd.spawn()?;
///
/// // Unmanaged process (like updater) - won't be killed when main app exits
/// let mut cmd = Command::new("updater.exe")
///     .without_job_management();
/// let child = cmd.spawn()?;
/// ```
pub struct Command {
    inner: std::process::Command,
    #[cfg(windows)]
    should_join_job: bool,
}

impl Display for Command {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Command {{ inner: {:?} }}", self.inner)
    }
}

impl Debug for Command {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Command {{ inner: {:?} }}", self.inner)
    }
}

impl Command {
    #[cfg(target_os = "windows")]
    pub fn new(cmd: impl AsRef<OsStr>) -> Self {
        {
            use std::os::windows::process::CommandExt;

            let mut cmd = std::process::Command::new(cmd);
            // CREATE_NO_WINDOW flag to prevent console window from appearing
            cmd.creation_flags(0x08000000);
            Self {
                inner: cmd,
                should_join_job: true, // Default to true on Windows
            }
        }
    }

    /// Exclude this command from Job Object management
    /// Use this for processes that need to survive app exit
    ///
    /// Examples of processes that should NOT be managed:
    /// - Updater processes (they need to survive app exit)
    /// - External tools opened by user
    /// - System utilities
    /// - Processes that need independent lifecycle
    #[allow(dead_code)]
    #[cfg(target_os = "windows")]
    pub fn without_job_management(mut self) -> Self {
        self.should_join_job = false;
        self
    }

    /// Spawn the process with optional Job Object management
    #[cfg(target_os = "windows")]
    pub fn spawn(&mut self) -> std::io::Result<std::process::Child> {
        let child = self.inner.spawn()?;

        if self.should_join_job {
            if let Some(job_arc) = crate::process::get_job_object() {
                if let Ok(job_lock) = job_arc.lock() {
                    if let Some(ref job) = *job_lock {
                        use std::os::windows::io::AsRawHandle;

                        match job.assign_process(child.as_raw_handle() as _) {
                            Ok(_) => log::info!("Process {} added to job object", child.id()),
                            Err(e) => log::warn!("Failed to add process {} to job object: {}", child.id(), e),
                        }
                    }
                }
            }
        } else {
            log::info!("Process {} spawned without job management (excluded)", child.id());
        }

        Ok(child)
    }

    #[cfg(not(target_os = "windows"))]
    pub fn new(cmd: impl AsRef<OsStr>) -> Self {
        use std::os::unix::process::CommandExt;

        let mut cmd = std::process::Command::new(cmd);
        unsafe {
            cmd.pre_exec(|| {
                // Set up process to be killed when parent dies (Linux only)
                #[cfg(target_os = "linux")]
                {
                    // PR_SET_PDEATHSIG: Send SIGKILL when parent dies
                    libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGKILL, 0, 0, 0);
                }

                Ok(())
            });
        }

        // set the process group to the current process
        cmd.process_group(0);

        Self { inner: cmd }
    }

    /// Exclude this command from management (no-op on non-Windows)
    #[cfg(not(target_os = "windows"))]
    pub fn without_job_management(self) -> Self {
        self
    }
}

impl Deref for Command {
    type Target = std::process::Command;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

impl DerefMut for Command {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.inner
    }
}
