'use client';

import RequestsWorkspaceManager from './RequestsWorkspaceManager';

type VisibilityMode = 'partner_wide' | 'strict_local';

type VisibilityTone = 'info' | 'success' | 'error';

type VisibilityConfig = {
  area_id: string;
  areas?: {
    name?: string;
  };
};

type Props = {
  visibilityConfig?: VisibilityConfig | null;
  visibilityMode?: VisibilityMode;
  visibilityBusy?: boolean;
  visibilityMessage?: string | null;
  visibilityTone?: VisibilityTone;
  onVisibilityModeChange?: (value: VisibilityMode) => void | Promise<void>;
};

export default function RequestsManager(props: Props) {
  return <RequestsWorkspaceManager {...props} />;
}
