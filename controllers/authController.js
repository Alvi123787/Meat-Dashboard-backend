import jwt from 'jsonwebtoken'

const TOKEN_EXPIRY = '7d'

// POST /api/auth/login
// Body: { password }
// Compares against process.env.DASHBOARD_PASSWORD (set in .env / hosting env vars).
// On match, issues a signed JWT the frontend stores and sends back on every request.
export const login = (req, res) => {
  const { password } = req.body
  const correctPassword = process.env.DASHBOARD_PASSWORD
  const secret = process.env.JWT_SECRET

  if (!correctPassword || !secret) {
    console.error('❌ DASHBOARD_PASSWORD or JWT_SECRET is missing in environment variables.')
    return res.status(500).json({
      success: false,
      message: 'Dashboard authentication is not configured on the server.'
    })
  }

  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required' })
  }

  if (password !== correctPassword) {
    return res.status(401).json({ success: false, message: 'Incorrect password' })
  }

  const token = jwt.sign({ dashboard: true }, secret, { expiresIn: TOKEN_EXPIRY })
  res.status(200).json({ success: true, message: 'Login successful', token })
}
