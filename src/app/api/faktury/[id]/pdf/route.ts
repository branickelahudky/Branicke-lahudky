import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { generateInvoicePdfBuffer } from '@/lib/invoice-pdf'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const inline = req.nextUrl.searchParams.get('inline') === 'true'

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { number: true },
  })
  if (!doc) {
    return NextResponse.json({ error: 'Faktura nenalezena' }, { status: 404 })
  }

  try {
    const pdfBuffer = await generateInvoicePdfBuffer(id)
    const safeNumber = doc.number.replace(/[^a-zA-Z0-9\-_]/g, '-')
    const disposition = inline
      ? `inline; filename="faktura-${safeNumber}.pdf"`
      : `attachment; filename="faktura-${safeNumber}.pdf"`

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: 'Chyba při generování PDF' }, { status: 500 })
  }
}
