export type TimeParts = {
  hours: number
  minutes: number
  seconds: number
}

export function parseTimeValue(value: string): TimeParts {
  const [hours = 0, minutes = 0, seconds = 0] = value.split(':').map(Number)
  return { hours, minutes, seconds }
}

export function formatTimeValue(value: Partial<TimeParts>): string {
  const pad = (part: number | undefined) => String(Number.isFinite(part) ? part : 0).padStart(2, '0')
  return `${pad(value.hours)}:${pad(value.minutes)}:${pad(value.seconds)}`
}
