import { useRef, useEffect, useCallback } from 'react'

// Green-dominant bioluminescent palette (matches Paralyte design)
const COLORS = [
  [38, 224, 168], [38, 224, 168], [38, 224, 168], [38, 224, 168],
  [41, 230, 224],   // cyan  — rare
  [154, 123, 255],  // violet — rare
]
const LINK    = 150   // connection distance px
const MOUSE_R = 220   // cursor influence radius px

export default function NeuralCanvas({ style = {} }) {
  const cvRef    = useRef(null)
  const nodesRef = useRef([])
  const mouseRef = useRef({ x: -9999, y: -9999, active: false })
  const frameRef = useRef(null)

  const build = useCallback((W, H) => {
    const count = Math.max(40, Math.min(150, Math.floor((W * H) / 17000)))
    nodesRef.current = Array.from({ length: count }, () => {
      const c = COLORS[Math.floor(Math.random() * COLORS.length)]
      return {
        x:  Math.random() * W,
        y:  Math.random() * H,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r:  Math.random() * 1.6 + 0.8,
        c,
        ph: Math.random() * Math.PI * 2,
      }
    })
  }, [])

  useEffect(() => {
    const cv = cvRef.current
    if (!cv) return
    const ctx = cv.getContext('2d', { alpha: true })
    let DPR = 1, W = 0, H = 0

    const resize = () => {
      DPR = Math.min(window.devicePixelRatio || 1, 2)
      W = cv.clientWidth; H = cv.clientHeight
      if (!W || !H) return
      cv.width = W * DPR; cv.height = H * DPR
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
      build(W, H)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(cv)
    resize()

    const loop = t => {
      frameRef.current = requestAnimationFrame(loop)
      if (!W || !H) return
      ctx.clearRect(0, 0, W, H)

      const nodes = nodesRef.current
      const { x: mx, y: my, active: ma } = mouseRef.current

      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy
        if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20
        if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20
      }

      // Connection lines
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d > LINK) continue
          let alpha = (1 - d / LINK) * 0.20
          if (ma) {
            const md = Math.hypot((a.x + b.x) / 2 - mx, (a.y + b.y) / 2 - my)
            if (md < MOUSE_R) alpha += (1 - md / MOUSE_R) * 0.55
          }
          if (alpha < 0.005) continue
          const [r, g, b2] = a.c
          ctx.strokeStyle = `rgba(${r},${g},${b2},${alpha})`
          ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
        }
      }

      // Nodes with halo
      for (const n of nodes) {
        let glow = 0.5 + 0.5 * Math.sin(t * 0.0012 + n.ph)
        let r = n.r
        if (ma) {
          const md = Math.hypot(n.x - mx, n.y - my)
          if (md < MOUSE_R) {
            const f = 1 - md / MOUSE_R
            glow = Math.min(1, glow + f * 0.9); r += f * 1.8
          }
        }
        const [cr, cg, cb] = n.c
        // halo
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 6)
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},${0.12 + glow * 0.08})`)
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
        ctx.fillStyle = grad
        ctx.beginPath(); ctx.arc(n.x, n.y, r * 6, 0, Math.PI * 2); ctx.fill()
        // core
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${0.35 + glow * 0.5})`
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill()
      }
    }
    frameRef.current = requestAnimationFrame(loop)

    // Track mouse via document so it works even with pointer-events:none on canvas
    const onMove = e => {
      const rect = cv.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, active: true }
    }
    const onLeave = () => { mouseRef.current = { ...mouseRef.current, active: false } }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)

    return () => {
      cancelAnimationFrame(frameRef.current)
      ro.disconnect()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [build])

  return (
    <canvas
      ref={cvRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        ...style,
      }}
    />
  )
}
