import express from 'express';
import { JSDOM } from 'jsdom';

// @excalidraw/mermaid-to-excalidraw uses DOMPurify internally which requires
// a browser DOM. Set up jsdom globals BEFORE the package is imported so that
// DOMPurify finds window/document and initialises correctly.
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Dynamic import so the module evaluates AFTER the globals above are set.
// Static top-level imports are hoisted and would run before the DOM is ready.
const { parseMermaidToExcalidraw } = await import('@excalidraw/mermaid-to-excalidraw');

const app = express();
app.use(express.json({ limit: '1mb' }));

// Health check — Python calls this to verify the sidecar is up
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Main conversion endpoint
// POST { mermaid: "<mermaid syntax string>" }
// Returns { elements: [...] }  — full Excalidraw element objects
app.post('/convert', async (req, res) => {
  const { mermaid } = req.body;
  if (!mermaid) {
    return res.status(400).json({ error: 'mermaid field required' });
  }
  try {
    const { elements } = await parseMermaidToExcalidraw(mermaid, { fontSize: 16 });
    res.json({ elements });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Mermaid converter running on :${PORT}`);
});
