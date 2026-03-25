import { type NextRequest, NextResponse } from "next/server"
import { getRedis } from "@/lib/redis"

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }
    
    const redisClient = getRedis()
    if (!redisClient) {
      console.error("[v0] Redis not available")
      return NextResponse.json({ requests: [] }, { status: 200 })
    }
    
    const userRequestsKey = `requests:${userId}`
    const rawRequests = await redisClient.get(userRequestsKey)
    
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
      await redisClient.set(userRequestsKey, validRequests)
    }

    return NextResponse.json({ requests: validRequests })
  } catch (error) {
    console.error("[v0] Check requests error:", error)
    return NextResponse.json({ requests: [] }, { status: 200 })
  }
}
