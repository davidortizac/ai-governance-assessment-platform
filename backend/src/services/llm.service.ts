/**
 * llm.service.ts — Ollama local LLM integration for contextual AI security assessment analysis.
 * Uses deepseek-r1:8b or qwen2.5:27b to generate vendor-neutral, data-driven reports.
 *
 * Uses Node's native http/https modules instead of fetch to control connect + socket
 * timeouts independently of undici's internal 10s default.
 */

import https from 'https';
import http from 'http';

// Read fresh from process.env on every call so runtime changes (model selection) take effect
const getOllamaUrl     = () => process.env.OLLAMA_URL      ?? 'http://host.docker.internal:11434/v1/chat/completions';
const getOllamaModel   = () => process.env.OLLAMA_MODEL    ?? 'deepseek-r1:8b';
const getOllamaTimeout = () => parseInt(process.env.OLLAMA_TIMEOUT_MS ?? '300000', 10);

/**
 * POST JSON to a URL using Node's native http/https.
 * Applies OLLAMA_TIMEOUT_MS to both connect and idle phases.
 */
function httpPost(url: string, body: string, timeoutMs: number): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
        const parsed   = new URL(url);
        const isHttps  = parsed.protocol === 'https:';
        const lib      = isHttps ? https : http;
        const port     = parsed.port ? parseInt(parsed.port, 10) : (isHttps ? 443 : 80);

        const options: https.RequestOptions = {
            hostname: parsed.hostname,
            port,
            path: parsed.pathname + parsed.search,
            method: 'POST',
            headers: {
                'Content-Type':   'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
            timeout: timeoutMs,          // socket connect + idle timeout
            rejectUnauthorized: false,   // allow self-signed certs on internal servers
        };

        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
            res.on('error', reject);
        });

        req.on('timeout', () => {
            req.destroy(new Error(`LLM request timed out after ${timeoutMs}ms (${url})`));
        });
        req.on('error', reject);

        req.write(body);
        req.end();
    });
}

/**
 * GET a URL using Node's native http/https.
 */
function httpGet(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
        const parsed  = new URL(url);
        const isHttps = parsed.protocol === 'https:';
        const lib     = isHttps ? https : http;
        const port    = parsed.port ? parseInt(parsed.port, 10) : (isHttps ? 443 : 80);

        const options: https.RequestOptions = {
            hostname: parsed.hostname,
            port,
            path: parsed.pathname + parsed.search,
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            timeout: timeoutMs,
            rejectUnauthorized: false,
        };

        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
            res.on('error', reject);
        });

        req.on('timeout', () => {
            req.destroy(new Error(`LLM GET timed out after ${timeoutMs}ms (${url})`));
        });
        req.on('error', reject);
        req.end();
    });
}

export interface LLMAnalysis {
    generatedAt: string;
    model: string;
    executiveSummary: string;
    awarenessMessage: string;
    industryBenchmark: string;
    improvementPlan: {
        quickWins: string[];
        longTerm: string[];
    };
    pillarAnalyses: {
        [pillarKey: string]: {
            findings: string;
            gaps: string;
            recommendation: string;
        };
    };
}

/** Remove <think>...</think> blocks produced by deepseek-r1 models. */
function stripThinkTags(raw: string): string {
    return raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * Walk through JSON and escape literal control characters (LF, CR, TAB, etc.)
 * found inside string values.  Models like ministral-3b output raw newlines
 * inside strings, which is invalid per JSON spec (must be \\n).
 */
function escapeControlCharsInStrings(s: string): string {
    let result = '';
    let inString = false;
    let escape = false;

    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        const code = s.charCodeAt(i);

        if (escape) { result += c; escape = false; continue; }
        if (c === '\\' && inString) { escape = true; result += c; continue; }
        if (c === '"') { inString = !inString; result += c; continue; }

        if (inString && code < 0x20) {
            if (code === 0x0A) { result += '\\n'; continue; }   // LF → \n
            if (code === 0x0D) { result += '\\r'; continue; }   // CR → \r
            if (code === 0x09) { result += '\\t'; continue; }   // TAB → \t
            result += `\\u${code.toString(16).padStart(4, '0')}`;
            continue;
        }

        result += c;
    }
    return result;
}

/**
 * Attempt to repair common LLM JSON issues before parsing:
 * 1. Literal control characters (newlines/tabs) inside string values
 * 2. Trailing commas before } or ]
 */
function repairJson(raw: string): string {
    let s = escapeControlCharsInStrings(raw);
    s = s.replace(/,(\s*[}\]])/g, '$1');
    return s;
}

/**
 * Extract the first complete JSON object from text using bracket counting.
 * More robust than a plain regex — correctly handles nested objects/arrays.
 */
function extractJsonObject(text: string): string {
    const start = text.indexOf('{');
    if (start === -1) throw new Error('No JSON object found in LLM response');

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < text.length; i++) {
        const c = text[i];
        if (escape) { escape = false; continue; }
        if (c === '\\' && inString) { escape = true; continue; }
        if (c === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (c === '{' || c === '[') depth++;
        if (c === '}' || c === ']') {
            depth--;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }

    // Truncated response — return what we have and let the caller try repair
    return text.slice(start);
}

/** Convert numeric score (0-4) to a human-readable label for the prompt. */
function scoreToLabel(score: number): string {
    if (score < 1.0) return 'Inicial (sin prácticas formales)';
    if (score < 2.0) return 'Emergente (prácticas ad-hoc)';
    if (score < 3.0) return 'Definido (procesos parciales)';
    if (score <= 3.5) return 'Gestionado (procesos maduros)';
    return 'Optimizado (liderazgo e innovación)';
}

/** Build the full prompt using real assessment data. */
function buildPrompt(assessment: any): string {
    const clientName = assessment.client?.name ?? 'la organización';
    const industry = assessment.client?.industry ?? 'sector no especificado';
    const overallScore = assessment.overallScore?.toFixed(2) ?? '0.00';
    const maturityLevel = assessment.maturityLevel ?? 1;
    const riskLevel = assessment.riskLevel ?? 'MEDIUM';

    const maturityLabels: Record<number, string> = {
        1: 'Experimental',
        2: 'Emergente',
        3: 'Definido',
        4: 'Gestionado',
        5: 'Optimizado',
    };
    const maturityLabel = maturityLabels[maturityLevel] ?? 'Desconocido';

    const riskLabels: Record<string, string> = {
        CONTROLLED: 'Controlado',
        LOW: 'Bajo',
        MEDIUM: 'Medio',
        HIGH: 'Alto',
        CRITICAL: 'Crítico',
        LATENT: 'Latente',
    };
    const riskLabel = riskLabels[riskLevel] ?? 'Medio';

    // Build pillar details
    const pillarLines: string[] = [];
    if (assessment.pillarScores && Array.isArray(assessment.pillarScores)) {
        for (const ps of assessment.pillarScores) {
            const pillarKey = ps.pillar?.key ?? 'unknown';
            const pillarName = ps.pillar?.name ?? pillarKey;
            const score = ps.score?.toFixed(2) ?? '0.00';
            const label = scoreToLabel(ps.score ?? 0);

            // Find answers belonging to this pillar
            const pillarAnswers = (assessment.answers ?? []).filter(
                (a: any) => a.question?.pillar?.key === pillarKey
            );

            pillarLines.push(`\n### Pilar: ${pillarName} (key: ${pillarKey})`);
            pillarLines.push(`Score: ${score}/4.0 — ${label}`);

            if (pillarAnswers.length > 0) {
                pillarLines.push('Respuestas por pregunta:');
                for (const a of pillarAnswers) {
                    const qText = a.question?.text ?? '(sin texto)';
                    const answerLabel = a.notApplicable
                        ? 'No Aplica'
                        : a.score === 1
                        ? 'No iniciado (1)'
                        : a.score === 3
                        ? 'En progreso (3)'
                        : a.score === 5
                        ? 'Completado (5)'
                        : `Score: ${a.score}`;
                    pillarLines.push(`  - ${qText} → ${answerLabel}`);
                }
            }
        }
    }

    const pillarSection = pillarLines.join('\n');
    const activeModel = getOllamaModel();

    return `Eres un experto consultor en ciberseguridad de inteligencia artificial analizando una evaluación de madurez CSIA.

## Datos del Assessment

**Cliente:** ${clientName}
**Industria:** ${industry}
**Score General:** ${overallScore}/4.0
**Nivel de Madurez:** ${maturityLevel} — ${maturityLabel}
**Nivel de Riesgo:** ${riskLabel}

## Detalle por Pilar
${pillarSection}

## Instrucciones

Genera un análisis ejecutivo contextual basado ÚNICAMENTE en los datos anteriores.
NO menciones productos de vendors específicos (no CrowdStrike, no Microsoft, no Palo Alto, etc.).
Enfócate en principios y prácticas de ciberseguridad aplicables al contexto de ${clientName} en la industria ${industry}.

Responde ÚNICAMENTE con el siguiente JSON válido (sin markdown, sin texto adicional, sin bloques de código):

{
  "generatedAt": "<ISO timestamp actual>",
  "model": "${activeModel}",
  "executiveSummary": "<3-5 oraciones de diagnóstico contextual basado en los datos reales>",
  "awarenessMessage": "<Por qué la seguridad en IA es crítica para el sector ${industry}, basado en el perfil de riesgo detectado>",
  "industryBenchmark": "<Comparación del nivel de madurez ${maturityLabel} con organizaciones típicas del sector ${industry}, sin inventar estadísticas>",
  "improvementPlan": {
    "quickWins": ["<acción concreta < 90 días>", "<acción>", "<acción>"],
    "longTerm": ["<iniciativa estratégica > 90 días>", "<iniciativa>", "<iniciativa>"]
  },
  "pillarAnalyses": {
    "<pillarKey>": {
      "findings": "<hallazgo principal basado en el score y respuestas>",
      "gaps": "<brechas específicas identificadas>",
      "recommendation": "<recomendación accionable sin mencionar vendors>"
    }
  }
}`;
}

/** Call Ollama API and return structured LLMAnalysis. Throws on failure. */
export async function generateLLMAnalysis(assessment: any): Promise<LLMAnalysis> {
    const prompt = buildPrompt(assessment);
    const ollamaUrl     = getOllamaUrl();
    const ollamaModel   = getOllamaModel();
    const ollamaTimeout = getOllamaTimeout();

    const requestBody = JSON.stringify({
        model: ollamaModel,
        messages: [
            {
                role: 'system',
                content:
                    'Eres un experto consultor en ciberseguridad de inteligencia artificial. ' +
                    'Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código, sin markdown, sin texto antes o después del JSON. ' +
                    'CRÍTICO: todos los valores de string deben estar en una sola línea, sin saltos de línea literales dentro de los strings. ' +
                    'Usa \\n (barra+n) si necesitas separar párrafos dentro de un string. ' +
                    'No uses asteriscos, almohadillas ni ningún formato markdown dentro de los valores. ' +
                    'No menciones productos de vendors específicos en tus recomendaciones.',
            },
            { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        stream: false,
        max_tokens: 2500,
    });

    console.log(`[LLM] POST ${ollamaUrl} (model=${ollamaModel}, timeout=${ollamaTimeout}ms)`);
    const { status, body: rawBody } = await httpPost(ollamaUrl, requestBody, ollamaTimeout);

    if (status >= 400) {
        throw new Error(`Ollama HTTP ${status}: ${rawBody.slice(0, 200)}`);
    }

    let data: any;
    try {
        data = JSON.parse(rawBody);
    } catch {
        throw new Error(`Ollama returned non-JSON response (status=${status}): ${rawBody.slice(0, 200)}`);
    }

    const raw: string = data?.choices?.[0]?.message?.content ?? '';

    // Strip <think>...</think> blocks (deepseek-r1)
    const cleaned = stripThinkTags(raw);

    // Extract and parse JSON — with automatic repair for common LLM issues
    let jsonStr: string;
    try {
        jsonStr = extractJsonObject(cleaned);
    } catch (e) {
        throw new Error(`LLM did not return a JSON object. Raw response (first 500 chars): ${cleaned.slice(0, 500)}`);
    }

    let parsed: LLMAnalysis;
    try {
        parsed = JSON.parse(jsonStr) as LLMAnalysis;
    } catch {
        // Attempt repair (trailing commas, etc.) before giving up
        const repaired = repairJson(jsonStr);
        try {
            parsed = JSON.parse(repaired) as LLMAnalysis;
            console.warn('[LLM] JSON required repair before parsing — consider switching to a model with better JSON output');
        } catch (e2) {
            throw new Error(`Failed to parse LLM JSON even after repair: ${(e2 as Error).message}. Snippet: ${jsonStr.slice(0, 300)}`);
        }
    }

    // Ensure required fields exist (defensive defaults)
    parsed.generatedAt = parsed.generatedAt ?? new Date().toISOString();
    parsed.model = parsed.model ?? ollamaModel;
    parsed.executiveSummary = parsed.executiveSummary ?? '';
    parsed.awarenessMessage = parsed.awarenessMessage ?? '';
    parsed.industryBenchmark = parsed.industryBenchmark ?? '';
    parsed.improvementPlan = parsed.improvementPlan ?? { quickWins: [], longTerm: [] };
    parsed.pillarAnalyses = parsed.pillarAnalyses ?? {};

    return parsed;
}

/**
 * List available models from the Ollama server.
 * Tries /v1/models (OpenAI-compatible) first, then /api/tags (Ollama native).
 */
export async function listOllamaModels(): Promise<{ name: string; size?: number }[]> {
    const chatUrl = getOllamaUrl();
    // Derive base URL: strip /v1/chat/completions and everything after
    const base = chatUrl.replace(/\/v1\/chat\/completions.*$/, '').replace(/\/api\/.*$/, '');
    const timeout = Math.min(getOllamaTimeout(), 15000); // cap at 15s for listing

    // Try OpenAI-compatible /v1/models first
    try {
        const { status, body } = await httpGet(`${base}/v1/models`, timeout);
        if (status === 200) {
            const data = JSON.parse(body);
            if (Array.isArray(data?.data)) {
                return data.data.map((m: any) => ({ name: m.id, size: undefined }));
            }
        }
    } catch {
        // fall through to /api/tags
    }

    // Ollama native /api/tags
    const { status, body } = await httpGet(`${base}/api/tags`, timeout);
    if (status !== 200) {
        throw new Error(`Ollama /api/tags returned HTTP ${status}`);
    }
    const data = JSON.parse(body);
    if (!Array.isArray(data?.models)) {
        throw new Error('Unexpected /api/tags response format');
    }
    return data.models.map((m: any) => ({ name: m.name, size: m.size as number | undefined }));
}
