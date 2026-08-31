import axios from 'axios';
import { validateEnv } from '../utils/env.validation.js';

const env = validateEnv();

const HF_API_URL = 'https://api-inference.huggingface.co/models';
const DEFAULT_HF_MODEL = 'google/flan-t5-small';

export interface LlmExtractionResult {
  field: string;
  value: string;
  confidence: number;
  source: string;
}

export async function extractWithLlm(text: string, fields: string[]): Promise<LlmExtractionResult[]> {
  const prompt = buildPrompt(text, fields);

  if (env.OLLAMA_URL) {
    return extractWithOllama(prompt);
  }

  if (env.HF_API_KEY) {
    return extractWithHuggingFace(prompt);
  }

  throw new Error('No LLM provider configured. Set OLLAMA_URL or HF_API_KEY.');
}

async function extractWithOllama(prompt: string): Promise<LlmExtractionResult[]> {
  try {
    const response = await axios.post(
      `${env.OLLAMA_URL}/api/generate`,
      {
        model: env.OLLAMA_MODEL || 'llama3.2:1b',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 256,
        },
      },
      {
        timeout: 120_000,
      },
    );

    const generatedText = response.data?.response;
    if (!generatedText) {
      return [];
    }

    return parseLlmResponse(generatedText);
  } catch (error) {
    console.error('Ollama extraction failed:', error);
    throw new Error(`Ollama extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function extractWithHuggingFace(prompt: string): Promise<LlmExtractionResult[]> {
  try {
    const response = await axios.post(
      `${HF_API_URL}/${DEFAULT_HF_MODEL}`,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 256,
          temperature: 0.1,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${env.HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60_000,
      },
    );

    const generatedText = Array.isArray(response.data) ? response.data[0]?.generated_text : response.data?.generated_text;
    if (!generatedText) {
      return [];
    }

    return parseLlmResponse(generatedText);
  } catch (error) {
    console.error('Hugging Face extraction failed:', error);
    throw new Error(`Hugging Face extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function buildPrompt(text: string, fields: string[]): string {
  const fieldList = fields.map((f) => `- ${f}`).join('\n');
  return `Extract the following fields from the document text below. Return ONLY the field name and value pairs in the format "field: value". If a field is not found, return "field: NOT_FOUND".

Fields to extract:
${fieldList}

Document text:
${text.slice(0, 4000)}

Response:`;
}

function parseLlmResponse(response: string): LlmExtractionResult[] {
  const results: LlmExtractionResult[] = [];
  const lines = response.split('\n');

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (!match) continue;

    const fieldName = match[1].trim().toLowerCase();
    const value = match[2].trim();

    results.push({
      field: fieldName,
      value: value === 'NOT_FOUND' ? '' : value,
      confidence: value === 'NOT_FOUND' ? 0 : 0.7,
      source: 'llm',
    });
  }

  return results;
}
