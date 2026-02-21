/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_TELEGRAM_BOT_NAME: string
  readonly VITE_TELEGRAM_GROUP_INVITE_LINK: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
