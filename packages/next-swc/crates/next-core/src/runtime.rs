use anyhow::{bail, Result};
use turbopack_binding::turbopack::{
    core::{
        issue::{IssueSeverity, OptionIssueSourceVc},
        resolve::{origin::ResolveOriginVc, parse::RequestVc},
    },
    turbopack::ecmascript::{chunk::EcmascriptChunkPlaceableVc, resolve::cjs_resolve},
};

/// Resolves the turbopack runtime module from the given [AssetContextVc].
#[turbo_tasks::function]
pub async fn resolve_runtime_request(
    origin: ResolveOriginVc,
    path: &str,
) -> Result<EcmascriptChunkPlaceableVc> {
    let runtime_request_path = format!("@vercel/turbopack-next/{}", path);
    let request = RequestVc::parse_string(runtime_request_path.clone());

    if let Some(asset) = *cjs_resolve(
        origin,
        request,
        OptionIssueSourceVc::none(),
        IssueSeverity::Error.cell(),
    )
    .first_asset()
    .await?
    {
        if let Some(placeable) = EcmascriptChunkPlaceableVc::resolve_from(asset).await? {
            Ok(placeable)
        } else {
            bail!("turbopack runtime asset is not placeable")
        }
    } else {
        // The @vercel/turbopack-dev module is not installed.
        bail!("could not resolve the `{}` module", runtime_request_path)
    }
}
