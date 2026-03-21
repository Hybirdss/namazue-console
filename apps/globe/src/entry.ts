import { resolveAppRoute } from './namazue/routeModel';
import { showStartupFailure } from './core/startupRecovery';

async function start(): Promise<void> {
  if (window.location.pathname === '/legacy' || window.location.pathname.startsWith('/legacy/')) {
    window.history.replaceState({}, '', '/');
  }

  const route = resolveAppRoute(window.location.pathname);

  if (route === 'docs') {
    const { bootstrapDocsApp } = await import('./docs/app');
    bootstrapDocsApp();
    return;
  }

  if (route === 'lab') {
    const { bootstrapNamazueApp } = await import('./namazue/app');
    bootstrapNamazueApp();
    return;
  }

  // Default: new spatial console
  const app = document.getElementById('app');
  if (!app) throw new Error('Missing #app root');
  const { bootstrapConsole } = await import('./core/bootstrap');
  await bootstrapConsole(app);
}

start().catch((error) => {
  console.error('[namazue] entry bootstrap failed:', error);
  showStartupFailure(error);
});
