import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // For now, return a mock response to prevent 404 errors
  // In production, this should validate JWT tokens and return user data
  return NextResponse.json({
    user: null,
    message: 'Authentication endpoint - backend integration pending'
  })
}
