import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { MemeConcept, GeneratedMeme } from '../types';
import { getModelPreference } from './feedbackService';

// A lightweight, self-contained placeholder SVG for when Gemini image generation fails.
const GEMINI_PLACEHOLDER_IMAGE_URL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgZmlsbD0iIzExMTgyNyIgd2lkdGg9IjUxMiIgaGVpZhtPSI1MTIiLz48dGV4dCB4PSI1MCUiIHk9IjQ4JSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzJweCIgZmlsbD0iI2Y4NzE3MSIgZm9udC13ZWlnaHQ9ImJvbGQiPlRIRSBBSSBHT1QgU0hZPC90ZXh0Pjx0ZXh0IHg9IjUwJSIgeT0iNTglIiBkb21pbmFhbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMThweCIgZmlsbD0iI2VhYTNmIj5JbWFnZSBnZW5lcmF0aW9uIGZhaWxlZC48L3RleHQ+PC9zdmc+';

// A placeholder for the DALL-E 3 image generation.
const DALLE_PLACEHOLDER_IMAGE_URL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgZmlsbD0iIzFlMWI0YiIgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiLz48dGV4dCB4PSI1MCUiIHk9IjQ4JSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzJweCIgZmlsbD0iI2E3OGJmYSIgZm9udC1wZWlnaHQ9ImJvbGQiPkRBTFktRSAzIEFUIFRIRSBFQVNFTDwvdGV4dD48dGV4dCB4PSI1MCUiIHk9IjU4JSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMThweCIgZmlsbD0iI2M0YjVmZCI+U2ltdWxhdGluZyBPcGVuQUkgaW1hZ2UgZ2VuZXJhdGlvbi48L3RleHQ+PC9zdmc+';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const memeSchema = {
  type: Type.OBJECT,
  properties: {
    memes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          topText: { type: Type.STRING, description: "The text at the top of the meme." },
          bottomText: { type: Type.STRING, description: "The text at the bottom of the meme." },
          imagePrompt: { type: Type.STRING, description: "A detailed prompt for an AI image generator." },
        },
        required: ["topText", "bottomText", "imagePrompt"],
      },
    },
  },
  required: ["memes"],
};

const createSystemInstruction = (examples: MemeConcept[]): string => {
  let instruction = `You are an AI meme generator for a queer nightlife project called 'Kiss My Face New York'. Your humor is witty, subversive, and deeply embedded in queer culture, referencing everything from drag race to historical queer icons and modern internet slang. You create memes in the style of popular, edgy, and funny queer-focused Instagram accounts. Your tone is irreverent, celebratory, and sharp. Generate exactly 5 concepts. IMPORTANT: Keep the total text for each meme (top text + bottom text) concise and impactful, under 15 words total.`;

  if (examples && examples.length > 0) {
    const examplesString = examples.map(ex => 
      `- Top: "${ex.topText}", Bottom: "${ex.bottomText}", Image Idea: "${ex.imagePrompt}"`
    ).join('\n');
    instruction += `\n\nTo fine-tune your response, here are examples of previously admin-approved memes. Match this style and humor:\n${examplesString}`;
  }
  return instruction;
}

const getMemeConceptsFromHeadline = async (headline: string, examples: MemeConcept[]): Promise<MemeConcept[]> => {
  const model = "gemini-2.5-pro";
  const systemInstruction = createSystemInstruction(examples);
  const prompt = `Based on this news headline: "${headline}", generate 5 distinct meme concepts. For each meme, provide a top text, a bottom text, and a prompt for an AI image generator. IMPORTANT: Image prompts must be descriptive, vibrant, and surreal, capturing a funny visual concept that matches the text and queer nightlife aesthetic. To ensure successful image generation, prompts MUST NOT include the names of specific, real-life public figures (like politicians or celebrities) and MUST NOT describe recreations of famous artworks. Focus on creating imaginative, original scenes. Additionally, to prevent generation failures, explicitly avoid terms in the image prompts related to smoking, vaping, illicit substances, realistic violence, or overly suggestive content.`;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: memeSchema,
    },
  });
  
  const jsonText = response.text.trim();
  const parsed = JSON.parse(jsonText);
  return parsed.memes;
};

const getMemeConceptsFromInspiration = async (links: string, customPrompt: string, examples: MemeConcept[]): Promise<MemeConcept[]> => {
  const model = "gemini-2.5-pro";
  const systemInstruction = createSystemInstruction(examples);
  const prompt = `Use the style, tone, and humor from these Instagram pages as inspiration: ${links}. Now, based on this user prompt: "${customPrompt}", generate 5 distinct meme concepts. For each meme, provide a top text, a bottom text, and a prompt for an AI image generator. IMPORTANT: Image prompts must be descriptive, vibrant, and surreal, capturing a funny visual concept that matches the text and queer nightlife aesthetic. To ensure successful image generation, prompts MUST NOT include the names of specific, real-life public figures (like politicians or celebrities) and MUST NOT describe recreations of famous artworks. Focus on creating imaginative, original scenes. Additionally, to prevent generation failures, explicitly avoid terms in the image prompts related to smoking, vaping, illicit substances, realistic violence, or overly suggestive content.`;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: memeSchema,
    },
  });
  
  const jsonText = response.text.trim();
  const parsed = JSON.parse(jsonText);
  return parsed.memes;
};


export const generateImage = async (prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `In a vibrant, high contrast, pop art meme aesthetic: ${prompt}. IMPORTANT: The generated image must not contain any text, letters, words, or numbers. It should be purely visual.`,
          },
        ],
      },
      config: {
          responseModalities: [Modality.IMAGE],
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

    if (part?.inlineData) {
      const base64ImageBytes: string = part.inlineData.data;
      const mimeType = part.inlineData.mimeType;
      return `data:${mimeType};base64,${base64ImageBytes}`;
    }

    console.error('Gemini Image generation failed: API response did not contain valid image data for prompt:', prompt);
    console.error('Full API response object:', JSON.stringify(response, null, 2));
    return GEMINI_PLACEHOLDER_IMAGE_URL;

  } catch (error) {
    console.error(`Gemini Image generation process caught an exception for prompt: "${prompt}"`, error);
    return GEMINI_PLACEHOLDER_IMAGE_URL;
  }
};


export const generateImageWithDalle = async (prompt: string, apiKey: string): Promise<string> => {
  if (!apiKey) {
    console.error("DALL-E 3 configuration error: No OpenAI API key provided.");
    return DALLE_PLACEHOLDER_IMAGE_URL;
  }
  
  const dallePrompt = `${prompt}. IMPORTANT: The generated image must not contain any text, letters, words, or numbers. It should be purely visual.`;
  console.log(`[REAL] Calling DALL-E 3 with prompt: "${dallePrompt}"`);

  let apiResponse;
  try {
    apiResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: dallePrompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json"
      })
    });
  } catch (networkError) {
    console.error('DALL-E 3 network error:', networkError);
    return DALLE_PLACEHOLDER_IMAGE_URL;
  }

  if (!apiResponse.ok) {
    let errorMessage = 'Unknown OpenAI API error';
    let errorDetails = '';
    try {
        const rawBody = await apiResponse.text();
        errorDetails = rawBody; // Keep raw body for logging
        const errorData = JSON.parse(rawBody);
        if (errorData?.error?.message) {
            errorMessage = typeof errorData.error.message === 'string' ? errorData.error.message : JSON.stringify(errorData.error.message);
        }
    } catch (e) {
        errorMessage = `API request failed with status ${apiResponse.status}. Could not parse JSON response.`;
    }
    
    console.error(`DALL-E 3 API Error: ${errorMessage}`, `Raw Response: ${errorDetails}`);
    
    // Provide a clear, actionable log for the most critical user-facing error.
    if (errorMessage.includes('Billing hard limit has been reached')) {
      console.error("CRITICAL: OpenAI Billing Limit Reached. All subsequent DALL-E generations will fail until this is resolved in your OpenAI account.");
    }

    return DALLE_PLACEHOLDER_IMAGE_URL;
  }

  const data = await apiResponse.json();
  const base64Image = data.data?.[0]?.b64_json;
  
  if (!base64Image) {
    console.error('DALL-E 3 API Error: Response did not contain image data.', data);
    return DALLE_PLACEHOLDER_IMAGE_URL;
  }

  return `data:image/png;base64,${base64Image}`;
};

export const generateMemeImageWithFallback = async (
  prompt: string,
  model: 'gemini' | 'dalle',
  openAiApiKey: string
): Promise<{ imageUrl: string; modelUsed: 'gemini' | 'dalle' }> => {
  let imageUrl: string;

  // Proactively fall back to Gemini if DALL-E is scheduled but no API key is available.
  if (model === 'dalle' && !openAiApiKey) {
    console.warn("DALL-E was scheduled, but no OpenAI API key was provided. Falling back to Gemini.");
    imageUrl = await generateImage(prompt);
    return { imageUrl, modelUsed: 'gemini' };
  }

  if (model === 'dalle') {
    imageUrl = await generateImageWithDalle(prompt, openAiApiKey);
  } else {
    imageUrl = await generateImage(prompt);
  }

  // The model used is the one we *attempted* to use.
  // If it failed, the imageUrl will be a placeholder, but the modelUsed is still correct for regeneration attempts.
  return { imageUrl, modelUsed: model };
};


export const generateImageAltText = async (concept: MemeConcept): Promise<string> => {
  try {
    const model = "gemini-2.5-flash";
    const prompt = `Generate a concise, descriptive, SEO-friendly alt text for an image in a meme.
    The meme is for a queer nightlife project called "Kiss My Face New York".
    
    Meme Details:
    - Top Text: "${concept.topText}"
    - Bottom Text: "${concept.bottomText}"
    - Image Description: "${concept.imagePrompt}"

    Instructions:
    1. Accurately describe the visual elements of the image based on the description.
    2. Incorporate the meme's text naturally if possible.
    3. Include a mix of relevant SEO keywords like: "queer meme", "lgbtq humor", "gay meme", "funny nightlife", "NYC nightlife", "drag queen", "queer culture", "Brooklyn nightlife", "viral meme", "Gen Z humor", "Kiss My Face New York".
    4. Keep it under 150 characters.
    5. Do not use hashtags or quotation marks.
    
    Example Output: A vibrant pop art meme from Kiss My Face New York showing a cat DJing, with text 'Me when the beat drops'. Funny queer nightlife humor for Gen Z.

    Generate the alt text now.`;
    
    const response = await ai.models.generateContent({ model, contents: prompt });
    
    return response.text.trim().replace(/^"|"$/g, '');
    
  } catch (error) {
    console.error("Failed to generate alt text:", error);
    return `Kiss My Face New York meme: ${concept.topText} - ${concept.bottomText}. Image: ${concept.imagePrompt.substring(0, 50)}...`;
  }
};


const processConceptsIntoMemes = async (
  conceptsPromise: Promise<MemeConcept[]>,
  modelPreference: { gemini: number; dalle: number; },
  openAiApiKey: string
): Promise<GeneratedMeme[]> => {
  const concepts = await conceptsPromise;
  if (!concepts || concepts.length === 0) {
    throw new Error("AI did not return any meme concepts.");
  }
  
  const generatorSchedule = [
    ...Array(modelPreference.gemini).fill('gemini'), 
    ...Array(modelPreference.dalle).fill('dalle')
  ];

  const memePromises = concepts.map(async (concept, index) => {
    const scheduledModel = generatorSchedule[index] as 'gemini' | 'dalle' || 'gemini';
    
    const { imageUrl, modelUsed } = await generateMemeImageWithFallback(concept.imagePrompt, scheduledModel, openAiApiKey);
    const altText = await generateImageAltText(concept);

    return {
      ...concept,
      id: crypto.randomUUID(),
      imageUrl,
      altText,
      status: 'pending' as const,
      modelUsed,
    };
  });

  return Promise.all(memePromises);
};

export const generateMemesFromHeadline = async (
  headline: string, 
  examples: MemeConcept[], 
  openAiApiKey: string,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<GeneratedMeme[]> => {
  const modelPreference = await getModelPreference(supabaseUrl, supabaseAnonKey);
  console.log('Generating with preference:', modelPreference);
  return processConceptsIntoMemes(getMemeConceptsFromHeadline(headline, examples), modelPreference, openAiApiKey);
};

export const generateMemesFromInspiration = async (
  links: string, 
  customPrompt: string, 
  examples: MemeConcept[], 
  openAiApiKey: string,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<GeneratedMeme[]> => {
  const modelPreference = await getModelPreference(supabaseUrl, supabaseAnonKey);
  console.log('Generating with preference:', modelPreference);
  return processConceptsIntoMemes(getMemeConceptsFromInspiration(links, customPrompt, examples), modelPreference, openAiApiKey);
};


/**
 * Simulates sending an approval email to an administrator.
 * In a real application, this would be a POST request to a secure backend endpoint,
 * which would then use a service like SendGrid to dispatch the email.
 * @param memes The array of generated memes to include in the email.
 * @param recipient The email address to send the notification to.
 * @param subject The subject line for the email.
 * @returns A promise that resolves to an object indicating success.
 */
export const sendApprovalEmail = async (
  memes: GeneratedMeme[],
  recipient: string = 'admin@kissmyfacenewyork.com',
  subject: string = 'New Memes for Approval'
): Promise<{ success: boolean }> => {
  console.log("--- SIMULATING SENDGRID EMAIL ---");
  console.log(`Recipient: ${recipient}`);
  console.log(`Subject: ${subject}`);
  console.log("Body: Please review the following memes generated by Kiss My Face New York AI.");
  
  const emailContent = memes.map(meme => ({
    id: meme.id,
    topText: meme.topText,
    bottomText: meme.bottomText,
    imageUrl: meme.imageUrl,
    status: meme.status,
  }));

  console.log("Meme Payload:", JSON.stringify(emailContent, null, 2));
  console.log("---------------------------------");

  await new Promise(resolve => setTimeout(resolve, 1500));

  return { success: true };
};