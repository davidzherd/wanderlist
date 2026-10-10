import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { MessageCircle, Send, Sparkles, Square, X } from 'lucide-react'
import { supabase } from '../api/supabaseClient'
import { BottomSheet } from './BottomSheet'
import { useIsMobile } from '../hooks/useIsMobile'
import { useAuth } from '../context/AuthContext'
import type { Trip } from '../types/trip'

interface TripChatProps {
  trip: Trip
  /** Optional controlled open state — on phones the trip dock's "Buddy" button opens the chat. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Desktop: element above the trip dock that the chat panel renders into (the dock's "Buddy" opens it). */
  desktopSlot?: HTMLElement | null
}

// Trip-assistant chat (premium), opened from the trip dock's "Buddy" item: a panel above the dock on desktop,
// a tall sheet on phones/tablets. History lives only in this component's state — mount it with
// key={tripId} so each trip gets a fresh conversation. The server route (app/api/trip-chat) loads the trip
// itself, so only the trip id travels with each request.
// Desktop opens a floating glass panel; on phones the same chat body opens in the shared BottomSheet (drag handle,
// swipe down to close). The chat state lives here, so switching between the two keeps the conversation.
export function TripChat({ trip, open, onOpenChange, desktopSlot }: TripChatProps) {
  const { id: tripId, name: tripName } = trip
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen
  const setIsOpen = onOpenChange ?? setInternalOpen
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const firstName = user?.name.trim().split(/\s+/)[0]
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/trip-chat',
      prepareSendMessagesRequest: async ({ messages, headers }) => {
        return {
          headers: { ...(headers as Record<string, string> | undefined), Authorization: `Bearer ${await getFreshAccessToken()}` },
          body: { messages, tripId },
        }
      },
    }),
  })

  const isBusy = status === 'submitted' || status === 'streaming'

  // Grow the textarea with its content (up to max-h-40, then it scrolls); shrinks back after sending clears it.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    // border-box sizing: add the borders, which scrollHeight leaves out, or a 1-line box would show a scrollbar.
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
  }, [input, isOpen])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, status])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isBusy) return
    void sendMessage({ text })
    setInput('')
  }

  // Shared by both shells (only one is mounted at a time, so the refs stay unambiguous).
  const chatBody = (
    <>
      <div ref={listRef} className="trip-scroll flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {/* UI-only greeting styled as an assistant message — never sent to the model (costs no tokens). It tells the
            traveler the assistant already has the full plan, so they ask directly instead of re-describing the trip. */}
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl bg-black/[0.06] px-3 py-2 text-sm text-ink dark:bg-black/30 dark:text-mist-light">
            {greetingFor(trip, firstName)}
          </div>
        </div>
        {messages.map((message) => {
          const text = message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('')
          if (!text) return null
          const isUser = message.role === 'user'
          return (
            <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  isUser ? 'bg-harbor text-white' : 'bg-black/[0.06] text-ink dark:bg-black/30 dark:text-mist-light'
                }`}
              >
                {text}
              </div>
            </div>
          )
        })}
        {status === 'submitted' && (
          <div className="flex justify-start" role="status">
            <div className="animate-pulse rounded-2xl bg-black/[0.06] px-3 py-2 text-sm italic text-ink/60 dark:bg-black/30 dark:text-mist-light/60">
              Thinking…
            </div>
          </div>
        )}
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {readableError(error)}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-black/10 px-3 pb-1.5 pt-3 dark:border-white/10">
        <textarea
          ref={inputRef}
          value={input}
          maxLength={500}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) handleSubmit(e)
          }}
          rows={1}
          placeholder="Ask about this trip…"
          aria-label="Message the trip assistant"
          className="max-h-40 flex-1 resize-none overflow-y-auto rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-harbor dark:border-white/10 dark:bg-black/30 dark:text-mist-light"
        />
        {isBusy ? (
          <button
            type="button"
            onClick={() => void stop()}
            aria-label="Stop response"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-harbor text-white transition hover:scale-105"
          >
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Send message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-harbor text-white transition hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
          >
            <Send size={15} />
          </button>
        )}
      </form>
      <p className="px-3 pb-2 text-center text-[11px] text-ink/50 dark:text-mist-light/50">
        Don't share personal details (passport numbers, bookings, payment info) with the assistant.
      </p>
    </>
  )

  return (
    <>
      {isOpen &&
        !isMobile &&
        desktopSlot &&
        createPortal(
          <div
            role="dialog"
            aria-label="Your travel buddy"
            className="flex h-[min(520px,58vh)] w-[min(420px,100%)] flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/90 shadow-glass backdrop-blur-2xl dark:border-white/10 dark:bg-[#333]/90"
          >
            <div className="flex items-center justify-between gap-2 border-b border-dashed border-black/10 px-4 py-3 dark:border-white/10">
              <div className="min-w-0">
                <h2 className="font-display text-sm font-semibold text-ink dark:text-mist-light">Your travel buddy</h2>
                <p className="truncate text-xs text-ink/50 dark:text-mist-light/50">{tripName}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close your travel buddy"
                className="rounded-full p-1.5 text-ink/60 transition hover:scale-105 hover:bg-black/5 dark:text-mist-light/60 dark:hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>
            {chatBody}
          </div>,
          desktopSlot,
        )}

      <BottomSheet open={isOpen && isMobile} onOpenChange={setIsOpen} title="Your travel buddy" subtitle={tripName} size="tall">
        {chatBody}
      </BottomSheet>

    </>
  )
}

// No chat-with-sparkle glyph in this lucide version, so compose one: a chat bubble with a small gold sparkle.
// Shared by the desktop toggle and the mobile trip dock's "Buddy" button.
export function TravelBuddyIcon({ size }: { size: number }) {
  return (
    <span className="relative inline-flex">
      <MessageCircle size={size} />
      <Sparkles size={Math.round(size / 2)} className="absolute -right-1.5 -top-1.5 fill-brass text-brass" />
    </span>
  )
}

// getSession() returns the stored session as-is, and its access token may have expired (e.g. after the tab sat
// idle) — the route would then reject it. Refresh when it's missing or within a minute of expiring.
async function getFreshAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (session && (session.expires_at ?? 0) * 1000 > Date.now() + 60_000) return session.access_token
  const { data: refreshed } = await supabase.auth.refreshSession()
  return refreshed.session?.access_token ?? ''
}

// Non-2xx responses from the route arrive as the raw JSON body (`{"error": "..."}`); show just the message.
function readableError(error: Error): string {
  try {
    const parsed: unknown = JSON.parse(error.message)
    if (parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string') return parsed.error
  } catch {
    // not JSON — fall through
  }
  return error.message || 'Something went wrong. Please try again.'
}

// The UI-only greeting adapts to how far along the trip is, so it invites the right kind of question: picking
// places for an empty trip, adding to a started one, or asking about a fuller plan. Recomputed every render, so it
// follows the trip as stops are added.
const STARTED_TRIP_MAX_STOPS = 5

function greetingFor(trip: Trip, firstName: string | undefined): string {
  const hello = `Hi${firstName ? ` ${firstName}` : ''}! I'm your travel buddy for ${trip.name}.`
  const stops = trip.items.filter((item) => item.kind === 'location')

  if (trip.items.length === 0) {
    return `${hello} Your plan is still empty, so let's fill it. Tell me where you're going and what you enjoy, and I'll suggest places to visit. For example: "What are the must-see places in Kyoto?"`
  }
  if (stops.length < STARTED_TRIP_MAX_STOPS) {
    const example = stops[0]
      ? `"What else should I see near ${stops[0].name}?"`
      : '"What places should I add to this trip?"'
    return `${hello} I can see what you've planned so far. Ask me for more places to add or how to fit them into your days. For example: ${example}`
  }
  return `${hello} I already know your whole plan: every day, stop, time and note. No need to describe it, just ask. For example: "Which day is the busiest?"`
}
