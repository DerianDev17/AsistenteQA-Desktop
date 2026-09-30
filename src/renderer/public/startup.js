// This script is independent of React and the module graph so failed downloads remain recoverable.
const startupScreen = document.getElementById('startup-screen');
const startupMessage = document.getElementById('startup-message');
const startupRetry = document.getElementById('startup-retry');
const startupTitle = document.getElementById('startup-title');

function showStartupFailure() {
  if (!startupScreen?.isConnected) return;
  startupScreen.setAttribute('role', 'alert');
  startupTitle.textContent = 'No se pudo cargar la interfaz';
  startupMessage.textContent =
    'Reintenta la carga. Tus proyectos, tareas y conexiones se conservan en este equipo.';
  startupRetry.hidden = false;
}

startupRetry.addEventListener('click', () => window.location.reload());
window.addEventListener('error', showStartupFailure, true);
window.addEventListener('unhandledrejection', showStartupFailure);
setTimeout(showStartupFailure, 15000);
