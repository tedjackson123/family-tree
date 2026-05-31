# Family Tree App

A local family tree application with AI-powered story generation. Built with Node.js, Express, React, and Claude API.

## Features

- **Add/Edit/Delete** family members with full biographical details
- **Relationships**: Connect parents, children, spouses, siblings
- **Interactive Tree View**: Visual family tree with drag-to-pan and scroll-to-zoom
- **Auto-Centering**: Layout algorithm keeps parents centered over children across generations
- **Story Generation**: Claude AI generates 500-word family narratives (using cheapest Haiku model)
- **Persistent Storage**: Auto-saves to browser localStorage
- **Import/Export**: Share family trees as JSON files

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Get an Anthropic API Key**:
   - Go to https://console.anthropic.com/
   - Create an account and generate an API key
   - Keep it handy (you'll paste it in the app to generate stories)

3. **Run the server**:
   ```bash
   npm start
   ```
   Server runs at `http://localhost:3000`

4. **Open in browser**:
   - Navigate to http://localhost:3000
   - Start adding family members!

## Fields

Each family member can have:
- Full name, nickname, maiden name
- Birth/death years
- Birth place
- Occupation
- Origin/nationality
- Biographical notes

## Relationships

Connect family members with:
- **Parent-of / Child-of**: Vertical parent–child connections
- **Spouse-of**: Dashed red lines for marriages
- **Sibling-of**: Dashed green lines for siblings

## Story Generation

- Click "Our Story" tab
- Paste your Anthropic API key
- Click "Generate Our Story"
- AI writes a warm, 500-word family narrative
- Regenerate or copy the story anytime

**Cost**: ~$0.001 per story (uses Claude Haiku)

## Import/Export

- **Export**: Download your tree as JSON to share with family
- **Import**: Load a JSON file or paste JSON to merge trees
- Data is encrypted in transit (HTTPS to API) and stored locally in your browser

## Storage

- All data stored in browser's localStorage
- No server-side storage (fully private)
- Survives browser restart
- Clear browser data to reset

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: React 18 (no build step, uses CDN)
- **Tree Layout**: Custom SVG with Bezier curves
- **AI**: Anthropic Claude API (Haiku model)
- **Persistence**: Browser localStorage

## Development

File structure:
```
family-tree/
├── server.js          (Express server + API proxy)
├── public/
│   └── index.html     (Single-file React app)
└── package.json
```

To customize:
- Colors: Edit CSS variables in `--warm-bg`, `--accent`, etc.
- Layout: Adjust `NODE_W`, `NODE_H`, `GAP_X`, `GAP_Y` in tree layout function
- Story prompt: Edit the prompt builder in `StoryTab`
