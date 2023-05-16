import { EdgeRouteModuleWrapper } from 'next/dist/server/web/edge-route-module-wrapper'

import RouteModule from 'ROUTE_MODULE'
import * as userland from 'ENTRY'
import { PAGE, PATHNAME } from 'BOOTSTRAP_CONFIG'

// TODO: (wyattjoh) - perform the option construction in Rust to allow other modules to accept different options
const routeModule = new RouteModule({
  userland,
  pathname: PATHNAME,
  resolvedPagePath: `app/${PAGE}`,
  nextConfigOutput: undefined,
})

// @ts-expect-error - exposed for edge support
globalThis._ENTRIES = {
  middleware_edge: {
    default: EdgeRouteModuleWrapper.wrap(routeModule, { page: `/${PAGE}` }),
  },
}
