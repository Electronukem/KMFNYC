import React, { useState } from 'react';
import { verifySupabaseConnection } from '../services/feedbackService';

interface ApiKeyManagerProps {
  openAiApiKey: string;
  setOpenAiApiKey: (key: string) => void;
  supabaseUrl: string;
  setSupabaseUrl: (url: string) => void;
  supabaseAnonKey: string;
  setSupabaseAnonKey: (key: string) => void;
  isSupabaseConnected: boolean;
  setIsSupabaseConnected: (connected: boolean) => void;
}

const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ 
  openAiApiKey, 
  setOpenAiApiKey,
  supabaseUrl,
  setSupabaseUrl,
  supabaseAnonKey,
  setSupabaseAnonKey,
  isSupabaseConnected,
  setIsSupabaseConnected,
}) => {
  const [showTableCreationSql, setShowTableCreationSql] = useState(false);
  const [showStoragePolicySql, setShowStoragePolicySql] = useState(false);
  const [showTablePolicySql, setShowTablePolicySql] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');

  const tableCreationSqlToCopy = `CREATE TABLE approved_memes (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  top_text TEXT NOT NULL,
  bottom_text TEXT NOT NULL,
  image_prompt TEXT NOT NULL,
  model_used TEXT NOT NULL,
  image_url TEXT NOT NULL
);`;

  const storagePolicySqlToCopy = `-- This script configures your Supabase storage bucket for public access.
-- You MUST run this entire script in your Supabase SQL Editor to fix upload errors.
-- If you get an error like "policy ... already exists", it's safe to ignore.

-- STEP 1: Enable Row Level Security (RLS) on the storage objects table.
-- This is a one-time command that is required for any policies to work.
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- STEP 2: Create policy to allow the public (anon role) to UPLOAD images.
-- This is required for the application to save the generated memes.
CREATE POLICY "Allow public uploads to memes bucket"
ON storage.objects FOR INSERT TO anon
WITH CHECK ( bucket_id = 'memes' );

-- STEP 3: Create policy to allow the public (anon role) to UPDATE images.
-- This is required because the app uses an 'upsert' operation, which may
-- need to update a file if an ID collision occurs (e.g., regenerating a meme).
CREATE POLICY "Allow public updates to memes bucket"
ON storage.objects FOR UPDATE TO anon
USING ( bucket_id = 'memes' )
WITH CHECK ( bucket_id = 'memes' );

-- STEP 4: Create policy to allow the public (anon role) to VIEW images.
-- This is required for the application and website visitors to see the memes.
CREATE POLICY "Allow public reads of memes bucket"
ON storage.objects FOR SELECT TO anon
USING ( bucket_id = 'memes' );
`;

const tablePolicySqlToCopy = `-- This script configures your 'approved_memes' table for public access.
-- You MUST run this in your Supabase SQL Editor for the app to work.
-- This is required to save approved memes and fetch them as examples.

-- STEP 1: Enable Row Level Security (RLS) on the table.
-- This is a one-time command that is required for any policies to work.
ALTER TABLE public.approved_memes ENABLE ROW LEVEL SECURITY;

-- STEP 2: Create a policy to allow public READ access.
-- This allows the app to fetch approved memes as examples for the AI.
CREATE POLICY "Allow public read access to approved_memes"
ON public.approved_memes FOR SELECT
TO anon
USING (true);

-- STEP 3: Create a policy to allow public WRITE access.
-- This allows the app to save newly approved memes to your database.
CREATE POLICY "Allow public insert access to approved_memes"
ON public.approved_memes FOR INSERT
TO anon
WITH CHECK (true);
`;

  const handleCredentialsChange = () => {
    setIsSupabaseConnected(false);
    setConnectionStatus('idle');
    setConnectionMessage('');
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSupabaseUrl(e.target.value);
    handleCredentialsChange();
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSupabaseAnonKey(e.target.value);
    handleCredentialsChange();
  };

  const handleTestConnection = async () => {
    if (!supabaseUrl || !supabaseAnonKey) {
        setConnectionStatus('error');
        setConnectionMessage('Please enter both Supabase URL and Key.');
        return;
    }
    setIsTesting(true);
    setConnectionStatus('idle');
    
    const result = await verifySupabaseConnection(supabaseUrl, supabaseAnonKey);
    
    setIsTesting(false);
    setConnectionMessage(result.message);

    if (result.success) {
        setConnectionStatus('success');
        setIsSupabaseConnected(true);
    } else {
        setConnectionStatus('error');
        setIsSupabaseConnected(false);
    }
  };

  const InstructionStep: React.FC<{ number: number, title: string, children: React.ReactNode, isCritical?: boolean }> = ({ number, title, children, isCritical = false }) => (
    <div className={`p-4 ${isCritical ? 'bg-yellow-900/40 border-2 border-yellow-500/60' : ''} rounded-lg flex items-start gap-4`}>
        <div className="flex-shrink-0 pt-1">
        {isCritical ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
        ) : (
            <span className="flex items-center justify-center h-6 w-6 bg-purple-600 rounded-full text-sm font-bold">{number}</span>
        )}
        </div>
        <div>
            <p className={`font-bold ${isCritical ? 'text-yellow-300' : 'text-gray-200'} text-base`}>{isCritical ? title : `${number}. ${title}`}</p>
            <div className="mt-1">{children}</div>
        </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto bg-gray-900/50 p-6 rounded-lg border border-yellow-500/30 shadow-lg shadow-yellow-500/10 mb-12">
      <h2 className="text-2xl font-bold text-center mb-4 text-gray-200">API & Backend Configuration</h2>
      <p className="text-center text-gray-400 mb-6">
        Connect to your backend to save approved memes for fine-tuning.
        <br />
        <span className="text-sm text-yellow-400">
          Keys are stored only in your browser for this session.
        </span>
      </p>

      {/* Supabase Configuration */}
      <div className="mb-6 p-4 border border-purple-500/50 rounded-lg">
        <h3 className="text-lg font-bold text-purple-300 mb-2">Supabase Backend Setup</h3>
        <div className="text-sm text-gray-400 mb-4 space-y-3">
            <InstructionStep number={1} title="Get API Keys">
                <p>Go to your Supabase Project &gt; Settings &gt; API. Copy your <strong>Project URL</strong> and <strong>anon public key</strong> into the fields below.</p>
            </InstructionStep>
            
            <InstructionStep number={2} title="Create Storage Bucket" isCritical>
                <p>This is a common source of errors! Follow these steps exactly:</p>
                <ol className="list-decimal list-inside ml-2 mt-2 space-y-1">
                  <li>In Supabase, go to the <strong>Storage</strong> section.</li>
                  <li>Click <strong>"Create a new bucket"</strong>.</li>
                  <li>For the bucket name, enter exactly: <code className="bg-gray-700 text-yellow-300 py-0.5 px-1.5 rounded-md text-base">memes</code></li>
                  <li>Toggle the switch to make it a <strong className="text-white">Public bucket</strong>.</li>
                  <li>Click <strong>"Create bucket"</strong>.</li>
                </ol>
            </InstructionStep>
            
            <InstructionStep number={3} title="CRITICAL: Set Storage Policies" isCritical>
                <p>Without this step, image uploads will fail. You <strong className="text-white">MUST</strong> run the entire SQL script below in your Supabase SQL Editor to allow the app to save and view images.</p>
                <button onClick={() => setShowStoragePolicySql(!showStoragePolicySql)} className="text-cyan-400 hover:underline mt-2 text-left">({showStoragePolicySql ? 'Hide' : 'Show'} Required Storage Policy SQL)</button>
                 {showStoragePolicySql && (
                    <pre className="bg-gray-800 p-3 mt-2 rounded-md text-xs text-yellow-300 overflow-x-auto">
                      <code>{storagePolicySqlToCopy}</code>
                    </pre>
                  )}
            </InstructionStep>

            <InstructionStep number={4} title="Create Database Table">
                <p>Go to the SQL Editor. Run the setup script to create your database table for storing meme text.</p>
                <button onClick={() => setShowTableCreationSql(!showTableCreationSql)} className="text-cyan-400 hover:underline mt-2">({showTableCreationSql ? 'Hide' : 'Show'} Table Creation SQL)</button>
                 {showTableCreationSql && (
                    <pre className="bg-gray-800 p-3 mt-2 rounded-md text-xs text-yellow-300 overflow-x-auto">
                      <code>{tableCreationSqlToCopy}</code>
                    </pre>
                  )}
            </InstructionStep>
            
            <InstructionStep number={5} title="CRITICAL: Set Table Policies" isCritical>
                 <p>This is the final required SQL step. Without it, saving approved memes will fail. You <strong className="text-white">MUST</strong> run this SQL in your Supabase SQL editor.</p>
                <button onClick={() => setShowTablePolicySql(!showTablePolicySql)} className="text-cyan-400 hover:underline mt-2 text-left">({showTablePolicySql ? 'Hide' : 'Show'} Required Table Policy SQL)</button>
                 {showTablePolicySql && (
                    <pre className="bg-gray-800 p-3 mt-2 rounded-md text-xs text-yellow-300 overflow-x-auto">
                      <code>{tablePolicySqlToCopy}</code>
                    </pre>
                  )}
            </InstructionStep>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="supabase-url" className="text-sm font-bold text-gray-300 block mb-1">Supabase Project URL</label>
            <input
              id="supabase-url"
              type="text"
              value={supabaseUrl}
              onChange={handleUrlChange}
              placeholder="https://<your-project-ref>.supabase.co"
              className="w-full bg-gray-800 border-2 border-gray-700 focus:border-purple-500 focus:ring-purple-500 rounded-lg px-4 py-3 text-white placeholder-gray-500 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="supabase-key" className="text-sm font-bold text-gray-300 block mb-1">Supabase Anon (Public) Key</label>
            <input
              id="supabase-key"
              type="password"
              value={supabaseAnonKey}
              onChange={handleKeyChange}
              placeholder="Enter your Supabase anon key"
              className="w-full bg-gray-800 border-2 border-gray-700 focus:border-purple-500 focus:ring-purple-500 rounded-lg px-4 py-3 text-white placeholder-gray-500 transition-colors"
              autoComplete="off"
            />
          </div>
        </div>
        <button 
          onClick={handleTestConnection} 
          disabled={isTesting || !supabaseUrl || !supabaseAnonKey}
          className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTesting ? 'Testing...' : isSupabaseConnected ? '✓ Connected' : 'Test Connection'}
        </button>
        {connectionMessage && (
            <div className={`mt-4 text-center p-2 rounded-md text-sm font-semibold ${
                connectionStatus === 'success' ? 'bg-green-900/70 text-green-300' : 'bg-red-900/70 text-red-300'
            }`}>
                {connectionMessage}
            </div>
        )}
      </div>

      {/* OpenAI Configuration */}
      <div className="p-4 border border-cyan-500/50 rounded-lg">
        <h3 className="text-lg font-bold text-cyan-300 mb-2">OpenAI API (Optional)</h3>
        <p className="text-sm text-gray-400 mb-4">
          To enable DALL-E 3 image generation, enter your OpenAI API key. If left blank, Gemini will be used for all images.
        </p>
        <div className="flex flex-col gap-2">
          <label htmlFor="openai-key" className="text-sm font-bold text-gray-300">OpenAI API Key</label>
          <input
            id="openai-key"
            type="password"
            value={openAiApiKey}
            onChange={(e) => setOpenAiApiKey(e.target.value)}
            placeholder="Enter your OpenAI API key (sk-...)"
            className="w-full bg-gray-800 border-2 border-gray-700 focus:border-cyan-500 focus:ring-cyan-500 rounded-lg px-4 py-3 text-white placeholder-gray-500 transition-colors"
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
};

export default ApiKeyManager;