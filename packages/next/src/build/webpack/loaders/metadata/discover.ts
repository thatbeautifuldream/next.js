import type webpack from 'webpack'
import type {
  CollectingMetadata,
  PossibleStaticMetadataFileNameConvention,
} from './types'
import path from 'path'
import { stringify } from 'querystring'
import { STATIC_METADATA_IMAGES } from '../../../../lib/metadata/is-metadata-route'

const METADATA_TYPE = 'metadata'

export const METADATA_RESOURCE_QUERY = '?__next_metadata'

// Produce all compositions with filename (icon, apple-icon, etc.) with extensions (png, jpg, etc.)
async function enumMetadataFiles(
  dir: string,
  filename: string,
  extensions: readonly string[],
  {
    resolvePath,
    loaderContext,
    // When set to true, possible filename without extension could: icon, icon0, ..., icon9
    numericSuffix,
  }: {
    resolvePath: (pathname: string) => Promise<string>
    loaderContext: webpack.LoaderContext<any>
    numericSuffix: boolean
  }
) {
  const collectedFiles: string[] = []

  const possibleFileNames = [filename].concat(
    numericSuffix
      ? Array(10)
          .fill(0)
          .map((_, index) => filename + index)
      : []
  )
  for (const name of possibleFileNames) {
    for (const ext of extensions) {
      const pathname = path.join(dir, `${name}.${ext}`)
      try {
        const resolved = await resolvePath(pathname)
        loaderContext.addDependency(resolved)

        collectedFiles.push(resolved)
      } catch (err: any) {
        if (!err.message.includes("Can't resolve")) {
          throw err
        }
        loaderContext.addMissingDependency(pathname)
      }
    }
  }

  return collectedFiles
}

export async function createStaticMetadataFromRoute(
  resolvedDir: string,
  {
    segment,
    resolvePath,
    isRootLayoutOrRootPage,
    loaderContext,
    pageExtensions,
    basePath,
  }: {
    segment: string
    resolvePath: (pathname: string) => Promise<string>
    isRootLayoutOrRootPage: boolean
    loaderContext: webpack.LoaderContext<any>
    pageExtensions: string[]
    basePath: string
  }
) {
  let hasStaticMetadataFiles = false
  const staticImagesMetadata: CollectingMetadata = {
    icon: [],
    apple: [],
    twitter: [],
    openGraph: [],
    manifest: undefined,
  }

  const opts = {
    resolvePath,
    loaderContext,
  }

  async function collectIconModuleIfExists(
    type: PossibleStaticMetadataFileNameConvention
  ) {
    if (type === 'manifest') {
      const staticManifestExtension = ['webmanifest', 'json']
      const manifestFile = await enumMetadataFiles(
        resolvedDir,
        'manifest',
        staticManifestExtension.concat(pageExtensions),
        { ...opts, numericSuffix: false }
      )
      if (manifestFile.length > 0) {
        hasStaticMetadataFiles = true
        const { name, ext } = path.parse(manifestFile[0])
        const extension = staticManifestExtension.includes(ext.slice(1))
          ? ext.slice(1)
          : 'webmanifest'
        staticImagesMetadata.manifest = JSON.stringify(`/${name}.${extension}`)
      }
      return
    }

    const resolvedMetadataFiles = await enumMetadataFiles(
      resolvedDir,
      STATIC_METADATA_IMAGES[type].filename,
      [
        ...STATIC_METADATA_IMAGES[type].extensions,
        ...(type === 'favicon' ? [] : pageExtensions),
      ],
      { ...opts, numericSuffix: true }
    )
    resolvedMetadataFiles
      .sort((a, b) => a.localeCompare(b))
      .forEach((filepath) => {
        const imageModuleImportSource = `next-metadata-image-loader?${stringify(
          {
            type,
            segment,
            basePath,
            pageExtensions,
          }
        )}!${filepath}${METADATA_RESOURCE_QUERY}`

        const imageModule = `(async (props) => (await import(/* webpackMode: "eager" */ ${JSON.stringify(
          imageModuleImportSource
        )})).default(props))`
        hasStaticMetadataFiles = true
        if (type === 'favicon') {
          staticImagesMetadata.icon.unshift(imageModule)
        } else {
          staticImagesMetadata[type].push(imageModule)
        }
      })
  }

  await Promise.all([
    collectIconModuleIfExists('icon'),
    collectIconModuleIfExists('apple'),
    collectIconModuleIfExists('openGraph'),
    collectIconModuleIfExists('twitter'),
    isRootLayoutOrRootPage && collectIconModuleIfExists('favicon'),
    isRootLayoutOrRootPage && collectIconModuleIfExists('manifest'),
  ])

  return hasStaticMetadataFiles ? staticImagesMetadata : null
}

export function createMetadataExportsCode(
  metadata: Awaited<ReturnType<typeof createStaticMetadataFromRoute>>
) {
  return metadata
    ? `${METADATA_TYPE}: {
    icon: [${metadata.icon.join(',')}],
    apple: [${metadata.apple.join(',')}],
    openGraph: [${metadata.openGraph.join(',')}],
    twitter: [${metadata.twitter.join(',')}],
    manifest: ${metadata.manifest ? metadata.manifest : 'undefined'}
  }`
    : ''
}
