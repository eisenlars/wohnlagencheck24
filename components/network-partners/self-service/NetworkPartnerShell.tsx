'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import {
  workflowHeaderStyle,
  workflowPanelCardStyle,
  workflowTopCardStyle,
} from '@/app/dashboard/workflow-ui';

type NetworkPartnerShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export default function NetworkPartnerShell({
  title,
  description,
  children,
}: NetworkPartnerShellProps) {
  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px 56px', display: 'grid', gap: 18 }}>
      <section style={workflowTopCardStyle}>
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Netzwerkpartner-Self-Service
          </span>
          <h1 style={{ margin: 0, color: '#fff', fontSize: 28, lineHeight: 1.2 }}>{title}</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', maxWidth: 760, lineHeight: 1.6 }}>
            {description}
          </p>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', color: '#fff', fontWeight: 700 }}>
            <Link href="/network-partner" style={{ color: '#fff', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Übersicht
            </Link>
            <Link href="/network-partner/bookings" style={{ color: '#fff', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Buchungen
            </Link>
            <Link href="/network-partner/invoices" style={{ color: '#fff', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Rechnungen
            </Link>
            <Link href="/network-partner/content" style={{ color: '#fff', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Content
            </Link>
            <Link href="/network-partner/integrations" style={{ color: '#fff', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Integrationen
            </Link>
          </div>
        </div>
      </section>

      <section style={workflowPanelCardStyle}>
        <div style={workflowHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>{title}</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
