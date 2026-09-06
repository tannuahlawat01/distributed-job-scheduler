import { useEffect, useRef } from 'react';

export function useJobSocket(onUpdate) {
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:4000');
    wsRef.current = ws;

    ws.onopen = () => console.log('WebSocket connected');
    ws.onclose = () => console.log('WebSocket disconnected');
    ws.onerror = (err) => console.error('WebSocket error:', err);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'job-update') {
        onUpdate();
      }
    };

    return () => ws.close();
  }, [onUpdate]);
}