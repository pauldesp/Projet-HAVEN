
import { GoogleGenAI, Type } from "@google/genai";

let ai: GoogleGenAI | undefined;

function getAi(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("L’assistance IA n’est pas configurée. Vous pouvez rédiger votre annonce manuellement.");
  }
  return ai ??= new GoogleGenAI({ apiKey });
}

export const aiService = {
  /**
   * Récupère les coordonnées d'une ville via l'IA si non présente dans le mock.
   */
  async getCityCoordinates(city: string): Promise<{ lat: number; lng: number } | null> {
    if (!process.env.GEMINI_API_KEY) return null;
    const response = await getAi().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Donne-moi les coordonnées GPS (latitude et longitude) de la ville suivante: "${city}"`,
      config: {
        systemInstruction: "Tu es un service de géocodage. Tu renvoies uniquement un objet JSON avec 'lat' et 'lng'.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER }
          },
          required: ["lat", "lng"]
        },
      },
    });

    try {
      return JSON.parse(response.text || "null");
    } catch (e) {
      console.error("Erreur geocoding AI", e);
      return null;
    }
  },
};
