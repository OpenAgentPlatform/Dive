pub mod command;

#[cfg(windows)]
use std::sync::{Arc, Mutex, OnceLock};

#[cfg(windows)]
static JOB_OBJECT: OnceLock<Arc<Mutex<Option<win32job::Job>>>> = OnceLock::new();

#[cfg(windows)]
pub fn init_job_object() -> Arc<Mutex<Option<win32job::Job>>> {
    JOB_OBJECT.get_or_init(|| {
        let job = win32job::Job::create().ok();
        if let Some(ref job) = job {
            if let Ok(mut info) = job.query_extended_limit_info() {
                // Set up job to kill child processes when job is closed
                info.limit_kill_on_job_close();
                let _ = job.set_extended_limit_info(&mut info);
                log::info!("Job object initialized successfully");
            }
        }
        Arc::new(Mutex::new(job))
    }).clone()
}

#[cfg(windows)]
pub fn get_job_object() -> Option<Arc<Mutex<Option<win32job::Job>>>> {
    JOB_OBJECT.get().cloned()
}
