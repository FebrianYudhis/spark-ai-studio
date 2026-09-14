/**
 * Salin teks ke clipboard secara andal, baik di Secure Context (HTTPS / localhost)
 * maupun di Non-Secure Context (HTTP jaringan lokal / LAN seperti http://192.168.x.x:3000).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Coba Clipboard API modern jika berada di Secure Context
  if (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('[clipboard] navigator.clipboard.writeText gagal, mencoba fallback textarea:', err);
    }
  }

  // 2. Fallback untuk non-HTTPS / LAN / browser yang memblokir navigator.clipboard
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;

      // Konfigurasi agar elemen tidak terlihat dan tidak memicu layout shift atau auto-scrolling
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '2em';
      textarea.style.height = '2em';
      textarea.style.padding = '0';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';
      textarea.style.opacity = '0';
      textarea.setAttribute('readonly', '');

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, text.length); // Dukungan kompatibilitas iOS Safari & mobile

      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (successful) {
        return true;
      }
    } catch (err) {
      console.error('[clipboard] Fallback execCommand copy gagal:', err);
    }
  }

  return false;
}
