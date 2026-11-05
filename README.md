# Kiss My Face New York: AI Meme Generator

A meme generator built for Kiss My Face New York, a NYC nightlife project. Enter a
news headline, or paste Instagram posts as inspiration, and it drafts five topical
memes for the team to approve or reject. Approved memes are saved and fed back to
the model as examples, so later batches lean toward what the team actually liked.

## Features

- Captions and image prompts written by Gemini 2.5 Pro
- Images from Gemini 2.5 Flash Image or OpenAI DALL·E 3
- Approve, reject or regenerate each meme
- Feedback loop: approved memes are stored in a Supabase `approved_memes` table and
  included as examples in the next prompt; the app also tracks which image model
  gets approved more often
- Autopilot mode: generates a fresh batch once a day from saved inspiration

## Tech

React 19, TypeScript, Vite, Google Gemini API, OpenAI API, Supabase.

## Run locally

Requires Node.js, a Gemini API key, and (for the feedback loop) a Supabase project.

```bash
npm install
echo "GEMINI_API_KEY=your-key" > .env.local
npm run dev
```

The Supabase URL and anon key are entered in the app. The SQL that creates the
`approved_memes` table is in `services/feedbackService.ts`.
