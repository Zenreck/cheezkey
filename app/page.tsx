"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"

type KeyRequest = {
  key?: string
  status: "pending" | "approved" | "declined"
  expiresAt?: Date
  requestId: string
}

export default function KeyGeneratorPage() {
  const [requests, setRequests] = useState<KeyRequest[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [cooldownTime, setCooldownTime] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>("")

  // Get or create user ID
  useEffect(() => {
    let id = localStorage.getItem("userId")
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem("userId", id)
    }
    setUserId(id)
  }, [])

  useEffect(() => {
    if (!userId) return

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/check-requests?userId=${userId}`)
        const data = await response.json()

        if (data.requests) {
          setRequests(
            data.requests.map((r: any) => ({
              ...r,
              expiresAt: r.expiresAt ? new Date(r.expiresAt) : undefined,
            })),
          )
        }
      } catch (err) {
        console.error("[v0] Error checking requests:", err)
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 3000) // Check every 3 seconds
    return () => clearInterval(interval)
  }, [userId])

  // Cooldown timer
  useEffect(() => {
    if (cooldownTime > 0) {
      const timer = setTimeout(() => setCooldownTime(cooldownTime - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldownTime])

  const generateKey = async () => {
    if (requests.length >= 2) {
      setError("Maximum 2 key requests allowed")
      return
    }

    setIsGenerating(true)
    setError(null)
    setCooldownTime(30)

    try {
      const response = await fetch("/api/generate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate key request")
      }

      // Request created, will poll for status
    } catch (err: any) {
      setError(err.message)
      setCooldownTime(0)
    } finally {
      setIsGenerating(false)
    }
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    if (diff <= 0) return "Expired"

    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const renderSlot = (index: number) => {
    const request = requests[index]

    if (!request) {
      return <p className="text-gray-400 text-center">No key generated</p>
    }

    if (request.status === "pending") {
      return (
        <div className="space-y-1">
          <p className="text-sm text-yellow-600 font-semibold">⏳ Pending</p>
          <p className="text-xs text-gray-500">Please wait for admin approval...</p>
        </div>
      )
    }

    if (request.status === "declined") {
      return (
        <div className="space-y-1">
          <p className="text-sm text-red-600 font-semibold">❌ Declined by Admin</p>
          <p className="text-xs text-gray-500">Your request was declined</p>
        </div>
      )
    }

    if (request.status === "approved" && request.key && request.expiresAt) {
      return (
        <div className="space-y-1">
          <p className="text-sm font-mono break-all text-gray-900">{request.key}</p>
          <p className="text-xs text-gray-500">Expires in: {formatTime(request.expiresAt)}</p>
        </div>
      )
    }

    return <p className="text-gray-400 text-center">No key generated</p>
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <Link href="/admin">
          <Button variant="outline" size="sm" className="text-xs bg-transparent">
            Admin
          </Button>
        </Link>
      </div>

      <Card className="w-full max-w-md p-8 bg-white shadow-2xl">
        <div className="space-y-6">
          <h1 className="text-3xl font-bold text-center text-gray-900">Keys</h1>

          <div className="text-center p-2 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-xs text-purple-600 font-mono">Your ID: {userId.slice(0, 8)}...</p>
          </div>

          <div className="space-y-4">
            {/* First Key Slot */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-700">1st Key</h2>
              <div className="min-h-[80px] p-4 bg-gray-50 rounded-lg border-2 border-gray-200">{renderSlot(0)}</div>
            </div>

            {/* Second Key Slot */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-700">2nd Key</h2>
              <div className="min-h-[80px] p-4 bg-gray-50 rounded-lg border-2 border-gray-200">{renderSlot(1)}</div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Button
            onClick={generateKey}
            disabled={isGenerating || cooldownTime > 0 || requests.length >= 2}
            className="w-full h-12 text-base font-semibold"
          >
            {isGenerating
              ? "Generating..."
              : cooldownTime > 0
                ? `Wait ${cooldownTime}s`
                : requests.length >= 2
                  ? "Max Keys Reached"
                  : "Generate Key"}
          </Button>

          <p className="text-xs text-center text-gray-500">Keys expire in 1 hour • Maximum 2 keys</p>
        </div>
      </Card>
    </div>
  )
}
