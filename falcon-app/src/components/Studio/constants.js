// ─── Intent metadata ──────────────────────────────────────────────────────────
export const INTENT_META = {
  process:         { label: 'Mermaid',      bg: '#ede9fe', text: '#6d28d9' },
  architecture:    { label: 'Mermaid',      bg: '#ede9fe', text: '#6d28d9' },
  timeline:        { label: 'Mermaid',      bg: '#ede9fe', text: '#6d28d9' },
  math:            { label: 'Manim',        bg: '#dbeafe', text: '#1d4ed8' },
  concept_analogy: { label: 'Diagram',      bg: '#fef3c7', text: '#b45309' },
  comparison:      { label: 'Diagram',      bg: '#fef3c7', text: '#b45309' },
  illustration:    { label: 'Illustration', bg: '#fce7f3', text: '#be185d' },
}

export const ACCENT_BY_INTENT = {
  process:         '#c7d2fe',
  architecture:    '#c7d2fe',
  timeline:        '#c7d2fe',
  math:            '#bfdbfe',
  concept_analogy: '#fde68a',
  comparison:      '#fde68a',
  illustration:    '#fbcfe8',
}

// ─── Follow-up suggestions per intent ────────────────────────────────────────
export const FOLLOWUP_SUGGESTIONS = {
  math:            ['Visual proof',          'Real-world example',    'Step by step',           'The converse'],
  illustration:    ['How does it work?',     'More detail',           'Compare with something', 'Show the process'],
  process:         ['Show the failure case', 'Compare alternatives',  'Explain each step',      'Draw a sequence diagram'],
  architecture:    ['Zoom into one part',    'Show the data flow',    'Scaling strategy',       'Trade-offs'],
  concept_analogy: ['Show me in code',       'Another analogy',       'Common mistakes',        'Practical use'],
  comparison:      ['When to use each?',     'Performance comparison','Real example',            'Trade-offs'],
  timeline:        ['What happened between?','Key turning points',    "What's next?",            'The impact'],
}

// ─── Prompt bar initial suggestions ──────────────────────────────────────────
export const INITIAL_SUGGESTIONS = [
  "Newton's laws of motion",
  "How does TCP/IP work?",
  "Pythagorean theorem",
  "How does recursion work?",
  "HTTP vs HTTPS",
]

// ─── Utilities ────────────────────────────────────────────────────────────────
export function relativeTime(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000)
  if (diff < 60)    return 'Just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function getFrameType(imagePath) {
  if (!imagePath) return 'placeholder'
  if (imagePath.toLowerCase().endsWith('.mp4')) return 'video'
  if (imagePath.toLowerCase().endsWith('.png')) return 'image'
  return 'placeholder'
}

export function intentMeta(intentType) {
  return INTENT_META[intentType] || { label: intentType || '?', bg: '#f1f5f9', text: '#64748b' }
}
