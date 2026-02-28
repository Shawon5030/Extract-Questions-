import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

export interface Question {
  questionNumber?: string;
  questionText: string;
  options: string[];
  answer: string;
  explanation?: string;
}

export interface ExtractionResult {
  fileName: string;
  questions: Question[];
  status: 'success' | 'error';
  errorMessage?: string;
  timestamp: number;
}

export async function extractDataFromPdf(
  pdfBase64: string,
  apiKey: string,
  modelName: string = "gemini-2.5-flash"
): Promise<Question[]> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Extract all questions from this PDF. 
    For each question, identify:
    1. The question text.
    2. The options (A, B, C, D, etc.).
    3. The correct answer.
    4. The explanation (if available).
    
    Note: Questions might not be in sequential order. Extract every single one you find.
    Return the data as a JSON array of objects.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            questionNumber: { type: Type.STRING },
            questionText: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            answer: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
          required: ["questionText", "options", "answer"],
        },
      },
    },
  });

  try {
    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Failed to extract structured data from PDF");
  }
}
