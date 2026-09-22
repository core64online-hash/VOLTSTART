export const TELEGRAM = Symbol('TELEGRAM');

type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
}>;

/** Повідомлення менеджерам у Telegram-чат через Bot API (sendMessage). */
export class TelegramNotifier {
  constructor(
    private readonly token: string,
    private readonly chatId: string,
    private readonly fetchFn: FetchFn = (url, init) => fetch(url, init),
  ) {}

  async send(text: string): Promise<void> {
    const res = await this.fetchFn(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: this.chatId, text, disable_web_page_preview: true }),
    });
    if (!res.ok) throw new Error(`Telegram sendMessage failed: ${res.status}`);
  }
}

/** Створює нотифікатор, лише якщо задано токен бота і чат. */
export function createTelegram(env: (key: string) => string | undefined): TelegramNotifier | null {
  const token = env('TELEGRAM_BOT_TOKEN');
  const chatId = env('TELEGRAM_CHAT_ID');
  return token && chatId ? new TelegramNotifier(token, chatId) : null;
}
