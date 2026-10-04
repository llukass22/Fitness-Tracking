// Installation only: no service worker or offline caching.
(() => {
  const button = document.getElementById('install-app');
  const standalone = window.matchMedia('(display-mode: standalone)');
  let installPrompt = null;
  const isInstalled = () => standalone.matches || window.navigator.standalone === true;

  window.addEventListener('beforeinstallprompt', event => {
    if (isInstalled()) return;
    event.preventDefault();
    installPrompt = event;
    button.hidden = false;
  });

  button.addEventListener('click', async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    button.hidden = true;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      // A prompt can only be used once; wait for a new browser offer.
    }
  });

  const hideInstall = () => {
    installPrompt = null;
    button.hidden = true;
  };
  window.addEventListener('appinstalled', hideInstall);
  standalone.addEventListener('change', () => {
    if (isInstalled()) hideInstall();
  });
})();
