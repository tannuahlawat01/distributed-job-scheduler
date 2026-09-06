import { subscriber } from './redis.js';
import { broadcast } from './ws.js';

const CHANNEL = 'job-updates';

export function startSubscriber() {
  subscriber.subscribe(CHANNEL, (err) => {
    if (err) {
      console.error('Failed to subscribe:', err);
    } else {
      console.log(`Subscribed to ${CHANNEL}`);
    }
  });

  subscriber.on('message', (channel, message) => {
    if (channel === CHANNEL) {
      const event = JSON.parse(message);
      broadcast(event);
    }
  });
}