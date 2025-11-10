import { GroundingChunk } from '@google/genai';

export const AVAILABLE_MODELS = [
    { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', aliases: ['flash', 'f'] },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', aliases: ['pro', 'p'] },
    { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite', aliases: ['lite', 'l'] },
    // This model is only available via the 'extra' command
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', aliases: [] },
];

export interface ChatMessage {
  id: string;
  sender: 'user' | 'gemini' | 'system';
  content: string | string[];
  sources?: GroundingChunk[];
  isImage?: boolean;
}