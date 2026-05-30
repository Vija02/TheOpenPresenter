/// WebKitGTK 2.x defaults to a DMABUF / accelerated-compositing renderer that
/// crashes the web process under virtualized graphics (VMs, llvmpipe, no DRM).
#[cfg(target_os = "linux")]
pub fn fix_webkit_vm_rendering() {
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
}
