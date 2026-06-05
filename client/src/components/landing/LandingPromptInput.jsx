import { useRef, useState, useCallback } from 'react'
import { Box } from '@mui/material'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ROUTES } from '../../constants/routes.js'
import { STORAGE_KEYS } from '../../constants/storage.js'
import { useLandingTheme } from './tokens.js'

const M = motion(Box)

/**
 * The landing-page prompt box. Visually mirrors the Studio prompt bar but is a
 * funnel, not a generator: on submit it stashes the text and routes the visitor
 * to Studio (if signed in) or the login page (if not). The stashed prompt is
 * later pre-filled into the real prompt bar — never auto-sent.
 *
 * Props:
 *   placeholder  — input placeholder text
 *   chips        — optional string[] of quick-fill suggestions shown below
 */
export default function LandingPromptInput({
  placeholder = 'Assign a task or ask anything',
  chips = [],
}) {
  const P        = useLandingTheme()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [value, setValue] = useState('')
  const taRef = useRef(null)

  const submit = useCallback(() => {
    const text = value.trim()
    if (!text) {
      taRef.current?.focus()
      return
    }
    // Carry the prompt across the auth boundary. Studio pre-fills it on mount.
    sessionStorage.setItem(STORAGE_KEYS.PENDING_PROMPT, text)
    if (user) {
      navigate(ROUTES.STUDIO)
    } else {
      navigate(ROUTES.LOGIN, { state: { from: { pathname: ROUTES.STUDIO } } })
    }
  }, [value, user, navigate])

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const hasText = value.trim().length > 0

  return (
    <Box sx={{ width: '100%', maxWidth: 780, mx: 'auto' }}>
      {/* Input shell */}
      <Box
        onClick={() => taRef.current?.focus()}
        sx={{
          position: 'relative',
          bgcolor: P.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
          border: `1px solid ${P.lineStrong}`,
          borderRadius: '26px',
          px: '24px',
          pt: '24px',
          pb: '68px',
          cursor: 'text',
          backdropFilter: 'blur(12px)',
          transition: 'border-color 0.25s, box-shadow 0.25s',
          boxShadow: P.isDark ? '0 8px 40px rgba(0,0,0,0.35)' : '0 8px 40px rgba(10,60,38,0.06)',
          '&:focus-within': {
            borderColor: `rgba(${P.greenRgb},0.55)`,
            boxShadow: `0 0 0 3px rgba(${P.greenRgb},0.10), 0 8px 40px rgba(0,0,0,0.30)`,
          },
        }}
      >
        <Box
          component="textarea"
          ref={taRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          sx={{
            display: 'block',
            width: '100%',
            resize: 'none',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: P.text0,
            fontFamily: P.fontBody,
            fontSize: 18,
            lineHeight: 1.5,
            minHeight: 48,
            '&::placeholder': { color: P.text2, opacity: 1 },
          }}
        />

        {/* Decorative leading affordance */}
        <Box
          sx={{
            position: 'absolute', left: 20, bottom: 18,
            width: 38, height: 38, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${P.line}`, color: P.text2,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Box>

        {/* Submit */}
        <M
          whileTap={{ scale: 0.92 }}
          onClick={(e) => { e.stopPropagation(); submit() }}
          aria-label="Submit"
          sx={{
            position: 'absolute', right: 18, bottom: 18,
            width: 42, height: 42, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', userSelect: 'none',
            bgcolor: hasText ? P.pine : (P.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(10,60,38,0.06)'),
            color: hasText ? '#eafff7' : P.text2,
            transition: 'background 0.25s, color 0.25s',
            '&:hover': { bgcolor: hasText ? P.pineHover : (P.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,60,38,0.10)') },
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </M>
      </Box>

      {/* Quick-fill chips */}
      {chips.length > 0 && (
        <Box sx={{ mt: '14px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px' }}>
          {chips.map((chip) => (
            <Box
              key={chip}
              onClick={() => { setValue(`Explain ${chip}`); taRef.current?.focus() }}
              sx={{
                px: '14px', py: '7px', borderRadius: '100px',
                border: `1px solid ${P.line}`,
                bgcolor: 'transparent', color: P.text1,
                fontFamily: P.fontBody, fontSize: 13.5,
                cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                transition: 'border-color 0.25s, color 0.25s, background 0.25s',
                '&:hover': {
                  borderColor: `rgba(${P.greenRgb},0.45)`,
                  color: P.text0,
                  bgcolor: `rgba(${P.greenRgb},0.05)`,
                },
              }}
            >
              {chip}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
