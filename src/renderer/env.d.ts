/// <reference types="vite/client" />

import type { BooruApi } from '@shared/ipc-contract';

declare global {
  interface Window {
    booru: BooruApi;
  }
}
