
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const aiService = {
  /**
   * Récupère les coordonnées d'une ville via l'IA si non présente dans le mock.
   */
  async getCityCoordinates(city: string): Promise<{ lat: number; lng: number } | null> {
    const response = await ai.models.generateContent({
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

  /**
   * Génère une description d'annonce basée sur les caractéristiques du logement.
   */
  async generateListingDescription(data: any): Promise<string> {
    const prompt = `Rédige une annonce de colocation courte durée attractive pour HAVEN.
    Type: ${data.type === 'APARTMENT' ? 'Appartement' : 'Maison'}
    Titre: ${data.title}
    Ville: ${data.city}
    Surface: ${data.surface}m²
    Chambres: ${data.totalRooms}
    Salles de bain: ${data.bathrooms}
    Mixité: ${data.isMixed ? 'Mixte' : 'Non-mixte'}
    Équipements: ${data.amenities.join(', ')}
    
    Le ton doit être chaleureux, professionnel et mettre en avant l'expérience de vie. Structure l'annonce avec une introduction, les points forts et une conclusion.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "Tu es un expert en rédaction immobilière pour HAVEN, une plateforme de colocation courte durée haut de gamme. Tu rédiges des annonces qui donnent envie aux étudiants et jeunes actifs. N'utilise pas de hashtags. Utilise un français impeccable.",
      },
    });

    return response.text || "";
  }
};
