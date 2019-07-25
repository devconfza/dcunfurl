import { parse as htmlParse, HTMLElement } from 'node-html-parser'

interface IContentResult {
    success: boolean,
    dom?: HTMLElement,
    error?: string
}

export class pageContent {
    public async get(target: string): Promise<IContentResult> {
        const response = await fetch(target)
        if (response.status === 500) {
            return { success: false, error: `badStatus${response.status}` }
        }

        const body = await response.text()

        return { success: true, dom: htmlParse(body) as HTMLElement }
    }
}

