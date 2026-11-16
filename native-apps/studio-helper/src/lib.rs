//! Native helper for TheOpenPresenter Studio.
//!
//! Things the desktop shell needs that Electron and Node can't do by
//! themselves, kept apart from the runtime manager, whose only job is
//! installing and running the server runtime.
//!
//! - [`remote`]   peer-to-peer access to the local server over iroh
//! - [`service`]  the state behind the NDJSON protocol and the CLI
//! - [`input`]    one-shot OS calls for input devices
//! - [`protocol`] the NDJSON wire format
//! - [`cli`]      the command line surface

pub mod cli;
pub mod input;
pub mod protocol;
pub mod remote;
pub mod service;
