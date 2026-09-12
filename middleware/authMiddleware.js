import jwt from 'jsonwebtoken'

// Protects a route by requiring a valid "Authorization: Bearer <token>" header.
// Attach this in front of any router that should only be reachable after the
// dashboard password has been entered (see routes/entries.js).
export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authenticated. Please log in.' })
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('❌ JWT_SECRET is missing on the server.')
    return res.status(500).json({ success: false, message: 'Server auth is not configured.' })
  }

  try {
    jwt.verify(token, secret)
    next()
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid. Please log in again.' })
  }
}

export default authMiddleware
