import { useState } from 'react'
import { Box } from '@mui/material'
import QuestionHeader from './QuestionHeader'
import VideoPanel     from './VideoPanel'
import FrameStrip     from './FrameStrip'
import NotesPanel     from './NotesPanel'

export default function SessionView({ session, videoPhase, framesData, hideHeader = false, onPauseAsk }) {
  const [activeFrame, setActiveFrame] = useState(0)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {!hideHeader && (
        <QuestionHeader
          prompt={session.prompt}
          intentType={session.intent_type}
          frameCount={session.frame_count}
        />
      )}

      <VideoPanel sessionId={session.id} videoPhase={videoPhase} onPauseAsk={onPauseAsk} />

      {framesData && (
        <FrameStrip
          sessionId={session.id}
          framesData={framesData}
          activeFrame={activeFrame}
          onFrameClick={setActiveFrame}
        />
      )}

      <NotesPanel notes={framesData?.notes} />
    </Box>
  )
}
