import { useState, useCallback, useEffect } from 'react'
import {
  Box, Typography, IconButton, Tooltip, Dialog, LinearProgress,
  useTheme, CircularProgress,
} from '@mui/material'
import ArrowBackIosNewIcon  from '@mui/icons-material/ArrowBackIosNew'
import ArrowForwardIosIcon  from '@mui/icons-material/ArrowForwardIos'
import FullscreenIcon       from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon   from '@mui/icons-material/FullscreenExit'
import DownloadIcon         from '@mui/icons-material/Download'
import { TYPOGRAPHY, RADIUS, PALETTE, BRAND } from '../../../theme/tokens'

// ── Slide content layouts ──────────────────────────────────────────────────────

function BulletList({ bullets, isDark, scale = 1 }) {
  if (!Array.isArray(bullets) || !bullets.length) return null
  return (
    <Box component="ul" sx={{ m: 0, pl: 3 * scale, listStyle: 'none' }}>
      {bullets.map((b, i) => (
        <Box component="li" key={i} sx={{
          display: 'flex', alignItems: 'flex-start', gap: 1.5 * scale,
          mb: 0.9 * scale,
        }}>
          <Box sx={{
            mt: 0.6 * scale,
            width: 6 * scale, height: 6 * scale,
            borderRadius: '50%', flexShrink: 0,
            backgroundColor: BRAND.primary,
            opacity: 0.75,
          }} />
          <Typography sx={{
            fontSize: 15 * scale, lineHeight: 1.55,
            color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.82)',
          }}>
            {b}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

function TwoColumn({ left, right, isDark, scale }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 * scale, height: '100%' }}>
      <Box>
        <BulletList bullets={left}  isDark={isDark} scale={scale} />
      </Box>
      <Box sx={{ borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, pl: 3 * scale }}>
        <BulletList bullets={right} isDark={isDark} scale={scale} />
      </Box>
    </Box>
  )
}

function SlideContent({ slide, isDark, scale = 1 }) {
  const layout = slide.layout ?? (slide.bullets?.length ? 'bullets' : 'title')
  const titleSize    = layout === 'title' ? 30 * scale : 22 * scale
  const subtitleSize = 16 * scale

  return (
    <Box sx={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      justifyContent: layout === 'title' ? 'center' : 'flex-start',
      px: 5 * scale, py: 4 * scale,
    }}>
      {/* Title */}
      {slide.title && (
        <Typography sx={{
          fontSize: titleSize, fontWeight: 700, lineHeight: 1.25,
          color: isDark ? '#ffffff' : '#0a0a0a',
          mb: layout === 'title' ? 1.5 * scale : 2.5 * scale,
          borderBottom: layout !== 'title'
            ? `2px solid ${BRAND.primary}44`
            : 'none',
          pb: layout !== 'title' ? 1.5 * scale : 0,
        }}>
          {slide.title}
        </Typography>
      )}

      {/* Subtitle (title layout only) */}
      {layout === 'title' && slide.subtitle && (
        <Typography sx={{
          fontSize: subtitleSize, fontWeight: 400, lineHeight: 1.5,
          color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)',
        }}>
          {slide.subtitle}
        </Typography>
      )}

      {/* Bullets */}
      {layout === 'bullets' && (
        <BulletList bullets={slide.bullets} isDark={isDark} scale={scale} />
      )}

      {/* Two-column */}
      {layout === 'two_column' && (
        <TwoColumn left={slide.left ?? []} right={slide.right ?? []} isDark={isDark} scale={scale} />
      )}

      {/* Free content */}
      {layout === 'content' && slide.content && (
        <Typography sx={{
          fontSize: 15 * scale, lineHeight: 1.65,
          color: isDark ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.80)',
          whiteSpace: 'pre-wrap',
        }}>
          {slide.content}
        </Typography>
      )}
    </Box>
  )
}

// ── Slide frame — 16:9 ratio box ─────────────────────────────────────────────

function SlideFrame({ slide, isDark, slideIndex, total, scale = 1, showNumber = true }) {
  const bg     = isDark ? '#1a1a2e' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'

  return (
    <Box sx={{
      width: '100%',
      aspectRatio: '16/9',
      backgroundColor: bg,
      borderRadius: `${RADIUS.md}px`,
      border: `1px solid ${border}`,
      boxShadow: isDark
        ? '0 4px 32px rgba(0,0,0,0.5)'
        : '0 4px 32px rgba(0,0,0,0.12)',
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Accent bar top */}
      <Box sx={{ height: 4 * scale, background: `linear-gradient(90deg, ${BRAND.primary}, ${BRAND.primary}88)`, flexShrink: 0 }} />

      {/* Slide content */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <SlideContent slide={slide} isDark={isDark} scale={scale} />
      </Box>

      {/* Slide number badge */}
      {showNumber && (
        <Box sx={{
          position: 'absolute', bottom: 8 * scale, right: 12 * scale,
          fontSize: 10 * scale,
          color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
          fontWeight: 500,
        }}>
          {slideIndex + 1} / {total}
        </Box>
      )}
    </Box>
  )
}

// ── PPTX export ───────────────────────────────────────────────────────────────

async function exportToPptx(slides, presentationTitle) {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()

  pptx.layout  = 'LAYOUT_WIDE'
  pptx.subject = presentationTitle ?? 'Presentation'
  pptx.title   = presentationTitle ?? 'Presentation'

  const ACCENT  = '4169e1'
  const DARK_BG = '1a1a2e'

  slides.forEach((slide, idx) => {
    const layout = slide.layout ?? (slide.bullets?.length ? 'bullets' : 'title')
    const sld    = pptx.addSlide()

    // Background
    sld.background = { color: 'FFFFFF' }

    // Accent bar
    sld.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.08,
      fill: { color: ACCENT },
      line: { type: 'none' },
    })

    const titleOpts = {
      x: 0.5, y: 0.25, w: 9, h: layout === 'title' ? 1.2 : 0.8,
      fontSize: layout === 'title' ? 32 : 24,
      bold: true, color: '0a0a0a',
      fontFace: 'Calibri',
    }

    if (slide.title) sld.addText(slide.title, titleOpts)

    // Title layout — centered subtitle
    if (layout === 'title' && slide.subtitle) {
      sld.addText(slide.subtitle, {
        x: 0.5, y: 1.7, w: 9, h: 0.6,
        fontSize: 18, color: '555555', fontFace: 'Calibri',
      })
    }

    // Bullets layout
    if (layout === 'bullets' && slide.bullets?.length) {
      const items = slide.bullets.map(b => ({ text: b, options: { bullet: { code: '2022' }, indentLevel: 0 } }))
      sld.addText(items, {
        x: 0.5, y: 1.3, w: 9, h: 4.2,
        fontSize: 16, color: '222222', fontFace: 'Calibri',
        lineSpacingMultiple: 1.4,
      })
    }

    // Two-column layout
    if (layout === 'two_column') {
      const toItems = arr => (arr ?? []).map(b => ({ text: b, options: { bullet: { code: '2022' } } }))
      sld.addText(toItems(slide.left), {
        x: 0.5, y: 1.3, w: 4.3, h: 4.2,
        fontSize: 14, color: '222222', fontFace: 'Calibri', lineSpacingMultiple: 1.4,
      })
      sld.addText(toItems(slide.right), {
        x: 5.2, y: 1.3, w: 4.3, h: 4.2,
        fontSize: 14, color: '222222', fontFace: 'Calibri', lineSpacingMultiple: 1.4,
      })
      // Divider
      sld.addShape(pptx.ShapeType.line, {
        x: 4.9, y: 1.3, w: 0, h: 4,
        line: { color: 'DDDDDD', width: 1 },
      })
    }

    // Content layout
    if (layout === 'content' && slide.content) {
      sld.addText(slide.content, {
        x: 0.5, y: 1.3, w: 9, h: 4.2,
        fontSize: 15, color: '222222', fontFace: 'Calibri',
        lineSpacingMultiple: 1.5, valign: 'top',
      })
    }

    // Speaker notes
    if (slide.notes) sld.addNotes(slide.notes)
  })

  const filename = `${(presentationTitle ?? 'presentation').replace(/[^a-z0-9]/gi, '_')}.pptx`
  await pptx.writeFile({ fileName: filename })
}

// ── Dot indicator ─────────────────────────────────────────────────────────────

function Dots({ total, current, isDark }) {
  const MAX = 8
  if (total <= 1) return null
  const dots = total <= MAX ? total : MAX
  return (
    <Box sx={{ display: 'flex', gap: 0.6, alignItems: 'center' }}>
      {Array.from({ length: dots }, (_, i) => {
        const idx   = total <= MAX ? i : Math.round((i / (MAX - 1)) * (total - 1))
        const active = total <= MAX ? i === current : Math.abs(idx - current) <= 1
        return (
          <Box key={i} sx={{
            width: active ? 8 : 5, height: active ? 8 : 5,
            borderRadius: '50%', transition: 'all 0.2s',
            backgroundColor: active
              ? BRAND.primary
              : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)'),
          }} />
        )
      })}
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SlideDeck({ entityId, slides, title, caption }) {
  const theme   = useTheme()
  const isDark  = theme.palette.mode === 'dark'

  const [idx,         setIdx]         = useState(0)
  const [fullscreen,  setFullscreen]  = useState(false)
  const [downloading, setDownloading] = useState(false)

  const total   = Array.isArray(slides) ? slides.length : 0
  const atStart = idx === 0
  const atEnd   = idx === total - 1

  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)),         [])
  const next = useCallback(() => setIdx(i => Math.min(total - 1, i + 1)), [total])

  // Keyboard navigation
  useEffect(() => {
    if (!fullscreen) return
    const handler = e => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next() }
      if (e.key === 'ArrowLeft')                   { e.preventDefault(); prev() }
      if (e.key === 'Escape')                      setFullscreen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [fullscreen, next, prev])

  const handleDownload = useCallback(async () => {
    if (downloading) return
    setDownloading(true)
    try {
      await exportToPptx(slides, title)
    } catch (err) {
      console.error('[SlideDeck] PPTX export failed', err)
    } finally {
      setDownloading(false)
    }
  }, [slides, title, downloading])

  if (!total) {
    return (
      <Box sx={{ p: 2, color: 'error.main', fontSize: TYPOGRAPHY.sizes.caption }}>
        slide_deck: requires a non-empty "slides" array
      </Box>
    )
  }

  const borderColor = isDark ? PALETTE.borderDark : PALETTE.borderCream
  const navBg       = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
  const navBorder   = isDark ? 'rgba(255,255,255,0.1)'  : 'rgba(0,0,0,0.08)'
  const progress    = total > 1 ? (idx / (total - 1)) * 100 : 100

  const ControlBar = ({ inDialog = false }) => (
    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      px: 1.5, py: 0.75,
      backgroundColor: inDialog ? 'rgba(0,0,0,0.6)' : navBg,
      borderTop: inDialog ? 'none' : `1px solid ${navBorder}`,
    }}>
      {/* Prev */}
      <Tooltip title="Previous slide">
        <span>
          <IconButton size="small" onClick={prev} disabled={atStart}
            sx={{ color: atStart ? 'text.disabled' : 'text.primary', width: 30, height: 30 }}>
            <ArrowBackIosNewIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </span>
      </Tooltip>

      {/* Center: counter + dots */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 500, color: inDialog ? 'rgba(255,255,255,0.7)' : 'text.secondary' }}>
          {idx + 1} / {total}
        </Typography>
        <Dots total={total} current={idx} isDark={isDark || inDialog} />
      </Box>

      {/* Right: next + fullscreen + download */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <Tooltip title="Next slide">
          <span>
            <IconButton size="small" onClick={next} disabled={atEnd}
              sx={{ color: atEnd ? 'text.disabled' : 'text.primary', width: 30, height: 30 }}>
              <ArrowForwardIosIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={inDialog ? 'Exit fullscreen' : 'Fullscreen'}>
          <IconButton size="small" onClick={() => setFullscreen(f => !f)}
            sx={{ color: inDialog ? 'rgba(255,255,255,0.7)' : 'text.secondary', width: 30, height: 30 }}>
            {inDialog
              ? <FullscreenExitIcon sx={{ fontSize: 16 }} />
              : <FullscreenIcon     sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Download as PowerPoint">
          <IconButton size="small" onClick={handleDownload} disabled={downloading}
            sx={{ color: inDialog ? 'rgba(255,255,255,0.7)' : 'text.secondary', width: 30, height: 30 }}>
            {downloading
              ? <CircularProgress size={13} sx={{ color: 'inherit' }} />
              : <DownloadIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )

  return (
    <Box>
      {/* ── Inline view ── */}
      <Box sx={{
        border: `1px solid ${borderColor}`,
        borderRadius: `${RADIUS.lg}px`,
        overflow: 'hidden',
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
      }}>
        {/* Header: title + progress */}
        {title && (
          <Box sx={{
            px: 2, py: 1,
            borderBottom: `1px solid ${borderColor}`,
            display: 'flex', alignItems: 'center', gap: 1.5,
          }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', flex: 1, noWrap: true, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </Typography>
            <LinearProgress variant="determinate" value={progress} sx={{
              width: 80, height: 3, borderRadius: 2,
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              '& .MuiLinearProgress-bar': { backgroundColor: BRAND.primary, borderRadius: 2 },
            }} />
          </Box>
        )}

        {/* Slide */}
        <Box sx={{ p: 2 }}>
          <SlideFrame slide={slides[idx]} isDark={isDark} slideIndex={idx} total={total} />
        </Box>

        <ControlBar />
      </Box>

      {caption && (
        <Typography sx={{
          mt: 1, fontSize: TYPOGRAPHY.sizes.caption, textAlign: 'center',
          color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
        }}>
          {caption}
        </Typography>
      )}

      {/* ── Fullscreen dialog ── */}
      <Dialog
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        fullScreen
        PaperProps={{
          sx: {
            backgroundColor: '#0d0d1a',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          },
        }}
      >
        <Box sx={{ width: '90vw', maxWidth: 1100 }}>
          <SlideFrame slide={slides[idx]} isDark={true} slideIndex={idx} total={total} scale={1.5} />
        </Box>
        <Box sx={{ width: '90vw', maxWidth: 1100, mt: 1 }}>
          <ControlBar inDialog />
        </Box>
      </Dialog>
    </Box>
  )
}
