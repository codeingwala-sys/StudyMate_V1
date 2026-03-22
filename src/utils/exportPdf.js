// Export a note as PDF using browser's native print dialog
// Works on all mobile browsers — no external library needed

export function exportNoteToPdf(note) {
  const title   = note.title || 'Untitled Note'
  const content = note.content || ''
  const tags    = note.tags?.join(', ') || ''
  const date    = new Date(note.createdAt || Date.now()).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })

  // Format content — preserve line breaks, handle markdown-like bold/headers
  const formatted = content
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/\n/g, '<br>')

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box }
        body { font-family:'Segoe UI',Arial,sans-serif; color:#111; padding:40px; max-width:720px; margin:0 auto; line-height:1.7 }
        .header { border-bottom:2px solid #111; padding-bottom:16px; margin-bottom:28px }
        .brand  { font-size:11px; color:#888; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:12px }
        h1      { font-size:28px; font-weight:800; letter-spacing:-0.5px; margin-bottom:8px }
        .meta   { font-size:12px; color:#666; display:flex; gap:16px; flex-wrap:wrap }
        .tag    { background:#f0f0f0; border-radius:4px; padding:2px 8px }
        .body   { font-size:15px; color:#222 }
        h2      { font-size:20px; font-weight:700; margin:24px 0 12px; color:#111 }
        h3      { font-size:17px; font-weight:700; margin:20px 0 10px; color:#222 }
        h4      { font-size:15px; font-weight:700; margin:16px 0 8px; color:#333 }
        strong  { font-weight:700 }
        .footer { margin-top:40px; padding-top:16px; border-top:1px solid #eee; font-size:11px; color:#aaa; text-align:center }
        @media print { body { padding:20px } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">✦ StudyMate</div>
        <h1>${title}</h1>
        <div class="meta">
          <span>${date}</span>
          ${tags ? `<span class="tag">${tags}</span>` : ''}
        </div>
      </div>
      <div class="body">${formatted}</div>
      <div class="footer">Exported from StudyMate AI · ${date}</div>
    </body>
    </html>
  `

  const win = window.open('', '_blank')
  if (!win) { alert('Please allow popups to export PDF'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 400)
}