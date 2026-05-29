import { useRef, useEffect } from 'react'

export default function StarsCanvas({ style = {} }) {
  const cvRef   = useRef(null)
  const frameRef = useRef(null)

  useEffect(() => {
    const cv = cvRef.current
    if (!cv) return
    const ctx = cv.getContext('2d', { alpha: true })
    let DPR = 1, W = 0, H = 0
    let stars = []

    const resize = () => {
      DPR = Math.min(window.devicePixelRatio || 1, 2)
      W = cv.clientWidth; H = cv.clientHeight
      if (!W || !H) return
      cv.width = W * DPR; cv.height = H * DPR
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
      const count = Math.max(120, Math.floor((W * H) / 5500))
      const rnd = Math.random
      stars = Array.from({ length: count }, () => {
        const roll = rnd()
        const color = roll < 0.74 ? [255, 255, 255] : roll < 0.88 ? [41, 230, 224] : [154, 123, 255]
        return {
          x: rnd() * W, y: rnd() * H,
          r: rnd() * 1.1 + 0.3,
          ph:  rnd() * Math.PI * 2,
          spd: rnd() * 1.1 + 0.4,
          color,
        }
      })
    }
    const ro = new ResizeObserver(resize)
    ro.observe(cv); resize()

    const loop = t => {
      frameRef.current = requestAnimationFrame(loop)
      if (!W || !H) return
      ctx.clearRect(0, 0, W, H)
      for (const s of stars) {
        const alpha = 0.35 + 0.55 * Math.sin(t * 0.001 * s.spd + s.ph)
        const [r, g, b] = s.color
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill()
      }
    }
    frameRef.current = requestAnimationFrame(loop)

    return () => { cancelAnimationFrame(frameRef.current); ro.disconnect() }
  }, [])

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
