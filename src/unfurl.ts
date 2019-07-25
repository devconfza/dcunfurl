import { HTMLElement } from 'node-html-parser';
import { constants } from './constants';
import { pageContent } from './pageContent';

export class Unfurl {
    private getThemeColour(dom: HTMLElement): string {
        const tags = dom.querySelectorAll('meta');
        if (tags.length === 0) {
            return null;
        }

        const themeColours = tags
            .filter(i => {
                const name = i.attributes.name
                if (!name) return false
                return name === 'theme-color'
            })
            .map(i => i.attributes.content);

        return themeColours[0];
    }

    private getRelIcon(dom: HTMLElement, relType: string): string {
        const links = dom.querySelectorAll('link');
        if (links.length === 0) {
            return null;
        }

        const icons = links
            .filter(i => {
                let rel = i.attributes.rel
                if (!rel) return false
                return rel === relType
            })
            .map(i => i.attributes.href);

        return icons[0];
    }

    private getSortedRelIcon(dom: HTMLElement, relType: string): string {
        const links = dom.querySelectorAll('link');
        if (links.length === 0) {
            return null;
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
            .map(i => i.attributes.href);

        return icons[0];
    }

    private getAppleTouchIcon(dom: HTMLElement): string {
        return this.getRelIcon(dom, 'apple-touch-icon');
    }

    private getShortcuthIcon(dom: HTMLElement): string {
        return this.getRelIcon(dom, 'shortcut icon');
    }

    private getStandardIcon(dom: HTMLElement): string {
        return this.getSortedRelIcon(dom, 'icon');
    }

    private getAPIPIcon(dom: HTMLElement): string {
        return this.getSortedRelIcon(dom, 'apple-touch-icon-precomposed');
    }

    private getIcon(dom: HTMLElement, target: string): string {
        let icon =
            this.getAppleTouchIcon(dom) ||
            this.getShortcuthIcon(dom) ||
            this.getAPIPIcon(dom) ||
            this.getStandardIcon(dom);

        if (!icon) {
            icon = `${constants.fallbackIcon}?none`;
        } else {
            const iconUrl = new URL(icon);
            if (!iconUrl.hostname) {
                const targetUrl = new URL(target);
                icon = `${targetUrl.protocol}//${targetUrl.host}${icon}`;
            }
        }

        return icon;
    }


    private manualOverrides(hostname: string): string {
        return constants.overrideIcons.filter(i => i.domain === hostname).map(i => i.icon)[0];
    }

    public async main(request: Request): Promise<Response> {
        try {
            const requestedUrl = new URL(request.url);
            const target = requestedUrl.searchParams.get('target');
            const getResult = await new pageContent().get(target);
            let icon = '';
            let theme = null;
            if (!getResult.success) {
                icon = `${constants.fallbackIcon}?${getResult.error}`
            } else {
                icon =
                    this.manualOverrides(new URL(target).hostname) ||
                    this.getIcon(getResult.dom, target);

                theme = this.getThemeColour(getResult.dom);
            }

            icon = icon.substring(icon.indexOf(':') + 1);
            const oneYear = new Date();
            oneYear.setFullYear(oneYear.getFullYear() + 1)

            const result = new Response(JSON.stringify(
                {
                    icon, theme
                }
            ), { status: 200 });
            result.headers.append('Expires', oneYear.toUTCString());
            result.headers.append(
                'Access-Control-Allow-Origin',
                request.headers.get('origin')
            );
            result.headers.append('Vary', 'Origin');
            return result;
        } catch (e) {
            return new Response(e, { status: 500 });
        }
    }
}