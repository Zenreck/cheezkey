"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"

type PendingRequest = {
  requestId: string
  userId: string
  status: string
  createdAt: number
}

export default function AdminDashboard() {
  const router = useRouter()
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Check if admin is logged in
    const isAdmin = sessionStorage.getItem("adminLoggedIn")
    if (!isAdmin) {
      router.push("/admin/login")
      return
    }

    loadPendingRequests()
    const interval = setInterval(loadPendingRequests, 3000)
    return () => clearInterval(interval)
  }, [router])

  const loadPendingRequests = async () => {
    try {
      const response = await fetch("/api/admin/pending")
      const data = await response.json()
      setPendingRequests(data.requests || [])
    } catch (error) {
      console.error("[v0] Error loading pending requests:", error)
    }
  }

  const handleAction = async (requestId: string, action: "approve" | "decline") => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      })

      if (response.ok) {
        await loadPendingRequests()
      }
    } catch (error) {
      console.error("[v0] Error processing action:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem("adminLoggedIn")
    router.push("/admin/login")
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="absolute top-4 left-4">
        <Link href="/">
          <Button variant="outline" size="sm" className="text-xs bg-transparent">
            Back to Home
          </Button>
        </Link>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        </div>

        <Card className="p-6 bg-white">
          <h2 className="text-xl font-semibold mb-4">Pending Key Requests</h2>

          {pendingRequests.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No pending requests</p>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div
                  key={request.requestId}
                  className="border border-gray-200 rounded-lg p-4 flex justify-between items-center"
                >
                  <div>
                    <p className="font-mono text-sm text-gray-900">User ID: {request.userId.slice(0, 8)}...</p>
                    <p className="text-xs text-gray-500">Requested: {new Date(request.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAction(request.requestId, "approve")}
                      disabled={isLoading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleAction(request.requestId, "decline")}
                      disabled={isLoading}
                      variant="destructive"
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
