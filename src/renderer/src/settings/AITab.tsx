/**
 * AI Settings Tab
 *
 * Compact grouped layout with horizontal tabs for:
 * - API Keys
 * - LLM
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertCircle,
  Brain,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type {
  AppSettings,
  AISettings,
} from '../../types/electron';
import { useI18n } from '../i18n';

const getProviderOptions = (t: (key: string) => string) => [
  { id: 'openai' as const, label: t('settings.ai.llm.provider.openai'), description: t('settings.ai.llm.providerDescriptions.openai') },
  { id: 'anthropic' as const, label: t('settings.ai.llm.provider.anthropic'), description: t('settings.ai.llm.providerDescriptions.anthropic') },
  { id: 'gemini' as const, label: t('settings.ai.llm.provider.gemini'), description: t('settings.ai.llm.providerDescriptions.gemini') },
  { id: 'ollama' as const, label: t('settings.ai.llm.provider.ollama'), description: t('settings.ai.llm.providerDescriptions.ollama') },
  { id: 'lm-studio' as const, label: t('settings.ai.llm.provider.lmStudio'), description: t('settings.ai.llm.providerDescriptions.lmStudio') },
  { id: 'openai-compatible' as const, label: t('settings.ai.llm.provider.openaiCompatible'), description: t('settings.ai.llm.providerDescriptions.openaiCompatible') },
];

const MODELS_BY_PROVIDER: Record<string, { id: string; label: string }[]> = {
  openai: [
    { id: 'openai-gpt-4o', label: 'GPT-4o' },
    { id: 'openai-gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'openai-gpt-4-turbo', label: 'GPT-4 Turbo' },
    { id: 'openai-o1', label: 'o1' },
    { id: 'openai-o3-mini', label: 'o3-mini' },
  ],
  anthropic: [
    { id: 'anthropic-claude-opus', label: 'Claude Opus' },
    { id: 'anthropic-claude-sonnet', label: 'Claude Sonnet' },
    { id: 'anthropic-claude-haiku', label: 'Claude Haiku' },
  ],
  gemini: [
    { id: 'gemini-gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  ],
};

const getCuratedOllamaModels = (t: (key: string) => string) => [
  { name: 'llama3.2', label: 'Llama 3.2', size: '2.0 GB', description: t('settings.ai.llm.ollama.curatedDescriptions.llama32') },
  { name: 'llama3.2:1b', label: 'Llama 3.2 (1B)', size: '1.3 GB', description: t('settings.ai.llm.ollama.curatedDescriptions.llama32_1b') },
  { name: 'mistral', label: 'Mistral 7B', size: '4.1 GB', description: t('settings.ai.llm.ollama.curatedDescriptions.mistral') },
  { name: 'codellama', label: 'Code Llama', size: '3.8 GB', description: t('settings.ai.llm.ollama.curatedDescriptions.codellama') },
  { name: 'phi3', label: 'Phi-3', size: '2.3 GB', description: t('settings.ai.llm.ollama.curatedDescriptions.phi3') },
  { name: 'gemma2', label: 'Gemma 2', size: '5.4 GB', description: t('settings.ai.llm.ollama.curatedDescriptions.gemma2') },
  { name: 'qwen2.5', label: 'Qwen 2.5', size: '4.7 GB', description: t('settings.ai.llm.ollama.curatedDescriptions.qwen25') },
  { name: 'deepseek-r1', label: 'DeepSeek R1', size: '4.7 GB', description: t('settings.ai.llm.ollama.curatedDescriptions.deepseekR1') },
];

function normalizeOllamaModelName(raw: string): string {
  return String(raw || '').trim().replace(/:latest$/i, '');
}

type TabId = 'api-keys' | 'llm';

const AITab: React.FC = () => {
  const { t } = useI18n();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('api-keys');

  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showSupermemoryKey, setShowSupermemoryKey] = useState(false);
  const [showOpenAICompatibleKey, setShowOpenAICompatibleKey] = useState(false);
  const [showLmStudioApiKey, setShowLmStudioApiKey] = useState(false);
  const [lmStudioShowApiKey, setLmStudioShowApiKey] = useState(false);
  const [lmStudioModels, setLmStudioModels] = useState<string[]>([]);
  const lmStudioFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);
  const [localModels, setLocalModels] = useState<Set<string>>(new Set());
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<{ status: string; percent: number }>({ status: '', percent: 0 });
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [ollamaError, setOllamaError] = useState<string | null>(null);

  const settingsRef = useRef<AppSettings | null>(null);
  const pullingModelRef = useRef<string | null>(null);
  const selectingOllamaDefaultRef = useRef(false);

  useEffect(() => {
    window.electron.getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const fetchLmStudioModels = useCallback((baseUrl: string) => {
    if (lmStudioFetchTimerRef.current) clearTimeout(lmStudioFetchTimerRef.current);
    lmStudioFetchTimerRef.current = setTimeout(() => {
      const url = baseUrl.trim().replace(/\/+$/, '');
      const modelsUrl = url.endsWith('/v1') ? `${url}/models` : `${url}/v1/models`;
      fetch(modelsUrl)
        .then((r) => r.json())
        .then((json) => {
          const ids: string[] = (json?.data ?? []).map((m: { id: string }) => m.id).filter(Boolean);
          setLmStudioModels(ids);
        })
        .catch(() => setLmStudioModels([]));
    }, 300);
  }, []);

  useEffect(() => {
    if (settings?.ai?.provider === 'lm-studio') {
      fetchLmStudioModels(settings.ai.lmStudioBaseUrl || 'http://127.0.0.1:1234/v1');
    }
  }, [settings?.ai?.provider, settings?.ai?.lmStudioBaseUrl, fetchLmStudioModels]);

  const updateAI = async (patch: Partial<AISettings>) => {
    if (!settings) return;
    const newAI = { ...settings.ai, ...patch };
    // Apply locally first so controlled inputs reflect the new value
    // immediately. Without this, a slow IPC round-trip (notably on Intel
    // Macs, where fs.writeFileSync blocks longer) keeps `value` at the stale
    // state, and any unrelated re-render during the wait snaps the DOM back,
    // visually "eating" pasted text even though the patch is already saved.
    setSettings((prev) => (prev ? { ...prev, ai: newAI } : prev));
    const updated = await window.electron.saveSettings({ ai: newAI } as any);
    setSettings(updated);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 1600);
  };

  const maybeSelectOllamaDefaultModel = useCallback((availableNames: string[], preferredName?: string) => {
    const currentSettings = settingsRef.current;
    if (!currentSettings) return;
    if (currentSettings.ai.provider !== 'ollama') return;
    if (availableNames.length === 0) return;

    const configuredDefault = String(currentSettings.ai.defaultModel || '').trim();
    const configuredName = configuredDefault.startsWith('ollama-')
      ? normalizeOllamaModelName(configuredDefault.slice('ollama-'.length))
      : '';
    if (configuredName && availableNames.includes(configuredName)) return;

    const preferred = normalizeOllamaModelName(preferredName || '');
    const targetName = preferred && availableNames.includes(preferred)
      ? preferred
      : availableNames[0];
    const nextDefault = `ollama-${targetName}`;
    if (configuredDefault === nextDefault || selectingOllamaDefaultRef.current) return;

    selectingOllamaDefaultRef.current = true;
    window.electron.saveSettings({
      ai: {
        ...currentSettings.ai,
        defaultModel: nextDefault,
      },
    } as any).then((updated) => {
      settingsRef.current = updated;
      setSettings(updated);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1600);
    }).catch(() => {}).finally(() => {
      selectingOllamaDefaultRef.current = false;
    });
  }, []);

  const refreshOllamaStatus = useCallback((preferredModelName?: string) => {
    setOllamaRunning(null);
    window.electron.ollamaStatus().then((result) => {
      setOllamaRunning(result.running);
      if (result.running) {
        const names = Array.from(new Set(
          result.models
            .map((m: any) => normalizeOllamaModelName(m?.name))
            .filter(Boolean)
        ));
        setLocalModels(new Set(names));
        maybeSelectOllamaDefaultModel(names, preferredModelName);
      } else {
        setLocalModels(new Set());
      }
    });
  }, [maybeSelectOllamaDefaultModel]);

  useEffect(() => {
    if (!settings) return;
    refreshOllamaStatus();
  }, [settings?.ai?.ollamaBaseUrl, settings?.ai?.provider, refreshOllamaStatus]);

  useEffect(() => {
    window.electron.onOllamaPullProgress((data) => {
      const percent = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
      setPullProgress({ status: data.status, percent });
    });
    window.electron.onOllamaPullDone(() => {
      const preferredModel = pullingModelRef.current || undefined;
      pullingModelRef.current = null;
      setPullingModel(null);
      setPullProgress({ status: '', percent: 0 });
      refreshOllamaStatus(preferredModel);
    });
    window.electron.onOllamaPullError((data) => {
      setPullingModel(null);
      setPullProgress({ status: '', percent: 0 });
      setOllamaError(data.error);
      setTimeout(() => setOllamaError(null), 5000);
    });
  }, [refreshOllamaStatus]);

  const handlePull = (modelName: string) => {
    const requestId = `ollama-pull-${Date.now()}`;
    pullingModelRef.current = modelName;
    setPullingModel(modelName);
    setPullProgress({ status: t('settings.ai.llm.ollama.startingDownload'), percent: 0 });
    setOllamaError(null);
    window.electron.ollamaPull(requestId, modelName);
  };

  const handleDelete = async (modelName: string) => {
    setDeletingModel(modelName);
    setOllamaError(null);
    const result = await window.electron.ollamaDelete(modelName);
    if (result.success) {
      setLocalModels((prev) => {
        const next = new Set(prev);
        next.delete(modelName);
        return next;
      });
    } else {
      setOllamaError(result.error || t('settings.ai.llm.ollama.deleteFailed'));
      setTimeout(() => setOllamaError(null), 5000);
    }
    setDeletingModel(null);
  };

  if (!settings) {
    return <div className="p-5 text-[var(--text-muted)] text-[0.75rem]">{t('common.loading')}</div>;
  }

  const ai = settings.ai;

  const genericModels = ai.provider === 'ollama' && ollamaRunning
    ? Array.from(localModels).map((name) => ({
        id: `ollama-${name}`,
        label: getCuratedOllamaModels(t).find((m) => m.name === name)?.label || name,
      }))
    : ai.provider === 'openai-compatible' && ai.openaiCompatibleModel
      ? [{
          id: `openai-compatible-${ai.openaiCompatibleModel}`,
          label: ai.openaiCompatibleModel,
        }]
      : ai.provider === 'lm-studio'
        ? lmStudioModels.map((id) => ({ id: `lm-studio-${id}`, label: id }))
        : MODELS_BY_PROVIDER[ai.provider] || [];

  const TabButton = ({ id, label }: { id: TabId; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-2.5 py-1 rounded-md text-[0.75rem] font-medium transition-colors ${
        activeTab === id
          ? 'bg-[var(--ui-segment-active-bg)] text-[var(--text-primary)] border border-[var(--ui-segment-border)]'
          : 'bg-[var(--ui-segment-bg)] text-[var(--text-muted)] border border-[var(--ui-divider)] hover:text-[var(--text-secondary)] hover:bg-[var(--ui-segment-hover-bg)]'
      }`}
    >
      {label}
    </button>
  );

  const AIRow: React.FC<{
    icon: React.ReactNode;
    title: string;
    description: string;
    withBorder?: boolean;
    children: React.ReactNode;
  }> = ({ icon, title, description, withBorder = true, children }) => (
    <div
      className={`grid gap-3 px-4 py-3.5 md:px-5 md:grid-cols-[220px_minmax(0,1fr)] ${
        withBorder ? 'border-b border-[var(--ui-divider)]' : ''
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 text-[var(--text-muted)] shrink-0">{icon}</div>
        <div className="min-w-0">
          <h3 className="text-[0.8125rem] font-semibold text-[var(--text-primary)]">{title}</h3>
          <p className="mt-0.5 text-[0.75rem] text-[var(--text-muted)] leading-snug">{description}</p>
        </div>
      </div>
      <div className="flex items-center min-h-[32px]">{children}</div>
    </div>
  );

  const SectionToggle = ({
    enabled,
    onToggle,
    label,
  }: {
    enabled: boolean;
    onToggle: () => void;
    label: string;
  }) => (
    <button
      onClick={onToggle}
      className={`relative w-10 h-6 rounded-full border transition-colors ${
        enabled
          ? 'bg-[var(--accent)] border-[var(--accent-hover)]'
          : 'bg-[var(--ui-segment-bg)] border-[var(--ui-segment-border)]'
      }`}
      aria-label={label}
    >
      <span
        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border shadow-sm transition-all ${
          enabled
            ? 'right-0.5 left-auto bg-[var(--bg-overlay-strong)] border-[var(--ui-segment-border)]'
            : 'left-0.5 right-auto bg-[var(--bg-overlay-strong)] border-[var(--ui-segment-border)]'
        }`}
      />
    </button>
  );

  return (
    <div className="w-full max-w-[980px] mx-auto">
      <div className="overflow-hidden rounded-xl border border-[var(--ui-panel-border)] bg-[var(--settings-panel-bg)]">
      <AIRow
        icon={<Brain className="w-4 h-4" />}
        title={t('settings.ai.enableAI.title')}
        description={t('settings.ai.enableAI.description')}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateAI({ enabled: !ai.enabled })}
            className={`relative w-10 h-6 rounded-full border transition-colors ${
              ai.enabled
                ? 'bg-[var(--accent)] border-[var(--accent-hover)]'
                : 'bg-[var(--ui-segment-bg)] border-[var(--ui-segment-border)]'
            }`}
          >
            <span
              className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border shadow-sm transition-all ${
                ai.enabled
                  ? 'right-0.5 left-auto bg-[var(--bg-overlay-strong)] border-[var(--ui-segment-border)]'
                  : 'left-0.5 right-auto bg-[var(--bg-overlay-strong)] border-[var(--ui-segment-border)]'
              }`}
            />
          </button>
          {saveStatus === 'saved' && <span className="text-[0.75rem] text-green-400">{t('settings.ai.saved')}</span>}
        </div>
      </AIRow>

      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[var(--ui-divider)] md:px-5 overflow-x-auto">
        <TabButton id="api-keys" label={t('settings.ai.tabs.apiKeys')} />
        <TabButton id="llm" label={t('settings.ai.tabs.llm')} />
      </div>

      <div className={`${!ai.enabled ? 'opacity-65 pointer-events-none select-none' : ''}`}>
        {(activeTab === 'api-keys' || activeTab === 'llm') && (
          <div className="grid grid-cols-1">
            <div className={`px-4 py-3.5 md:px-5 space-y-3 ${activeTab === 'llm' ? 'hidden' : ''}`}>
                <div>
                  <label className="text-[0.75rem] text-[var(--text-secondary)] mb-1 block">{t('settings.ai.apiKeys.openai.label')}</label>
                  <div className="relative">
                    <input
                      type={showOpenAIKey ? 'text' : 'password'}
                      value={ai.openaiApiKey}
                      onChange={(e) => updateAI({ openaiApiKey: e.target.value.trim() })}
                      placeholder={t('settings.ai.apiKeys.openai.placeholder')}
                      className="sc-input pr-9"
                    />
                    <button
                      onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    >
                      {showOpenAIKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[0.75rem] text-[var(--text-secondary)] mb-1 block">{t('settings.ai.apiKeys.anthropic.label')}</label>
                  <div className="relative">
                    <input
                      type={showAnthropicKey ? 'text' : 'password'}
                      value={ai.anthropicApiKey}
                      onChange={(e) => updateAI({ anthropicApiKey: e.target.value.trim() })}
                      placeholder={t('settings.ai.apiKeys.anthropic.placeholder')}
                      className="sc-input pr-9"
                    />
                    <button
                      onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    >
                      {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[0.75rem] text-[var(--text-secondary)] mb-1 block">{t('settings.ai.apiKeys.gemini.label')}</label>
                  <div className="relative">
                    <input
                      type={showGeminiKey ? 'text' : 'password'}
                      value={ai.geminiApiKey || ''}
                      onChange={(e) => updateAI({ geminiApiKey: e.target.value.trim() })}
                      placeholder={t('settings.ai.apiKeys.gemini.placeholder')}
                      className="sc-input pr-9"
                    />
                    <button
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    >
                      {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-1 border-t border-[var(--ui-divider)]">
                  <p className="text-[0.8125rem] font-semibold text-[var(--text-primary)]">{t('settings.ai.apiKeys.supermemory.title')}</p>
                  <p className="text-[0.75rem] text-[var(--text-muted)] mt-0.5 leading-snug">{t('settings.ai.apiKeys.supermemory.description')}</p>
                </div>

                <div>
                  <label className="text-[0.75rem] text-[var(--text-secondary)] mb-1 block">{t('settings.ai.apiKeys.supermemory.apiKey.label')}</label>
                  <div className="relative">
                    <input
                      type={showSupermemoryKey ? 'text' : 'password'}
                      value={ai.supermemoryApiKey || ''}
                      onChange={(e) => updateAI({ supermemoryApiKey: e.target.value.trim() })}
                      placeholder={t('settings.ai.apiKeys.supermemory.apiKey.placeholder')}
                      className="sc-input pr-9"
                    />
                    <button
                      onClick={() => setShowSupermemoryKey(!showSupermemoryKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    >
                      {showSupermemoryKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[0.75rem] text-[var(--text-secondary)] mb-1 block">{t('settings.ai.apiKeys.supermemory.client.label')}</label>
                  <input
                    type="text"
                    value={ai.supermemoryClient || ''}
                    onChange={(e) => updateAI({ supermemoryClient: e.target.value.trim() })}
                    placeholder={t('settings.ai.apiKeys.supermemory.client.placeholder')}
                    className="sc-input"
                  />
                  <p className="text-[0.625rem] text-[var(--text-muted)] mt-1">{t('settings.ai.apiKeys.supermemory.client.hint')}</p>
                </div>

                <div>
                  <label className="text-[0.75rem] text-[var(--text-secondary)] mb-1 block">{t('settings.ai.apiKeys.supermemory.baseUrl.label')}</label>
                  <input
                    type="text"
                    value={ai.supermemoryBaseUrl || 'https://api.supermemory.ai'}
                    onChange={(e) => updateAI({ supermemoryBaseUrl: e.target.value.trim() })}
                    placeholder="https://api.supermemory.ai"
                    className="sc-input"
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-[0.6875rem] text-[var(--text-muted)]">
                  <input
                    type="checkbox"
                    checked={Boolean(ai.supermemoryLocalMode)}
                    onChange={(e) => updateAI({ supermemoryLocalMode: e.target.checked })}
                    className="settings-checkbox"
                  />
                  <span>{t('settings.ai.apiKeys.supermemory.localMode')}</span>
                </label>
            </div>

            <div className={`px-4 py-3.5 md:px-5 space-y-3 self-start ${activeTab === 'llm' ? '' : 'hidden'}`}>
              <div className="flex items-center justify-between gap-3 pb-1">
                <div>
                  <h3 className="text-[0.8125rem] font-semibold text-[var(--text-primary)]">{t('settings.ai.llm.enableLLM.title')}</h3>
                  <p className="text-[0.75rem] text-[var(--text-muted)] mt-0.5 leading-snug">{t('settings.ai.llm.enableLLM.description')}</p>
                </div>
                <SectionToggle
                  enabled={ai.llmEnabled !== false}
                  onToggle={() => updateAI({ llmEnabled: ai.llmEnabled === false })}
                  label={t('settings.ai.llm.enableLLM.title')}
                />
              </div>

              <div className={`${ai.llmEnabled === false ? 'opacity-65 pointer-events-none select-none' : ''}`}>
              <div>
                <h3 className="text-[0.8125rem] font-semibold text-[var(--text-primary)]">{t('settings.ai.llm.modelSelection.title')}</h3>
                <p className="text-[0.75rem] text-[var(--text-muted)] mt-0.5 leading-snug">{t('settings.ai.llm.modelSelection.description')}</p>
              </div>

              <div>
                  <label className="text-[0.75rem] text-[var(--text-secondary)] mb-1 block">{t('settings.ai.llm.provider.label')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {getProviderOptions(t).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          if (p.id === 'ollama') {
                            const firstInstalled = Array.from(localModels)[0];
                            const nextDefault = firstInstalled ? `ollama-${firstInstalled}` : '';
                            updateAI({ provider: p.id, defaultModel: nextDefault });
                            return;
                          }
                          if (p.id === 'openai-compatible') {
                            const nextDefault = ai.openaiCompatibleModel ? `openai-compatible-${ai.openaiCompatibleModel}` : '';
                            updateAI({ provider: p.id, defaultModel: nextDefault });
                            return;
                          }
                          if (p.id === 'lm-studio') {
                            updateAI({ provider: p.id, defaultModel: '' });
                            return;
                          }
                          updateAI({ provider: p.id, defaultModel: '' });
                        }}
                        className={`rounded-md border px-2 py-2 text-left transition-colors ${
                          ai.provider === p.id
                            ? 'bg-[var(--launcher-card-selected-bg)] border-[var(--launcher-card-selected-border)] text-[var(--text-primary)]'
                            : 'bg-[var(--ui-segment-bg)] border-[var(--ui-divider)] text-[var(--text-muted)] hover:bg-[var(--ui-segment-bg)]'
                        }`}
                      >
                        <div className="text-xs font-medium leading-tight">{p.label}</div>
                        <div className="text-[0.625rem] text-[var(--text-subtle)] mt-0.5 leading-tight">{p.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {ai.provider === 'ollama' && (
                  <div>
                    <label className="text-[0.75rem] text-[var(--text-muted)] mb-1 block">{t('settings.ai.llm.ollama.serverUrl.label')}</label>
                    <input
                      type="text"
                      value={ai.ollamaBaseUrl}
                      onChange={(e) => updateAI({ ollamaBaseUrl: e.target.value.trim() })}
                      placeholder="http://localhost:11434"
                      className="sc-input"
                    />
                  </div>
                )}

                {ai.provider === 'lm-studio' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[0.75rem] text-[var(--text-muted)] mb-1 block">{t('settings.ai.llm.lmStudio.baseUrl.label')}</label>
                      <input
                        type="text"
                        value={ai.lmStudioBaseUrl}
                        onChange={(e) => {
                          const url = e.target.value.trim();
                          updateAI({ lmStudioBaseUrl: url });
                          fetchLmStudioModels(url || 'http://127.0.0.1:1234/v1');
                        }}
                        placeholder="http://127.0.0.1:1234/v1"
                        className="sc-input"
                      />
                      <p className="text-[0.625rem] text-[var(--text-subtle)] mt-1">{t('settings.ai.llm.lmStudio.baseUrl.hint')}</p>
                    </div>

                    <div>
                      <button
                        type="button"
                        className="text-[0.75rem] text-[var(--text-muted)] flex items-center gap-1 hover:text-[var(--text-default)] transition-colors"
                        onClick={() => setShowLmStudioApiKey((v) => !v)}
                      >
                        {showLmStudioApiKey ? <EyeOff size={12} /> : <Eye size={12} />}
                        {t('settings.ai.llm.lmStudio.apiKey.toggle')}
                      </button>
                      {showLmStudioApiKey && (
                        <div className="mt-2">
                          <div className="relative">
                            <input
                              type={lmStudioShowApiKey ? 'text' : 'password'}
                              value={ai.lmStudioApiKey ?? ''}
                              onChange={(e) => updateAI({ lmStudioApiKey: e.target.value })}
                              placeholder={t('settings.ai.llm.lmStudio.apiKey.placeholder')}
                              className="sc-input pr-8"
                            />
                            <button
                              type="button"
                              onClick={() => setLmStudioShowApiKey((v) => !v)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-default)]"
                            >
                              {lmStudioShowApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                          <p className="text-[0.625rem] text-[var(--text-subtle)] mt-1">{t('settings.ai.llm.lmStudio.apiKey.hint')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {ai.provider === 'openai-compatible' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[0.75rem] text-[var(--text-muted)] mb-1 block">{t('settings.ai.llm.openaiCompatible.baseUrl.label')}</label>
                      <input
                        type="text"
                        value={ai.openaiCompatibleBaseUrl}
                        onChange={(e) => updateAI({ openaiCompatibleBaseUrl: e.target.value.trim() })}
                        placeholder="https://api.openrouter.ai/v1"
                        className="sc-input"
                      />
                      <p className="text-[0.625rem] text-[var(--text-subtle)] mt-1">{t('settings.ai.llm.openaiCompatible.baseUrl.hint')}</p>
                      <label className="inline-flex items-center gap-2 text-[0.6875rem] text-[var(--text-muted)] mt-1.5">
                        <input
                          type="checkbox"
                          checked={ai.openaiCompatibleAppendV1 !== false}
                          onChange={(e) => updateAI({ openaiCompatibleAppendV1: e.target.checked })}
                          className="settings-checkbox"
                        />
                        <span>{t('settings.ai.llm.openaiCompatible.baseUrl.appendV1')}</span>
                      </label>
                    </div>

                    <div>
                      <label className="text-[0.75rem] text-[var(--text-muted)] mb-1 block">{t('settings.ai.llm.openaiCompatible.apiKey.label')}</label>
                      <div className="relative">
                        <input
                          type={showOpenAICompatibleKey ? 'text' : 'password'}
                          value={ai.openaiCompatibleApiKey}
                          onChange={(e) => updateAI({ openaiCompatibleApiKey: e.target.value.trim() })}
                          placeholder="sk-..."
                          className="sc-input pr-9"
                        />
                        <button
                          onClick={() => setShowOpenAICompatibleKey(!showOpenAICompatibleKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] hover:text-[var(--text-muted)]"
                        >
                          {showOpenAICompatibleKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[0.75rem] text-[var(--text-muted)] mb-1 block">{t('settings.ai.llm.openaiCompatible.modelName.label')}</label>
                      <input
                        type="text"
                        value={ai.openaiCompatibleModel}
                        onChange={(e) => {
                          const modelName = e.target.value.trim();
                          updateAI({
                            openaiCompatibleModel: modelName,
                            defaultModel: modelName ? `openai-compatible-${modelName}` : ''
                          });
                        }}
                        placeholder="anthropic/claude-3.5-sonnet"
                        className="sc-input"
                      />
                      <p className="text-[0.625rem] text-[var(--text-subtle)] mt-1">{t('settings.ai.llm.openaiCompatible.modelName.hint')}</p>
                    </div>
                  </div>
                )}

                <div className="mt-2">
                  <label className="text-[0.75rem] text-[var(--text-muted)] mb-1 block">{t('settings.ai.llm.defaultModel.label')}</label>
                  <select
                    value={ai.defaultModel}
                    onChange={(e) => updateAI({ defaultModel: e.target.value })}
                    className="sc-select"
                  >
                    <option value="">{t('settings.ai.llm.defaultModel.auto')}</option>
                    {genericModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

              {ai.provider === 'ollama' && (
                <div className="pt-3 border-t border-[var(--ui-divider)]">
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-[0.8125rem] font-semibold text-[var(--text-primary)]">{t('settings.ai.llm.ollama.models')}</h3>
                    {ollamaRunning && (
                      <button
                        onClick={refreshOllamaStatus}
                        className="flex items-center gap-1 px-2 py-1 text-[0.75rem] text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-md transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        {t('common.refresh')}
                      </button>
                    )}
                  </div>

                  {ollamaRunning === null && (
                    <div className="flex items-center gap-2 text-[var(--text-subtle)] text-xs py-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      {t('settings.ai.llm.ollama.checking')}
                    </div>
                  )}

                  {ollamaRunning === false && (
                    <div className="text-center py-4">
                      <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-2.5">
                        <AlertCircle className="w-4 h-4 text-red-400/70" />
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mb-0.5">{t('settings.ai.llm.ollama.notRunning.title')}</p>
                      <p className="text-[0.75rem] text-[var(--text-subtle)] mb-3">{t('settings.ai.llm.ollama.notRunning.description')}</p>
                      <button
                        onClick={() => window.electron.ollamaOpenDownload()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-md transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {t('settings.ai.llm.ollama.notRunning.download')}
                        <ExternalLink className="w-3 h-3 text-blue-300/60" />
                      </button>
                    </div>
                  )}

                  {ollamaRunning === true && (
                    <>
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        <span className="text-[0.6875rem] text-green-400/70">{t('settings.ai.llm.ollama.running')}</span>
                      </div>

                      {ollamaError && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-md px-2.5 py-2 mb-2.5">
                          <p className="text-[0.6875rem] text-red-400">{ollamaError}</p>
                        </div>
                      )}

                      <div className="space-y-1 max-h-[min(46vh,360px)] overflow-y-auto pr-1">
                        {getCuratedOllamaModels(t).map((model) => {
                          const installed = localModels.has(model.name);
                          const isPulling = pullingModel === model.name;
                          const isDeleting = deletingModel === model.name;

                          return (
                            <div key={model.name} className="rounded-md border border-[var(--ui-divider)] bg-[var(--ui-segment-bg)] px-2.5 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs text-[var(--text-secondary)]">{model.label}</span>
                                    <span className="text-[0.625rem] text-[var(--text-subtle)]">{model.size}</span>
                                    {installed && (
                                      <span className="text-[0.625rem] font-medium px-1.5 py-0.5 rounded border border-[color:var(--status-success)] bg-[color:var(--status-success-soft)] text-[color:var(--status-success)]">{t('settings.ai.llm.ollama.installed')}</span>
                                    )}
                                  </div>
                                  <p className="text-[0.75rem] text-[var(--text-subtle)] mt-0.5">{model.description}</p>
                                </div>

                                {isPulling ? (
                                  <div className="flex items-center gap-1 text-[0.6875rem] text-[var(--text-muted)]">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    {pullProgress.percent > 0 ? `${pullProgress.percent}%` : '...'}
                                  </div>
                                ) : isDeleting ? (
                                  <div className="flex items-center gap-1 text-[0.6875rem] text-[var(--text-muted)]">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    {t('settings.ai.llm.ollama.removing')}
                                  </div>
                                ) : installed ? (
                                  <button
                                    onClick={() => handleDelete(model.name)}
                                    disabled={!!pullingModel}
                                    className="flex items-center gap-1 px-2 py-1 text-[0.6875rem] text-red-300/80 hover:text-red-200 hover:bg-red-500/10 rounded-md transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    {t('settings.ai.llm.ollama.removeModel')}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handlePull(model.name)}
                                    disabled={!!pullingModel}
                                    className="flex items-center gap-1 px-2 py-1 text-[0.6875rem] text-blue-300 hover:text-blue-200 bg-blue-500/10 hover:bg-blue-500/20 rounded-md transition-colors disabled:opacity-40"
                                  >
                                    <Download className="w-3 h-3" />
                                    {t('settings.ai.llm.ollama.downloadModel')}
                                  </button>
                                )}
                              </div>

                              {isPulling && pullProgress.percent > 0 && (
                                <div className="mt-2">
                                  <div className="w-full h-1.5 bg-[var(--ui-segment-bg)] rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                      style={{ width: `${pullProgress.percent}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        )}

      </div>
      </div>
    </div>
  );
};

export default AITab;
