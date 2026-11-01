export const normalizeDomain = (input: string): string | null => {
  const value = input.trim().toLowerCase().replace(/\.$/, '')
  if (value.length > 253 || value.length < 4 || value.includes('://') || value.includes('/')) return null
  if (!/^[a-z0-9.-]+$/.test(value) || !value.includes('.')) return null
  const labels = value.split('.')
  if (labels.some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null
  return value
}

export const parseInterval = (input: string): number | null => {
  const match = /^(\d+)(m|h|d)$/.exec(input.trim().toLowerCase())
  if (!match) return null
  const count = Number(match[1])
  const multiplier = { m: 60, h: 3600, d: 86400 }[match[2] as 'm' | 'h' | 'd']
  const seconds = count * multiplier
  return Number.isSafeInteger(seconds) && seconds >= 300 && seconds <= 604800 ? seconds : null
}
