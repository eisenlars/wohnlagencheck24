'use client';

import type {
  NetworkContentRecord,
  NetworkPartnerBookingRecord,
} from '@/lib/network-partners/types';
import ContentForm from '@/components/network-partners/ContentForm';

type ContentEditorProps = {
  bookings: NetworkPartnerBookingRecord[];
  contentItem?: NetworkContentRecord | null;
  onSubmit: (values: Parameters<NonNullable<React.ComponentProps<typeof ContentForm>['onSubmit']>>[0]) => Promise<void>;
};

export default function ContentEditor({
  bookings,
  contentItem,
  onSubmit,
}: ContentEditorProps) {
  return (
    <ContentForm
      bookings={bookings}
      networkPartners={[]}
      initialValue={contentItem ?? null}
      submitLabel={contentItem ? 'Content speichern' : 'Content anlegen'}
      onSubmit={onSubmit}
    />
  );
}
