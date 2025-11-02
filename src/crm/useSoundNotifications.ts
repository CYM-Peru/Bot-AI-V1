import { useEffect, useRef } from "react";
import type { Message } from "./types";

interface SoundOptions {
  enabled: boolean;
  volume: number; // 0-1
}

interface ConversationData {
  messages: Message[];
}

// Simple notification sound using Web Audio API
function createNotificationSound(audioContext: AudioContext, volume: number) {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
  oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

  gainNode.gain.setValueAtTime(volume * 0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.3);
}

export function useSoundNotifications(
  allConversationData: Record<string, ConversationData>,
  selectedConversationId: string | null,
  options: SoundOptions
) {
  const previousMessagesRef = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastPlayedRef = useRef<number>(0);

  // Initialize audio context
  useEffect(() => {
    if (options.enabled && !audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.error("[CRM] Error creating audio context:", error);
      }
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [options.enabled]);

  // Detect new messages and play sound - ONLY for OTHER conversations (not the currently selected one)
  useEffect(() => {
    if (!options.enabled || !audioContextRef.current) return;

    // Get all messages from ALL conversations EXCEPT the currently selected one
    const allMessages: Message[] = [];
    for (const [convId, data] of Object.entries(allConversationData)) {
      if (convId !== selectedConversationId) {
        allMessages.push(...data.messages);
      }
    }

    // Find NEW incoming messages that we haven't seen before
    const newMessages = allMessages.filter((msg) => {
      const isNew = !previousMessagesRef.current.has(msg.id);
      const isIncoming = msg.direction === "incoming";

      // Mark this message as seen
      if (isNew) {
        previousMessagesRef.current.add(msg.id);
      }

      // Only return true for incoming messages we haven't seen
      return isNew && isIncoming;
    });

    // Play sound for new messages (throttle to prevent sound spam)
    // Only play if there are genuinely new messages AND we're not in the initial load
    if (newMessages.length > 0 && previousMessagesRef.current.size > newMessages.length) {
      const now = Date.now();
      // Minimum 2 seconds between sounds to prevent rapid firing
      if (now - lastPlayedRef.current > 2000) {
        try {
          if (audioContextRef.current.state === "suspended") {
            audioContextRef.current.resume();
          }
          createNotificationSound(audioContextRef.current, options.volume);
          lastPlayedRef.current = now;
          console.log(`[CRM] Sound notification played for ${newMessages.length} new message(s)`);
        } catch (error) {
          console.error("[CRM] Error playing notification sound:", error);
        }
      }
    }
  }, [allConversationData, selectedConversationId, options.enabled, options.volume]);
}
