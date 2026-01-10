import { NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.Puro_KV_REST_API_URL!,
  token: process.env.Puro_KV_REST_API_TOKEN!,
})

export async function GET() {
  try {
    // Get all pending request keys
    const pendingKeys = await redis.keys("pending:*")

    const requests = []
    for (const key of pendingKeys) {
      const request = await redis.get(key)
      if (request) {
        requests.push(request)
      }
    }

    // Sort by creation time (newest first)
    requests.sort((a: any, b: any) => b.createdAt - a.createdAt)

    return NextResponse.json({ requests })
  } catch (error) {
    console.error("[v0] Error fetching pending requests:", error)
    return NextResponse.json({ error: "Failed to fetch pending requests" }, { status: 500 })
  }
}
