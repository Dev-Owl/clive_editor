/* ================================================================== */
/*  CliveEdit — Vue Plugin for global registration                     */
/*                                                                     */
/*  Usage:                                                             */
/*    import { CliveEditPlugin } from '@cliveedit/editor'              */
/*    app.use(CliveEditPlugin)                                         */
/*                                                                     */
/*  Then use <CliveEdit v-model="md" /> anywhere without importing.    */
/* ================================================================== */

import type { App } from 'vue'
import CliveEdit from './components/CliveEdit.vue'
import MarkdownViewer from './components/MarkdownViewer.vue'

export const CliveEditPlugin = {
  install(app: App): void {
    app.component('CliveEdit', CliveEdit)
    app.component('MarkdownViewer', MarkdownViewer)
  },
}
