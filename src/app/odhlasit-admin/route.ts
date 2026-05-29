import { NextRequest, NextResponse } from 'next/server'
import { destroyCurrentSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  await destroyCurrentSession()
  return NextResponse.redirect(new URL('/prihlaseni-admin', request.url))
}
