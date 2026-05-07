import { useState, useCallback } from 'react'
import { Box, Typography, IconButton, Tooltip, useTheme } from '@mui/material'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import { BRAND } from '../../theme/tokens.js'

const ALL_SUGGESTIONS = [
  // Science & Technology
  { icon: '🔬', label: 'How does CRISPR gene editing work?',      category: 'science'  },
  { icon: '🤖', label: 'Explain transformer neural networks',      category: 'science'  },
  { icon: '🧬', label: 'What is quantum entanglement?',            category: 'science'  },
  { icon: '🌌', label: 'How do black holes form?',                  category: 'science'  },
  { icon: '💻', label: 'How does public key cryptography work?',    category: 'science'  },
  { icon: '⚡', label: 'Explain how batteries store energy',        category: 'science'  },

  // History & Society
  { icon: '🌍', label: 'Causes and effects of World War I',         category: 'history'  },
  { icon: '🏛️', label: 'How did the Roman Empire fall?',            category: 'history'  },
  { icon: '📜', label: 'Origins of the Cold War',                   category: 'history'  },
  { icon: '🗳️', label: 'How does democracy actually work?',         category: 'history'  },
  { icon: '🌐', label: 'What caused the 2008 financial crisis?',    category: 'history'  },
  { icon: '🚀', label: 'The space race — key milestones',           category: 'history'  },

  // Business & Finance
  { icon: '📈', label: 'How does compound interest work?',          category: 'business' },
  { icon: '💹', label: 'Explain supply and demand curves',          category: 'business' },
  { icon: '🏦', label: 'How do central banks control inflation?',   category: 'business' },
  { icon: '🦄', label: 'What makes a startup a unicorn?',           category: 'business' },
  { icon: '📊', label: 'Basics of reading a balance sheet',         category: 'business' },
  { icon: '🔄', label: 'How does venture capital work?',            category: 'business' },

  // Health & Medicine
  { icon: '💊', label: 'How do mRNA vaccines work?',                category: 'health'   },
  { icon: '🧠', label: 'How does the brain form memories?',         category: 'health'   },
  { icon: '🦠', label: 'How does antibiotic resistance develop?',   category: 'health'   },
  { icon: '❤️', label: 'What happens during a heart attack?',       category: 'health'   },
  { icon: '🔬', label: 'How does cancer develop at a cell level?',  category: 'health'   },
  { icon: '😴', label: 'Why do we need sleep?',                     category: 'health'   },
]

const GRID_SIZE = 6

function pickRandom(exclude = []) {
  const pool = ALL_SUGGESTIONS.filter(s => !exclude.includes(s))
  const out  = []
  const used = new Set()
  while (out.length < GRID_SIZE && used.size < pool.length) {
    const idx = Math.floor(Math.random() * pool.length)
    if (!used.has(idx)) { used.add(idx); out.push(pool[idx]) }
  }
  return out
}

// ── Single suggestion card ────────────────────────────────────────────────────

function SuggestionCard({ suggestion, onClick, isDark }) {
  const theme = useTheme()
  return (
    <Box
      component="button"
      type="button"
      onClick={() => onClick(suggestion.label)}
      sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        gap: 0.75, px: 1.5, py: 1.25,
        textAlign: 'left', cursor: 'pointer',
        background: 'none', fontFamily: 'inherit',
        borderRadius: '12px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        transition: 'all 0.15s',
        '&:hover': {
          borderColor: isDark ? 'rgba(75,114,255,0.4)' : `${BRAND.primary}40`,
          backgroundColor: isDark ? 'rgba(75,114,255,0.08)' : `${BRAND.primary}06`,
          transform: 'translateY(-1px)',
          boxShadow: isDark
            ? '0 4px 16px rgba(75,114,255,0.12)'
            : '0 4px 16px rgba(24,71,214,0.08)',
        },
        '&:active': { transform: 'translateY(0)' },
      }}
    >
      <Typography sx={{ fontSize: 18, lineHeight: 1 }}>{suggestion.icon}</Typography>
      <Typography sx={{
        fontSize: 12.5, fontWeight: 500, lineHeight: 1.5,
        color: theme.palette.text.primary,
      }}>
        {suggestion.label}
      </Typography>
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * 3×2 grid of suggestion cards shown on the empty state.
 * Clicking a card fills the prompt + signals deep research mode via onSuggestionClick.
 */
export default function SuggestionBoxes({ onSuggestionClick }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [cards, setCards] = useState(() => pickRandom())

  const handleShuffle = useCallback(() => {
    setCards(prev => pickRandom(prev))
  }, [])

  return (
    <Box sx={{ width: '100%', maxWidth: 600 }}>
      {/* Header row */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: theme.palette.text.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Try asking…
        </Typography>
        <Tooltip title="Shuffle suggestions">
          <IconButton
            size="small"
            onClick={handleShuffle}
            sx={{
              p: 0.5, color: theme.palette.text.secondary,
              '&:hover': { color: theme.palette.text.primary },
            }}
          >
            <ShuffleIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 3×2 grid */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 1,
      }}>
        {cards.map((s, i) => (
          <SuggestionCard
            key={`${s.label}-${i}`}
            suggestion={s}
            onClick={onSuggestionClick}
            isDark={isDark}
          />
        ))}
      </Box>
    </Box>
  )
}
