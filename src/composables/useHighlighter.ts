/* ================================================================== */
/*  useHighlighter — Vue composable for Shiki syntax highlighting      */
/*                                                                     */
/*  Wraps the highlighter utilities in a reactive Vue composable       */
/*  and provides the highlight function via provide/inject.            */
/* ================================================================== */

import { ref, computed, provide, inject, type Ref, type InjectionKey } from 'vue'
import {
    initHighlighter,
    highlightCode,
    isHighlighterReady,
    type HighlightOptions,
} from '@/utils/highlighter'

/* ---- Injection key ---- */

export type HighlightFn = (code: string, lang: string) => string

export const HIGHLIGHT_KEY: InjectionKey<Ref<HighlightFn | null>> = Symbol('cliveedit-highlight')

/* ---- Composable ---- */

export function useHighlighter() {
    const isReady = ref(isHighlighterReady())
    const enabled = ref(false)
    const darkMode = ref(false)

    /** Reactive highlight function: null when disabled or not ready */
    const highlightFn = computed<HighlightFn | null>(() => {
        if (!isReady.value || !enabled.value) return null
        // Capture darkMode.value in the closure so the computed re-evaluates
        const isDark = darkMode.value
        return (code: string, lang: string) => highlightCode(code, lang, isDark)
    })

    /**
     * Initialise Shiki with the given options.
     * Safe to call multiple times — subsequent calls are no-ops if already ready.
     */
    async function init(options?: HighlightOptions): Promise<boolean> {
        if (isReady.value) {
            enabled.value = true
            return true
        }

        const ok = await initHighlighter(options)
        if (ok) {
            isReady.value = true
            enabled.value = true
        }
        return ok
    }

    /**
     * Enable / disable highlighting without destroying the Shiki instance.
     */
    function setEnabled(value: boolean): void {
        enabled.value = value
    }

    /**
     * Switch between light and dark themes.
     */
    function setDarkMode(value: boolean): void {
        darkMode.value = value
    }

    /**
     * The highlight function.  Returns `''` when Shiki is not ready or disabled,
     * which lets callers fall back to plain rendering.
     */
    function highlight(code: string, lang: string): string {
        if (!isReady.value || !enabled.value) return ''
        return highlightCode(code, lang, darkMode.value)
    }

    /** Provide the highlight function to child components */
    function provideHighlight(): void {
        provide(HIGHLIGHT_KEY, highlightFn)
    }

    return {
        /** Whether Shiki has been initialised */
        isReady,
        /** Whether highlighting is currently enabled */
        enabled,
        /** Whether to use the dark theme */
        darkMode,
        /** The reactive highlight function ref (null when not ready/disabled) */
        highlightFn,
        /** Initialise Shiki */
        init,
        /** Enable or disable highlighting */
        setEnabled,
        /** Switch between light/dark themes */
        setDarkMode,
        /** Highlight code (safe before init — returns '') */
        highlight,
        /** Call in setup() to provide the highlight fn to descendants */
        provideHighlight,
    }
}

/**
 * Inject the highlight function provided by a parent `useHighlighter().provideHighlight()`.
 * Returns a ref that is `null` when no provider exists or Shiki isn't ready yet.
 */
export function useInjectHighlight(): Ref<HighlightFn | null> {
    return inject(HIGHLIGHT_KEY, ref(null))
}
