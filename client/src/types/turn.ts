export type VideoPhase = 'generating' | 'ready' | 'error' | 'disabled'
export type RenderPath = 'interactive' | 'video' | 'text'

export interface Stage {
  id:         string
  label:      string
  status:     'active' | 'done'
  duration_s?: number
}

export interface Source {
  title:   string
  url:     string
  snippet: string
  domain:  string
}

export interface Block {
  id:           string
  type:         string
  entity_type?: string
  content?:     string
  props?:       Record<string, unknown>
  html?:        string | null
}

export interface FramesData {
  sessionId?:   string
  captions:     string[]
  images:       string[]
  notes?:       string
  frame_count?: number
}

export interface Turn {
  // Identity
  id:               string | null    // null until server responds
  tempId:           string           // always set — React key + DOM query target
  prompt:           string
  intent_type:      string | null
  render_path:      RenderPath | null

  // Interactive
  title:            string
  followUps:        string[]
  blocks:           Block[]
  learningObjective?: string | null

  // Video
  framesData:       FramesData | null
  frame_count:      number | null
  videoPhase:       VideoPhase

  // Loading
  isLoading:        boolean

  // Synthesis
  synthesisText:    string | null
  synthesisComplete: boolean
  sources:          Source[]

  // Stage progress
  stages:           Stage[]

  // Branching
  parentSessionId:  string | null
  parentFrameIndex: number | null
}

// Wire format from GET /api/conversations/:id
export interface RawTurn {
  id:                 string
  prompt:             string
  render_path?:       string
  frame_count?:       number
  video_path?:        string | null
  status?:            string
  intent_type?:       string | null
  parent_session_id?: string | null
  parent_frame_index?: number | null
  stages_json?:       Stage[] | null
  sources_json?:      Source[] | null
  synthesis_text?:    string | null
  frames_meta?:       Record<string, unknown> | null
}
