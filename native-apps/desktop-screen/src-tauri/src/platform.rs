/// WebKitGTK 2.x defaults to a DMABUF / accelerated-compositing renderer that
/// crashes the web process when there's no DRM device available (VMs with
/// software graphics, llvmpipe, bare-ssh sessions).
#[cfg(target_os = "linux")]
pub fn fix_webkit_vm_rendering() {
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_some() {
        return;
    }
    let has_drm_render_node = std::fs::read_dir("/dev/dri")
        .map(|entries| {
            entries.filter_map(|e| e.ok()).any(|e| {
                e.file_name()
                    .to_str()
                    .map(|n| n.starts_with("renderD"))
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false);
    if !has_drm_render_node {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
}

/// Promote the modern GStreamer `va` hardware decoders
#[cfg(target_os = "linux")]
pub fn tune_media_pipeline() {
    if std::env::var_os("GST_PLUGIN_FEATURE_RANK").is_none() {
        std::env::set_var(
            "GST_PLUGIN_FEATURE_RANK",
            "vah264dec:MAX,vah265dec:MAX,vavp9dec:MAX,vavp8dec:MAX,vaapidecodebin:NONE",
        );
    }
}
