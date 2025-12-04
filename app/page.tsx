"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function KeyGeneratorPage() {
  const [keys, setKeys] = useState<{ key: string; expiresAt: Date }[]>([])
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
    loadKeys()
  }, [])

  // Load existing keys from localStorage
  const loadKeys = () => {
    const savedKeys = localStorage.getItem("generatedKeys")
    if (savedKeys) {
      const parsed = JSON.parse(savedKeys).map((k: any) => ({
        ...k,
        expiresAt: new Date(k.expiresAt),
      }))
      // Filter out expired keys
      const validKeys = parsed.filter((k: any) => new Date(k.expiresAt) > new Date())
      setKeys(validKeys)
      if (validKeys.length !== parsed.length) {
        localStorage.setItem("generatedKeys", JSON.stringify(validKeys))
      }
    }
  }

  // Cooldown timer
  useEffect(() => {
    if (cooldownTime > 0) {
      const timer = setTimeout(() => setCooldownTime(cooldownTime - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldownTime])

  // Check for expired keys
  useEffect(() => {
    const interval = setInterval(() => {
      const validKeys = keys.filter((k) => new Date(k.expiresAt) > new Date())
      if (validKeys.length !== keys.length) {
        setKeys(validKeys)
        localStorage.setItem("generatedKeys", JSON.stringify(validKeys))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [keys])

  const generateKey = async () => {
    if (keys.length >= 2) {
      setError("Maximum 2 keys allowed")
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
        throw new Error(data.error || "Failed to generate key")
      }

      const newKey = {
        key: data.key,
        expiresAt: new Date(data.expiresAt),
      }

      const updatedKeys = [...keys, newKey]
      setKeys(updatedKeys)
      localStorage.setItem("generatedKeys", JSON.stringify(updatedKeys))
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-white shadow-2xl">
        <div className="space-y-6">
          <h1 className="text-3xl font-bold text-center text-gray-900">Keys</h1>

          <div className="space-y-4">
            {/* First Key Slot */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-700">1st Key</h2>
              <div className="min-h-[80px] p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                {keys[0] ? (
                  <div className="space-y-1">
                    <p className="text-sm font-mono break-all text-gray-900">{keys[0].key}</p>
                    <p className="text-xs text-gray-500">Expires in: {formatTime(keys[0].expiresAt)}</p>
                  </div>
                ) : (
                  <p className="text-gray-400 text-center">No key generated</p>
                )}
              </div>
            </div>

            {/* Second Key Slot */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-700">2nd Key</h2>
              <div className="min-h-[80px] p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                {keys[1] ? (
                  <div className="space-y-1">
                    <p className="text-sm font-mono break-all text-gray-900">{keys[1].key}</p>
                    <p className="text-xs text-gray-500">Expires in: {formatTime(keys[1].expiresAt)}</p>
                  </div>
                ) : (
                  <p className="text-gray-400 text-center">No key generated</p>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Button
            onClick={generateKey}
            disabled={isGenerating || cooldownTime > 0 || keys.length >= 2}
            className="w-full h-12 text-base font-semibold"
          >
            {isGenerating
              ? "Generating..."
              : cooldownTime > 0
                ? `Wait ${cooldownTime}s`
                : keys.length >= 2
                  ? "Max Keys Reached"
                  : "Generate Key"}
          </Button>

          <p className="text-xs text-center text-gray-500">Keys expire in 1 hour • Maximum 2 keys</p>
        </div>
      </Card>
    </div>
  )
}
