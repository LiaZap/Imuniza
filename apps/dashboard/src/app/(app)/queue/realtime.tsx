'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function QueueRealtime() {
  const router = useRouter();

  useEffect(() => {
    const es = new EventSource('/api/events/conversations');

    const refresh = () => router.refresh();

    es.addEventListener('message.created', refresh);
    es.addEventListener('conversation.handoff_requested', refresh);
    es.addEventListener('conversation.assigned', refresh);
    es.addEventListener('conversation.closed', refresh);

    return () => {
      es.close();
    };
  }, [router]);

  return null;
}
