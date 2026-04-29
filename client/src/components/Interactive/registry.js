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

export const REGISTRY = {
  mermaid_viewer:   MermaidViewer,
  code_walkthrough: CodeWalkthrough,
  step_controls:    StepControls,
  freeform_html:    SandboxedFrame,
}

export function resolveEntity(type) {
  return REGISTRY[type] ?? SandboxedFrame
}
