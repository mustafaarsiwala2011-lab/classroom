/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';

type EventHandler = (data: any) => void;

/**
 * Hook for subscribing to High-Tech Real-Time Server-Sent Events (SSE)
 */
export function useRealtimeEvents(handlers: Record<string, EventHandler>, userId?: string, username?: string) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const query = new URLSearchParams();
    if (userId) query.set('userId', userId);
    if (username) query.set('username', username);

    const url = `/api/events/stream?${query.toString()}`;
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      try {
        eventSource = new EventSource(url);

        eventSource.onopen = () => {
          // Connected
        };

        // Listen for all specified events
        const eventTypes = [
          'message_created',
          'message_updated',
          'message_status_updated',
          'message_delivered',
          'message_deleted',
          'messages_read',
          'reaction_updated',
          'note_created',
          'note_updated',
          'note_deleted',
          'meme_created',
          'fail_created',
          'fail_updated',
          'fail_deleted',
          'fail_reacted',
          'notice_created',
          'notice_deleted',
          'poll_created',
          'poll_voted',
          'system_restored'
        ];

        eventTypes.forEach(type => {
          eventSource?.addEventListener(type, (e: MessageEvent) => {
            try {
              const data = JSON.parse(e.data);
              const handler = handlersRef.current[type];
              if (handler) {
                handler(data);
              }
              // Also call generic wildcard handler if provided
              if (handlersRef.current['*']) {
                handlersRef.current['*']({ type, data });
              }
            } catch (err) {
              console.error(`Error parsing SSE event "${type}":`, err);
            }
          });
        });

        eventSource.onerror = () => {
          eventSource?.close();
          // Auto-reconnect after 3 seconds
          reconnectTimeout = setTimeout(connect, 3000);
        };
      } catch (err) {
        console.error('SSE connection error:', err);
      }
    };

    connect();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [userId, username]);
}
