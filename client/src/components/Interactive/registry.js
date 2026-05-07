import { lazy } from 'react'
import SandboxedFrame  from './SandboxedFrame'

// Light — loaded eagerly (small, used on nearly every session)
import CodeWalkthrough from './entities/CodeWalkthrough'
import StepControls    from './entities/StepControls'
import MathFormula     from './entities/MathFormula'
import TimelineViewer  from './entities/TimelineViewer'
import TableViewer     from './entities/TableViewer'
import TerminalOutput  from './entities/TerminalOutput'
import DiffViewer      from './entities/DiffViewer'
import QuizBlock       from './entities/QuizBlock'
import FlashcardDeck   from './entities/FlashcardDeck'

// Heavy — lazy loaded so they only download when actually rendered.
// mermaid ~400 KB, reactflow ~300 KB, leaflet ~280 KB, recharts ~200 KB
const MermaidViewer  = lazy(() => import('./entities/MermaidViewer'))
const GraphCanvas    = lazy(() => import('./entities/GraphCanvas'))
const MoleculeViewer = lazy(() => import('./entities/MoleculeViewer'))
const MapViewer      = lazy(() => import('./entities/MapViewer'))
const P5Sketch       = lazy(() => import('./entities/P5Sketch'))
const ChartViewer    = lazy(() => import('./entities/ChartViewer'))

// Each entry: { component, getCopyText?, noExpand? }
// getCopyText(props) → string | null — used by BlockWrapper's copy button
// noExpand: true — skip the expand modal (entity has its own fullscreen or doesn't work in portals)
export const REGISTRY = {
  mermaid_viewer:   { component: MermaidViewer },   // has own copy button in toolbar
  code_walkthrough: { component: CodeWalkthrough },  // has own copy button in header
  step_controls:    { component: StepControls,   noExpand: true },
  freeform_html:    { component: SandboxedFrame, noExpand: true },
  math_formula:     {
    component: MathFormula,
    getCopyText: p => p.latex ?? (Array.isArray(p.steps) ? p.steps.map(s => s.latex ?? '').join('\n') : ''),
  },
  chart:            { component: ChartViewer },
  graph_canvas:     { component: GraphCanvas,    noExpand: true },
  molecule_viewer:  { component: MoleculeViewer },
  map_viewer:       { component: MapViewer,      noExpand: true },
  timeline:         { component: TimelineViewer },
  table_viewer:     {
    component: TableViewer,
    getCopyText: p => {
      if (!Array.isArray(p.rows) || !Array.isArray(p.columns)) return ''
      const header = p.columns.map(c => c.label ?? c.key).join('\t')
      const rows   = p.rows.map(r => p.columns.map(c => {
        const v = r[c.key]
        return v !== null && typeof v === 'object' ? (v.text ?? '') : (v ?? '')
      }).join('\t'))
      return [header, ...rows].join('\n')
    },
  },
  terminal_output:  { component: TerminalOutput },  // has own copy button in title bar
  diff_viewer:      { component: DiffViewer,     noExpand: true },
  p5_sketch:        { component: P5Sketch,       noExpand: true },
  quiz_block:       { component: QuizBlock },
  flashcard_deck:   {
    component: FlashcardDeck,
    getCopyText: p => (p.cards ?? []).map(c => `Q: ${c.front}\nA: ${c.back}`).join('\n\n'),
  },
}

export function resolveEntity(type) {
  return REGISTRY[type]?.component ?? SandboxedFrame
}

export function getBlockMeta(type) {
  return REGISTRY[type] ?? {}
}
