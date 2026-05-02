/**
 * Entity registry — maps type strings to React components.
 *
 * To add a new entity:
 *   1. Create the component in ./entities/YourEntity.jsx
 *   2. Import and add one line to REGISTRY below
 *   3. Add prop schema to backend/services/interactive/prompts/component_catalog.md
 *
 * Unknown types fall back to SandboxedFrame (safe iframe fallback).
 */
import MermaidViewer   from './entities/MermaidViewer'
import CodeWalkthrough from './entities/CodeWalkthrough'
import StepControls    from './entities/StepControls'
import SandboxedFrame  from './SandboxedFrame'
import MathFormula     from './entities/MathFormula'
import ChartViewer     from './entities/ChartViewer'
import GraphCanvas     from './entities/GraphCanvas'
import MoleculeViewer  from './entities/MoleculeViewer'
import MapViewer       from './entities/MapViewer'
import TimelineViewer  from './entities/TimelineViewer'
import TableViewer     from './entities/TableViewer'
import TerminalOutput  from './entities/TerminalOutput'
import DiffViewer      from './entities/DiffViewer'
import P5Sketch        from './entities/P5Sketch'
import QuizBlock       from './entities/QuizBlock'
import FlashcardDeck   from './entities/FlashcardDeck'

export const REGISTRY = {
  mermaid_viewer:   MermaidViewer,
  code_walkthrough: CodeWalkthrough,
  step_controls:    StepControls,
  freeform_html:    SandboxedFrame,
  math_formula:     MathFormula,
  chart:            ChartViewer,
  graph_canvas:     GraphCanvas,
  molecule_viewer:  MoleculeViewer,
  map_viewer:       MapViewer,
  timeline:         TimelineViewer,
  table_viewer:     TableViewer,
  terminal_output:  TerminalOutput,
  diff_viewer:      DiffViewer,
  p5_sketch:        P5Sketch,
  quiz_block:       QuizBlock,
  flashcard_deck:   FlashcardDeck,
}

export function resolveEntity(type) {
  return REGISTRY[type] ?? SandboxedFrame
}
