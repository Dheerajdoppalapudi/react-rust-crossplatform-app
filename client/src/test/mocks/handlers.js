import { http, HttpResponse } from 'msw'

const BASE = 'http://localhost:8000'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

export const fixtures = {
  conversation: {
    id: 'conv-1',
    title: 'Test conversation',
    starred: 0,
  },
  session: {
    id: 'sess-1',
    prompt: 'Explain recursion',
    video_phase: 'ready',
    render_path: 'video',
    frames_data: { captions: ['Frame 1', 'Frame 2'], images: [], frame_count: 2 },
  },
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export const handlers = [

  // Auth
  http.post(`${BASE}/auth/refresh`, () =>
    HttpResponse.json({ status: 'success', data: { access_token: 'test-token', user: { id: 'u1', email: 'test@test.com', name: 'Test' } } })
  ),
  http.post(`${BASE}/auth/logout`, () =>
    HttpResponse.json({ status: 'success', data: {} })
  ),
  http.get(`${BASE}/auth/me`, () =>
    HttpResponse.json({ status: 'success', data: { id: 'u1', email: 'test@test.com', name: 'Test' } })
  ),

  // Conversations
  http.get(`${BASE}/api/conversations`, () =>
    HttpResponse.json({ status: 'success', data: [fixtures.conversation] })
  ),
  http.get(`${BASE}/api/conversations/:convId`, ({ params }) =>
    HttpResponse.json({
      status: 'success',
      data: {
        id: params.convId,
        title: 'Test conversation',
        sessions: [fixtures.session],
      },
    })
  ),
  http.patch(`${BASE}/api/conversations/:convId`, () =>
    HttpResponse.json({ status: 'success', data: { title: 'Renamed' } })
  ),
  http.delete(`${BASE}/api/conversations/:convId`, () =>
    HttpResponse.json({ status: 'success', data: {} })
  ),
  http.post(`${BASE}/api/conversations/:convId/star`, () =>
    HttpResponse.json({ status: 'success', data: { starred: true } })
  ),

  // Sessions
  http.get(`${BASE}/api/sessions/:sessionId/frames-meta`, () =>
    HttpResponse.json({
      status: 'success',
      data: { captions: ['Frame 1', 'Frame 2'], images: [], frame_count: 2 },
    })
  ),

  // Generation (unified SSE endpoint)
  http.post(`${BASE}/api/generate`, () =>
    new HttpResponse(
      'data: {"type":"done","session_id":"sess-new","conversation_id":"conv-1","turn_index":1,"render_path":"interactive"}\n\n',
      { headers: { 'Content-Type': 'text/event-stream' } }
    )
  ),
]
