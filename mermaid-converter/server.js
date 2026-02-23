import express from 'express';
import { JSDOM } from 'jsdom';

// Set up a jsdom browser environment before any package that needs DOM is imported.
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  pretendToBeVisual: true,
});

const { window } = dom;

global.window    = window;
global.document  = window.document;
global.navigator = window.navigator;

// Mermaid calls SVG layout methods that jsdom doesn't implement.
// Patch them on Element.prototype (covers all SVG element subclasses) before
// parseMermaidToExcalidraw is imported so every element instance inherits them.

// getBBox — returns the bounding box of an element; used for node sizing.
window.Element.prototype.getBBox = function () {
  const text = this.textContent || '';
  return { x: 0, y: 0, width: Math.max(text.length * 8, 50), height: 20 };
};

// getTotalLength — returns path length; used for edge routing.
window.Element.prototype.getTotalLength = function () {
  return 100;
};

// getComputedTextLength — used for text-overflow measurement.
window.Element.prototype.getComputedTextLength = function () {
  return (this.textContent || '').length * 8;
};

// getPointAtLength — used with getTotalLength for path midpoints.
window.Element.prototype.getPointAtLength = function () {
  return { x: 0, y: 0 };
};

// Dynamic import — evaluated AFTER all globals and patches are in place.
const { parseMermaidToExcalidraw } = await import('@excalidraw/mermaid-to-excalidraw');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/convert', async (req, res) => {
  const { mermaid } = req.body;
  if (!mermaid) return res.status(400).json({ error: 'mermaid field required' });
  try {
    const { elements } = await parseMermaidToExcalidraw(mermaid, { fontSize: 16 });
    res.json({ elements });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Mermaid converter running on :${PORT}`));
