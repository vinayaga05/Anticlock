'use client';

import Link from 'next/link';
import { AdminShell } from '@/components/AdminShell';

const operations = [
  { href: '/bookings', title: 'Service bookings', description: 'Review and update customer service bookings.' },
  { href: '/trips/bookings', title: 'Trip bookings', description: 'Review traveler requests and trip booking status.' },
  { href: '/provider/applications', title: 'Provider applications', description: 'Review onboarding applications and submitted documents.' },
  { href: '/moderation', title: 'Content moderation', description: 'Review reported or pending content.' },
];

export default function OperationsPage() {
  return (
    <AdminShell>
      <h1 className="page-title">Operations</h1>
      <p className="page-sub">Open the tools for day-to-day booking, provider, and moderation work.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {operations.map(item => (
          <Link className="card" href={item.href} key={item.href} style={{ color: 'inherit', textDecoration: 'none' }}>
            <h2>{item.title}</h2>
            <p className="muted">{item.description}</p>
            <span className="btn secondary">Open</span>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
