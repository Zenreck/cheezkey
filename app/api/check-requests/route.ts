import { type NextRequest, NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.KV_REST_API_URL || "",
  token: process.env.KV_REST_API_TOKEN || "",
})

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }
    const userRequestsKey = `requests:${userId}`
    const rawRequests = await redis.get(userRequestsKey)
    
    // Ensure requests is always an array
    let requests: any[] = []
    if (Array.isArray(rawRequests)) {
      requests = rawRequests
    } else if (rawRequests && typeof rawRequests === 'object') {
      requests = [rawRequests]
    }

    // Clean up expired approved keys
    const now = Date.now()
    const validRequests = requests.filter((req: any) => {
      if (req.status === "approved" && req.expiresAt && req.expiresAt < now) {
        return false
      }
      return true
    })

    if (validRequests.length !== requests.length) {
      await redis.set(userRequestsKey, validRequests)
    }

    return NextResponse.json({ requests: validRequests })
  } catch (error) {
    console.error("[v0] Check requests error:", error)
    return NextResponse.json({ requests: [] }, { status: 200 })
  }
}
