const IMAGE_WIDTH_METADATA_PREFIX = 'ce-width:'

export const IMAGE_SIZE_PRESETS = ['25%', '50%', '75%', '100%'] as const

export function normalizeImageWidth(value: string | null | undefined): string | null {
  if (!value) return null

  const trimmed = value.trim()
  const match = trimmed.match(/^(\d+(?:\.\d+)?)%?$/)
  if (!match) return null

  const numeric = Number.parseFloat(match[1])
  if (!Number.isFinite(numeric) || numeric <= 0) return null

  const clamped = Math.min(100, numeric)
  const normalized = Number.isInteger(clamped)
    ? String(clamped)
    : clamped.toFixed(2).replace(/\.?0+$/, '')

  return `${normalized}%`
}

export function applyImageWidth(img: HTMLImageElement, width: string | null | undefined): string | null {
  const normalized = normalizeImageWidth(width)

  img.style.height = 'auto'
  img.removeAttribute('height')

  if (!normalized) {
    img.removeAttribute('data-ce-width')
    img.style.removeProperty('width')
    return null
  }

  img.setAttribute('data-ce-width', normalized)
  img.style.width = normalized
  img.removeAttribute('width')
  return normalized
}

export function getImageWidth(img: HTMLImageElement): string | null {
  return normalizeImageWidth(
    img.getAttribute('data-ce-width')
    ?? img.style.width
    ?? undefined,
  )
}

export function createImageMarkdownTitle(
  width: string | null | undefined,
  existingTitle?: string | null,
): string | null {
  const normalized = normalizeImageWidth(width)
  const title = existingTitle?.trim() ?? ''

  if (!normalized) return title || null
  return `${IMAGE_WIDTH_METADATA_PREFIX}${normalized}${title ? `|${title}` : ''}`
}

export function parseImageMarkdownTitle(title: string | null | undefined): { width: string | null, title: string | null } {
  const raw = title?.trim()
  if (!raw?.startsWith(IMAGE_WIDTH_METADATA_PREFIX)) {
    return { width: null, title: raw || null }
  }

  const payload = raw.slice(IMAGE_WIDTH_METADATA_PREFIX.length)
  const separatorIndex = payload.indexOf('|')
  const widthValue = separatorIndex >= 0 ? payload.slice(0, separatorIndex) : payload
  const remainingTitle = separatorIndex >= 0 ? payload.slice(separatorIndex + 1).trim() : ''

  return {
    width: normalizeImageWidth(widthValue),
    title: remainingTitle || null,
  }
}

export function applyImageSizingMetadata(root: ParentNode | HTMLImageElement): void {
  const images = root instanceof HTMLImageElement
    ? [root]
    : Array.from(root.querySelectorAll('img'))

  images.forEach((img) => {
    const { width, title } = parseImageMarkdownTitle(img.getAttribute('title'))
    const appliedWidth = applyImageWidth(img, getImageWidth(img) ?? width)

    if (width) {
      if (title) {
        img.setAttribute('title', title)
      } else {
        img.removeAttribute('title')
      }
    }
  })
}
