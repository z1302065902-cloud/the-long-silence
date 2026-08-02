export type PlaySession = {
  index: number
  durationSec: number
  kills: number
  deaths: number
  score: number
  maxWave: number
  pickups: number
  issues: string[]
  endReason: 'timeout' | 'deaths' | 'error'
}

export type PlayReport = {
  done: boolean
  sessionsTarget: number
  sessionsCompleted: number
  totalKills: number
  totalDeaths: number
  sessions: PlaySession[]
  uniqueIssues: string[]
  errors: string[]
  startedAt: number
  finishedAt?: number
}

declare global {
  interface Window {
    __PLAYTEST__?: PlayReport
    __GAME__?: unknown
  }
}

export function createPlayReport(sessionsTarget: number): PlayReport {
  return {
    done: false,
    sessionsTarget,
    sessionsCompleted: 0,
    totalKills: 0,
    totalDeaths: 0,
    sessions: [],
    uniqueIssues: [],
    errors: [],
    startedAt: Date.now(),
  }
}
