'use client';

import type { ReactNode } from 'react';

export type WorkspacePillTabItem = {
  id: string;
  label: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
};

type WorkspacePillTabsProps = {
  items: WorkspacePillTabItem[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
};

export default function WorkspacePillTabs({
  items,
  activeId,
  onSelect,
  className = 'my-4',
}: WorkspacePillTabsProps) {
  return (
    <div className={`d-flex flex-wrap gap-2 ${className}`.trim()}>
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            className={`btn btn-sm rounded-pill px-3 ${active ? 'btn-secondary fw-bold' : 'btn-outline-secondary fw-semibold'}`}
            onClick={() => onSelect(item.id)}
            aria-label={item.ariaLabel}
            disabled={item.disabled}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
