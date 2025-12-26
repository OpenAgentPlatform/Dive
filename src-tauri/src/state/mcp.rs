// use dive_core::McpElicitationManager;
use std::ops::{Deref, DerefMut};

type McpElicitationManager = ();

#[derive(Clone, Default)]
pub struct McpState(pub McpElicitationManager);

impl Deref for McpState {
    type Target = McpElicitationManager;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for McpState {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}
