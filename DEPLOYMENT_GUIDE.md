# Inkeep Run API - Netlify Deployment Guide

## Prerequisites
- Turso database URL and auth token
- Nango secret key
- OpenAI API key
- Anthropic API key (optional)
- Google Gemini API key (optional)

## Environment Variables for Netlify

Set these in your Netlify dashboard under Site Settings > Environment Variables:

```
ENVIRONMENT=production
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-key
INKEEP_AGENTS_RUN_API_BYPASS_SECRET=<generate-with-openssl-rand-hex-32>
TURSO_DATABASE_URL=libsql://party-time-maddiedreese.aws-us-west-2.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NTkyNzY2NDYsImlkIjoiNDM0YzIyYjktY2NkMi00NWE5LWI3YjctOTZjZDAzZjM2YTAxIiwicmlkIjoiMDAwNjNkOTYtYTAxZi00ODRjLTk1MDctYzBkYmIxYTQ4MDUzIn0.-1zsr0K3Y_698fyNmDLae5IyQjahRzgo5mDz3NcPcbNM3PMxkxXjTWZPpU0aO0sLFH6zxDiAWLjkP0tqf_yqAQ
NANGO_SECRET_KEY=e4aed064-122b-49da-b488-b9b6cd769cda
NANGO_SERVER_URL=https://api.nango.dev
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://ingest.us.signoz.cloud:443/v1/traces
OTEL_EXPORTER_OTLP_TRACES_HEADERS=signoz-ingestion-key=your-signoz-key
```

## Deployment Steps

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/voice-party-host-inkeep-run-api.git
   git push -u origin main
   ```

2. **Deploy to Netlify**:
   - Go to https://app.netlify.com
   - Click "New site from Git"
   - Connect your GitHub repository
   - Build settings are already configured in netlify.toml
   - Add environment variables
   - Deploy

3. **Test the deployment**:
   - Visit your Netlify URL
   - Should see the API running

## Next Steps
After deployment, you'll get a URL like `https://your-run-api.netlify.app`
Save this URL for the Manage UI configuration.
