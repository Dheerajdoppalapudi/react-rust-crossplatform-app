import LightbulbOutlinedIcon        from '@mui/icons-material/LightbulbOutlined'
import TravelExploreOutlinedIcon    from '@mui/icons-material/TravelExploreOutlined'
import ArticleOutlinedIcon          from '@mui/icons-material/ArticleOutlined'
import AutoFixHighOutlinedIcon      from '@mui/icons-material/AutoFixHighOutlined'
import AccountTreeOutlinedIcon      from '@mui/icons-material/AccountTreeOutlined'
import DashboardOutlinedIcon        from '@mui/icons-material/DashboardOutlined'
import GridViewOutlinedIcon         from '@mui/icons-material/GridViewOutlined'
import MovieCreationOutlinedIcon    from '@mui/icons-material/MovieCreationOutlined'
import BurstModeOutlinedIcon        from '@mui/icons-material/BurstModeOutlined'
import PhotoFilterOutlinedIcon      from '@mui/icons-material/PhotoFilterOutlined'
import SlideshowOutlinedIcon        from '@mui/icons-material/SlideshowOutlined'
import RadioButtonUncheckedIcon     from '@mui/icons-material/RadioButtonUnchecked'

// Registry of known stage IDs → visual configuration.
// LoadingView consumes this so adding a new stage = one entry here.
//
// skeleton values:
//   'frames_or_beats' — show BeatProgressList if beat data present, else FrameSkeletonCards
//   'video'           — show VideoSkeletonCard
//   'blocks'          — show BlockSkeletonPreview
//   undefined         — no skeleton
//
// hasSourceItems: true → stage sub-panel shows sources from turn.sources
export const STAGE_REGISTRY = {
  thinking:          { Icon: LightbulbOutlinedIcon,      defaultLabel: 'Thinking…' },
  decomposing:       { Icon: LightbulbOutlinedIcon,      defaultLabel: 'Decomposing…' },
  searching:         { Icon: TravelExploreOutlinedIcon,  defaultLabel: 'Searching…',        hasSourceItems: true },
  reading:           { Icon: ArticleOutlinedIcon,        defaultLabel: 'Reading sources…',  hasSourceItems: true },
  synthesising:      { Icon: AutoFixHighOutlinedIcon,    defaultLabel: 'Synthesising…' },
  planning:          { Icon: AccountTreeOutlinedIcon,    defaultLabel: 'Planning…' },
  designing:         { Icon: DashboardOutlinedIcon,      defaultLabel: 'Designing…',        skeleton: 'blocks' },
  generating_frames: { Icon: GridViewOutlinedIcon,       defaultLabel: 'Generating frames…', skeleton: 'frames_or_beats' },
  generating:        { Icon: GridViewOutlinedIcon,       defaultLabel: 'Generating…',       skeleton: 'frames_or_beats' },
  rendering:         { Icon: PhotoFilterOutlinedIcon,    defaultLabel: 'Rendering…',        skeleton: 'frames_or_beats' },
  frames:            { Icon: BurstModeOutlinedIcon,      defaultLabel: 'Preparing frames…', skeleton: 'frames_or_beats' },
  video:             { Icon: MovieCreationOutlinedIcon,  defaultLabel: 'Building video…',   skeleton: 'video' },
  assembling:        { Icon: SlideshowOutlinedIcon,      defaultLabel: 'Assembling video…' },
  // Video stream 2 stages
  export_frames:     { Icon: BurstModeOutlinedIcon,      defaultLabel: 'Exporting frames…' },
  tts:               { Icon: MovieCreationOutlinedIcon,  defaultLabel: 'Generating audio…' },
}

// Fallback icon for unknown stage IDs
export const FALLBACK_STAGE_ICON = RadioButtonUncheckedIcon
