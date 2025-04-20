import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Message } from '@/lib/supabase.types'

interface UseConversationEngineOptions {
  onRedirect?: (to: string) => void
}

export function useConversationEngine({ onRedirect }: UseConversationEngineOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const processMessage = useCallback(async (content: string) => {
    try {
      setIsProcessing(true)
      setError(null)

      // Add user message to state
      const userMessage: Message = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        content,
        role: 'user',
        script_id: null
      }
      setMessages(prev => [...prev, userMessage])

      // Save message to Supabase
      const { error: saveError } = await supabase
        .from('messages')
        .insert([userMessage])

      if (saveError) throw saveError

      // TODO: Process message with backend conversation engine
      // For now, just simulate a response
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        content: 'This is a simulated response. The actual conversation engine will be implemented later.',
        role: 'assistant',
        script_id: null
      }
      setMessages(prev => [...prev, assistantMessage])

      // Save assistant message
      await supabase
        .from('messages')
        .insert([assistantMessage])

      // Check for redirect after 3 turns
      if (messages.length >= 6) { // 3 turns = 6 messages (user + assistant)
        onRedirect?.('/register')
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to process message'))
    } finally {
      setIsProcessing(false)
    }
  }, [messages, onRedirect])

  return {
    messages,
    isProcessing,
    error,
    processMessage
  }
} 