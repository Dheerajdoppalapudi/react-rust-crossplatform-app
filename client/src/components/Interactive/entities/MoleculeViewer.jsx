import { useEffect, useRef, useState } from 'react'
import { Box, Typography, Skeleton, useTheme } from '@mui/material'
import { TYPOGRAPHY, RADIUS, PALETTE } from '../../../theme/tokens'

const CDN_URLS = [
  '/3Dmol-nojquery.min.js',  // local copy in public/ — always works offline
  'https://cdn.jsdelivr.net/npm/3dmol/build/3Dmol-nojquery.min.js',
  'https://unpkg.com/3dmol/build/3Dmol-nojquery.min.js',
]

// Singleton loader — tries each CDN in order, resolves on first success
let _loadPromise = null
function load3Dmol() {
  if (_loadPromise) return _loadPromise
  _loadPromise = new Promise((resolve, reject) => {
    if (typeof window.$3Dmol !== 'undefined') { resolve(); return }

    function tryUrl(index) {
      if (index >= CDN_URLS.length) {
        reject(new Error('3Dmol.js unavailable — check your internet connection'))
        return
      }
      const script   = document.createElement('script')
      script.src     = CDN_URLS[index]
      script.async   = true
      script.onload  = () => resolve()
      script.onerror = () => {
        document.head.removeChild(script)
        tryUrl(index + 1)
      }
      document.head.appendChild(script)
    }

    tryUrl(0)
  })
  return _loadPromise
}

const STYLE_MAP = {
  stick:        { stick: {} },
  sphere:       { sphere: {} },
  line:         { line: {} },
  cartoon:      { cartoon: {} },
  ballAndStick: { stick: {}, sphere: { scale: 0.3 } },
  surface:      {},  // handled separately
}

const COLOR_SCHEME_MAP = {
  element:  'elementColors',
  residue:  'residueColors',
  chain:    'chainColors',
  spectrum: 'spectrum',
  ssPyMOL:  'ssPyMOL',
  rasmol:   'rasmol',
}

export default function MoleculeViewer({
  format          = 'smiles',
  data,
  style           = 'ballAndStick',
  colorScheme     = 'element',
  highlights      = [],
  labels          = [],
  surfaces        = [],
  spin            = false,
  spinSpeed       = 1,
  zoom            = 1.0,
  backgroundColor = 'transparent',
  height          = 360,
  caption,
}) {
  const theme       = useTheme()
  const isDark      = theme.palette.mode === 'dark'
  const containerRef = useRef(null)
  const viewerRef    = useRef(null)

  const [status, setStatus] = useState('loading') // loading | ready | error
  const [errorMsg, setErrorMsg] = useState('')

  const bgColor = backgroundColor === 'transparent'
    ? (isDark ? '#111111' : '#f8fafc')
    : backgroundColor

  useEffect(() => {
    if (!data) { setStatus('error'); setErrorMsg('No molecule data provided'); return }

    let cancelled = false
    setStatus('loading')

    load3Dmol()
      .then(() => {
        if (cancelled || !containerRef.current) return
        const $3Dmol = window.$3Dmol

        // Destroy previous viewer if remounting
        if (viewerRef.current) {
          try { viewerRef.current.clear() } catch { /* viewer may already be torn down */ }
          containerRef.current.innerHTML = ''
        }

        const viewer = $3Dmol.createViewer(containerRef.current, {
          backgroundColor: bgColor,
          antialias: true,
        })
        viewerRef.current = viewer

        viewer.addModel(data, format)

        // Base style
        const colorSpec = COLOR_SCHEME_MAP[colorScheme]
          ? { colorscheme: COLOR_SCHEME_MAP[colorScheme] }
          : {}

        const baseStyle = STYLE_MAP[style] ?? STYLE_MAP.ballAndStick
        Object.entries(baseStyle).forEach(([styleType, opts]) => {
          viewer.setStyle({}, { [styleType]: { ...colorSpec, ...opts } })
        })

        // Highlight overlays
        highlights.forEach(({ selection = {}, style: hStyle = 'sphere', color: hColor }) => {
          const spec = { [hStyle]: {} }
          if (hColor) spec[hStyle].color = hColor
          viewer.addStyle(selection, spec)
        })

        // Atom labels
        labels.forEach(({ selection = {}, text = '', fontSize = 12, color: lColor = 'white', backgroundOpacity = 0.6 }) => {
          viewer.addLabel(text, { fontSize, fontColor: lColor, backgroundOpacity, alignment: 'center' }, selection)
        })

        // Molecular surfaces
        surfaces.forEach(({ type: sType = 'VDW', opacity = 0.7, color: sColor, colorscheme: sCS }) => {
          const surfStyle = {}
          if (sColor)    surfStyle.color = sColor
          if (sCS)       surfStyle.colorscheme = sCS
          surfStyle.opacity = opacity
          viewer.addSurface($3Dmol.SurfaceType[sType] ?? $3Dmol.SurfaceType.VDW, surfStyle)
        })

        viewer.zoomTo()
        if (zoom !== 1.0) viewer.zoom(zoom)
        viewer.render()

        if (spin) viewer.spin(true, spinSpeed)

        if (!cancelled) setStatus('ready')
      })
      .catch(err => {
        if (!cancelled) { setStatus('error'); setErrorMsg(err.message) }
      })

    return () => {
      cancelled = true
      if (viewerRef.current) {
        try { viewerRef.current.spin(false) } catch { /* ignore if already unmounted */ }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, format, style, colorScheme, spin, spinSpeed, zoom, bgColor])

  return (
    <Box>
      <Box sx={{
        position: 'relative',
        height,
        borderRadius: `${RADIUS.lg}px`,
        overflow: 'hidden',
        border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
        backgroundColor: bgColor,
      }}>
        {status === 'loading' && (
          <Skeleton variant="rectangular" sx={{ position: 'absolute', inset: 0, transform: 'none', zIndex: 1 }} animation="wave" />
        )}
        {status === 'error' && (
          <Box sx={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 1, p: 2,
          }}>
            <Typography sx={{ fontSize: TYPOGRAPHY.sizes.caption, color: 'error.main', textAlign: 'center' }}>
              {errorMsg || 'Failed to render molecule'}
            </Typography>
            <Typography sx={{ fontSize: TYPOGRAPHY.sizes.caption, color: 'text.disabled', textAlign: 'center' }}>
              {errorMsg?.includes('unavailable')
                ? 'Check your internet connection — 3Dmol.js is loaded from a CDN.'
                : `Verify that "data" is valid ${format.toUpperCase()} and the "format" prop matches.`}
            </Typography>
          </Box>
        )}
        <Box
          ref={containerRef}
          sx={{
            width: '100%', height: '100%',
            visibility: status === 'ready' ? 'visible' : 'hidden',
          }}
        />
      </Box>
      {caption && (
        <Typography sx={{
          mt: 1, fontSize: TYPOGRAPHY.sizes.caption, textAlign: 'center',
          color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
        }}>
          {caption}
        </Typography>
      )}
    </Box>
  )
}
