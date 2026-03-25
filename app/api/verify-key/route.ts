import { type NextRequest, NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.KV_REST_API_URL || "",
  token: process.env.KV_REST_API_TOKEN || "",
})

export async function POST(request: NextRequest) {
  try {
    const { key } = await request.json()

    if (!key) {
      return NextResponse.json({ error: "Key required" }, { status: 400 })
    }

    // Search all user requests to find matching key
    const allKeys = await redis.keys("requests:*")
    const now = Date.now()

    for (const keyName of allKeys) {
      const rawRequests = await redis.get(keyName)
      
      // Ensure requests is an array
      let requests: any[] = []
      if (Array.isArray(rawRequests)) {
        requests = rawRequests
      } else if (rawRequests && typeof rawRequests === 'object') {
        requests = [rawRequests]
      }

      // Check each request for a matching approved key
      for (const req of requests) {
        if (req.status === "approved" && req.key === key) {
          // Check if key is expired
          if (req.expiresAt && req.expiresAt > now) {
            return NextResponse.json({
              valid: true,
              userId: req.userId,
              expiresAt: req.expiresAt,
            })
          }
        }
      }
    }

    return NextResponse.json({ valid: false, error: "Invalid or expired key" })
  } catch (error) {
    console.error("[v0] Key verification error:", error)
    return NextResponse.json({ error: "Failed to verify key" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: "Use POST to verify a key" })
}
