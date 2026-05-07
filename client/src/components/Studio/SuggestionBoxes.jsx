import { useState, useCallback } from 'react'
import { Box, Typography, IconButton, Tooltip, useTheme } from '@mui/material'
import ShuffleRoundedIcon from '@mui/icons-material/ShuffleRounded'

const ALL_SUGGESTIONS = [
  // Science & Technology
  { label: 'How does CRISPR gene editing work?',       category: 'science'  },
  { label: 'Explain transformer neural networks',      category: 'science'  },
  { label: 'What is quantum entanglement?',            category: 'science'  },
  { label: 'How do black holes form?',                 category: 'science'  },
  { label: 'How does public key cryptography work?',   category: 'science'  },
  { label: 'Explain how batteries store energy',       category: 'science'  },

  // History & Society
  { label: 'Causes and effects of World War I',        category: 'history'  },
  { label: 'How did the Roman Empire fall?',           category: 'history'  },
  { label: 'Origins of the Cold War',                  category: 'history'  },
  { label: 'How does democracy actually work?',        category: 'history'  },
  { label: 'What caused the 2008 financial crisis?',   category: 'history'  },
  { label: 'The space race — key milestones',          category: 'history'  },

  // Business & Finance
  { label: 'How does compound interest work?',         category: 'business' },
  { label: 'Explain supply and demand curves',         category: 'business' },
  { label: 'How do central banks control inflation?',  category: 'business' },
  { label: 'What makes a startup a unicorn?',          category: 'business' },
  { label: 'Basics of reading a balance sheet',        category: 'business' },
  { label: 'How does venture capital work?',           category: 'business' },

  // Health & Medicine
  { label: 'How do mRNA vaccines work?',               category: 'health'   },
  { label: 'How does the brain form memories?',        category: 'health'   },
  { label: 'How does antibiotic resistance develop?',  category: 'health'   },
  { label: 'What happens during a heart attack?',      category: 'health'   },
  { label: 'How does cancer develop at a cell level?', category: 'health'   },
  { label: 'Why do we need sleep?',                    category: 'health'   },
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

function SuggestionCard({ label, onClick, isDark }) {
  const theme = useTheme()
  return (
    <Box
      component="button"
      type="button"
      onClick={() => onClick(label)}
      sx={{
        display:        'flex',
        alignItems:     'center',
        px:             2,
        py:             1.25,
        textAlign:      'left',
        cursor:         'pointer',
        background:     'none',
        fontFamily:     'inherit',
        borderRadius:   '10px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
        backgroundColor: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.018)',
        transition:     'all 0.15s',
        '&:hover': {
          borderColor:     isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)',
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          transform:       'translateY(-1px)',
        },
        '&:active': { transform: 'translateY(0)' },
      }}
    >
      <Typography sx={{
        fontSize:   13,
        fontWeight: 400,
        lineHeight: 1.5,
        color:      isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)',
        '&:hover':  { color: theme.palette.text.primary },
      }}>
        {label}
      </Typography>
    </Box>
  )
}

export default function SuggestionBoxes({ onSuggestionClick }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [cards, setCards] = useState(() => pickRandom())

  const handleShuffle = useCallback(() => {
    setCards(prev => pickRandom(prev))
  }, [])

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography sx={{
          fontSize:      12,
          fontWeight:    500,
          color:         isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)',
          letterSpacing: 0.2,
        }}>
          Not sure where to start?
        </Typography>
        <Tooltip title="Shuffle">
          <IconButton
            size="small"
            onClick={handleShuffle}
            sx={{
              p: 0.5,
              color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)',
              '&:hover': { color: theme.palette.text.secondary },
            }}
          >
            <ShuffleRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{
        display:             'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap:                 1,
      }}>
        {cards.map((s, i) => (
          <SuggestionCard
            key={`${s.label}-${i}`}
            label={s.label}
            onClick={onSuggestionClick}
            isDark={isDark}
          />
        ))}
      </Box>
    </Box>
  )
}
