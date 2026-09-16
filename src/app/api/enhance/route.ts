import { NextRequest, NextResponse } from 'next/server';
import { getUserSettings, DEFAULT_ENHANCER_PROMPT } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { parseAndSanitizeApiResponse } from '@/lib/responseCleaner';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Harap login terlebih dahulu untuk menggunakan Prompt Enhancer.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt teks wajib diisi sebelum melakukan enhance.' },
        { status: 400 }
      );
    }

    const settings = getUserSettings(user.id);
    const enhancerToken = settings.enhancer_api_token?.trim();

    // Sesuai aturan: user harus mengisi API Token Enhancer sendiri tanpa fallback
    if (!enhancerToken || enhancerToken === 'your_api_token_here' || enhancerToken.includes('dummy')) {
      return NextResponse.json(
        {
          error:
            'API Token untuk Prompt Enhancer belum diisi. Silakan buka menu Pengaturan (Settings) -> tab "Enhancer" dan masukkan API Token Anda.',
        },
        { status: 400 }
      );
    }

    const baseUrl = (settings.enhancer_base_url || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const model = (settings.enhancer_model || 'gpt-4o-mini').trim();
    const systemPrompt = settings.enhancer_prompt?.trim() || DEFAULT_ENHANCER_PROMPT;

    const targetUrl = `${baseUrl}/chat/completions`;

    const chatPayload = {
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    };

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${enhancerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatPayload),
      signal: AbortSignal.timeout(45000),
    });

    const rawText = await res.text();
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[enhance] Target URL: ${targetUrl} (model: ${model})`);
      console.log(`[enhance] HTTP Status: ${res.status}`);
      console.log(`[enhance] Raw response (first 500 chars):`, rawText.slice(0, 500));
    }

    const data = parseChatCompletionResponse(rawText);

    if (!res.ok) {
      const sanitized = parseAndSanitizeApiResponse(rawText, res.status, 'Gateway Prompt Enhancer');
      const errMsg =
        sanitized.errorMessage ||
        (data?.error as { message?: string })?.message ||
        `HTTP ${res.status}: Gagal menghubungi Chat Completions API (${res.statusText || 'Error'})`;
      return NextResponse.json({ error: errMsg }, { status: res.status });
    }

    let rawContent = extractChatContent(data);

    if (!rawContent) {
      console.error('[enhance] Failed to extract text from response. Parsed data:', JSON.stringify(data));
      return NextResponse.json(
        {
          error:
            'Tidak menerima respon teks dari model Chat Completions. Response API: ' +
            rawText.slice(0, 300),
        },
        { status: 500 }
      );
    }

    // Pembersihan pembungkus markdown atau tanda kutip jika ada
    if (rawContent.startsWith('```') && rawContent.endsWith('```')) {
      rawContent = rawContent.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    }
    if (
      (rawContent.startsWith('"') && rawContent.endsWith('"')) ||
      (rawContent.startsWith("'") && rawContent.endsWith("'"))
    ) {
      rawContent = rawContent.slice(1, -1).trim();
    }

    return NextResponse.json({
      success: true,
      enhancedPrompt: rawContent,
      originalPrompt: prompt,
      model,
    });
  } catch (err: unknown) {
    console.error('[enhance] Exception:', err);
    let message = err instanceof Error ? err.message : String(err);
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      message = 'Koneksi ke server AI Enhancer timeout setelah 45 detik. Pastikan server merespons dengan cepat.';
    }
    return NextResponse.json(
      {
        error: 'Terjadi kesalahan saat memproses enhance prompt: ' + message,
      },
      { status: 500 }
    );
  }
}

/**
 * Parsing payload respons Chat Completions dengan toleransi terhadap:
 * 1. Akhiran `data: [DONE]` yang sering ditambahkan oleh custom router / proxy.
 * 2. Format JSON standar OpenAI.
 * 3. Format potongan SSE (streaming data chunks).
 */
function parseChatCompletionResponse(rawText: string): Record<string, unknown> {
  let cleanText = rawText.trim();

  // 1. Bersihkan akhiran `data: [DONE]` (bisa beberapa kali atau dengan spasi/newline)
  cleanText = cleanText.replace(/data:\s*\[DONE\][\s\r\n]*$/gi, '').trim();

  // 2. Coba parse JSON langsung
  try {
    return JSON.parse(cleanText);
  } catch {}

  // 3. Coba ekstrak blok JSON pertama { ... } jika ada teks pengantar/penutup
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const potentialJson = cleanText.substring(firstBrace, lastBrace + 1);
      return JSON.parse(potentialJson);
    } catch {}
  }

  // 4. Jika format berupa stream chunks SSE (data: { ... }), rangkai seluruh teks potongan
  const lines = cleanText.split('\n');
  let aggregatedContent = '';
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('data:') && !trimmedLine.includes('[DONE]')) {
      const jsonPart = trimmedLine.replace(/^data:\s*/, '').trim();
      try {
        const chunk = JSON.parse(jsonPart);
        const delta =
          chunk?.choices?.[0]?.delta?.content ||
          chunk?.choices?.[0]?.message?.content ||
          '';
        if (delta) aggregatedContent += delta;
      } catch {}
    }
  }

  if (aggregatedContent.trim()) {
    return {
      choices: [
        {
          message: {
            content: aggregatedContent.trim(),
          },
        },
      ],
    };
  }

  return { rawText };
}

/**
 * Ekstraksi teks respons dari aneka ragam format model LLM
 * (OpenAI choices.message.content, reasoning_content, array content parts, candidates Gemini, text, output, dll).
 */
function extractChatContent(data: Record<string, unknown>): string {
  // 1. OpenAI format choices
  if (Array.isArray(data.choices) && data.choices.length > 0) {
    const choice = data.choices[0] as Record<string, unknown> | undefined;
    if (choice) {
      if (choice.message && typeof choice.message === 'object') {
        const msg = choice.message as Record<string, unknown>;

        // String content
        if (typeof msg.content === 'string' && msg.content.trim()) {
          return msg.content.trim();
        }

        // Array content parts: [{ type: 'text', text: '...' }]
        if (Array.isArray(msg.content)) {
          const parts = msg.content
            .map((p) =>
              p && typeof p === 'object' && 'text' in p ? String((p as Record<string, unknown>).text) : ''
            )
            .filter(Boolean);
          if (parts.length > 0) return parts.join('\n').trim();
        }

        // Reasoning content (DeepSeek-R1 / OpenAI o1/o3)
        if (typeof msg.reasoning_content === 'string' && msg.reasoning_content.trim()) {
          return msg.reasoning_content.trim();
        }
        if (typeof msg.reasoning === 'string' && msg.reasoning.trim()) {
          return msg.reasoning.trim();
        }
      }

      // Legacy completion choice.text
      if (typeof choice.text === 'string' && choice.text.trim()) {
        return choice.text.trim();
      }
    }
  }

  // 2. Gemini-style candidates[0].content.parts[0].text
  if (Array.isArray(data.candidates) && data.candidates.length > 0) {
    const cand = data.candidates[0] as Record<string, unknown> | undefined;
    const content = cand?.content as Record<string, unknown> | undefined;
    if (content && Array.isArray(content.parts) && content.parts.length > 0) {
      const parts = content.parts
        .map((p) =>
          p && typeof p === 'object' && 'text' in p ? String((p as Record<string, unknown>).text) : ''
        )
        .filter(Boolean);
      if (parts.length > 0) return parts.join('\n').trim();
    }
  }

  // 3. Direct string attributes
  if (typeof data.text === 'string' && data.text.trim()) return data.text.trim();
  if (typeof data.response === 'string' && data.response.trim()) return data.response.trim();
  if (typeof data.output === 'string' && data.output.trim()) return data.output.trim();

  return '';
}
