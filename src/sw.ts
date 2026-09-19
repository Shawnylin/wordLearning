/// <reference lib="webworker" />

import { addPlugins, cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string | null }>
}

function withoutDownloadHeader(response: Response | null | undefined) {
  if (!response || !response.headers.has('content-disposition')) return response

  const headers = new Headers(response.headers)
  headers.delete('content-disposition')
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText
  })
}

// CloudBase's default *.tcloudbaseapp.com domain adds Content-Disposition:
// attachment to non-navigation responses. Keep that gateway header out of the
// cached app shell and the navigation response used during PWA updates.
const cloudBaseResponsePlugin = {
  cacheWillUpdate: async ({ response }: { response: Response }) => withoutDownloadHeader(response),
  cachedResponseWillBeUsed: async ({ cachedResponse }: { cachedResponse?: Response | null }) => withoutDownloadHeader(cachedResponse),
  handlerWillRespond: async ({ response }: { response: Response }) => withoutDownloadHeader(response) as Response
}

addPlugins([cloudBaseResponsePlugin])
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
