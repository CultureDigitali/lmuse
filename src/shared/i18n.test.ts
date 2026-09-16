import { describe, expect, it } from 'vitest';
import { t } from './i18n';

// Parità chiavi it/en: ogni chiave usata in UI deve esistere in entrambe.
const IT_KEYS = [
  'settings',
  'provider',
  'model',
  'api_key',
  'run',
  'stop',
  'copy_result',
  'inbox_title',
  'compose_ph',
  'approval_label',
  'approval_off',
  'approval_sensitive',
  'approval_all',
  'approve',
  'deny',
  'approval_title',
  'approval_timeout',
  'retry',
  'usage_line',
  'run_stats',
  'onboarding_title',
  'onboarding_body',
  'onboarding_done',
  'history_cleared',
  'history_empty',
  'copy_log',
  'clear_log',
  'privacy_off_warn',
  'host_only',
  'keep_history',
  'orphan_title',
  'orphan_retry',
  'last_run',
  'history_empty',
  'filter_all',
  'filter_tools',
  'filter_errors',
  'download_log',
  'theme_label',
  'theme_auto',
  'theme_dark',
  'theme_light',
  'lang_label',
  'templates_title',
  'template_save',
  'template_use',
  'template_delete',
  'template_ph',
  'presets_title',
  'preset_fast',
  'preset_precise',
  'preset_local',
  'trusted_title',
  'trusted_remember',
  'trusted_empty',
  'test_connection',
  'testing',
  'test_ok',
  'active_tab',
];

describe('i18n parity', () => {
  it.each(IT_KEYS)('chiave "%s" in it ed en', (key) => {
    expect(t('it', key)).not.toBe(key);
    expect(t('en', key)).not.toBe(key);
  });
  it('sostituzione variabili', () => {
    expect(t('it', 'step_of', { n: 2, max: 9 })).toContain('2');
  });
  it('fallback: chiave mancante → chiave stessa', () => {
    expect(t('it', 'chiave_che_non_esiste')).toBe('chiave_che_non_esiste');
    expect(t('en', 'chiave_che_non_esiste')).toBe('chiave_che_non_esiste');
  });
  it('variabile mancante resta placeholder', () => {
    expect(t('it', 'step_of', { n: 1 })).toContain('{max}');
  });
});
