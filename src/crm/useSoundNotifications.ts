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

    const currentMessageIds = new Set(allMessages.map((m) => m.id));
    const previousIds = previousMessagesRef.current;

    // Find new incoming messages from OTHER conversations
    const newMessages = allMessages.filter(
      (msg) => !previousIds.has(msg.id) && msg.direction === "incoming"
    );

    // Play sound for new messages (throttle to prevent sound spam)
    if (newMessages.length > 0) {
      const now = Date.now();
      if (now - lastPlayedRef.current > 1000) { // Minimum 1 second between sounds
        try {
          if (audioContextRef.current.state === "suspended") {
            audioContextRef.current.resume();
          }
          createNotificationSound(audioContextRef.current, options.volume);
          lastPlayedRef.current = now;
        } catch (error) {
          console.error("[CRM] Error playing notification sound:", error);
        }
      }
    }

    // Update previous messages set
    previousMessagesRef.current = currentMessageIds;
  }, [allConversationData, selectedConversationId, options.enabled, options.volume]);
}
