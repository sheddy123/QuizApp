/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'true' in the Android build, which uses the on-device API instead of the .NET server. */
  readonly VITE_OFFLINE?: string
}
