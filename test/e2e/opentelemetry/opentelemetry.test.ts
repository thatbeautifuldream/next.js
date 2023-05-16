import { createNextDescribe } from 'e2e-utils'
import { check } from 'next-test-utils'

import { SavedSpan, traceFile } from './constants'

createNextDescribe(
  'opentelemetry',
  {
    files: __dirname,
    skipDeployment: true,
    dependencies: require('./package.json').dependencies,
  },
  ({ next, isNextDev }) => {
    const getTraces = async (): Promise<SavedSpan[]> => {
      const traces = await next.readFile(traceFile)
      return traces
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    }

    /**
     * Sanitize (modifies) span to make it ready for snapshot testing.
     */
    const sanitizeSpan = (span: SavedSpan) => {
      delete span.duration
      delete span.id
      delete span.links
      delete span.events
      delete span.timestamp
      delete span.traceId
      span.parentId = span.parentId === undefined ? undefined : '[parent-id]'
      return span
    }
    const sanitizeSpans = (spans: SavedSpan[]) => {
      return spans
        .sort((a, b) =>
          (a.attributes?.['next.span_name'] ?? '').localeCompare(
            b.attributes?.['next.span_name'] ?? ''
          )
        )
        .sort((a, b) =>
          (a.attributes?.['next.span_type'] ?? '').localeCompare(
            b.attributes?.['next.span_type'] ?? ''
          )
        )
        .map(sanitizeSpan)
    }

    const getSanitizedTraces = async (numberOfRootTraces: number) => {
      let traces
      await check(async () => {
        traces = sanitizeSpans(await getTraces())

        const rootSpans = traces.filter((span) => !span.parentId)
        return String(rootSpans.length)
      }, String(numberOfRootTraces))
      return traces
    }

    const cleanTraces = async () => {
      await next.patchFile(traceFile, '')
    }

    afterEach(async () => {
      await cleanTraces()
    })

    describe('app router', () => {
      it('should handle RSC with fetch', async () => {
        await next.fetch('/app/param/rsc-fetch')

        await check(async () => {
          expect(await getSanitizedTraces(1)).toMatchInlineSnapshot(`
          Array [
            Object {
              "attributes": Object {
                "http.method": "GET",
                "http.url": "https://vercel.com/",
                "net.peer.name": "vercel.com",
                "next.span_name": "fetch GET https://vercel.com/",
                "next.span_type": "AppRender.fetch",
              },
              "kind": 2,
              "name": "fetch GET https://vercel.com/",
              "parentId": "[parent-id]",
              "status": Object {
                "code": 0,
              },
            },
            Object {
              "attributes": Object {
                "next.route": "/app/[param]/rsc-fetch",
                "next.span_name": "render route (app) /app/[param]/rsc-fetch",
                "next.span_type": "AppRender.getBodyResult",
              },
              "kind": 0,
              "name": "render route (app) /app/[param]/rsc-fetch",
              "parentId": "[parent-id]",
              "status": Object {
                "code": 0,
              },
            },
            Object {
              "attributes": Object {
                "http.method": "GET",
                "http.route": "/app/[param]/rsc-fetch",
                "http.status_code": 200,
                "http.target": "/app/param/rsc-fetch",
                "next.route": "/app/[param]/rsc-fetch",
                "next.span_name": "GET /app/[param]/rsc-fetch",
                "next.span_type": "BaseServer.handleRequest",
              },
              "kind": 1,
              "name": "GET /app/[param]/rsc-fetch",
              "parentId": undefined,
              "status": Object {
                "code": 0,
              },
            },
            Object {
              "attributes": Object {
                "next.page": "/app/[param]/layout",
                "next.span_name": "generateMetadata /app/[param]/layout",
                "next.span_type": "ResolveMetadata.generateMetadata",
              },
              "kind": 0,
              "name": "generateMetadata /app/[param]/layout",
              "parentId": "[parent-id]",
              "status": Object {
                "code": 0,
              },
            },
            Object {
              "attributes": Object {
                "next.page": "/app/[param]/rsc-fetch/page",
                "next.span_name": "generateMetadata /app/[param]/rsc-fetch/page",
                "next.span_type": "ResolveMetadata.generateMetadata",
              },
              "kind": 0,
              "name": "generateMetadata /app/[param]/rsc-fetch/page",
              "parentId": "[parent-id]",
              "status": Object {
                "code": 0,
              },
            },
          ]
        `)
          return 'success'
        }, 'success')
      })

      it('should handle route handlers in app router', async () => {
        await next.fetch('/api/app/param/data')

        await check(async () => {
          expect(await getSanitizedTraces(1)).toMatchInlineSnapshot(`
          Array [
            Object {
              "attributes": Object {
                "next.route": "/api/app/[param]/data/route",
                "next.span_name": "executing api route (app) /api/app/[param]/data/route",
                "next.span_type": "AppRouteRouteHandlers.runHandler",
              },
              "kind": 0,
              "name": "executing api route (app) /api/app/[param]/data/route",
              "parentId": "[parent-id]",
              "status": Object {
                "code": 0,
              },
            },
            Object {
              "attributes": Object {
                "http.method": "GET",
                "http.status_code": 200,
                "http.target": "/api/app/param/data",
                "next.span_name": "GET /api/app/param/data",
                "next.span_type": "BaseServer.handleRequest",
              },
              "kind": 1,
              "name": "GET /api/app/param/data",
              "parentId": undefined,
              "status": Object {
                "code": 0,
              },
            },
          ]
        `)
          return 'success'
        }, 'success')
      })
    })

    describe('pages', () => {
      it('should handle getServerSideProps', async () => {
        await next.fetch('/pages/param/getServerSideProps')

        await check(async () => {
          expect(await getSanitizedTraces(1)).toMatchInlineSnapshot(`
          Array [
            Object {
              "attributes": Object {
                "http.method": "GET",
                "http.route": "/pages/[param]/getServerSideProps",
                "http.status_code": 200,
                "http.target": "/pages/param/getServerSideProps",
                "next.route": "/pages/[param]/getServerSideProps",
                "next.span_name": "GET /pages/[param]/getServerSideProps",
                "next.span_type": "BaseServer.handleRequest",
              },
              "kind": 1,
              "name": "GET /pages/[param]/getServerSideProps",
              "parentId": undefined,
              "status": Object {
                "code": 0,
              },
            },
            Object {
              "attributes": Object {
                "next.route": "/pages/[param]/getServerSideProps",
                "next.span_name": "getServerSideProps /pages/[param]/getServerSideProps",
                "next.span_type": "Render.getServerSideProps",
              },
              "kind": 0,
              "name": "getServerSideProps /pages/[param]/getServerSideProps",
              "parentId": "[parent-id]",
              "status": Object {
                "code": 0,
              },
            },
            Object {
              "attributes": Object {
                "next.route": "/pages/[param]/getServerSideProps",
                "next.span_name": "render route (pages) /pages/[param]/getServerSideProps",
                "next.span_type": "Render.renderDocument",
              },
              "kind": 0,
              "name": "render route (pages) /pages/[param]/getServerSideProps",
              "parentId": "[parent-id]",
              "status": Object {
                "code": 0,
              },
            },
          ]
        `)
          return 'success'
        }, 'success')
      })

      it("should handle getStaticProps when fallback: 'blocking'", async () => {
        await next.fetch('/pages/param/getStaticProps')

        await check(async () => {
          expect(await getSanitizedTraces(1)).toMatchInlineSnapshot(`
          Array [
            Object {
              "attributes": Object {
                "http.method": "GET",
                "http.route": "/pages/[param]/getStaticProps",
                "http.status_code": 200,
                "http.target": "/pages/param/getStaticProps",
                "next.route": "/pages/[param]/getStaticProps",
                "next.span_name": "GET /pages/[param]/getStaticProps",
                "next.span_type": "BaseServer.handleRequest",
              },
              "kind": 1,
              "name": "GET /pages/[param]/getStaticProps",
              "parentId": undefined,
              "status": Object {
                "code": 0,
              },
            },
            Object {
              "attributes": Object {
                "next.route": "/pages/[param]/getStaticProps",
                "next.span_name": "getStaticProps /pages/[param]/getStaticProps",
                "next.span_type": "Render.getStaticProps",
              },
              "kind": 0,
              "name": "getStaticProps /pages/[param]/getStaticProps",
              "parentId": "[parent-id]",
              "status": Object {
                "code": 0,
              },
            },
            Object {
              "attributes": Object {
                "next.route": "/pages/[param]/getStaticProps",
                "next.span_name": "render route (pages) /pages/[param]/getStaticProps",
                "next.span_type": "Render.renderDocument",
              },
              "kind": 0,
              "name": "render route (pages) /pages/[param]/getStaticProps",
              "parentId": "[parent-id]",
              "status": Object {
                "code": 0,
              },
            },
          ]
        `)
          return 'success'
        }, 'success')
      })

      it('should handle api routes in pages', async () => {
        await next.fetch('/api/pages/param/basic')

        await check(async () => {
          expect(await getSanitizedTraces(1)).toMatchInlineSnapshot(`
          Array [
            Object {
              "attributes": Object {
                "http.method": "GET",
                "http.route": "/api/pages/[param]/basic",
                "http.status_code": 200,
                "http.target": "/api/pages/param/basic",
                "next.route": "/api/pages/[param]/basic",
                "next.span_name": "GET /api/pages/[param]/basic",
                "next.span_type": "BaseServer.handleRequest",
              },
              "kind": 1,
              "name": "GET /api/pages/[param]/basic",
              "parentId": undefined,
              "status": Object {
                "code": 0,
              },
            },
            Object {
              "attributes": Object {
                "next.span_name": "executing api route (pages) /api/pages/[param]/basic",
                "next.span_type": "Node.runHandler",
              },
              "kind": 0,
              "name": "executing api route (pages) /api/pages/[param]/basic",
              "parentId": "[parent-id]",
              "status": Object {
                "code": 0,
              },
            },
          ]
        `)
          return 'success'
        }, 'success')
      })
    })
  }
)
