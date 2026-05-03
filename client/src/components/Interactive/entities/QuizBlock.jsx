import { useState, useMemo } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import { TYPOGRAPHY, RADIUS, PALETTE } from '../../../theme/tokens'
import { useExpanded } from '../BlockWrapper'

function QuizQuestion({ q, index, total, onAnswer, isDark }) {
  const [selected,    setSelected]    = useState(null)
  const [revealed,    setRevealed]    = useState(false)
  const [hintVisible, setHintVisible] = useState(false)

  const displayOptions = q.type === 'true_false' ? ['True', 'False'] : (q.options ?? [])

  function handleSelect(i) {
    if (revealed) return
    setSelected(i)
    setRevealed(true)
    setTimeout(() => onAnswer(i === q.correctIndex), 900)
  }

  function optionStyle(i) {
    const base = {
      display: 'flex', alignItems: 'center', gap: 1,
      px: 2, py: 1.25,
      borderRadius: `${RADIUS.md}px`,
      border: '2px solid',
      cursor: revealed ? 'default' : 'pointer',
      userSelect: 'none',
      transition: 'all 0.18s ease',
    }
    if (!revealed) return {
      ...base,
      borderColor: isDark ? PALETTE.borderDark : PALETTE.borderCream,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      '&:hover': {
        borderColor: isDark ? 'rgba(75,114,255,0.5)' : 'rgba(75,114,255,0.4)',
        backgroundColor: isDark ? 'rgba(75,114,255,0.08)' : 'rgba(75,114,255,0.05)',
      },
    }
    if (i === q.correctIndex) return {
      ...base, borderColor: '#2ea043',
      backgroundColor: isDark ? 'rgba(46,160,67,0.12)' : 'rgba(46,160,67,0.08)',
    }
    if (i === selected && i !== q.correctIndex) return {
      ...base, borderColor: '#f85149',
      backgroundColor: isDark ? 'rgba(248,81,73,0.12)' : 'rgba(248,81,73,0.08)',
    }
    return {
      ...base, opacity: 0.45,
      borderColor: isDark ? PALETTE.borderDark : PALETTE.borderCream,
      backgroundColor: 'transparent',
    }
  }

  return (
    <Box>
      {total > 1 && (
        <Typography sx={{ fontSize: 10, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}>
          Question {index + 1} of {total}
        </Typography>
      )}

      <Typography sx={{
        fontSize: TYPOGRAPHY.sizes.body,
        fontWeight: TYPOGRAPHY.weights.semibold,
        color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
        mb: 2, lineHeight: 1.5,
      }}>
        {q.question}
      </Typography>

      {q.hint && !revealed && (
        <Box sx={{ mb: 1.5 }}>
          {!hintVisible ? (
            <Typography component="span" onClick={() => setHintVisible(true)} sx={{
              fontSize: TYPOGRAPHY.sizes.caption,
              color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
              cursor: 'pointer',
              '&:hover': { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' },
            }}>
              💡 Show hint
            </Typography>
          ) : (
            <Typography sx={{
              fontSize: TYPOGRAPHY.sizes.caption,
              color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
              fontStyle: 'italic',
            }}>
              {q.hint}
            </Typography>
          )}
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {displayOptions.map((opt, i) => (
          <Box key={i} onClick={() => handleSelect(i)} sx={optionStyle(i)}>
            {revealed && i === q.correctIndex && (
              <Typography component="span" sx={{ color: '#2ea043', fontWeight: 700, flexShrink: 0, lineHeight: 1 }}>✓</Typography>
            )}
            {revealed && i === selected && i !== q.correctIndex && (
              <Typography component="span" sx={{ color: '#f85149', fontWeight: 700, flexShrink: 0, lineHeight: 1 }}>✗</Typography>
            )}
            {(!revealed || (i !== q.correctIndex && i !== selected)) && (
              <Typography component="span" sx={{
                minWidth: 20, height: 20, borderRadius: '50%',
                border: '1.5px solid', flexShrink: 0,
                borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
              }}>
                {String.fromCharCode(65 + i)}
              </Typography>
            )}
            <Typography sx={{
              fontSize: TYPOGRAPHY.sizes.bodySm,
              color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
              lineHeight: 1.4,
            }}>
              {opt}
            </Typography>
          </Box>
        ))}
      </Box>

      {revealed && q.explanation && (
        <Box sx={{
          mt: 2, p: 1.5, borderRadius: `${RADIUS.md}px`,
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          borderLeft: `3px solid ${selected === q.correctIndex ? '#2ea043' : '#f85149'}`,
        }}>
          <Typography sx={{
            fontSize: TYPOGRAPHY.sizes.caption,
            color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
            lineHeight: 1.5,
          }}>
            {q.explanation}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

function ScoreSummary({ answers, questions, onRetry, isDark }) {
  const correct = answers.filter(Boolean).length
  const total   = questions.length
  const pct     = Math.round((correct / total) * 100)
  const color   = pct >= 80 ? '#2ea043' : pct >= 50 ? '#f0883e' : '#f85149'

  return (
    <Box sx={{ textAlign: 'center', py: 1 }}>
      <Typography sx={{ fontSize: '2rem', fontWeight: 700, color, mb: 0.25, lineHeight: 1 }}>
        {correct}/{total}
      </Typography>
      <Typography sx={{
        fontSize: TYPOGRAPHY.sizes.bodySm,
        color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
        mb: 2,
      }}>
        {pct}% correct
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2.5, textAlign: 'left' }}>
        {questions.map((q, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Typography component="span" sx={{
              fontSize: 13, color: answers[i] ? '#2ea043' : '#f85149',
              flexShrink: 0, mt: '1px', lineHeight: 1,
            }}>
              {answers[i] ? '✓' : '✗'}
            </Typography>
            <Typography sx={{
              fontSize: TYPOGRAPHY.sizes.caption,
              color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
              lineHeight: 1.4,
            }}>
              {q.question}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box
        onClick={onRetry}
        sx={{
          display: 'inline-block', px: 2, py: 0.75,
          borderRadius: `${RADIUS.md}px`,
          border: '1.5px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
          cursor: 'pointer',
          fontSize: TYPOGRAPHY.sizes.caption,
          color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
          userSelect: 'none',
          transition: 'all 0.15s ease',
          '&:hover': { borderColor: '#4B72FF', color: '#4B72FF' },
        }}
      >
        Try again
      </Box>
    </Box>
  )
}

export default function QuizBlock({
  question     = '',
  type         = 'mcq',
  options      = [],
  correctIndex = 0,
  explanation,
  hint,
  questions,
  caption,
}) {
  const theme      = useTheme()
  const isDark     = theme.palette.mode === 'dark'
  const isExpanded = useExpanded()

  // Normalize: questions array takes precedence over single-question props
  const allQuestions = useMemo(() => {
    if (Array.isArray(questions) && questions.length > 0) return questions
    return [{ question, type, options, correctIndex, explanation, hint }]
  }, [questions, question, type, options, correctIndex, explanation, hint])

  const [currentQ,    setCurrentQ]    = useState(0)
  const [answers,     setAnswers]     = useState([])
  const [showSummary, setShowSummary] = useState(false)

  const total = allQuestions.length

  function handleAnswer(correct) {
    const next = [...answers, correct]
    setAnswers(next)
    if (next.length === total && total > 1) {
      // Only show summary screen for multi-question quizzes
      setTimeout(() => setShowSummary(true), 400)
    } else if (next.length < total) {
      setTimeout(() => setCurrentQ(q => q + 1), 800)
    }
    // Single question: answer revealed inline, no summary screen
  }

  function handleRetry() {
    setCurrentQ(0)
    setAnswers([])
    setShowSummary(false)
  }

  return (
    <Box>
      <Box sx={{
        border: isExpanded ? 'none' : `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
        borderRadius: isExpanded ? 0 : `${RADIUS.lg}px`,
        p: isExpanded ? 3 : 2.5,
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
      }}>
        {showSummary ? (
          <ScoreSummary
            answers={answers}
            questions={allQuestions}
            onRetry={handleRetry}
            isDark={isDark}
          />
        ) : (
          <QuizQuestion
            key={currentQ}
            q={allQuestions[currentQ]}
            index={currentQ}
            total={total}
            onAnswer={handleAnswer}
            isDark={isDark}
          />
        )}
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
