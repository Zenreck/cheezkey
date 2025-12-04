import { type NextRequest, NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    // Check rate limit and key count for this user
    const userKeyPrefix = `user:${userId}:keys`
    const userKeys = await redis.keys(`${userKeyPrefix}:*`)

    // Clean up expired keys
    const now = Date.now()
    for (const keyName of userKeys) {
      const keyData = await redis.get(keyName)
      if (keyData && typeof keyData === "object" && "expiresAt" in keyData) {
        if (keyData.expiresAt < now) {
          await redis.del(keyName)
        }
      }
    }

    // Re-check active keys after cleanup
    const activeKeys = await redis.keys(`${userKeyPrefix}:*`)
    const validKeyCount = activeKeys.length

    if (validKeyCount >= 2) {
      return NextResponse.json({ error: "Maximum 2 keys reached. Wait for keys to expire." }, { status: 429 })
    }

    // Check cooldown (30 seconds between generations)
    const cooldownKey = `cooldown:${userId}`
    const lastGeneration = await redis.get(cooldownKey)

    if (lastGeneration) {
      return NextResponse.json({ error: "Please wait 30 seconds between generations" }, { status: 429 })
    }

    // Generate a random key
    const key = generateRandomKey()
    const expiresAt = now + 60 * 60 * 1000 // 1 hour from now

    // Store the key in Redis with 1 hour TTL
    const keyId = `${userKeyPrefix}:${Date.now()}`
    await redis.set(
      keyId,
      { key, expiresAt, userId },
      { ex: 60 * 60 }, // 1 hour expiration
    )

    // Set cooldown for 30 seconds
    await redis.set(cooldownKey, Date.now(), { ex: 30 })

    return NextResponse.json({
      key,
      expiresAt,
      message: "Key generated successfully",
    })
  } catch (error) {
    console.error("[v0] Key generation error:", error)
    return NextResponse.json({ error: "Failed to generate key" }, { status: 500 })
  }
}

function generateRandomKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  const segments = 4
  const segmentLength = 4

  return Array(segments)
    .fill(0)
    .map(() =>
      Array(segmentLength)
        .fill(0)
        .map(() => chars[Math.floor(Math.random() * chars.length)])
        .join(""),
    )
    .join("-")
}
