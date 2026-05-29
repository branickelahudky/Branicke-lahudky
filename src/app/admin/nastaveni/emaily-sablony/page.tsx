import { loadEmailSablonyData } from './actions'
import { EmailSablonyClient } from './EmailSablonyClient'

export default async function EmailSablonyPage() {
  const { brand, previewHtml } = await loadEmailSablonyData()
  return <EmailSablonyClient initialBrand={brand} initialPreviewHtml={previewHtml} />
}
