# WHOP_AI_V3 - Master Architecture & Directives

## 1. Core Stack

- **Backend:** Node.js, Mongoose (MongoDB), Supabase (Auth/PostgreSQL).
- **Processing:** FFmpeg for video/audio synthesis.
- **AI/Agents:** Autonomous Creator, Voice Hook Library.
- **Security:** C2PA Signing for media provenance.

## 2. Advanced Editing Rules

- Always use the `precision-architect` skill when modifying core logic,
  especially around the `/api/ai` entry point.
- **FFmpeg Strictness:** Video processing scripts MUST output logs to a
  dedicated `logs/` directory, not the project root. Clean up temporary
  `.mp4` and `.wav` files upon process completion.
- **No Placeholders:** Write full, executable code blocks.

## 3. Verification Commands

- Before finalizing a task, run `./check.sh` to verify syntax and health.
- To test the AI backend: `curl -s http://localhost:<PORT>/api/health`
