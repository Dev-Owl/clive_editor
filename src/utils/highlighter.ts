/* ================================================================== */
/*  highlighter.ts — optional Shiki-based syntax highlighting          */
/*                                                                     */
/*  Shiki is an optional peer dependency.  When installed, call        */
/*  `initHighlighter()` once at startup (async) — after that the      */
/*  `highlightCode()` function works synchronously.                    */
/* ================================================================== */

export interface HighlightOptions {
    /** Shiki theme name for light mode (default: 'github-light') */
    theme?: string
    /** Shiki theme name for dark mode (default: 'github-dark') */
    darkTheme?: string
    /** Languages to pre-load (default: common web langs) */
    langs?: string[]
    /** When true, uses the dark theme for syntax highlighting */
    darkMode?: boolean
}

const DEFAULT_THEME = 'github-light'
const DEFAULT_DARK_THEME = 'github-dark'

const DEFAULT_LANGS = [
    'javascript', 'typescript', 'html', 'css', 'json',
    'python', 'bash', 'shell', 'markdown', 'vue', 'jsx', 'tsx',
    'csharp',
]

/* ---- Module-level highlighter instance ---- */

// We store the highlighter as `any` to avoid requiring Shiki types at
// compile time (it's an optional peer dep).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let highlighter: any = null
let loadedTheme: string = DEFAULT_THEME
let loadedDarkTheme: string = DEFAULT_DARK_THEME

/**
 * Initialise the Shiki highlighter.
 *
 * This must be called **once** before highlighted output is expected.
 * It dynamically imports `shiki` so the library is only loaded when
 * the consumer has it installed.
 *
 * @returns `true` if Shiki was loaded successfully, `false` if not
 *          installed or an error occurred.
 */
export async function initHighlighter(
    options?: HighlightOptions,
): Promise<boolean> {
    try {
        // Dynamic import — tree-shaken away when Shiki isn't installed
        const shiki = await import('shiki')
        const theme = options?.theme ?? DEFAULT_THEME
        const darkTheme = options?.darkTheme ?? DEFAULT_DARK_THEME
        const langs = options?.langs ?? DEFAULT_LANGS

        // Load both light and dark themes
        const themes = [theme]
        if (darkTheme !== theme) themes.push(darkTheme)

        highlighter = await shiki.createHighlighter({ themes, langs })
        loadedTheme = theme
        loadedDarkTheme = darkTheme
        return true
    } catch {
        // Shiki not installed or failed to load — degrade gracefully
        highlighter = null
        return false
    }
}

/**
 * Highlight a code string.
 *
 * If Shiki is initialised, returns fully highlighted HTML (a `<pre><code>…`
 * block with inline styles).  Otherwise returns `''` so the caller can
 * fall back to the default renderer.
 *
 * @param code     Raw code string
 * @param lang     Language identifier (e.g. `'javascript'`)
 * @param darkMode If `true`, uses the dark theme
 * @returns        Highlighted HTML string, or `''` if Shiki unavailable
 */
export function highlightCode(code: string, lang: string, darkMode = false): string {
    if (!highlighter) return ''

    try {
        const theme = darkMode ? loadedDarkTheme : loadedTheme
        // Shiki's codeToHtml is synchronous once the highlighter is created
        return highlighter.codeToHtml(code, {
            lang,
            theme,
        })
    } catch {
        // Unknown language or other error — let the caller use plain rendering
        return ''
    }
}

/**
 * Check whether the highlighter has been initialised.
 */
export function isHighlighterReady(): boolean {
    return highlighter !== null
}

/**
 * Get the raw Shiki highlighter instance for advanced use.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getHighlighterInstance(): any {
    return highlighter
}
