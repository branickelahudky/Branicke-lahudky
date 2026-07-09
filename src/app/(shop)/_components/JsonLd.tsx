// Vloží schema.org strukturovaná data do stránky.
// JSON.stringify + escape '<' brání XSS přes </script> v datech.
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
