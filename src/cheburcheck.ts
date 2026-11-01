const BLOCKING_VERDICTS = new Set(['cdn_block', 'dns_spoofing', 'sni_block', 'tspu_block'])
const PROBE_TIMEOUT_MS = 25000

type CheckResponse = {
  id?: string | null
  blocked: boolean
  rkn_domain?: string | null
  blocked_subnets?: string[]
  cdn_providers?: Record<string, unknown[]>
}

type ProbeResult = { verdicts?: string[]; cdn_unblocked?: boolean }

export type CheckResult = {
  state: 'blocked' | 'clear' | 'unknown'
  details: string
}

export class CheburcheckClient {
  constructor(private readonly baseUrl: string) {}

  async check(domain: string): Promise<CheckResult> {
    const response = await fetch(`${this.baseUrl}/api/v1/check?target=${encodeURIComponent(domain)}`, {
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`check API returned ${response.status}`)
    const check = await response.json() as CheckResponse
    if (!check.id) throw new Error('check API did not return a probe context')

    const probe = await this.readProbe(check.id)
    if (probe.online === 0 || probe.results.length === 0) {
      return { state: check.blocked ? 'blocked' : 'unknown', details: check.blocked ? 'Обнаружено в списках блокировок; сетевые пробы недоступны' : 'Нет результатов сетевых проб' }
    }

    const blockedProbes = probe.results.filter((result) => result.verdicts?.some((verdict) => BLOCKING_VERDICTS.has(verdict) && (verdict !== 'cdn_block' || !result.cdn_unblocked))).length
    const staticReasons = [
      check.rkn_domain ? 'домен в реестре' : null,
      check.blocked_subnets?.length ? 'IP в реестре' : null,
      Object.keys(check.cdn_providers ?? {}).length ? 'IP в диапазоне CDN' : null,
    ].filter(Boolean)
    const details = `Списки: ${staticReasons.join(', ') || 'нет совпадений'}; пробы: ${blockedProbes}/${probe.results.length} с признаками блокировки`
    return { state: check.blocked || blockedProbes > 0 ? 'blocked' : 'clear', details }
  }

  private async readProbe(id: string): Promise<{ online: number; results: ProbeResult[] }> {
    const response = await fetch(`${this.baseUrl}/api/v1/probe/${encodeURIComponent(id)}`, {
      headers: { Accept: 'text/event-stream' },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    if (!response.ok || !response.body) throw new Error(`probe API returned ${response.status}`)

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const results: ProbeResult[] = []
    let online = 0
    let buffer = ''
    let done = false

    try {
      while (!done) {
        const chunk = await reader.read()
        if (chunk.done) break
        buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n')
        let boundary: number
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          const event = /^event:(.+)$/m.exec(block)?.[1]?.trim()
          const data = /^data:(.+)$/m.exec(block)?.[1]
          if (!event || !data) continue
          const value = JSON.parse(data)
          if (event === 'started') online = value.online_probes ?? 0
          if (event === 'result') results.push(value as ProbeResult)
          if (event === 'done') done = true
        }
      }
    } finally {
      await reader.cancel().catch(() => undefined)
    }
    if (!done) throw new Error('probe stream ended before done event')
    return { online, results }
  }
}
