// The browser build has no native bridge. Only the desktop shell supplies this API.
export const desktopRuntime = globalThis.__TAURI__?.core?.invoke && globalThis.__TAURI__?.event?.listen
  ? {invoke: globalThis.__TAURI__.core.invoke, listen: globalThis.__TAURI__.event.listen}
  : null;
