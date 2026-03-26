'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { buildWebAssetUrl } from '@/utils/assets';
import FullscreenLoader from '@/components/ui/FullscreenLoader';
import {
  workflowTopCardStyle,
  workflowTopControlsStyle,
  workflowTopFieldStyle,
  workflowTopSelectStyle,
} from '@/app/dashboard/workflow-ui';

type PartnerArea = {
  id?: string;
  name?: string;
  slug?: string;
  parent_slug?: string;
  bundesland_slug?: string;
};

type PartnerAreaConfig = {
  area_id: string;
  areas?: PartnerArea;
  [key: string]: unknown;
};

type BlogManagerProps = {
  config: PartnerAreaConfig;
  onNavigateToTexts?: (sectionKey: string) => void;
};

type BlogSource = {
  individual01: string;
  individual02: string;
  zitat: string;
};

type BlogPostRow = {
  id: string;
  headline: string | null;
  subline: string | null;
  body_md: string | null;
  status: 'draft' | 'active' | 'inactive';
  created_at: string | null;
};

type LlmIntegrationOption = {
  id: string;
  source: 'partner' | 'global';
  provider: string;
  model: string;
  label: string;
  partnerIntegrationId: string | null;
  globalProviderId: string | null;
};

type LlmOptionApiRow = {
  id?: string | null;
  source?: string | null;
  provider?: string | null;
  model?: string | null;
  label?: string | null;
  partner_integration_id?: string | null;
  global_provider_id?: string | null;
};

const SOURCE_KEYS = [
  'immobilienmarkt_individuell_01',
  'immobilienmarkt_individuell_02',
  'immobilienmarkt_zitat',
] as const;

export default function BlogManager({ config, onNavigateToTexts }: BlogManagerProps) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [isNarrow, setIsNarrow] = useState(false);
  const [source, setSource] = useState<BlogSource>({ individual01: '', individual02: '', zitat: '' });
  const [authorName, setAuthorName] = useState<string>('');
  const [headline, setHeadline] = useState('');
  const [subline, setSubline] = useState('');
  const [bodyMd, setBodyMd] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llmOptions, setLlmOptions] = useState<LlmIntegrationOption[]>([]);
  const [selectedLlmIntegrationId, setSelectedLlmIntegrationId] = useState('');

  const areaName = config?.areas?.name || '';
  const bundeslandSlug = String(config?.areas?.bundesland_slug || '');
  const kreisSlug = String(config?.areas?.slug || '');
  const areaId = String(config?.area_id || '');

  const authorImageUrl = useMemo(() => {
    if (!bundeslandSlug || !kreisSlug) return '';
    return buildWebAssetUrl(
      `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung-${kreisSlug}.png`,
    );
  }, [bundeslandSlug, kreisSlug]);

  const hasAllSources = Boolean(source.individual01 && source.individual02 && source.zitat);
  const missingSources: Array<{ key: string; label: string }> = [
    { key: 'immobilienmarkt_individuell_01', label: 'Experteneinschätzung Text 01' },
    { key: 'immobilienmarkt_individuell_02', label: 'Experteneinschätzung Text 02' },
    { key: 'immobilienmarkt_zitat', label: 'Zitat' },
  ].filter((item) => {
    if (item.key.endsWith('01')) return !source.individual01;
    if (item.key.endsWith('02')) return !source.individual02;
    return !source.zitat;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 980px)');
    const handleChange = () => setIsNarrow(media.matches);
    handleChange();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    setHeadline('');
    setSubline('');
    setBodyMd('');
    setCustomPrompt('');
    setSelectedPostId(null);
  }, [areaId]);

  useEffect(() => {
    async function loadSource() {
      if (!areaId) return;
      setLoading(true);
      setError(null);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const res = await fetch('/api/fetch-json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bundesland: bundeslandSlug,
            kreis: kreisSlug,
            ortslage: null,
          }),
        });
        const jsonTexts = await res.json();
        const beraterName = String(jsonTexts?.berater?.berater_name || '').trim();
        setAuthorName(beraterName);

        const { data } = await supabase
          .from('report_texts')
          .select('section_key, optimized_content')
          .eq('area_id', areaId)
          .eq('partner_id', user.id)
          .in('section_key', SOURCE_KEYS as unknown as string[]);

        const byKey = new Map<string, string>();
        for (const entry of data || []) {
          const value = typeof entry.optimized_content === 'string' ? entry.optimized_content.trim() : '';
          if (value) byKey.set(entry.section_key, value);
        }

        setSource({
          individual01: byKey.get('immobilienmarkt_individuell_01') ?? '',
          individual02: byKey.get('immobilienmarkt_individuell_02') ?? '',
          zitat: byKey.get('immobilienmarkt_zitat') ?? '',
        });
      } catch (err) {
        console.error(err);
        setError('Quelltexte konnten nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    }

    loadSource();
  }, [areaId, bundeslandSlug, kreisSlug, supabase]);

  useEffect(() => {
    async function loadPosts() {
      if (!areaId) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('partner_blog_posts')
          .select('id, headline, subline, body_md, status, created_at')
          .eq('partner_id', user.id)
          .eq('area_id', areaId)
          .order('created_at', { ascending: false });
        setPosts((data || []) as BlogPostRow[]);
      } catch (err) {
        console.error(err);
      }
    }
    loadPosts();
  }, [areaId, supabase, saving]);

  useEffect(() => {
    async function loadLlmOptions() {
      try {
        const integrationsRes = await fetch('/api/partner/llm/options');
        if (!integrationsRes.ok) throw new Error('LLM-Optionen konnten nicht geladen werden.');
        const payload = await integrationsRes.json().catch(() => ({}));
        const items: LlmOptionApiRow[] = Array.isArray(payload?.options)
          ? (payload.options as LlmOptionApiRow[])
          : [];
        const llmModeDefault = String(payload?.llm_mode_default ?? '').trim().toLowerCase();
        const nextOptions = items
          .map((entry) => {
            const id = String(entry?.id ?? '').trim();
            if (!id) return null;
            const provider = String(entry?.provider ?? '').trim() || 'LLM';
            const model = String(entry?.model ?? '').trim() || 'Standardmodell';
            const source = String(entry?.source ?? '').trim().toLowerCase() === 'global' ? 'global' : 'partner';
          return {
            id,
            source,
            provider,
            model,
            label: String(entry?.label ?? '').trim() || `${provider} · ${model}${source === 'global' ? ' (Global)' : ' (Partner)'}`,
            partnerIntegrationId: String(entry?.partner_integration_id ?? '').trim() || null,
            globalProviderId: String(entry?.global_provider_id ?? '').trim() || null,
          } satisfies LlmIntegrationOption;
        })
          .filter((entry): entry is LlmIntegrationOption => Boolean(entry));
        setLlmOptions(nextOptions);
        setSelectedLlmIntegrationId((prev) => {
          if (prev && nextOptions.some((item) => item.id === prev)) return prev;
          if (llmModeDefault === 'central_managed') {
            return nextOptions.find((item) => item.source === 'global')?.id ?? nextOptions[0]?.id ?? '';
          }
          if (llmModeDefault === 'partner_managed') {
            return nextOptions.find((item) => item.source === 'partner')?.id ?? nextOptions[0]?.id ?? '';
          }
          return nextOptions[0]?.id ?? '';
        });
      } catch (err) {
        console.error(err);
      }
    }

    void loadLlmOptions();
  }, []);

  const handleGenerate = async () => {
    if (!areaName || !hasAllSources) return;
    setGenerating(true);
    setError(null);
    try {
      const selectedOption = llmOptions.find((item) => item.id === (selectedLlmIntegrationId || llmOptions[0]?.id)) ?? null;
      const res = await fetch('/api/ai-blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          areaName,
          authorName: authorName || undefined,
          source,
          customPrompt: customPrompt || undefined,
          llm_integration_id: selectedOption?.partnerIntegrationId || undefined,
          llm_global_provider_id: selectedOption?.globalProviderId || undefined,
        }),
      });
      const data = await res.json();
      if (data?.headline) setHeadline(data.headline);
      if (data?.subline) setSubline(data.subline);
      if (data?.body_md) setBodyMd(data.body_md);
    } catch (err) {
      console.error(err);
      setError('KI-Generierung fehlgeschlagen.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!headline || !bodyMd || !areaId) return;
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (selectedPostId) {
        await supabase
          .from('partner_blog_posts')
          .update({
            headline,
            subline,
            body_md: bodyMd,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedPostId)
          .eq('partner_id', user.id);
      } else {
        await supabase.from('partner_blog_posts').insert({
          partner_id: user.id,
          area_id: areaId,
          area_name: areaName,
          bundesland_slug: bundeslandSlug,
          kreis_slug: kreisSlug,
          headline,
          subline,
          body_md: bodyMd,
          author_name: authorName,
          author_image_url: authorImageUrl,
          source_individual_01: source.individual01,
          source_individual_02: source.individual02,
          source_zitat: source.zitat,
          status: 'draft',
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(err);
      setError('Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (post: BlogPostRow) => {
    setSelectedPostId(post.id);
    setHeadline(post.headline ?? '');
    setSubline(post.subline ?? '');
    setBodyMd(post.body_md ?? '');
  };

  const updateStatus = async (postId: string, status: 'active' | 'inactive') => {
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from('partner_blog_posts')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', postId)
        .eq('partner_id', user.id);
    } catch (err) {
      console.error(err);
      setError('Status konnte nicht geändert werden.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (postId: string, status: BlogPostRow['status']) => {
    if (status === 'active') return;
    const ok = window.confirm('Blogartikel wirklich löschen? (irreversibel)');
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from('partner_blog_posts')
        .delete()
        .eq('id', postId)
        .eq('partner_id', user.id);
    } catch (err) {
      console.error(err);
      setError('Löschen fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <FullscreenLoader show label="Blog-Bausteine werden geladen..." />;

  return (
    <div style={{ width: '100%' }}>
      <div style={workflowTopCardStyle}>
        <div style={workflowTopControlsStyle}>
          <label style={workflowTopFieldStyle}>
            <select
              value={selectedLlmIntegrationId || llmOptions[0]?.id || ''}
              onChange={(e) => setSelectedLlmIntegrationId(e.target.value)}
              style={workflowTopSelectStyle}
              aria-label="KI-Modell auswählen"
              disabled={llmOptions.length === 0}
            >
              {llmOptions.length === 0 ? <option value="">Kein LLM verfügbar</option> : null}
              {llmOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div style={layoutGridStyle(isNarrow)}>
        <div style={layoutLeftStyle}>
          <div style={listCardStyle}>
            <div style={listTitleStyle}>Blog-Übersicht</div>
            {posts.length === 0 ? (
              <div style={listEmptyStyle}>Keine Blogartikel vorhanden.</div>
            ) : (
              <div style={listWrapStyle}>
                {posts.map((post) => (
                  <div key={post.id} style={listRowStyle}>
                    <div>
                      <div style={listHeadlineStyle}>{post.headline || 'Ohne Titel'}</div>
                      <div style={listMetaStyle}>
                        {post.created_at ? new Date(post.created_at).toLocaleString('de-DE') : '—'}
                      </div>
                      <div style={statusBadgeStyle(post.status)}>
                        {post.status === 'active' ? 'Aktiv' : post.status === 'inactive' ? 'Inaktiv' : 'Entwurf'}
                      </div>
                    </div>
                    <div style={listActionsStyle}>
                      <button type="button" onClick={() => handleEdit(post)} style={listButtonStyle}>
                        Bearbeiten
                      </button>
                      {post.status !== 'active' ? (
                        <button type="button" onClick={() => updateStatus(post.id, 'active')} style={listButtonPrimaryStyle}>
                          Aktivieren
                        </button>
                      ) : (
                        <button type="button" onClick={() => updateStatus(post.id, 'inactive')} style={listButtonStyle}>
                          Deaktivieren
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(post.id, post.status)}
                        style={listButtonDangerStyle(post.status === 'active')}
                        disabled={post.status === 'active'}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={layoutRightStyle}>
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div>
                <div style={labelStyle}>Quelle</div>
                <div style={titleStyle}>Marktüberblick – Individuelle Texte</div>
              </div>
          <div style={statusStyle(hasAllSources)}>
            {hasAllSources ? 'Quellen vollständig' : 'Quellen unvollständig'}
          </div>
        </div>
        {!hasAllSources ? (
          <div style={missingHintStyle}>
            <div style={missingTitleStyle}>Bitte ergänzen in „Berichte &amp; Texte → Marktüberblick“:</div>
            <div style={missingLinksStyle}>
              {missingSources.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  style={missingLinkStyle}
                  onClick={() => onNavigateToTexts?.(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

            <div style={sourceStackStyle}>
              <div>
                <div style={sourceLabelStyle}>Zitat</div>
                <div style={sourceBoxStyle}>{source.zitat || 'Kein Override vorhanden.'}</div>
              </div>
              <div style={sourceGridStyle(isNarrow)}>
                <div>
                  <div style={sourceLabelStyle}>Experteneinschätzung Text 01</div>
                  <div style={sourceBoxStyle}>{source.individual01 || 'Kein Override vorhanden.'}</div>
                </div>
                <div>
                  <div style={sourceLabelStyle}>Experteneinschätzung Text 02</div>
                  <div style={sourceBoxStyle}>{source.individual02 || 'Kein Override vorhanden.'}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div>
                <div style={labelStyle}>Blog-Generator</div>
                <div style={titleStyle}>Headline, Subline &amp; Blogtext</div>
              </div>
            </div>

            <div style={formColStyle}>
              <label style={inputLabelStyle}>
                Headline
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  style={inputStyle}
                  placeholder="Headline"
                />
              </label>
              <label style={inputLabelStyle}>
                Subline
                <input
                  value={subline}
                  onChange={(e) => setSubline(e.target.value)}
                  style={inputStyle}
                  placeholder="Subline"
                />
              </label>
              <label style={inputLabelStyle}>
                Blog (Markdown)
                <textarea
                  value={bodyMd}
                  onChange={(e) => setBodyMd(e.target.value)}
                  style={textareaStyle}
                  placeholder="Markdown-Text"
                />
              </label>

              <div style={buttonRowStyle}>
                <button
                  type="button"
                  onClick={handleGenerate}
                  style={primaryButtonStyle}
                  disabled={!hasAllSources || generating || llmOptions.length === 0}
                >
                  {generating ? '⏳ KI generiert Blog...' : '✨ Blog per KI generieren'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  style={secondaryButtonStyle}
                  disabled={!headline || !bodyMd || saving}
                >
                  {saving ? 'Speichern...' : selectedPostId ? 'Änderungen speichern' : 'Blog speichern'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowPrompt((prev) => !prev)}
                style={promptToggleStyle}
              >
                {showPrompt ? 'Prompt ausblenden' : 'Prompt anzeigen'}
              </button>
              {showPrompt ? (
                <div style={promptPanelStyle}>
                  <div style={promptLabelStyle}>Standard-Prompt</div>
                  <div style={promptContentStyle}>
                    Schreibe einen kompakten Blogartikel auf Basis der drei Quellen (Individuell 01/02 + Zitat).
                    Keine neuen Fakten, sachlich, 2–4 Abschnitte, klare Headline und Subline.
                  </div>
                  <label style={promptInputLabelStyle}>
                    Eigener Prompt (optional)
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      style={promptInputStyle}
                      placeholder="Eigene Zusatzvorgaben (werden zum Standard-Prompt ergänzt)"
                    />
                  </label>
                </div>
              ) : null}
            </div>

            {error ? <div style={errorStyle}>{error}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  backgroundColor: '#fff',
  borderRadius: '16px',
  padding: '28px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 12px 20px rgba(15, 23, 42, 0.06)',
  marginBottom: '24px',
};

const cardHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '18px',
};

const labelStyle = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: '#94a3b8',
  fontWeight: 700,
};

const titleStyle = {
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
};

const statusStyle = (ok: boolean) => ({
  padding: '6px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 600,
  backgroundColor: ok ? '#dcfce7' : '#fee2e2',
  color: ok ? '#166534' : '#b91c1c',
});

const missingHintStyle = {
  marginTop: '12px',
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid #fecaca',
  backgroundColor: '#fff1f2',
};

const missingTitleStyle = {
  fontSize: '12px',
  fontWeight: 700,
  color: '#b91c1c',
  marginBottom: '8px',
};

const missingLinksStyle = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap' as const,
};

const missingLinkStyle = {
  padding: '6px 10px',
  borderRadius: '999px',
  border: '1px solid #fecaca',
  backgroundColor: '#fff',
  color: '#b91c1c',
  fontSize: '11px',
  fontWeight: 700,
  cursor: 'pointer',
};

const sourceStackStyle = {
  display: 'grid',
  gap: '16px',
};

const sourceGridStyle = (isNarrow: boolean) => ({
  display: 'grid',
  gridTemplateColumns: isNarrow ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
  gap: '16px',
});

const sourceLabelStyle = {
  fontSize: '12px',
  fontWeight: 700,
  color: '#1e293b',
  marginBottom: '8px',
};

const sourceBoxStyle = {
  backgroundColor: '#f8fafc',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  padding: '12px',
  fontSize: '12.5px',
  color: '#475569',
  lineHeight: 1.6,
  minHeight: '120px',
  whiteSpace: 'pre-wrap' as const,
};

const formColStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '16px',
};

const inputLabelStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '6px',
  fontSize: '12px',
  fontWeight: 600,
  color: '#1e293b',
};

const inputStyle = {
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  padding: '10px 12px',
  fontSize: '14px',
};

const textareaStyle = {
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  padding: '12px',
  minHeight: '220px',
  fontSize: '13px',
  lineHeight: 1.6,
  fontFamily: 'inherit',
};

const buttonRowStyle = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap' as const,
};

const primaryButtonStyle = {
  padding: '10px 16px',
  borderRadius: '8px',
  border: '1px solid #dbeafe',
  backgroundColor: '#eff6ff',
  color: '#2563eb',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButtonStyle = {
  padding: '10px 16px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  backgroundColor: '#fff',
  color: '#0f172a',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
};

const promptToggleStyle = {
  alignSelf: 'flex-start',
  background: 'transparent',
  border: 'none',
  color: '#2563eb',
  fontSize: '12px',
  fontWeight: '600',
  cursor: 'pointer',
  padding: 0,
};

const promptPanelStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '12px',
  backgroundColor: '#f8fafc',
};

const promptLabelStyle = {
  fontSize: '10px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: '#94a3b8',
  fontWeight: '700',
  marginBottom: '6px',
};

const promptContentStyle = {
  fontSize: '12px',
  color: '#475569',
  marginBottom: '10px',
  lineHeight: 1.5,
};

const promptInputLabelStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '6px',
  fontSize: '11px',
  fontWeight: '600',
  color: '#1e293b',
};

const promptInputStyle = {
  width: '100%',
  minHeight: '80px',
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '12px',
  lineHeight: 1.4,
  fontFamily: 'inherit',
};


const layoutGridStyle = (isNarrow: boolean) => ({
  display: 'grid',
  gridTemplateColumns: isNarrow ? 'minmax(0, 1fr)' : 'minmax(260px, 1fr) minmax(0, 2.2fr)',
  gap: '24px',
  alignItems: 'start',
});

const layoutLeftStyle = {
  position: 'sticky' as const,
  top: '16px',
};

const layoutRightStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '24px',
};

const listCardStyle = {
  backgroundColor: '#fff',
  borderRadius: '14px',
  padding: '16px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 10px 18px rgba(15, 23, 42, 0.06)',
};

const listTitleStyle = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#0f172a',
  marginBottom: '10px',
};

const listEmptyStyle = {
  fontSize: '12px',
  color: '#94a3b8',
};

const listWrapStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '12px',
};

const listRowStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '10px',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  backgroundColor: '#f8fafc',
};

const listHeadlineStyle = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#0f172a',
};

const listMetaStyle = {
  fontSize: '11px',
  color: '#64748b',
  marginTop: '4px',
};

const listActionsStyle = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap' as const,
};

const listButtonStyle = {
  padding: '6px 10px',
  borderRadius: '8px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#e2e8f0',
  backgroundColor: '#fff',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
};

const listButtonPrimaryStyle = {
  ...listButtonStyle,
  borderColor: '#dbeafe',
  backgroundColor: '#eff6ff',
  color: '#2563eb',
};

const listButtonDangerStyle = (disabled: boolean) => ({
  ...listButtonStyle,
  borderColor: '#fecaca',
  color: '#b91c1c',
  opacity: disabled ? 0.4 : 1,
  cursor: disabled ? 'not-allowed' : 'pointer',
});

const statusBadgeStyle = (status: BlogPostRow['status']) => ({
  display: 'inline-flex',
  padding: '3px 8px',
  borderRadius: '999px',
  fontSize: '10px',
  fontWeight: 700,
  marginTop: '6px',
  backgroundColor: status === 'active' ? '#dcfce7' : status === 'inactive' ? '#fee2e2' : '#e2e8f0',
  color: status === 'active' ? '#166534' : status === 'inactive' ? '#b91c1c' : '#475569',
});

const errorStyle = {
  marginTop: '16px',
  color: '#b91c1c',
  fontSize: '12px',
  fontWeight: 600,
};
