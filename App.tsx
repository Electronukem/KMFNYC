import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { GeneratedMeme, ApprovedMemeConcept } from './types';
import { generateMemesFromHeadline, generateMemesFromInspiration, sendApprovalEmail, generateImage, generateImageWithDalle, generateImageAltText, generateMemeImageWithFallback } from './services/geminiService';
import { getApprovedMemes, addApprovedMeme } from './services/feedbackService';
import Header from './components/Header';
import MemeCard from './components/MemeCard';
import LoadingSpinner from './components/LoadingSpinner';
import ApiKeyManager from './components/ApiKeyManager';

const getFriendlyErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message.includes('OpenAI Billing Limit Reached')) {
      return error.message;
    }
    if (error.message.toLowerCase().includes('quota') || error.message.includes('RESOURCE_EXHAUSTED')) {
      return 'API Quota Exceeded: Please check your plan and billing details with the API provider.';
    }
    if (error.message.includes('DALL-E API Error:') || error.message.includes('Invalid response from OpenAI API')) {
        return `OpenAI Error: ${error.message.replace('DALL-E API Error: ', '')}`;
    }
    if (error.message.includes('Invalid response from Gemini API')) {
        return `Gemini Error: ${error.message}`;
    }
    return 'An AI service failed. This could be due to a temporary outage or a rejected prompt. Please adjust your input or try again later.';
  }
  return 'An unknown error occurred. Please check the console and try again.';
};


const App: React.FC = () => {
  // State for headline generator
  const [headline, setHeadline] = useState<string>('');
  
  // State for inspiration generator
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [instagramLinks, setInstagramLinks] = useState<string>('');

  // State for autopilot generator
  const [isAutopilotOn, setIsAutopilotOn] = useState<boolean>(false);
  const [autopilotPrompt, setAutopilotPrompt] = useState<string>('');
  const [autopilotLinks, setAutopilotLinks] = useState<string>('');
  const autopilotIntervalRef = useRef<number | undefined>(undefined);

  // Shared state
  const [memes, setMemes] = useState<GeneratedMeme[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [emailSent, setEmailSent] = useState<boolean>(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [regeneratingMemeId, setRegeneratingMemeId] = useState<string | null>(null);
  
  // API Keys & Backend Config
  const [openAiApiKey, setOpenAiApiKey] = useState<string>('');
  const [supabaseUrl, setSupabaseUrl] = useState<string>('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState<string>('');
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(false);

  const handleLogin = () => setIsLoggedIn(true);
  const handleLogout = () => setIsLoggedIn(false);

  // A generic function to run any meme generation logic
  const runMemeGeneration = useCallback(async (generatorType: 'headline' | 'inspiration') => {
    if (isLoading) return;
    if (!isSupabaseConnected) {
      setError("Please configure and test your Supabase connection in the admin panel to generate memes.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setMemes([]);
    setEmailSent(false);

    try {
      const examples = await getApprovedMemes(supabaseUrl, supabaseAnonKey);
      let generatedMemes: GeneratedMeme[];
      
      if (generatorType === 'headline') {
          generatedMemes = await generateMemesFromHeadline(headline, examples, openAiApiKey, supabaseUrl, supabaseAnonKey);
      } else {
          generatedMemes = await generateMemesFromInspiration(instagramLinks, customPrompt, examples, openAiApiKey, supabaseUrl, supabaseAnonKey);
      }
      setMemes(generatedMemes);

    } catch (err) {
      console.error(err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, headline, instagramLinks, customPrompt, openAiApiKey, supabaseUrl, supabaseAnonKey, isSupabaseConnected]);

  const handleGenerateFromHeadline = useCallback(() => {
    if (!headline.trim()) return;
    runMemeGeneration('headline');
  }, [headline, runMemeGeneration]);

  const handleGenerateFromInspiration = useCallback(() => {
    if (!customPrompt.trim() || !instagramLinks.trim()) return;
    runMemeGeneration('inspiration');
  }, [customPrompt, instagramLinks, runMemeGeneration]);

  const handleToggleAutopilot = () => {
    if (!isAutopilotOn) {
      if (!isSupabaseConnected) {
        setError("Please configure and test your Supabase connection before enabling Autopilot.");
        return;
      }
      if (!autopilotPrompt.trim() || !autopilotLinks.trim()) {
        setError("Please set a prompt and provide inspiration links before enabling Autopilot.");
        return;
      }
    }
    setError(null);
    setIsAutopilotOn(prev => !prev);
  };

  // Effect to simulate the daily autopilot job
  useEffect(() => {
    const runAutopilotTask = async () => {
      // NOTE: This is a frontend simulation of a backend cron job.
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const lastRunDate = localStorage.getItem('lastAutopilotRunDate');

      if (now.getHours() === 8 && lastRunDate !== today && isSupabaseConnected) {
        console.log(`[${now.toLocaleTimeString()}] AUTOPILOT TRIGGERED! Generating memes...`);
        localStorage.setItem('lastAutopilotRunDate', today);

        try {
          const examples = await getApprovedMemes(supabaseUrl, supabaseAnonKey);
          const autopilotMemes = await generateMemesFromInspiration(autopilotLinks, autopilotPrompt, examples, openAiApiKey, supabaseUrl, supabaseAnonKey);
          const successfulMemes = autopilotMemes.filter(m => m.status !== 'rejected');
          if (successfulMemes.length > 0) {
            await sendApprovalEmail(
              successfulMemes,
              'admin@kissmyfacenewyork.com',
              `KMFNY Autopilot Memes: ${today}`
            );
            console.log("Autopilot email successfully sent.");
          } else {
            console.warn("Autopilot: All meme generations failed. No email sent.");
          }
        } catch (err) {
          console.error("Autopilot task failed:", err);
        }
      }
    };

    if (isAutopilotOn) {
      runAutopilotTask();
      autopilotIntervalRef.current = window.setInterval(runAutopilotTask, 5 * 60 * 1000);
    }

    return () => {
      if (autopilotIntervalRef.current) {
        clearInterval(autopilotIntervalRef.current);
      }
    };
  }, [isAutopilotOn, autopilotPrompt, autopilotLinks, openAiApiKey, supabaseUrl, supabaseAnonKey, isSupabaseConnected]);

  const handleStatusChange = (id: string, status: 'approved' | 'rejected' | 'pending') => {
    setMemes(currentMemes =>
      currentMemes.map(meme =>
        meme.id === id ? { ...meme, status } : meme
      )
    );
  };
  
  const handleApprove = async (id:string) => {
    if (!isSupabaseConnected) {
      setError("Please test and verify your Supabase connection in the admin panel.");
      return;
    }
    const memeToApprove = memes.find(meme => meme.id === id);
    if (!memeToApprove) return;

    // Optimistic UI update
    handleStatusChange(id, 'approved');
    
    try {
        // Asynchronously save to the backend
        await addApprovedMeme(memeToApprove, supabaseUrl, supabaseAnonKey);
    } catch (err) {
        console.error("Failed to save meme to backend:", err);
        // Revert the change if the backend call fails
        handleStatusChange(id, 'pending');
        setError(getFriendlyErrorMessage(err));
    }
  };

  const handleReject = (id:string) => handleStatusChange(id, 'rejected');

  const handleRegenerate = async (id: string) => {
    if (regeneratingMemeId) return; // Prevent multiple regenerations at once

    const memeToRegenerate = memes.find(m => m.id === id);
    if (!memeToRegenerate) return;

    setRegeneratingMemeId(id);
    setError(null);

    try {
      const { imageUrl: newImageUrl, modelUsed: newModelUsed } = await generateMemeImageWithFallback(
        memeToRegenerate.imagePrompt,
        memeToRegenerate.modelUsed,
        openAiApiKey
      );
      const newAltText = await generateImageAltText(memeToRegenerate);

      setMemes(currentMemes =>
        currentMemes.map(meme =>
          meme.id === id
            ? {
                ...meme,
                imageUrl: newImageUrl,
                altText: newAltText,
                status: 'pending',
                modelUsed: newModelUsed,
              }
            : meme
        )
      );
    } catch (err) {
      console.error("Failed to regenerate image:", err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setRegeneratingMemeId(null);
    }
  };

  const handleSendEmail = async () => {
    if (isSendingEmail || memes.length === 0) return;

    setIsSendingEmail(true);
    setError(null);

    try {
      await sendApprovalEmail(memes, 'admin@kissmyfacenewyork.com', 'New Memes for Approval');
      setEmailSent(true);
    } catch (err) {
      console.error("Failed to send approval email:", err);
      setError("Could not send the approval email. Please try again.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const displayedMemes = isLoggedIn ? memes : memes.filter(meme => meme.status === 'approved');

  return (
    <div className="min-h-screen text-white font-sans bg-gray-950">
      <Header isLoggedIn={isLoggedIn} onLogin={handleLogin} onLogout={handleLogout} />
      <main className="container mx-auto px-4 py-8 md:py-12">
        {isLoggedIn && (
          <>
            <ApiKeyManager 
              openAiApiKey={openAiApiKey} setOpenAiApiKey={setOpenAiApiKey}
              supabaseUrl={supabaseUrl} setSupabaseUrl={setSupabaseUrl}
              supabaseAnonKey={supabaseAnonKey} setSupabaseAnonKey={setSupabaseAnonKey}
              isSupabaseConnected={isSupabaseConnected}
              setIsSupabaseConnected={setIsSupabaseConnected}
            />

            <div className="max-w-3xl mx-auto bg-gray-900/50 p-6 rounded-lg border border-cyan-500/30 shadow-lg shadow-cyan-500/10 mb-8">
              <h2 className="text-2xl font-bold text-center mb-4 text-gray-200">Generate Today's Memes</h2>
              <p className="text-center text-gray-400 mb-6">Enter a news headline or a trending topic to create 5 fresh memes for the timeline.</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g., 'Local Drag Queen Wins Nobel Prize'"
                  className="flex-grow bg-gray-800 border-2 border-gray-700 focus:border-pink-500 focus:ring-pink-500 rounded-lg px-4 py-3 text-white placeholder-gray-500 transition-colors"
                  disabled={isLoading}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerateFromHeadline()}
                />
                <button
                  onClick={handleGenerateFromHeadline}
                  disabled={isLoading || !headline.trim() || !isSupabaseConnected}
                  className="bg-gradient-to-r from-pink-500 to-cyan-400 hover:from-pink-600 hover:to-cyan-500 text-white font-bold py-3 px-8 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                >
                  {isLoading ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>

            <div className="max-w-3xl mx-auto bg-gray-900/50 p-6 rounded-lg border border-pink-500/30 shadow-lg shadow-pink-500/10 mb-8">
                <h2 className="text-2xl font-bold text-center mb-4 text-gray-200">Generate from Inspiration</h2>
                <p className="text-center text-gray-400 mb-6">Use Instagram pages as a vibe check and add a prompt to create 5 new memes.</p>
                <div className="flex flex-col gap-4">
                    <input
                        type="text"
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="e.g., 'The feeling after the function'"
                        className="w-full bg-gray-800 border-2 border-gray-700 focus:border-cyan-500 focus:ring-cyan-500 rounded-lg px-4 py-3 text-white placeholder-gray-500 transition-colors"
                        disabled={isLoading}
                    />
                    <textarea
                        value={instagramLinks}
                        onChange={(e) => setInstagramLinks(e.target.value)}
                        placeholder="Paste Instagram URLs, separated by commas..."
                        className="w-full bg-gray-800 border-2 border-gray-700 focus:border-cyan-500 focus:ring-cyan-500 rounded-lg px-4 py-3 text-white placeholder-gray-500 transition-colors resize-y"
                        rows={3}
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleGenerateFromInspiration}
                        disabled={isLoading || !customPrompt.trim() || !instagramLinks.trim() || !isSupabaseConnected}
                        className="bg-gradient-to-r from-cyan-400 to-pink-500 hover:from-cyan-500 hover:to-pink-600 text-white font-bold py-3 px-8 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                    >
                        {isLoading ? 'Generating...' : 'Generate from Vibe'}
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto bg-gray-900/50 p-6 rounded-lg border border-purple-500/30 shadow-lg shadow-purple-500/10 mb-12">
              <h2 className="text-2xl font-bold text-center mb-4 text-gray-200">Autopilot Meme Generation</h2>
              <p className="text-center text-gray-400 mb-6">
                Set a recurring theme. The AI will automatically generate and email 5 memes to{' '}
                <code className="bg-gray-800 text-purple-300 px-1 rounded">admin@kissmyfacenewyork.com</code> daily at 8 AM EST.
              </p>
              <div className="flex flex-col gap-4">
                <input
                  type="text"
                  value={autopilotPrompt}
                  onChange={(e) => setAutopilotPrompt(e.target.value)}
                  placeholder="Enter a recurring prompt (e.g., 'That Friday feeling')"
                  className="w-full bg-gray-800 border-2 border-gray-700 focus:border-purple-500 focus:ring-purple-500 rounded-lg px-4 py-3 text-white placeholder-gray-500 transition-colors disabled:bg-gray-800/50 disabled:cursor-not-allowed"
                  disabled={isAutopilotOn}
                />
                <textarea
                  value={autopilotLinks}
                  onChange={(e) => setAutopilotLinks(e.target.value)}
                  placeholder="Paste inspiration Instagram URLs..."
                  className="w-full bg-gray-800 border-2 border-gray-700 focus:border-purple-500 focus:ring-purple-500 rounded-lg px-4 py-3 text-white placeholder-gray-500 transition-colors resize-y disabled:bg-gray-800/50 disabled:cursor-not-allowed"
                  rows={2}
                  disabled={isAutopilotOn}
                />
                <button
                  onClick={handleToggleAutopilot}
                  disabled={(!autopilotPrompt.trim() || !autopilotLinks.trim() || !isSupabaseConnected) && !isAutopilotOn}
                  className={`font-bold py-3 px-8 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isAutopilotOn
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600'
                  }`}
                >
                  {isAutopilotOn ? '⏹️ Disable Autopilot' : '▶️ Enable Autopilot'}
                </button>
              </div>
               {isAutopilotOn && (
                <p className="text-center text-green-400 mt-4 animate-pulse">
                  Autopilot is active. Checking for new tasks every 5 minutes...
                </p>
              )}
            </div>
          </>
        )}

        {error && (
          <div className="max-w-3xl mx-auto bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg relative mb-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {isLoading && <div className="text-center my-12"><LoadingSpinner /></div>}

        {!isLoading && memes.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              {memes.map(meme => (
                <MemeCard
                  key={meme.id}
                  meme={meme}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onRegenerate={handleRegenerate}
                  isRegenerating={regeneratingMemeId === meme.id}
                  isLoggedIn={isLoggedIn}
                />
              ))}
            </div>

            {isLoggedIn && (
              <div className="text-center mt-12">
                <button
                  onClick={handleSendEmail}
                  disabled={isSendingEmail || emailSent}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-10 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all transform hover:scale-105 text-lg"
                >
                  {isSendingEmail ? 'Sending...' : emailSent ? '✅ Email Sent!' : '📧 Email to Admin'}
                </button>
              </div>
            )}
          </>
        )}

        {!isLoading && displayedMemes.length === 0 && !isLoggedIn && (
          <div className="text-center text-gray-300 py-16">
            <h2 className="text-2xl font-bold mb-2">Nothing to see here... yet!</h2>
            <p>The admins haven't approved any memes today. Check back later!</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;