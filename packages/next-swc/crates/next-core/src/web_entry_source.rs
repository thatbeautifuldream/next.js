use anyhow::{anyhow, Result};
use turbopack_binding::{
    turbo::{
        tasks::{TryJoinIterExt, Value},
        tasks_fs::FileSystemPathVc,
    },
    turbopack::{
        core::{
            chunk::ChunkableAssetVc,
            compile_time_defines,
            compile_time_info::{
                CompileTimeDefines, CompileTimeDefinesVc, CompileTimeInfo, CompileTimeInfoVc,
                FreeVarReferencesVc,
            },
            environment::{
                BrowserEnvironment, EnvironmentIntention, EnvironmentVc, ExecutionEnvironment,
            },
            free_var_references,
            reference_type::{EntryReferenceSubType, ReferenceType},
            resolve::{origin::PlainResolveOriginVc, parse::RequestVc},
            source_asset::SourceAssetVc,
        },
        dev::react_refresh::assert_can_resolve_react_refresh,
        dev_server::{
            html::DevHtmlAssetVc,
            source::{asset_graph::AssetGraphContentSourceVc, ContentSourceVc},
        },
        node::execution_context::ExecutionContextVc,
        turbopack::ecmascript::EcmascriptModuleAssetVc,
    },
};

use crate::{
    embed_js::next_js_file_path,
    next_client::{
        context::{
            get_client_asset_context, get_client_chunking_context,
            get_client_resolve_options_context, ClientContextType,
        },
        runtime_entry::{RuntimeEntriesVc, RuntimeEntry},
    },
    next_config::NextConfigVc,
};

fn defines() -> CompileTimeDefines {
    compile_time_defines!(
        process.turbopack = true,
        process.env.NODE_ENV = "development",
    )
}

#[turbo_tasks::function]
pub fn web_defines() -> CompileTimeDefinesVc {
    defines().cell()
}

#[turbo_tasks::function]
pub async fn web_free_vars() -> Result<FreeVarReferencesVc> {
    Ok(free_var_references!(..defines().into_iter()).cell())
}

#[turbo_tasks::function]
pub fn get_compile_time_info(browserslist_query: &str) -> CompileTimeInfoVc {
    CompileTimeInfo::builder(EnvironmentVc::new(
        Value::new(ExecutionEnvironment::Browser(
            BrowserEnvironment {
                dom: true,
                web_worker: false,
                service_worker: false,
                browserslist_query: browserslist_query.to_owned(),
            }
            .into(),
        )),
        Value::new(EnvironmentIntention::Client),
    ))
    .defines(web_defines())
    .free_var_references(web_free_vars())
    .cell()
}

#[turbo_tasks::function]
pub async fn get_web_runtime_entries(
    project_root: FileSystemPathVc,
    next_config: NextConfigVc,
    execution_context: ExecutionContextVc,
) -> Result<RuntimeEntriesVc> {
    let resolve_options_context = get_client_resolve_options_context(
        project_root,
        Value::new(ClientContextType::Other),
        next_config,
        execution_context,
    );
    let enable_react_refresh =
        assert_can_resolve_react_refresh(project_root, resolve_options_context)
            .await?
            .as_request();

    let mut runtime_entries = Vec::new();

    // It's important that React Refresh come before the regular bootstrap file,
    // because the bootstrap contains JSX which requires Refresh's global
    // functions to be available.
    if let Some(request) = enable_react_refresh {
        runtime_entries.push(RuntimeEntry::Request(request, project_root.join("_")).cell())
    };

    runtime_entries.push(
        RuntimeEntry::Source(SourceAssetVc::new(next_js_file_path("dev/bootstrap.ts")).into())
            .cell(),
    );

    Ok(RuntimeEntriesVc::cell(runtime_entries))
}

#[turbo_tasks::function]
pub async fn create_web_entry_source(
    project_path: FileSystemPathVc,
    execution_context: ExecutionContextVc,
    entry_requests: Vec<RequestVc>,
    server_root: FileSystemPathVc,
    eager_compile: bool,
    browserslist_query: &str,
    next_config: NextConfigVc,
) -> Result<ContentSourceVc> {
    let ty = Value::new(ClientContextType::Other);
    let compile_time_info = get_compile_time_info(browserslist_query);
    let context = get_client_asset_context(
        project_path,
        execution_context,
        compile_time_info,
        ty,
        next_config,
    );
    let chunking_context = get_client_chunking_context(
        project_path,
        server_root,
        compile_time_info.environment(),
        ty,
    );
    let entries = get_web_runtime_entries(project_path, next_config, execution_context);

    let runtime_entries = entries.resolve_entries(context);

    let origin = PlainResolveOriginVc::new(context, project_path.join("_")).as_resolve_origin();
    let entries = entry_requests
        .into_iter()
        .map(|request| async move {
            let ty = Value::new(ReferenceType::Entry(EntryReferenceSubType::Web));
            Ok(origin
                .resolve_asset(request, origin.resolve_options(ty.clone()), ty)
                .primary_assets()
                .await?
                .first()
                .copied())
        })
        .try_join()
        .await?;

    let entries: Vec<_> = entries
        .into_iter()
        .flatten()
        .map(|module| async move {
            if let Some(ecmascript) = EcmascriptModuleAssetVc::resolve_from(module).await? {
                Ok((
                    ecmascript.into(),
                    chunking_context,
                    Some(runtime_entries.with_entry(ecmascript.into())),
                ))
            } else if let Some(chunkable) = ChunkableAssetVc::resolve_from(module).await? {
                // TODO this is missing runtime code, so it's probably broken and we should also
                // add an ecmascript chunk with the runtime code
                Ok((chunkable, chunking_context, None))
            } else {
                // TODO convert into a serve-able asset
                Err(anyhow!(
                    "Entry module is not chunkable, so it can't be used to bootstrap the \
                     application"
                ))
            }
        })
        .try_join()
        .await?;

    let entry_asset = DevHtmlAssetVc::new(server_root.join("index.html"), entries).into();

    let graph = if eager_compile {
        AssetGraphContentSourceVc::new_eager(server_root, entry_asset)
    } else {
        AssetGraphContentSourceVc::new_lazy(server_root, entry_asset)
    }
    .into();
    Ok(graph)
}
