import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ApprovedMemeConcept, GeneratedMeme } from '../types';

const MAX_EXAMPLES = 10; // Increased for better fine-tuning with a real DB

// --- Supabase Setup Instructions for the user ---
// 1. Create a Supabase project.
// 2. Go to 'Storage' and create a NEW PUBLIC BUCKET named 'memes'.
// 3. Go to the 'SQL Editor' and run the following query to create your table:
/*
   CREATE TABLE approved_memes (
     id UUID PRIMARY KEY,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     top_text TEXT NOT NULL,
     bottom_text TEXT NOT NULL,
     image_prompt TEXT NOT NULL,
     model_used TEXT NOT NULL,
     image_url TEXT NOT NULL
   );
*/

// Use a singleton pattern for the client to avoid creating multiple connections.
let supabase: SupabaseClient | null = null;
// FIX: Store current URL and key to check for changes without accessing protected properties.
let currentSupabaseUrl: string | null = null;
let currentSupabaseKey: string | null = null;

const getSupabaseClient = (url: string, key: string): SupabaseClient => {
    if (!url || !key) {
        throw new Error("Supabase URL and Anon Key are required.");
    }
    // If the URL/key changes, re-initialize the client.
    if (!supabase || currentSupabaseUrl !== url || currentSupabaseKey !== key) {
        supabase = createClient(url, key);
        currentSupabaseUrl = url;
        currentSupabaseKey = key;
    }
    return supabase;
};

// Utility to convert base64 data URL to a Blob for uploading
const base64ToBlob = (base64String: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64String.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}


/**
 * Verifies that the Supabase credentials are correct and the required
 * database table and storage bucket exist.
 */
export const verifySupabaseConnection = async (supabaseUrl: string, supabaseAnonKey: string): Promise<{ success: boolean; message: string }> => {
    try {
        const client = getSupabaseClient(supabaseUrl, supabaseAnonKey);

        // 1. Verify table exists and is readable
        const { error: tableError } = await client
            .from('approved_memes')
            .select('id')
            .limit(1);

        if (tableError) {
            console.error('[Supabase Check] Table query failed:', JSON.stringify(tableError, null, 2));
            const tableErrorMessage = tableError.message.toLowerCase();

            // Check for common "table not found" messages from Supabase/PostgREST. This is more robust.
            if (tableErrorMessage.includes('relation "approved_memes" does not exist') || tableErrorMessage.includes("could not find the table 'public.approved_memes'")) {
                throw new Error("Connection failed: The 'approved_memes' table was not found. Please run the setup SQL in your Supabase project.");
            }
            // A common error for wrong keys/URL is a JWT error.
            if (tableErrorMessage.includes('jwt')) {
                throw new Error("Authentication error: Your Supabase URL or Anon Key is incorrect. Please double-check them.");
            }
            throw new Error(`Database error: ${tableError.message}`);
        }

        // 2. Verify storage bucket exists
        const { data: bucketData, error: bucketError } = await client
            .storage
            .getBucket('memes');

        if (bucketError) {
             console.error('[Supabase Check] Bucket check failed:', JSON.stringify(bucketError, null, 2));
             // FIX: The `StorageError` type does not have a `statusCode` property.
             // Check for a `status` property (common in API errors) by casting to `any`.
             // This handles cases where the bucket isn't found, which returns a 404.
             if ((bucketError as any).status === 404 || bucketError.message?.toLowerCase().includes("not found")) {
                throw new Error("Connection failed: The 'memes' storage bucket was not found. Please create a public bucket with this exact name.");
            }
            throw new Error(`Storage error: ${bucketError.message}`);
        }
        
        if (!bucketData.public) {
            throw new Error("Connection failed: The 'memes' storage bucket is not public. Please edit the bucket policies to make it public.");
        }

        return { success: true, message: 'Supabase connection successful! You can now generate memes.' };

    } catch (error) {
        // This catch block handles thrown errors from above and any other exceptions.
        if (error instanceof Error) {
            // Log the raw error for deeper debugging if needed
            console.error('[Supabase Connection] Raw error:', error);
            return { success: false, message: error.message };
        }
        return { success: false, message: 'An unknown error occurred during the connection test.' };
    }
};


/**
 * Retrieves the list of approved meme concepts from the Supabase backend.
 */
export const getApprovedMemes = async (supabaseUrl: string, supabaseAnonKey: string): Promise<ApprovedMemeConcept[]> => {
    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn("Supabase not configured. Cannot fetch fine-tuning examples.");
        return [];
    }
    
    try {
        const client = getSupabaseClient(supabaseUrl, supabaseAnonKey);
        const { data, error } = await client
            .from('approved_memes')
            .select('top_text, bottom_text, image_prompt, model_used')
            .order('created_at', { ascending: false })
            .limit(MAX_EXAMPLES);

        if (error) throw error;

        // Map Supabase snake_case to our camelCase type
        const concepts = data.map(item => ({
            topText: item.top_text,
            bottomText: item.bottom_text,
            imagePrompt: item.image_prompt,
            modelUsed: item.model_used as 'gemini' | 'dalle',
        }));
        
        console.log(`[Supabase] Found ${concepts.length} approved memes for fine-tuning.`);
        return concepts;

    } catch (error) {
        console.error("[Supabase] Failed to retrieve memes:", error);
        return [];
    }
};

/**
 * Saves a new approved meme to the Supabase backend.
 */
export const addApprovedMeme = async (newMeme: GeneratedMeme, supabaseUrl: string, supabaseAnonKey: string): Promise<void> => {
    console.log(`[Supabase] Received request to save meme ${newMeme.id}.`);
    
    const client = getSupabaseClient(supabaseUrl, supabaseAnonKey);
    
    // 1. Upload Image to Supabase Storage
    const mimeType = newMeme.imageUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    const imageBlob = base64ToBlob(newMeme.imageUrl, mimeType);
    const filePath = `public/${newMeme.id}.${mimeType.split('/')[1]}`;

    const { error: uploadError } = await client.storage
        .from('memes')
        .upload(filePath, imageBlob, {
            cacheControl: '3600',
            upsert: true // Overwrite if it exists
        });

    if (uploadError) {
        console.error("[Supabase] Image upload failed:", uploadError);
        const errorMessage = uploadError.message.toLowerCase();
        
        // Specific check for Row-Level Security policy errors
        if (errorMessage.includes("security policy") || errorMessage.includes("violates row-level security")) {
            throw new Error("Failed to upload image: Supabase storage is blocking the upload due to a missing or incomplete security policy. Please run the full 'Storage Policy SQL' from the Admin panel, which must include INSERT, UPDATE, and SELECT permissions.");
        }
        
        if (errorMessage.includes("not found")) {
             throw new Error("Failed to upload image: The 'memes' storage bucket was not found. Please verify your Supabase setup.");
        }
        throw new Error("Failed to upload meme image to the backend.");
    }

    // 2. Get Public URL for the uploaded image
    const { data: urlData } = client.storage
        .from('memes')
        .getPublicUrl(filePath);
    
    const publicImageUrl = urlData.publicUrl;

    // 3. Insert Meme Metadata into Supabase Table
    const { error: insertError } = await client
        .from('approved_memes')
        .insert({
            id: newMeme.id,
            top_text: newMeme.topText,
            bottom_text: newMeme.bottomText,
            image_prompt: newMeme.imagePrompt,
            model_used: newMeme.modelUsed,
            image_url: publicImageUrl,
        });
    
    if (insertError) {
        console.error("[Supabase] Database insert failed:", JSON.stringify(insertError, null, 2));
        const errorMessage = insertError.message.toLowerCase();
        
        // Check for common RLS policy error on the table itself
        if (errorMessage.includes("security policy for table") || errorMessage.includes("violates row-level security")) {
            throw new Error("Failed to save metadata: The 'approved_memes' table is blocking the action due to a missing security policy. Please run the full 'Table Policy SQL' from the Admin panel.");
        }

        throw new Error(`Failed to save meme metadata: ${insertError.message}`);
    }
    
    console.log(`[Supabase] Meme ${newMeme.id} saved successfully.`);
};


/**
 * Analyzes the history of approved memes to determine which image model is preferred.
 */
export const getModelPreference = async (supabaseUrl: string, supabaseAnonKey: string): Promise<{ gemini: number, dalle: number }> => {
    const approved = await getApprovedMemes(supabaseUrl, supabaseAnonKey);
    if (approved.length === 0) {
        return { gemini: 3, dalle: 2 };
    }

    const dalleCount = approved.filter(m => m.modelUsed === 'dalle').length;
    const geminiCount = approved.length - dalleCount;

    if (dalleCount > geminiCount) {
        return { gemini: 2, dalle: 3 };
    } else {
        return { gemini: 3, dalle: 2 };
    }
};