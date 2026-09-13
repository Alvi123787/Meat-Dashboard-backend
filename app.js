import express from 'express'
import cors from 'cors'
import connectDB from './db.js'
import entryRoutes from './routes/entries.js'
import expenseRoutes from './routes/expenses.js'
import dueRoutes from './routes/dues.js'
import authRoutes from './routes/auth.js'
import authMiddleware from './middleware/authMiddleware.js'

const app = express()

// ── Middleware ──
const defaultOrigins = [
  'https://meatdashboard.netlify.app',
  'https://dashboardbyalvi.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000'
]

const normalizeOrigin = (o) => (o || '').trim().replace(/\/+$/, '')

const allowedOrigins = (process.env.CLIENT_ORIGIN || defaultOrigins.join(','))
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean)

// Ensure production Netlify origins are always allowed even if env vars differ
defaultOrigins.forEach((origin) => {
  const norm = normalizeOrigin(origin)
  if (!allowedOrigins.includes(norm)) {
    allowedOrigins.push(norm)
  }
})

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-side requests without origin and tools like Postman/curl.
    if (!origin) return callback(null, true)

    const reqOrigin = normalizeOrigin(origin)
    const isAllowed =
      allowedOrigins.includes(reqOrigin) ||
      /^https:\/\/([a-z0-9-]+--)?meatdashboard\.netlify\.app$/.test(reqOrigin) ||
      /^https:\/\/([a-z0-9-]+--)?dashboardbyalvi\.netlify\.app$/.test(reqOrigin)

    if (isAllowed) {
      callback(null, true)
    } else {
      console.warn(`[CORS] Rejected origin: ${origin}`)
      callback(new Error(`CORS origin denied: ${origin}`))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json())

// ── Routes ──
app.get('/', (req, res) => {
  res.json({ success: true, message: 'MeatbyAlvi Business Tracker API is running' })
})

// Public — no DB connection needed, no auth token required.
app.use('/api/auth', authRoutes)

// Ensure a MongoDB connection exists before handling any /api/entries route.
// On Vercel this runs per invocation, but connectDB() caches the connection
// so a warm instance reuses it instead of reconnecting every time.
// Scoped to /api/entries only — the login route above doesn't need the DB,
// so it stays reachable even if MongoDB is briefly unavailable.
const requireDb = async (req, res, next) => {
  try {
    await connectDB()
    next()
  } catch (err) {
    console.error('❌ Database connection error:', err.message)
    res.status(500).json({
      success: false,
      message: 'Database connection failed. Check MONGO_URI in your environment settings.'
    })
  }
}

app.use('/api/entries', requireDb, authMiddleware, entryRoutes)
app.use('/api/expenses', requireDb, authMiddleware, expenseRoutes)
app.use('/api/dues', requireDb, authMiddleware, dueRoutes)

// ── 404 handler ──
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

// ── Error handler (catches anything thrown/passed to next()) ──
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, message: 'Internal server error' })
})

export default app
