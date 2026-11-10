import type { ExportStyles } from '@southneuhof/spool'

export const defaultExportStyles: ExportStyles = {
  mode: 'isolated',
  css: `
:root{color-scheme:light}
body{background:white;color:black;font:12px Arial,sans-serif}
.loom-export-document,.loom-export-document *{background:transparent!important;color:black!important;box-shadow:none!important}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #999!important;padding:4px 6px;vertical-align:top;text-align:start}
th{font-weight:bold}
caption{text-align:start;font-weight:bold;margin-bottom:8px}
`,
}
