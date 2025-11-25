import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
// In Vite/Browser environment, we use import.meta.env instead of process.env to avoid reference errors
const apiKey = (import.meta as any).env?.VITE_API_KEY || '';

const ai = new GoogleGenAI({ apiKey });

export const analyzeData = async (summaryJSON: any) => {
  if (!apiKey) {
    console.warn("Gemini API Key missing");
    return "Analysis unavailable (Missing API Key)";
  }

  try {
    const prompt = `
      You are a logistics and financial analyst AI. 
      Analyze the following JSON summary of a dispatch system. 
      Identify 3 key trends, 1 potential financial risk (like high unpaid amounts), and 1 operational suggestion.
      Keep it concise and professional.
      
      Data:
      ${JSON.stringify(summaryJSON, null, 2)}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Unable to generate analysis at this time.";
  }
};