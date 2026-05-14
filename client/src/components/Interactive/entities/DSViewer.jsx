import { useState, useMemo, useCallback } from 'react'
import { Box, Typography, Chip, IconButton, Tooltip, useTheme } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import EditIcon  from '@mui/icons-material/Edit'
import CloseIcon from '@mui/icons-material/Close'
import { TYPOGRAPHY, RADIUS, PALETTE, BRAND } from '../../../theme/tokens'

// ═══════════════════════════════════════════════════════════════════════════
// ── Utilities ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

let _dsUid = 0
const uid = () => `ds${++_dsUid}`

// ─ Tree node factory ─────────────────────────────────────────────────────
function mkNode(value) {
  return { id: uid(), value: String(value), left: null, right: null }
}

function arrayToTree(arr) {
  if (!arr?.length) return null
  const ns = arr.map(v => (v == null ? null : mkNode(v)))
  for (let i = 0; i < ns.length; i++) {
    if (!ns[i]) continue
    const l = 2 * i + 1, r = 2 * i + 2
    if (l < ns.length) ns[i].left  = ns[l] ?? null
    if (r < ns.length) ns[i].right = ns[r] ?? null
  }
  return ns[0]
}

function objToTree(obj) {
  if (!obj) return null
  const n = mkNode(obj.value)
  n.left  = objToTree(obj.left)
  n.right = objToTree(obj.right)
  return n
}

function normalizeTree(raw) {
  if (!raw) return null
  if (Array.isArray(raw)) return arrayToTree(raw)
  if (typeof raw === 'object' && 'value' in raw) return objToTree(raw)
  return null
}

// ─ BST operations ────────────────────────────────────────────────────────
function cmp(a, b) {
  const na = +a, nb = +b
  if (!isNaN(na) && !isNaN(nb)) return na - nb
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
}

function bstInsert(root, value) {
  if (!root) return mkNode(value)
  const c = cmp(value, root.value)
  if (c < 0) return { ...root, left:  bstInsert(root.left,  value) }
  if (c > 0) return { ...root, right: bstInsert(root.right, value) }
  return root
}

function bstMin(node) { while (node.left) node = node.left; return node }

function bstDelete(root, value) {
  if (!root) return null
  const c = cmp(value, root.value)
  if (c < 0) return { ...root, left:  bstDelete(root.left,  value) }
  if (c > 0) return { ...root, right: bstDelete(root.right, value) }
  if (!root.left)  return root.right
  if (!root.right) return root.left
  const succ = bstMin(root.right)
  return { ...root, value: succ.value, right: bstDelete(root.right, succ.value) }
}

function bstSearch(root, value) {
  const path = []
  let node = root
  while (node) {
    path.push(node.id)
    const c = cmp(value, node.value)
    if (c === 0) return { found: true, path }
    node = c < 0 ? node.left : node.right
  }
  return { found: false, path }
}

// ─ Tree layout (in-order x, BFS y) ──────────────────────────────────────
const TR    = 22   // node radius
const TGAPX = TR * 2 + 18
const TGAPY = 68

function computeTreeLayout(root) {
  if (!root) return { tNodes: [], tEdges: [], svgW: 160, svgH: 80 }
  let xIdx = 0
  const xMap = new Map(), yMap = new Map()
  const assignX = n => { if (!n) return; assignX(n.left); xMap.set(n.id, xIdx++ * TGAPX + TR + 8); assignX(n.right) }
  assignX(root)
  const q = [[root, 0]]
  while (q.length) {
    const [n, d] = q.shift()
    yMap.set(n.id, d * TGAPY + TR + 8)
    if (n.left)  q.push([n.left,  d + 1])
    if (n.right) q.push([n.right, d + 1])
  }
  const tNodes = [], tEdges = []
  const collect = n => {
    if (!n) return
    const x = xMap.get(n.id), y = yMap.get(n.id)
    tNodes.push({ id: n.id, value: n.value, x, y })
    if (n.left)  { const cx = xMap.get(n.left.id),  cy = yMap.get(n.left.id);  tEdges.push({ key: `${n.id}L`, x1:x,y1:y,x2:cx,y2:cy }); collect(n.left) }
    if (n.right) { const cx = xMap.get(n.right.id), cy = yMap.get(n.right.id); tEdges.push({ key: `${n.id}R`, x1:x,y1:y,x2:cx,y2:cy }); collect(n.right) }
  }
  collect(root)
  const svgW = tNodes.length ? Math.max(...tNodes.map(n => n.x)) + TR + 16 : 160
  const svgH = tNodes.length ? Math.max(...tNodes.map(n => n.y)) + TR + 16 : 80
  return { tNodes, tEdges, svgW, svgH }
}

// ─ Hash helper ───────────────────────────────────────────────────────────
function hashKey(key, n) {
  let h = 0
  for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) % n
  return h
}

// ─ Data initialiser ──────────────────────────────────────────────────────
function initData(type, rawNodes) {
  if (type === 'bst' || type === 'binary_tree') return normalizeTree(rawNodes)
  if (type === 'hash_table') {
    return (rawNodes || []).map(e => ({
      id: uid(), key: String(e.key ?? e.k ?? ''), value: String(e.value ?? e.v ?? ''),
    }))
  }
  return (rawNodes || []).map(v => ({ id: uid(), value: String(v) }))
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Shared visual primitives ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function NodeRect({ value, highlighted, isDark }) {
  const accent = BRAND.primary
  return (
    <Box sx={{
      minWidth: 52, height: 40, px: 1.5, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: `${RADIUS.sm}px`,
      backgroundColor: highlighted
        ? (isDark ? `${accent}28` : `${accent}14`)
        : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
      border: `2px solid ${highlighted ? accent : (isDark ? PALETTE.borderDark : PALETTE.borderCream)}`,
      boxShadow: highlighted ? `0 0 0 3px ${accent}28` : 'none',
      transition: 'all 0.22s ease',
    }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: highlighted ? accent : 'text.primary', userSelect: 'none', lineHeight: 1 }}>
        {value}
      </Typography>
    </Box>
  )
}

function Arrow({ isDark, double = false }) {
  const col = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.22)'
  const w = double ? 28 : 20
  return (
    <svg width={w} height={16} style={{ flexShrink: 0, alignSelf: 'center' }}>
      <line x1="0" y1="8" x2={w - 4} y2="8" stroke={col} strokeWidth={1.5} />
      <polygon points={`${w-6},5 ${w},8 ${w-6},11`} fill={col} />
      {double && <polygon points="6,5 0,8 6,11" fill={col} />}
    </svg>
  )
}

function NullTag({ isDark }) {
  return (
    <Box sx={{ px: 1, py: 0.5, borderRadius: 1, border: `1px dashed ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)'}`, flexShrink: 0 }}>
      <Typography sx={{ fontSize: 10, color: 'text.disabled', userSelect: 'none' }}>∅</Typography>
    </Box>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Type-specific views ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function LinkedListView({ items, highlighted, isDark, type }) {
  const isDouble = type === 'doubly_linked_list'
  return (
    <Box sx={{ overflowX: 'auto', pb: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 2, px: 1, minWidth: 'max-content' }}>
        <Chip label="HEAD" size="small" sx={{
          height: 20, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', flexShrink: 0,
          backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
          color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
        }} />
        <Arrow isDark={isDark} />
        <AnimatePresence mode="popLayout">
          {items.map((item, i) => (
            <Box key={item.id} component={motion.div} layout
              initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.22 }}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <NodeRect value={item.value} highlighted={highlighted?.has(item.id)} isDark={isDark} />
              {i < items.length - 1 && <Arrow isDark={isDark} double={isDouble} />}
            </Box>
          ))}
        </AnimatePresence>
        {items.length > 0 && <><Arrow isDark={isDark} /><NullTag isDark={isDark} /></>}
        {items.length === 0 && <NullTag isDark={isDark} />}
      </Box>
    </Box>
  )
}

function StackView({ items, highlighted, isDark }) {
  const accent = BRAND.primary
  const borderCol = isDark ? PALETTE.borderDark : PALETTE.borderCream
  const reversed = [...items].reverse()
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1.5 }}>
      <Typography sx={{ fontSize: 9, fontWeight: 700, color: accent, letterSpacing: '0.1em', mb: 0.5 }}>TOP</Typography>
      <Box sx={{ border: `1px solid ${borderCol}`, borderRadius: `${RADIUS.md}px`, overflow: 'hidden', minWidth: 120, width: 'fit-content' }}>
        <AnimatePresence mode="popLayout">
          {reversed.length === 0 && (
            <Box key="empty" component={motion.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              sx={{ px: 4, py: 1.5, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>empty</Typography>
            </Box>
          )}
          {reversed.map((item, i) => (
            <Box key={item.id} component={motion.div} layout
              initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 32 }}
              transition={{ duration: 0.22 }}
            >
              <Box sx={{
                px: 3, py: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderBottom: i < reversed.length - 1 ? `1px solid ${borderCol}` : 'none',
                backgroundColor: highlighted?.has(item.id) ? (isDark ? `${accent}22` : `${accent}12`) : 'transparent',
                transition: 'background-color 0.2s',
              }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: highlighted?.has(item.id) ? accent : 'text.primary', userSelect: 'none' }}>
                  {item.value}
                </Typography>
              </Box>
            </Box>
          ))}
        </AnimatePresence>
      </Box>
      <Typography sx={{ fontSize: 9, fontWeight: 700, color: 'text.disabled', letterSpacing: '0.1em', mt: 0.5 }}>BOTTOM</Typography>
    </Box>
  )
}

function QueueView({ items, highlighted, isDark }) {
  const accent = BRAND.primary
  const borderCol = isDark ? PALETTE.borderDark : PALETTE.borderCream
  return (
    <Box sx={{ overflowX: 'auto', pb: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2, px: 1, minWidth: 'max-content' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 9, fontWeight: 700, color: accent, letterSpacing: '0.1em' }}>FRONT</Typography>
          <Typography sx={{ fontSize: 12, color: accent }}>←</Typography>
        </Box>
        <Box sx={{ border: `1px solid ${borderCol}`, borderRadius: `${RADIUS.md}px`, overflow: 'hidden', display: 'flex' }}>
          <AnimatePresence mode="popLayout">
            {items.length === 0 && (
              <Box key="empty" component={motion.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                sx={{ px: 4, py: 1.5 }}>
                <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>empty</Typography>
              </Box>
            )}
            {items.map((item, i) => (
              <Box key={item.id} component={motion.div} layout
                initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.22 }}
              >
                <Box sx={{
                  px: 2.5, py: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRight: i < items.length - 1 ? `1px solid ${borderCol}` : 'none',
                  backgroundColor: highlighted?.has(item.id) ? (isDark ? `${accent}22` : `${accent}12`) : 'transparent',
                  minWidth: 52, transition: 'background-color 0.2s',
                }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: highlighted?.has(item.id) ? accent : 'text.primary', userSelect: 'none' }}>
                    {item.value}
                  </Typography>
                </Box>
              </Box>
            ))}
          </AnimatePresence>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 9, fontWeight: 700, color: accent, letterSpacing: '0.1em' }}>REAR</Typography>
          <Typography sx={{ fontSize: 12, color: accent }}>→</Typography>
        </Box>
      </Box>
    </Box>
  )
}

function TreeView({ root, highlighted, isDark }) {
  const { tNodes, tEdges, svgW, svgH } = useMemo(() => computeTreeLayout(root), [root])
  const accent    = BRAND.primary
  const edgeColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'

  if (!root) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>empty tree</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ overflowX: 'auto', py: 1, px: 1 }}>
      <Box sx={{ position: 'relative', width: svgW, height: svgH, minWidth: svgW }}>
        <svg style={{ position: 'absolute', top: 0, left: 0, width: svgW, height: svgH, overflow: 'visible', pointerEvents: 'none' }}>
          {tEdges.map(e => <line key={e.key} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={edgeColor} strokeWidth={1.5} />)}
        </svg>
        <AnimatePresence mode="popLayout">
          {tNodes.map(n => {
            const isHl = highlighted?.has(n.id)
            return (
              <Box key={n.id} component={motion.div}
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                sx={{ position: 'absolute', left: n.x - TR, top: n.y - TR, width: TR * 2, height: TR * 2 }}
              >
                <Box sx={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isHl ? (isDark ? `${accent}30` : `${accent}18`) : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)'),
                  border: `2px solid ${isHl ? accent : (isDark ? PALETTE.borderDark : PALETTE.borderCream)}`,
                  boxShadow: isHl ? `0 0 0 3px ${accent}28` : 'none',
                  transition: 'all 0.22s ease',
                }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: isHl ? accent : 'text.primary', userSelect: 'none', lineHeight: 1 }}>
                    {n.value}
                  </Typography>
                </Box>
              </Box>
            )
          })}
        </AnimatePresence>
      </Box>
    </Box>
  )
}

function HashTableView({ entries, numBuckets, highlighted, isDark }) {
  const accent    = BRAND.primary
  const borderCol = isDark ? PALETTE.borderDark : PALETTE.borderCream

  const buckets = useMemo(() => {
    const b = Array.from({ length: numBuckets }, () => [])
    for (const e of entries) b[hashKey(e.key, numBuckets)].push(e)
    return b
  }, [entries, numBuckets])

  return (
    <Box sx={{ py: 1 }}>
      {buckets.map((items, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
          <Box sx={{
            width: 28, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            borderRadius: `${RADIUS.sm}px`, border: `1px solid ${borderCol}`,
          }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled' }}>{i}</Typography>
          </Box>
          <Box sx={{
            height: 32, minWidth: 36, border: `1px solid ${borderCol}`,
            borderRadius: `${RADIUS.sm}px`, display: 'flex', alignItems: 'center', overflow: 'hidden',
          }}>
            <AnimatePresence mode="popLayout">
              {items.length === 0
                ? <Box key="empty" sx={{ px: 1.5 }}><Typography sx={{ fontSize: 10, color: 'text.disabled' }}>—</Typography></Box>
                : items.map((entry, j) => (
                  <Box key={entry.id} component={motion.div} layout
                    initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.2 }}
                    sx={{ display: 'flex', alignItems: 'center' }}
                  >
                    {j > 0 && (
                      <svg width={16} height={16} style={{ flexShrink: 0 }}>
                        <line x1="0" y1="8" x2="12" y2="8" stroke={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)'} strokeWidth={1.5} />
                        <polygon points="10,5 14,8 10,11" fill={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)'} />
                      </svg>
                    )}
                    <Box sx={{
                      px: 1.25, height: 32, display: 'flex', alignItems: 'center', gap: 0.5,
                      backgroundColor: highlighted?.has(entry.id) ? (isDark ? `${accent}25` : `${accent}14`) : 'transparent',
                      transition: 'background-color 0.2s',
                    }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: highlighted?.has(entry.id) ? accent : 'text.secondary' }}>
                        {entry.key}
                      </Typography>
                      <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>→</Typography>
                      <Typography sx={{ fontSize: 11, fontWeight: 600, color: highlighted?.has(entry.id) ? accent : 'text.primary' }}>
                        {entry.value}
                      </Typography>
                    </Box>
                  </Box>
                ))
              }
            </AnimatePresence>
          </Box>
        </Box>
      ))}
    </Box>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Operations panel primitives ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function OpsBtn({ label, onClick, primary = false, disabled = false }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  return (
    <Box component="button" onClick={onClick} disabled={disabled} sx={{
      px: 1.5, py: 0.55, fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
      border: primary ? 'none' : `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
      borderRadius: `${RADIUS.sm}px`,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      backgroundColor: primary ? BRAND.primary : 'transparent',
      color: primary ? '#fff' : (isDark ? PALETTE.warmSilver : PALETTE.nearBlackText),
      transition: 'opacity 0.15s, background-color 0.15s',
      whiteSpace: 'nowrap', outline: 'none',
      '&:hover:not(:disabled)': { opacity: 0.82 },
    }}>
      {label}
    </Box>
  )
}

function OpsInput({ value, onChange, placeholder, width = 88, onEnter }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  return (
    <Box component="input" value={value} onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter' && onEnter) onEnter() }}
      placeholder={placeholder}
      sx={{
        width, height: 28, px: 1, fontSize: 12,
        border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
        borderRadius: `${RADIUS.sm}px`,
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
        color: 'text.primary', outline: 'none',
        '&:focus': { borderColor: BRAND.primary },
        '&::placeholder': { color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' },
      }}
    />
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Main component ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

const TYPE_LABELS = {
  linked_list:        'Linked List',
  doubly_linked_list: 'Doubly Linked List',
  stack:              'Stack',
  queue:              'Queue',
  bst:                'Binary Search Tree',
  binary_tree:        'Binary Tree',
  hash_table:         'Hash Table',
}

export default function DSViewer({
  entityId,
  type     = 'linked_list',
  nodes    = [],
  buckets  = 8,
  editable = true,
  caption,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [data,        setData]        = useState(() => initData(type, nodes))
  const [highlighted, setHighlighted] = useState(null)   // Set<id>
  const [message,     setMessage]     = useState(null)   // { text, ok }
  const [showOps,     setShowOps]     = useState(false)
  const [val,         setVal]         = useState('')
  const [hashKey_,    setHashKey]     = useState('')     // hash_table key input

  const flash = useCallback((ids, text, ok = true) => {
    setHighlighted(new Set(ids))
    setMessage({ text, ok })
    const t = setTimeout(() => { setHighlighted(null); setMessage(null) }, 1800)
    return () => clearTimeout(t)
  }, [])

  // ── Type flags ──────────────────────────────────────────────────────────
  const isTree  = type === 'bst' || type === 'binary_tree'
  const isHash  = type === 'hash_table'
  const isStack = type === 'stack'
  const isQueue = type === 'queue'
  const isList  = !isTree && !isHash && !isStack && !isQueue

  // ── Operations ──────────────────────────────────────────────────────────
  const ops = useMemo(() => {
    if (isTree) return {
      insert: () => {
        if (!val.trim()) return
        setData(d => bstInsert(d, val.trim()))
        flash([], `Inserted ${val.trim()}`)
        setVal('')
      },
      delete: () => {
        if (!val.trim()) return
        setData(d => bstDelete(d, val.trim()))
        flash([], `Deleted ${val.trim()}`)
        setVal('')
      },
      search: () => {
        if (!val.trim() || !data) return
        const { found, path } = bstSearch(data, val.trim())
        flash(path, found ? `Found ${val.trim()}!` : `${val.trim()} not in tree`, found)
      },
    }

    if (isHash) return {
      put: () => {
        if (!hashKey_.trim()) return
        const k = hashKey_.trim(), v = val.trim()
        const entry = { id: uid(), key: k, value: v }
        setData(d => [...d.filter(e => e.key !== k), entry])
        flash([entry.id], `Put "${k}" → "${v}"`)
        setHashKey(''); setVal('')
      },
      remove: () => {
        if (!hashKey_.trim()) return
        const k = hashKey_.trim()
        setData(d => d.filter(e => e.key !== k))
        flash([], `Removed key "${k}"`)
        setHashKey('')
      },
      get: () => {
        if (!hashKey_.trim()) return
        const found = data.find(e => e.key === hashKey_.trim())
        if (found) flash([found.id], `"${found.key}" → "${found.value}"`, true)
        else flash([], `"${hashKey_.trim()}" not found`, false)
      },
    }

    if (isStack) return {
      push: () => {
        if (!val.trim()) return
        const item = { id: uid(), value: val.trim() }
        setData(d => [...d, item])
        flash([item.id], `Pushed ${item.value}`)
        setVal('')
      },
      pop: () => {
        if (!data.length) { flash([], 'Stack is empty', false); return }
        const top = data[data.length - 1]
        flash([top.id], `Popped ${top.value}`)
        setTimeout(() => setData(d => d.slice(0, -1)), 600)
      },
      peek: () => {
        if (!data.length) { flash([], 'Stack is empty', false); return }
        flash([data[data.length - 1].id], `Top: ${data[data.length - 1].value}`)
      },
    }

    if (isQueue) return {
      enqueue: () => {
        if (!val.trim()) return
        const item = { id: uid(), value: val.trim() }
        setData(d => [...d, item])
        flash([item.id], `Enqueued ${item.value}`)
        setVal('')
      },
      dequeue: () => {
        if (!data.length) { flash([], 'Queue is empty', false); return }
        const front = data[0]
        flash([front.id], `Dequeued ${front.value}`)
        setTimeout(() => setData(d => d.slice(1)), 600)
      },
      peek: () => {
        if (!data.length) { flash([], 'Queue is empty', false); return }
        flash([data[0].id], `Front: ${data[0].value}`)
      },
    }

    // linked_list / doubly_linked_list
    return {
      insertHead: () => {
        if (!val.trim()) return
        const item = { id: uid(), value: val.trim() }
        setData(d => [item, ...d])
        flash([item.id], `Inserted ${item.value} at head`)
        setVal('')
      },
      insertTail: () => {
        if (!val.trim()) return
        const item = { id: uid(), value: val.trim() }
        setData(d => [...d, item])
        flash([item.id], `Inserted ${item.value} at tail`)
        setVal('')
      },
      delete: () => {
        if (!val.trim()) return
        const v = val.trim()
        const found = data.find(e => e.value === v)
        if (!found) { flash([], `"${v}" not found`, false); return }
        flash([found.id], `Deleted "${v}"`)
        setTimeout(() => setData(d => d.filter(e => e.value !== v)), 600)
        setVal('')
      },
      search: () => {
        if (!val.trim()) return
        const found = data.find(e => e.value === val.trim())
        if (found) flash([found.id], `Found "${val.trim()}"!`, true)
        else flash([], `"${val.trim()}" not found`, false)
      },
    }
  }, [type, data, val, hashKey_, flash, isTree, isHash, isStack, isQueue])

  // ── Render ──────────────────────────────────────────────────────────────
  const borderCol = isDark ? PALETTE.borderDark : PALETTE.borderCream
  const elemCount = isTree ? null : Array.isArray(data) ? data.length : null

  return (
    <Box>
      <Box sx={{
        border: `1px solid ${borderCol}`,
        borderRadius: `${RADIUS.lg}px`,
        overflow: 'hidden',
        backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)',
      }}>
        {/* ── Header ── */}
        <Box sx={{
          px: 1.5, py: 0.75,
          borderBottom: `1px solid ${borderCol}`,
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          display: 'flex', alignItems: 'center', gap: 1,
        }}>
          <Chip label={TYPE_LABELS[type] ?? type} size="small" sx={{
            height: 20, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
          }} />
          {elemCount !== null && (
            <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
              {elemCount} node{elemCount !== 1 ? 's' : ''}
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          {editable && (
            <Tooltip title={showOps ? 'Close operations' : 'Edit / Operations'}>
              <IconButton size="small" onClick={() => setShowOps(s => !s)}
                sx={{ color: showOps ? BRAND.primary : 'text.disabled', width: 24, height: 24 }}>
                {showOps ? <CloseIcon sx={{ fontSize: 14 }} /> : <EditIcon sx={{ fontSize: 14 }} />}
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* ── Visualization ── */}
        <Box sx={{ px: 2, py: 0.5, minHeight: 80 }}>
          {isList  && <LinkedListView items={data} highlighted={highlighted} isDark={isDark} type={type} />}
          {isStack && <StackView      items={data} highlighted={highlighted} isDark={isDark} />}
          {isQueue && <QueueView      items={data} highlighted={highlighted} isDark={isDark} />}
          {isTree  && <TreeView       root={data}  highlighted={highlighted} isDark={isDark} />}
          {isHash  && <HashTableView  entries={data} numBuckets={buckets} highlighted={highlighted} isDark={isDark} />}
        </Box>

        {/* ── Operations panel (toggled by edit icon) ── */}
        <AnimatePresence>
          {showOps && (
            <Box component={motion.div}
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              sx={{ overflow: 'hidden' }}
            >
              <Box sx={{
                borderTop: `1px solid ${borderCol}`,
                px: 2, py: 1.25,
                backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)',
                display: 'flex', flexDirection: 'column', gap: 1,
              }}>
                {/* Inputs + buttons */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
                  {isHash ? (
                    <>
                      <OpsInput value={hashKey_} onChange={setHashKey} placeholder="key" width={72} onEnter={ops.put} />
                      <OpsInput value={val}      onChange={setVal}     placeholder="value" width={72} onEnter={ops.put} />
                      <OpsBtn label="Put"    onClick={ops.put}    primary />
                      <OpsBtn label="Get"    onClick={ops.get} />
                      <OpsBtn label="Remove" onClick={ops.remove} />
                    </>
                  ) : isTree ? (
                    <>
                      <OpsInput value={val} onChange={setVal} placeholder="value" onEnter={ops.insert} />
                      <OpsBtn label="Insert" onClick={ops.insert} primary />
                      <OpsBtn label="Delete" onClick={ops.delete} />
                      <OpsBtn label="Search" onClick={ops.search} />
                    </>
                  ) : isStack ? (
                    <>
                      <OpsInput value={val} onChange={setVal} placeholder="value" onEnter={ops.push} />
                      <OpsBtn label="Push" onClick={ops.push} primary />
                      <OpsBtn label="Pop"  onClick={ops.pop} />
                      <OpsBtn label="Peek" onClick={ops.peek} />
                    </>
                  ) : isQueue ? (
                    <>
                      <OpsInput value={val} onChange={setVal} placeholder="value" onEnter={ops.enqueue} />
                      <OpsBtn label="Enqueue" onClick={ops.enqueue} primary />
                      <OpsBtn label="Dequeue" onClick={ops.dequeue} />
                      <OpsBtn label="Peek"    onClick={ops.peek} />
                    </>
                  ) : (
                    <>
                      <OpsInput value={val} onChange={setVal} placeholder="value" onEnter={ops.insertHead} />
                      <OpsBtn label="Insert Head" onClick={ops.insertHead} primary />
                      <OpsBtn label="Insert Tail" onClick={ops.insertTail} />
                      <OpsBtn label="Delete"      onClick={ops.delete} />
                      <OpsBtn label="Search"      onClick={ops.search} />
                    </>
                  )}
                </Box>

                {/* Status feedback */}
                <AnimatePresence mode="popLayout">
                  {message && (
                    <Box key={message.text} component={motion.div}
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Typography sx={{
                        fontSize: 11, fontWeight: 500,
                        color: message.ok
                          ? (isDark ? '#6ee7b7' : '#065f46')
                          : (isDark ? '#fca5a5' : '#991b1b'),
                      }}>
                        {message.text}
                      </Typography>
                    </Box>
                  )}
                </AnimatePresence>
              </Box>
            </Box>
          )}
        </AnimatePresence>
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
