import { useEffect, useRef } from 'react'
import { useDashboardStore } from '../store/dashboard'
import { useQueryClient } from '@tanstack/react-query'
import { getToken } from '../services/api'

type Listener = (message: any) => void
const listeners = new Set<Listener>()

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let refCount = 0
let reconnectAttempts = 0
let lastPongTime = Date.now()

const INITIAL_RECONNECT_DELAY = 1000
const MAX_RECONNECT_DELAY = 30000
const BACKOFF_MULTIPLIER = 2

function getReconnectDelay(): number {
  const delay = Math.min(
    INITIAL_RECONNECT_DELAY * Math.pow(BACKOFF_MULTIPLIER, reconnectAttempts),
    MAX_RECONNECT_DELAY
  )
  return delay
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const token = getToken()
  const wsUrl = `${protocol}//${window.location.host}/ws/dashboard${token ? `?token=${token}` : ''}`

  try {
    ws = new WebSocket(wsUrl)
    ws.onopen = () => {
      console.log('[WS] Connected')
      reconnectAttempts = 0
      lastPongTime = Date.now()
    }
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        // Handle heartbeat pings
        if (message.type === 'ping') {
          lastPongTime = Date.now()
          // Respond to server ping
          ws?.send(JSON.stringify({ type: 'pong', timestamp: lastPongTime }))
          return
        }
        if (message.type === 'pong') {
          lastPongTime = Date.now()
          return
        }
        listeners.forEach(fn => fn(message))
      } catch (e) {
        console.error('[WS] Parse error:', e)
      }
    }
    ws.onclose = () => {
      ws = null
      if (refCount > 0) {
        const delay = getReconnectDelay()
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})`)
        reconnectTimer = setTimeout(() => {
          reconnectAttempts++
          connect()
        }, delay)
      }
    }
    ws.onerror = () => ws?.close()
  } catch (e) {
    console.error('[WS] Connection error:', e)
    if (refCount > 0) {
      const delay = getReconnectDelay()
      reconnectTimer = setTimeout(() => {
        reconnectAttempts++
        connect()
      }, delay)
    }
  }
}

function disconnect() {
  refCount--
  if (refCount <= 0) {
    refCount = 0
    if (ws) { ws.close(); ws = null }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
    reconnectAttempts = 0
  }
}

export function getReconnectCount(): number {
  return reconnectAttempts
}

export function useWebSocket() {
  const setLastEvent = useDashboardStore((s) => s.setLastEvent)
  const queryClient = useQueryClient()

  useEffect(() => {
    refCount++
    connect()

    const handler = (message: any) => {
      setLastEvent(message)
      if (message.type === 'containment') {
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        queryClient.invalidateQueries({ queryKey: ['agents'] })
        queryClient.invalidateQueries({ queryKey: ['risk-events'] })
      } else if (message.type === 'tool_execution' || message.type === 'risk_update') {
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      } else if (message.type === 'replay_event') {
        queryClient.invalidateQueries({ queryKey: ['replay-events'] })
      } else if (message.type === 'operator_alert') {
        queryClient.invalidateQueries({ queryKey: ['operator-activities'] })
        queryClient.invalidateQueries({ queryKey: ['operator-risks'] })
        queryClient.invalidateQueries({ queryKey: ['incidents'] })
      } else if (message.type === 'demo_environment_started' || message.type === 'demo_environment_reset') {
        queryClient.invalidateQueries({ queryKey: ['demo-state'] })
        queryClient.invalidateQueries({ queryKey: ['agents'] })
      } else if (message.type === 'explanation_generated') {
        queryClient.invalidateQueries({ queryKey: ['risk-events'] })
      }
    }
    listeners.add(handler)

    return () => {
      listeners.delete(handler)
      disconnect()
    }
  }, [setLastEvent, queryClient])
}
