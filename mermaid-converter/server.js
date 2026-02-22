import express from 'express';
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Health check — Python calls this to verify the sidecar is up before routing to Mermaid path
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Main conversion endpoint
// POST { mermaid: "<mermaid syntax string>" }
// Returns { elements: [...] }  — full Excalidraw element objects, ready to use
app.post('/convert', async (req, res) => {
  const { mermaid } = req.body;
  if (!mermaid) {
    return res.status(400).json({ error: 'mermaid field required' });
  }
  try {
    const { elements } = await parseMermaidToExcalidraw(mermaid, { fontSize: 16 });
    res.json({ elements });
  } catch (err) {
    // Return 400 so Python knows to fall back to slim JSON path
    res.status(400).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Mermaid converter running on :${PORT}`);
});
