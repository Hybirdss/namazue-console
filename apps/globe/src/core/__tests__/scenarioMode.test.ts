import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('toggleScenarioMode', () => {
  it('shows the strengthened beta disclaimer before enabling scenario mode', async () => {
    const confirmSpy = vi.fn((_message?: string) => false);
    vi.stubGlobal('confirm', confirmSpy);

    const { setLocale } = await import('../../i18n');
    setLocale('en');

    const { consoleStore, toggleScenarioMode } = await import('../store');
    consoleStore.set('scenarioMode', false);

    toggleScenarioMode();

    const message = confirmSpy.mock.calls[0]?.[0] ?? '';

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(message).toContain('beta simulation feature');
    expect(message).toContain('Errors, omissions, or delays may exist');
    expect(message).toContain('official agencies and primary sources');
    expect(consoleStore.get('scenarioMode')).toBe(false);
  });
});
