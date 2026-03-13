import { useState } from 'react'
import { Box } from '@mui/material'
import QuestionHeader from './QuestionHeader'
import VideoPanel from './VideoPanel'
import FrameStrip from './FrameStrip'

export default function SessionView({ session, videoPhase, framesData }) {
  const [activeFrame, setActiveFrame] = useState(0)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <QuestionHeader
        prompt={session.prompt}
        intentType={session.intent_type}
        frameCount={session.frame_count}
      />

      <VideoPanel sessionId={session.id} videoPhase={videoPhase} />

      {framesData && (
        <FrameStrip
          sessionId={session.id}
          framesData={framesData}
          activeFrame={activeFrame}
          onFrameClick={setActiveFrame}
        />
      )}
    </Box>
  )
}
