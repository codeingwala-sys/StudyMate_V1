// Export a note as PDF using browser's native print dialog
// Uses the rich HTML content from the editor when available

export function exportNoteToPdf(note) {
  const title  = note.title || 'Untitled Note'
  const tags   = (note.tags || []).join(', ')
  const date   = new Date(note.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  // Prefer rich HTML from contenteditable, fall back to plain text
  let bodyContent = ''
  if (note.html && note.html.trim()) {
    // Sanitise: strip script tags
    bodyContent = note.html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  } else if (note.content) {
    // Convert plain text with basic markdown
    bodyContent = note.content
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^# (.+)$/gm,   '<h2>$1</h2>')
      .replace(/^## (.+)$/gm,  '<h3>$1</h3>')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/\n/g, '<br>')
  }

  // Checklist items
  const checklistHtml = (note.checklists || []).length > 0 ? `
    <div class="checklist">
      <h3>Checklist</h3>
      ${(note.checklists || []).map(item => `
        <div class="check-item">
          <span class="check-box">${item.done ? '☑' : '☐'}</span>
          <span style="${item.done ? 'text-decoration:line-through;color:#999' : ''}">${item.text || ''}</span>
        </div>
      `).join('')}
    </div>
  ` : ''

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          color: #111; padding: 48px 56px;
          max-width: 780px; margin: 0 auto; line-height: 1.75;
        }
        .header {
          border-bottom: 2px solid #111;
          padding-bottom: 18px; margin-bottom: 32px;
        }
        .brand {
          font-size: 10px; color: #999; text-transform: uppercase;
          letter-spacing: 2px; margin-bottom: 14px; display: flex;
          align-items: center; gap: 6px;
        }
        h1 { font-size: 30px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 10px }
        .meta { font-size: 12px; color: #666; display: flex; gap: 14px; flex-wrap: wrap; align-items: center }
        .tag { background: #f0f0f0; border-radius: 4px; padding: 2px 9px; font-size: 11px }
        .body { font-size: 15px; color: #1a1a1a }
        .body h2 { font-size: 22px; font-weight: 700; margin: 28px 0 12px; color: #111 }
        .body h3 { font-size: 18px; font-weight: 700; margin: 22px 0 10px }
        .body h4 { font-size: 15px; font-weight: 700; margin: 18px 0 8px }
        .body p  { margin-bottom: 10px }
        .body ul, .body ol { padding-left: 22px; margin-bottom: 12px }
        .body li { margin-bottom: 4px }
        .body strong { font-weight: 700 }
        .body em     { font-style: italic }
        .body img    { max-width: 100%; height: auto; border-radius: 8px; margin: 12px 0 }
        .checklist { margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee }
        .checklist h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 12px }
        .check-item { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; font-size: 14px }
        .check-box { font-size: 16px; flex-shrink: 0; line-height: 1.4 }
        .footer {
          margin-top: 48px; padding-top: 18px; border-top: 1px solid #eee;
          font-size: 11px; color: #bbb; display: flex; justify-content: space-between;
        }
        @media print {
          body { padding: 24px 32px }
          .header { page-break-after: avoid }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">✦ StudyMate</div>
        <h1>${title}</h1>
        <div class="meta">
          <span>📅 ${date}</span>
          ${tags ? `<span class="tag">🏷 ${tags}</span>` : ''}
          ${note.category ? `<span class="tag">${note.category}</span>` : ''}
        </div>
      </div>
      <div class="body">${bodyContent}</div>
      ${checklistHtml}
      <div class="footer">
        <span>✦ Exported from StudyMate AI</span>
        <span>${date}</span>
      </div>
    </body>
    </html>
  `

  const win = window.open('', '_blank')
  if (!win) {
    // Fallback: download as HTML file
    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${title.replace(/[^a-z0-9]/gi,'_')}.html`
    a.click()
    URL.revokeObjectURL(url)
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
  // Small delay so styles load before print dialog
  setTimeout(() => { win.print(); }, 600)
}