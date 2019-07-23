const url = require('url');
const querystring = require('querystring');
const htmlParse = require('node-html-parser');

addEventListener('fetch', event => {
    event.respondWith(handle(event))
})

const fallbackIcon = "/public/images/hl3confirmed.jpg";

function getThemeColour(dom) {
    const tags = dom.querySelectorAll("meta")
    if (tags.length === 0) {
        return null
    }

    const themeColours = tags.filter(i => {        
        const name = i.attributes.name
        if (!name) return false
        return name === 'theme-color'
    })
        .map(i => i.attributes.content);

    return themeColours[0]
}


function getRelIcon(dom, relType) {
    const links = dom.querySelectorAll("link")
    if (links.length === 0) {
        return null
    }

    const icons = links.filter(i => {
        let rel = i.attributes.rel
        if (!rel) return false
        return rel === relType
    })
        .map(i => i.attributes.href);

    return icons[0]
}

function getSortedRelIcon(dom, relType) {
    const links = dom.querySelectorAll("link")
    if (links.length === 0) {
        return null
    }

    const icons = links.filter(i => {
        let rel = i.attributes.rel
        if (!rel) return false
        return rel === relType
    })
        .sort((a, b) => {
            const aSizeStr = a.attributes.sizes || '0x0';
            const bSizeStr = b.attributes.sizes || '0x0';
            const aSize = +aSizeStr.substring(0, aSizeStr.indexOf('x'))
            const bSize = +bSizeStr.substring(0, bSizeStr.indexOf('x'))
            return bSize - aSize
        })
        .map(i => i.attributes.href);

    return icons[0]
}

function getAppleTouchIcon(dom) {
    return getRelIcon(dom, 'apple-touch-icon')
}

function getShortcuthIcon(dom) {
    return getRelIcon(dom, 'shortcut icon')
}

function getStandardIcon(dom) {
    return getSortedRelIcon(dom, 'icon')
}

function getAPIPIcon(dom) {
    return getSortedRelIcon(dom, 'apple-touch-icon-precomposed')
}

async function getContent(target) {
    const response = await fetch(target)
    if (response.status === 500) {
        return { success: false, error: `badStatus${response.status}` };
    }

    const body = await response.text();

    return { success: true, dom: htmlParse.parse(body) }
}

function getIcon(dom) {
    let icon = getAppleTouchIcon(dom) ||
        getShortcuthIcon(dom) ||
        getAPIPIcon(dom) ||
        getStandardIcon(dom)

    if (!icon) {
        icon = fallbackIcon + "?none"
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

async function handle(event) {
    const referrer = new URL(event.request.headers.get('origin'))
    if (validSources.filter(i => i === referrer.hostname) === undefined) {
        return new Response('invalid client', { status: 401 })
    }

    const cache = caches.default
    let response = await cache.match(event.request)

    if (!response) {
        response = await main(event.request)

        if (referrer.hostname !== 'localhost') {
            event.waitUntil(cache.put(event.request, response.clone()))
        }
    }

    return response
};

function manualOverrides(hostname) {
    const icons = [
        {
            domain: "www.bizcommunity.com",
            icon: "https://biz-file.com/res/img/logo.gif"
        },
        {
            domain: "it-online.co.za",
            icon: "https://it-online.co.za/wp-content/uploads/2017/12/IT-Online-Logo.png"
        },
        {
            domain: "www.itweb.co.za",
            icon: "https://www.itweb.co.za/static/assets/favicon-96x96.png"
        }
    ]

    return icons.filter(i => i.domain === hostname).map(i => i.icon)[0]
}

async function main(request) {
    try {
        const requestedUrl = new URL(request.url);
        const target = requestedUrl.searchParams.get('target');
        const getResult = await getContent(target)
        let icon = ""
        let theme = undefined
        if (!getResult.success) {
            icon = `${fallbackIcon}?${getResult.error}`
        } else {
            icon = manualOverrides(new URL(target).hostname) ||
                getIcon(getResult.dom)

            theme = getThemeColour(getResult.dom)
        }

        const oneYear = new Date();
        oneYear.setFullYear(oneYear.getFullYear() + 1);

        const result = new Response(`{
            "icon":"${icon}",
            "theme":"${theme}"
        }`, { status: 200 })
        result.headers.append("x-Expires", oneYear.toUTCString())
        result.headers.append("Access-Control-Allow-Origin", request.headers.get('origin'))
        result.headers.append("Vary", "Origin")
        return result
    } catch (e) {
        return new Response(e, { status: 500 });
    }
} 