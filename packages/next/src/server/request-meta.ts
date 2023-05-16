/* eslint-disable no-redeclare */
import type { IncomingMessage } from 'http'
import type { ParsedUrlQuery } from 'querystring'
import type { UrlWithParsedQuery } from 'url'
import type { BaseNextRequest } from './base-http'
import type { CloneableBody } from './body-streams'
import { RouteMatch } from './future/route-matches/route-match'

// FIXME: (wyattjoh) this is a temporary solution to allow us to pass data between bundled modules
export const NEXT_REQUEST_META = Symbol.for('NextInternalRequestMeta')

export type NextIncomingMessage = (BaseNextRequest | IncomingMessage) & {
  [NEXT_REQUEST_META]?: RequestMeta
}

export interface RequestMeta {
  __NEXT_INIT_QUERY?: ParsedUrlQuery
  __NEXT_INIT_URL?: string
  __NEXT_CLONABLE_BODY?: CloneableBody
  __nextHadTrailingSlash?: boolean

  /**
   * True when the request matched a locale domain that was configured in the
   * next.config.js file.
   */
  __nextIsLocaleDomain?: boolean

  /**
   * True when the request had locale information stripped from the pathname
   * part of the URL.
   */
  __nextStrippedLocale?: boolean
  _nextDidRewrite?: boolean
  _nextHadBasePath?: boolean
  _nextRewroteUrl?: string
  _nextMiddlewareCookie?: string[]
  _protocol?: string
  _nextDataNormalizing?: boolean
  _nextMatch?: RouteMatch
  _nextIncrementalCache?: any
  _nextMinimalMode?: boolean
}

export function getRequestMeta(
  req: NextIncomingMessage,
  key?: undefined
): RequestMeta
export function getRequestMeta<K extends keyof RequestMeta>(
  req: NextIncomingMessage,
  key: K
): RequestMeta[K]
export function getRequestMeta<K extends keyof RequestMeta>(
  req: NextIncomingMessage,
  key?: K
): RequestMeta | RequestMeta[K] {
  const meta = req[NEXT_REQUEST_META] || {}
  return typeof key === 'string' ? meta[key] : meta
}

export function setRequestMeta(req: NextIncomingMessage, meta: RequestMeta) {
  req[NEXT_REQUEST_META] = meta
  return getRequestMeta(req)
}

export function addRequestMeta<K extends keyof RequestMeta>(
  request: NextIncomingMessage,
  key: K,
  value: RequestMeta[K]
) {
  const meta = getRequestMeta(request)
  meta[key] = value
  return setRequestMeta(request, meta)
}

type NextQueryMetadata = {
  __nextNotFoundSrcPage?: string
  __nextDefaultLocale?: string
  __nextFallback?: 'true'

  /**
   * The locale that was inferred or explicitly set for the request.
   *
   * When this property is mutated, it's important to also update the request
   * metadata for `_nextInferredDefaultLocale` to ensure that the correct
   * behavior is applied.
   */
  __nextLocale?: string

  /**
   * `1` when the request did not have a locale in the pathname part of the
   * URL but the default locale was inferred from either the domain or the
   * configuration.
   */
  __nextInferredLocaleFromDefault?: '1'

  __nextSsgPath?: string
  _nextBubbleNoFallback?: '1'
  __nextDataReq?: '1'
  __nextCustomErrorRender?: '1'
}

export type NextParsedUrlQuery = ParsedUrlQuery &
  NextQueryMetadata & {
    amp?: '1'
  }

export interface NextUrlWithParsedQuery extends UrlWithParsedQuery {
  query: NextParsedUrlQuery
}

export function getNextInternalQuery(
  query: NextParsedUrlQuery
): NextQueryMetadata {
  const keysToInclude: (keyof NextQueryMetadata)[] = [
    '__nextDefaultLocale',
    '__nextFallback',
    '__nextLocale',
    '__nextSsgPath',
    '_nextBubbleNoFallback',
    '__nextDataReq',
    '__nextInferredLocaleFromDefault',
  ]
  const nextInternalQuery: NextQueryMetadata = {}

  for (const key of keysToInclude) {
    if (key in query) {
      // @ts-ignore this can't be typed correctly
      nextInternalQuery[key] = query[key]
    }
  }

  return nextInternalQuery
}
