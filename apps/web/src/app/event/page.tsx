import type { Metadata } from 'next';
import { EventInvitation } from '@/components/event/EventInvitation';
import { eventConfig } from '@/config/event';
import { generateMetadata } from '@/lib/metadata';

export const metadata: Metadata = generateMetadata({
  title: `${eventConfig.name} — Mupperum Vizha`,
  description: `${eventConfig.description} Tamil and English invitation with verified ₹${eventConfig.fee} UPI entry.`,
});

export default function EventPage() {
  return <EventInvitation />;
}
