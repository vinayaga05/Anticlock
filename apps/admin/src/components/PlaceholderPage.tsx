'use client';

import { AdminShell } from '@/components/AdminShell';

export function PlaceholderPage({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <AdminShell>
      <h1 className="page-title">{title}</h1>
      <p className="page-sub">{blurb}</p>
      <div className="card placeholder">Coming in a later phase.</div>
    </AdminShell>
  );
}

export default PlaceholderPage;
