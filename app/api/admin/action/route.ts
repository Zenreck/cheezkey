import { type NextRequest, NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.KV_REST_API_URL || "",
  token: process.env.KV_REST_API_TOKEN || "",
})

export async function POST(request: NextRequest) {
  try {
    const { requestId, action } = await request.json()

    if (!requestId || !action) {
      return NextResponse.json({ error: "Request ID and action required" }, { status: 400 })
    }

    // Get the pending request
    const pendingKey = `pending:${requestId}`
    const pendingRequest = (await redis.get(pendingKey)) as any

    if (!pendingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    const userId = pendingRequest.userId
    const userRequestsKey = `requests:${userId}`
    const rawRequests = await redis.get(userRequestsKey)
    
    // Ensure userRequests is always an array
    let userRequests: any[] = []
    if (Array.isArray(rawRequests)) {
      userRequests = rawRequests
    } else if (rawRequests && typeof rawRequests === 'object') {
      userRequests = [rawRequests]
    }

    // Find and update the request
    const requestIndex = userRequests.findIndex((r: any) => r.requestId === requestId)

    if (requestIndex === -1) {
      return NextResponse.json({ error: "User request not found" }, { status: 404 })
    }

    if (action === "approve") {
      // Generate the key
      const key = generateRandomKey()
      const now = Date.now()
      const expiresAt = now + 60 * 60 * 1000 // 1 hour from now

      userRequests[requestIndex] = {
        ...userRequests[requestIndex],
        status: "approved",
        key,
        expiresAt,
        approvedAt: now,
      }
    } else if (action === "decline") {
      userRequests[requestIndex] = {
        ...userRequests[requestIndex],
        status: "declined",
        declinedAt: Date.now(),
      }
    }

    // Update user requests
    await redis.set(userRequestsKey, userRequests)

    // Remove from pending queue
    await redis.del(pendingKey)

    return NextResponse.json({
      success: true,
      message: `Request ${action}d successfully`,
    })
  } catch (error) {
    console.error("[v0] Admin action error:", error)
    return NextResponse.json({ error: "Failed to process action" }, { status: 500 })
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
