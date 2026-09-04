export function parseFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null

  const filenameStarMatch = header.match(/filename\*\=UTF-8''([^;]+)/)
  if (filenameStarMatch?.[1]) {
    return decodeURIComponent(filenameStarMatch[1])
  }

  const filenameMatch = header.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
  if (filenameMatch?.[1]) {
    return filenameMatch[1].replace(/['"]/g, '')
  }

  return null
}

export async function downloadBlob(response: Response, fallbackFilename: string): Promise<void> {
  const contentDisposition = response.headers.get('Content-Disposition')
  const parsedFilename = parseFilenameFromContentDisposition(contentDisposition)
  const finalFilename = parsedFilename || fallbackFilename

  const blob = await response.blob()
  const link = document.createElement('a')
  link.target = '_parent'
  link.href = window.URL.createObjectURL(blob)
  link.download = finalFilename
  link.click()
  URL.revokeObjectURL(link.href)
}
