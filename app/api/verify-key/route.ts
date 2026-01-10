import { type NextRequest, NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.Puro_KV_REST_API_URL!,
  token: process.env.Puro_KV_REST_API_TOKEN!,
})

export async function POST(request: NextRequest) {
  try {
    const { key } = await request.json()

    if (!key) {
      return NextResponse.json({ error: "Key required" }, { status: 400 })
    }

    // Search all user keys to find matching key
    const allKeys = await redis.keys("user:*:keys:*")

    for (const keyName of allKeys) {
      const keyData = await redis.get(keyName)

      if (keyData && typeof keyData === "object" && "key" in keyData && keyData.key === key) {
        const now = Date.now()

        // Check if key is expired
        if ("expiresAt" in keyData && keyData.expiresAt > now) {
          return NextResponse.json({
            valid: true,
            userId: keyData.userId,
            expiresAt: keyData.expiresAt,
          })
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
