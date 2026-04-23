'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { buildWebAssetUrl } from '@/utils/assets';
import FullscreenLoader from '@/components/ui/FullscreenLoader';
import workspaceStyles from './styles/workspace.module.css';

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

export default function BlogManager({ config, onNavigateToTexts }: BlogManagerProps) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
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
  const [llmOptionsLoading, setLlmOptionsLoading] = useState(false);
  const [llmOptionsLoaded, setLlmOptionsLoaded] = useState(false);
  const llmOptionsRequestRef = useRef<Promise<LlmIntegrationOption[]> | null>(null);

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
    setHeadline('');
    setSubline('');
    setBodyMd('');
    setCustomPrompt('');
    setSelectedPostId(null);
  }, [areaId]);

  useEffect(() => {
    async function loadWorkspace() {
      if (!areaId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          area_id: areaId,
          bundesland_slug: bundeslandSlug,
          kreis_slug: kreisSlug,
        });
        const res = await fetch(`/api/partner/blog/workspace?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = await res.json().catch(() => null) as {
          author_name?: string;
          source?: BlogSource;
          posts?: BlogPostRow[];
          error?: string;
        } | null;
        if (!res.ok) {
          setError(payload?.error || 'Blog-Daten konnten nicht geladen werden.');
          return;
        }
        setAuthorName(String(payload?.author_name ?? '').trim());
        setSource({
          individual01: String(payload?.source?.individual01 ?? ''),
          individual02: String(payload?.source?.individual02 ?? ''),
          zitat: String(payload?.source?.zitat ?? ''),
        });
        setPosts(Array.isArray(payload?.posts) ? payload.posts : []);
      } catch (err) {
        console.error(err);
        setError('Blog-Daten konnten nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    }

    loadWorkspace();
  }, [areaId, bundeslandSlug, kreisSlug, saving]);

  const ensureLlmOptions = useCallback(async (): Promise<LlmIntegrationOption[]> => {
    if (llmOptionsLoaded) return llmOptions;
    if (llmOptionsRequestRef.current) return llmOptionsRequestRef.current;
    const request = (async () => {
      setLlmOptionsLoading(true);
      try {
        const integrationsRes = await fetch('/api/partner/llm/options');
        if (!integrationsRes.ok) {
          setLlmOptions([]);
          setSelectedLlmIntegrationId('');
          setLlmOptionsLoaded(true);
          return [];
        }
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
        setLlmOptionsLoaded(true);
        return nextOptions;
      } catch (err) {
        console.error(err);
        setLlmOptions([]);
        setSelectedLlmIntegrationId('');
        setLlmOptionsLoaded(true);
        return [];
      } finally {
        setLlmOptionsLoading(false);
      }
    })();
    llmOptionsRequestRef.current = request;
    try {
      return await request;
    } finally {
      llmOptionsRequestRef.current = null;
    }
  }, [llmOptions, llmOptionsLoaded]);

  useEffect(() => {
    void ensureLlmOptions();
  }, [ensureLlmOptions]);

  const handleGenerate = async () => {
    if (!areaName || !hasAllSources) return;
    setGenerating(true);
    setError(null);
    try {
      const availableOptions = llmOptions.length > 0 ? llmOptions : await ensureLlmOptions();
      const selectedOption = availableOptions.find((item) => item.id === (selectedLlmIntegrationId || availableOptions[0]?.id)) ?? null;
      if (!selectedOption) {
        setError('Keine aktive LLM-Integration verfügbar.');
        return;
      }
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
    <div className="w-100">
      <section className="mb-3">
        <div className={workspaceStyles.workspaceTopControlCard}>
          <div className={workspaceStyles.workspaceTopControlRow}>
            <div className={workspaceStyles.workspaceTopControlFieldModel}>
              <select
                value={selectedLlmIntegrationId || llmOptions[0]?.id || ''}
                onChange={(e) => setSelectedLlmIntegrationId(e.target.value)}
                className={`form-select fw-semibold ${workspaceStyles.workspaceTopControlSelect}`}
                aria-label="KI-Modell auswählen"
                disabled={llmOptionsLoading || (llmOptionsLoaded && llmOptions.length === 0)}
              >
                {!llmOptionsLoaded || llmOptionsLoading ? <option value="">Modelle werden geladen...</option> : null}
                {llmOptionsLoaded && llmOptions.length === 0 ? <option value="">Kein LLM verfügbar</option> : null}
                {llmOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>
      <div className="row g-3 g-xl-4 align-items-start">
        <section className="col-12 col-xl-4">
          <div className="bg-white border rounded-4 p-3 shadow-sm">
            <div className="m-0 mb-3 fs-6 fw-bold text-dark">Blog-Übersicht</div>
            {posts.length === 0 ? (
              <div className="small text-secondary">Keine Blogartikel vorhanden.</div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {posts.map((post) => (
                  <div key={post.id} className="d-flex flex-column gap-2 p-3 rounded-3 border bg-light">
                    <div>
                      <div className="small fw-bold text-dark">{post.headline || 'Ohne Titel'}</div>
                      <div className="small text-secondary mt-1">
                        {post.created_at ? new Date(post.created_at).toLocaleString('de-DE') : '—'}
                      </div>
                      <div
                        className={`badge rounded-pill mt-2 ${
                          post.status === 'active'
                            ? 'text-success bg-success-subtle'
                            : post.status === 'inactive'
                              ? 'text-danger bg-danger-subtle'
                              : 'text-secondary bg-secondary-subtle'
                        }`}
                      >
                        {post.status === 'active' ? 'Aktiv' : post.status === 'inactive' ? 'Inaktiv' : 'Entwurf'}
                      </div>
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      <button type="button" onClick={() => handleEdit(post)} className="btn btn-sm btn-outline-secondary fw-semibold">
                        Bearbeiten
                      </button>
                      {post.status !== 'active' ? (
                        <button type="button" onClick={() => updateStatus(post.id, 'active')} className="btn btn-sm btn-outline-primary fw-semibold">
                          Aktivieren
                        </button>
                      ) : (
                        <button type="button" onClick={() => updateStatus(post.id, 'inactive')} className="btn btn-sm btn-outline-secondary fw-semibold">
                          Deaktivieren
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(post.id, post.status)}
                        className="btn btn-sm btn-outline-danger fw-semibold"
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
        </section>

        <section className="col-12 col-xl-8 d-flex flex-column gap-3">
          <div className="bg-white border rounded-4 p-3 p-xl-4 shadow-sm">
            <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-3">
              <div>
                <div className="small text-secondary text-uppercase fw-bold">Quelle</div>
                <div className="fs-5 fw-bold text-dark">Marktüberblick – Individuelle Texte</div>
              </div>
              <div
                className={`badge rounded-pill px-3 py-2 ${
                  hasAllSources ? 'text-success bg-success-subtle' : 'text-danger bg-danger-subtle'
                }`}
              >
                {hasAllSources ? 'Quellen vollständig' : 'Quellen unvollständig'}
              </div>
            </div>
            {!hasAllSources ? (
              <div className="alert alert-danger py-2 px-3 small">
                <div className="fw-bold mb-2">Bitte ergänzen in „Berichte &amp; Texte → Marktüberblick“:</div>
                <div className="d-flex flex-wrap gap-2">
                  {missingSources.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className="btn btn-sm btn-outline-danger rounded-pill fw-semibold"
                      onClick={() => onNavigateToTexts?.(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="d-flex flex-column gap-3">
              <div>
                <div className="small fw-bold text-dark mb-2">Zitat</div>
                <div className="bg-light border rounded-3 p-3 small text-secondary lh-base text-break">
                  {source.zitat || 'Kein Override vorhanden.'}
                </div>
              </div>
              <div className="row g-3">
                <div className="col-12 col-lg-6">
                  <div className="small fw-bold text-dark mb-2">Experteneinschätzung Text 01</div>
                  <div className="bg-light border rounded-3 p-3 small text-secondary lh-base text-break h-100">
                    {source.individual01 || 'Kein Override vorhanden.'}
                  </div>
                </div>
                <div className="col-12 col-lg-6">
                  <div className="small fw-bold text-dark mb-2">Experteneinschätzung Text 02</div>
                  <div className="bg-light border rounded-3 p-3 small text-secondary lh-base text-break h-100">
                    {source.individual02 || 'Kein Override vorhanden.'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-4 p-3 p-xl-4 shadow-sm">
            <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-3">
              <div>
                <div className="small text-secondary text-uppercase fw-bold">Blog-Generator</div>
                <div className="fs-5 fw-bold text-dark">Headline, Subline &amp; Blogtext</div>
              </div>
            </div>

            <div className="d-flex flex-column gap-3">
              <label className="form-label small fw-semibold text-dark mb-0 d-flex flex-column gap-1">
                <span>Headline</span>
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="form-control"
                  placeholder="Headline"
                />
              </label>
              <label className="form-label small fw-semibold text-dark mb-0 d-flex flex-column gap-1">
                <span>Subline</span>
                <input
                  value={subline}
                  onChange={(e) => setSubline(e.target.value)}
                  className="form-control"
                  placeholder="Subline"
                />
              </label>
              <label className="form-label small fw-semibold text-dark mb-0 d-flex flex-column gap-1">
                <span>Blog (Markdown)</span>
                <textarea
                  value={bodyMd}
                  onChange={(e) => setBodyMd(e.target.value)}
                  className="form-control"
                  rows={10}
                  placeholder="Markdown-Text"
                />
              </label>

              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="btn btn-sm btn-outline-primary fw-semibold px-3 py-2"
                  disabled={!hasAllSources || generating || llmOptionsLoading || (llmOptionsLoaded && llmOptions.length === 0)}
                >
                  {generating ? '⏳ KI generiert Blog...' : '✨ Blog per KI generieren'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn btn-sm btn-dark fw-semibold px-3 py-2"
                  disabled={!headline || !bodyMd || saving}
                >
                  {saving ? 'Speichern...' : selectedPostId ? 'Änderungen speichern' : 'Blog speichern'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowPrompt((prev) => !prev)}
                className="btn btn-sm btn-outline-secondary fw-semibold align-self-start"
              >
                {showPrompt ? 'Prompt ausblenden' : 'Prompt anzeigen'}
              </button>
              {showPrompt ? (
                <div className="border rounded-3 p-3 bg-light">
                  <div className="small text-secondary text-uppercase fw-bold mb-2">Standard-Prompt</div>
                  <div className="small text-secondary lh-base mb-2">
                    Schreibe einen kompakten Blogartikel auf Basis der drei Quellen (Individuell 01/02 + Zitat).
                    Keine neuen Fakten, sachlich, 2–4 Abschnitte, klare Headline und Subline.
                  </div>
                  <label className="form-label small fw-semibold text-dark mb-0 d-flex flex-column gap-1">
                    <span>Eigener Prompt (optional)</span>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      className="form-control form-control-sm"
                      rows={4}
                      placeholder="Eigene Zusatzvorgaben (werden zum Standard-Prompt ergänzt)"
                    />
                  </label>
                </div>
              ) : null}
            </div>

            {error ? <div className="alert alert-danger small fw-semibold mt-3 mb-0">{error}</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
