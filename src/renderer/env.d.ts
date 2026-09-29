import type { QaApi } from '../shared/api';
declare global {
  interface Window {
    qa: QaApi;
  }
}
