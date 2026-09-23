//! The modules are grouped by what they are for:
//!
//! - [`storage`]  bytes on disk: layout, blob store, cheap copies
//! - [`runtime`]  acquiring a version and running it
//! - [`shell`]    how callers drive this binary
//! - [`publish`]  building a release, used only by `top-runtime-publish`

pub mod publish;
pub mod runtime;
pub mod shell;
pub mod storage;

pub use storage::paths::Layout;
