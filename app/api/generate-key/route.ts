import { type NextRequest, NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.KV_REST_API_URL || "",
  token: process.env.KV_REST_API_TOKEN || "",
})

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }
    const userRequestsKey = `requests:${userId}`
    const rawRequests = await redis.get(userRequestsKey)
    
    // Ensure existingRequests is always an array
    let existingRequests: any[] = []
    if (Array.isArray(rawRequests)) {
      existingRequests = rawRequests
    } else if (rawRequests && typeof rawRequests === 'object') {
      existingRequests = [rawRequests]
    }

    // Clean up expired or old declined requests
    const now = Date.now()
    const activeRequests = existingRequests.filter((req: any) => {
      if (req.status === "approved" && req.expiresAt && req.expiresAt < now) {
        return false
      }
      return true
    })

    if (activeRequests.length >= 2) {
      return NextResponse.json({ error: "Maximum 2 key requests reached" }, { status: 429 })
    }

    // Check cooldown (30 seconds between generations)
    const cooldownKey = `cooldown:${userId}`
    const lastGeneration = await redis.get(cooldownKey)

    if (lastGeneration) {
      return NextResponse.json({ error: "Please wait 30 seconds between generations" }, { status: 429 })
    }

    const requestId = `${userId}:${Date.now()}`
    const newRequest = {
      requestId,
      userId,
      status: "pending" as const,
      createdAt: now,
    }

    // Add to user's requests
    activeRequests.push(newRequest)
    await redis.set(userRequestsKey, activeRequests)

    // Add to pending queue for admin
    const pendingKey = `pending:${requestId}`
    await redis.set(pendingKey, newRequest, { ex: 86400 }) // 24 hour expiry for pending

    // Set cooldown for 30 seconds
    await redis.set(cooldownKey, now, { ex: 30 })

    return NextResponse.json({
      requestId,
      status: "pending",
      message: "Key request submitted. Waiting for admin approval.",
    })
  } catch (error) {
    console.error("[v0] Key generation error:", error)
    return NextResponse.json({ error: "Failed to generate key request" }, { status: 500 })
  }
}
