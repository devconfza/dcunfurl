import typesForCloudflare from 'types-cloudflare-worker'
import {constants} from './constants'
import {parse as htmlParse, HTMLElement} from 'node-html-parser'

addEventListener('fetch', event => {
    (<any>event).respondWith(handle(event))
})

function getThemeColour(dom: HTMLElement): string {
    const tags = dom.querySelectorAll('meta')
    if (tags.length === 0) {
        return null
    }

    const themeColours = tags
        .filter(i => {
            const name = i.attributes.name
            if (!name) return false
            return name === 'theme-color'
        })
        .map(i => i.attributes.content)

    return themeColours[0]
}

function getRelIcon(dom: HTMLElement, relType: string): string {
    const links = dom.querySelectorAll('link')
    if (links.length === 0) {
        return null
    }

    const icons = links
        .filter(i => {
            let rel = i.attributes.rel
            if (!rel) return false
            return rel === relType
        })
        .map(i => i.attributes.href)

    return icons[0]
}

function getSortedRelIcon(dom: HTMLElement, relType: string): string {
    const links = dom.querySelectorAll('link')
    if (links.length === 0) {
        return null
    }

    const icons = links
        .filter(i => {
            let rel = i.attributes.rel
            if (!rel) return false
            return rel === relType
        })
        .sort((a, b) => {
            const aSizeStr = a.attributes.sizes || '0x0'
            const bSizeStr = b.attributes.sizes || '0x0'
            const aSize = +aSizeStr.substring(0, aSizeStr.indexOf('x'))
            const bSize = +bSizeStr.substring(0, bSizeStr.indexOf('x'))
            return bSize - aSize
        })
        .map(i => i.attributes.href)

    return icons[0]
}

function getAppleTouchIcon(dom: HTMLElement): string {
    return getRelIcon(dom, 'apple-touch-icon')
}

function getShortcuthIcon(dom: HTMLElement): string {
    return getRelIcon(dom, 'shortcut icon')
}

function getStandardIcon(dom: HTMLElement): string {
    return getSortedRelIcon(dom, 'icon')
}

function getAPIPIcon(dom: HTMLElement): string {
    return getSortedRelIcon(dom, 'apple-touch-icon-precomposed')
}

interface IContentResult {
    success: boolean,
    dom?: HTMLElement,
    error?: string
}

async function getContent(target: string): Promise<IContentResult> {
    const response = await fetch(target)
    if (response.status === 500) {
        return { success: false, error: `badStatus${response.status}` }
    }

    const body = await response.text()

    return { success: true, dom: htmlParse(body) as HTMLElement }
}

function getIcon(dom: HTMLElement, target: string): string {
    let icon =
        getAppleTouchIcon(dom) ||
        getShortcuthIcon(dom) ||
        getAPIPIcon(dom) ||
        getStandardIcon(dom)

    if (!icon) {
        icon = `${constants.fallbackIcon}?none`
    } else {
        const iconUrl = new URL(icon)
        if (!iconUrl.hostname) {
            const targetUrl = new URL(target)
            icon = `${targetUrl.protocol}//${targetUrl.host}${icon}`
        }
    }

    return icon
}

const validSources = ['localhost', 'devconf.co.za', 'www.devconf.co.za']

interface ISourceSettings {
    valid: Boolean,
    cache: Boolean,
}

function getSourceSettings(request: Request): ISourceSettings {
    const origin = request.headers.get('origin');
    if (!origin) return { valid: false, cache: false}; 

    const referrer = new URL(origin);
    if (validSources.filter(i => i === referrer.hostname) === undefined) {
        return { valid: false, cache: false}
    }

    return { valid: true, cache: referrer.hostname !== 'localhost'};
}

async function handle(event:any): Promise<Response> {
    const sourceSettings = getSourceSettings(event.request);
    if (!sourceSettings.valid) {
        return new Response('invalid client', { status: 401 })
    }

    const cache = caches.default;
    let response = await cache.match(event.request);

    if (!response) {
        response = await main(event.request);

        if (sourceSettings.cache) {
            event.waitUntil(cache.put(event.request, response.clone()));
        }
    }

    return response;
}

function manualOverrides(hostname: string): string {
    return constants.overrideIcons.filter(i => i.domain === hostname).map(i => i.icon)[0]
}

async function main(request: Request): Promise<Response> {
    try {
        const requestedUrl = new URL(request.url)
        const target = requestedUrl.searchParams.get('target')
        const getResult = await getContent(target)
        let icon = ''
        let theme = undefined
        if (!getResult.success) {
            icon = `${constants.fallbackIcon}?${getResult.error}`
        } else {
            icon =
                manualOverrides(new URL(target).hostname) ||
                getIcon(getResult.dom, target)

            theme = getThemeColour(getResult.dom)
        }

        const oneYear = new Date()
        oneYear.setFullYear(oneYear.getFullYear() + 1)

        const result = new Response(JSON.stringify(
            {
                icon, theme
            }
        ),{ status: 200 })
        result.headers.append('Expires', oneYear.toUTCString())
        result.headers.append(
            'Access-Control-Allow-Origin',
            request.headers.get('origin')
        )
        result.headers.append('Vary', 'Origin')
        return result
    } catch (e) {
        return new Response(e, { status: 500 })
    }
}
