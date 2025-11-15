import { useEffect, useRef, useMemo } from "react";
import type { Message } from "./types";

interface SoundOptions {
  enabled: boolean;
  volume: number; // 0-1
  debounceMs?: number; // Configurable debounce (default 2000ms)
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
  const initializedRef = useRef<boolean>(false);

  const debounceMs = options.debounceMs ?? 2000;

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

  // Create stable message ID array using useMemo to prevent unnecessary re-renders
  const otherConversationsMessageIds = useMemo(() => {
    const ids: string[] = [];
    for (const [convId, data] of Object.entries(allConversationData)) {
      if (convId !== selectedConversationId) {
        ids.push(...data.messages.map(m => m.id));
      }
    }
    return ids.sort().join(','); // Create stable string key
  }, [allConversationData, selectedConversationId]);

  // Detect new messages and play sound - ONLY for OTHER conversations (not the currently selected one)
  useEffect(() => {
    if (!options.enabled || !audioContextRef.current) {
      initializedRef.current = true;
      return;
    }

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

    // Skip sound on initial load (when hook first runs)
    if (!initializedRef.current) {
      console.log(`[CRM] Initial load - skipping sound for ${previousMessagesRef.current.size} existing messages`);
      initializedRef.current = true;
      return;
    }

    // Play sound for new messages (with configurable debounce to prevent sound spam)
    if (newMessages.length > 0) {
      const now = Date.now();
      const timeSinceLastSound = now - lastPlayedRef.current;

      if (timeSinceLastSound > debounceMs) {
        try {
          if (audioContextRef.current.state === "suspended") {
            audioContextRef.current.resume();
          }
          createNotificationSound(audioContextRef.current, options.volume);
          lastPlayedRef.current = now;
          console.log(`[CRM] 🔔 Sound notification played for ${newMessages.length} new message(s)`);
        } catch (error) {
          console.error("[CRM] Error playing notification sound:", error);
        }
      } else {
        console.log(`[CRM] 🔇 Sound debounced (${Math.round(timeSinceLastSound)}ms since last, need ${debounceMs}ms)`);
      }
    }
  }, [otherConversationsMessageIds, options.enabled, options.volume, debounceMs]);
}
