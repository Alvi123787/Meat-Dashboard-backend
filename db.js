import mongoose from 'mongoose'

// ── Serverless-safe MongoDB connection ──
// Vercel spins up a fresh function instance per request (or reuses a warm one).
// Two things break a plain "connect once at boot" setup like a normal Express app uses:
//
// 1. process.exit(1) on failure — in a normal server that's fine (the whole process
//    restarts). In a serverless function it just kills the invocation and Vercel reports
//    it as "This Serverless Function has crashed", which is exactly the error you saw.
//
// 2. Reconnecting on every request — without caching, a cold-heavy workload can open a
//    new connection per invocation and exhaust MongoDB's connection limit.
//
// This version caches the connection promise on `global` so a warm function instance
// reuses it, and NEVER calls process.exit() — it throws instead, so the route handler's
// try/catch can turn it into a proper JSON error response instead of a hard crash.

let cached = global._mongooseConn

if (!cached) {
  cached = global._mongooseConn = { conn: null, promise: null }
}

export const connectDB = async () => {
  const uri = process.env.MONGO_URI

  if (!uri) {
    // Thrown, not process.exit()'d — the caller decides what to do with it.
    throw new Error(
      'MONGO_URI is missing. Set it in your Vercel project → Settings → Environment Variables.'
    )
  }

  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        bufferCommands: false
      })
      .then((mongooseInstance) => {
        console.log('✅ MongoDB connected:', mongooseInstance.connection.host)
        return mongooseInstance
      })
  }

  try {
    cached.conn = await cached.promise
  } catch (err) {
    // Reset so the next invocation retries instead of reusing a rejected promise forever.
    cached.promise = null
    throw err
  }

  return cached.conn
}

export default connectDB
