import typesForCloudflare from 'types-cloudflare-worker';
import { constants } from './constants';
import { Unfurl } from './unfurl';

addEventListener('fetch', event => {
    (<any>event).respondWith(handle(event))
})

interface ISourceSettings {
    valid: Boolean,
    cache: Boolean,
}

function getSourceSettings(request: Request): ISourceSettings {
    const origin = request.headers.get('origin');
    if (!origin) return { valid: false, cache: false };

    const referrer = new URL(origin);
    if (constants.corsDomains.filter(i => i === referrer.hostname) === undefined) {
        return { valid: false, cache: false }
    }

    return { valid: true, cache: referrer.hostname !== 'localhost' };
}

async function handle(event: any): Promise<Response> {
    const sourceSettings = getSourceSettings(event.request);
    if (!sourceSettings.valid) {
        return new Response('invalid client', { status: 401 })
    }

    const cache = caches.default;
    let response = await cache.match(event.request);

    if (!response) {
        response = await new Unfurl().main(event.request);

        if (sourceSettings.cache) {
            event.waitUntil(cache.put(event.request, response.clone()));
        }
    }

    return response;
}

