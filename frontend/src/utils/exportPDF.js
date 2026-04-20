import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate, getFullName } from './helpers.js'
import { STATUS_LABELS, ROLE_LABELS } from './constants.js'
import headerLogoUrl from '../assets/header-jofe.png'
import headerDecoUrl from '../assets/header-decoration.png'

function formatCFA(amount) {
  if (amount === null || amount === undefined || amount === '') return '—'
  const num = parseFloat(amount)
  if (isNaN(num)) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

const BRAND_DEEP  = [22, 44, 84]    // #162C54
const BRAND_MID   = [52, 117, 187]  // #3475BB
const BRAND_LIGHT = [55, 182, 233]  // #37B6E9

// Load image as base64 for jsPDF
function loadImageAsBase64(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export async function exportFichePDF(fiche, type) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const isExterne = type === 'externe'
  const pageW = doc.internal.pageSize.getWidth()   // 210mm
  const pageH = doc.internal.pageSize.getHeight()  // 297mm
  const margin = 14

  // ── Load images ─────────────────────────────────────────────────────────────
  const [headerLogo, headerDeco] = await Promise.all([
    loadImageAsBase64(headerLogoUrl),
    loadImageAsBase64(headerDecoUrl),
  ])

  // ── Décoration de fond (coins) — image2 ────────────────────────────────────
  // image2 est portrait 2497×3550 → ratio ~0.703
  // On la place en fond, pleine page, très transparente
  if (headerDeco) {
    // jsPDF n'a pas d'opacité native pour addImage, on l'ajoute via GState
    doc.saveGraphicsState()
    doc.setGState(new doc.GState({ opacity: 0.06 }))
    doc.addImage(headerDeco, 'PNG', 0, 0, pageW, pageH)
    doc.restoreGraphicsState()
  }

  // ── En-tête officiel Jofé (image1) ─────────────────────────────────────────
  // image1 est 10482×1457 → ratio ~7.19 (très large)
  // Pleine largeur de la page = 210mm, hauteur ≈ 210/7.19 ≈ 29mm
  const headerH = 29
  if (headerLogo) {
    doc.addImage(headerLogo, 'PNG', 0, 0, pageW, headerH)
  } else {
    // Fallback si image non chargée
    doc.setFillColor(...BRAND_DEEP)
    doc.rect(0, 0, pageW, headerH, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('JoFé Digital SARL', margin, 18)
  }

  // ── Bande de titre sous le logo ─────────────────────────────────────────────
  const bandY = headerH
  doc.setFillColor(...BRAND_DEEP)
  doc.rect(0, bandY, pageW, 9, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(`FICHE DE BESOIN ${isExterne ? 'EXTERNE' : 'INTERNE'}`, pageW / 2, bandY + 6, { align: 'center' })

  // Numéro de fiche à droite dans la bande
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...BRAND_LIGHT)
  doc.text(`N° ${fiche.numero || fiche.id}   |   ${formatDate(new Date())}`, pageW - margin, bandY + 6, { align: 'right' })

  // ── Statut ──────────────────────────────────────────────────────────────────
  let y = bandY + 16
  const statusLabel = STATUS_LABELS[fiche.status] || fiche.status || ''
  doc.setFillColor(240, 248, 255)
  doc.setDrawColor(...BRAND_LIGHT)
  doc.roundedRect(margin, y - 5, 65, 8, 2, 2, 'FD')
  doc.setTextColor(...BRAND_MID)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(`Statut : ${statusLabel}`, margin + 3, y)

  // ── Informations générales ──────────────────────────────────────────────────
  y += 10
  doc.setTextColor(...BRAND_DEEP)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Informations générales', margin, y)
  doc.setDrawColor(...BRAND_LIGHT)
  doc.setLineWidth(0.5)
  doc.line(margin, y + 2, pageW - margin, y + 2)

  y += 8
  const col1 = margin
  const col2 = pageW / 2

  const fields = [
    ['Créé par', getFullName(fiche.created_by_detail) || '—'],
    ['Rôle', ROLE_LABELS[fiche.created_by_detail?.role] || '—'],
    ['Département', fiche.department_detail?.name || fiche.created_by_detail?.department_detail?.name || '—'],
    ['Date de création', formatDate(fiche.created_at)],
    ['Dernière mise à jour', formatDate(fiche.updated_at)],
    ["Nombre d'articles", String(fiche.items?.length ?? 0)],
  ]

  fields.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? col1 : col2
    const rowY = y + Math.floor(i / 2) * 10

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(label.toUpperCase(), x, rowY)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    doc.text(value, x, rowY + 5)
  })

  if (fiche.notes) {
    y += Math.ceil(fields.length / 2) * 10 + 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text('NOTES', col1, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    const lines = doc.splitTextToSize(fiche.notes, pageW - margin * 2)
    doc.text(lines, col1, y + 5)
    y += lines.length * 5 + 8
  } else {
    y += Math.ceil(fields.length / 2) * 10 + 10
  }

  // ── Exécution (si disponible) ───────────────────────────────────────────────
  if (fiche.executed_at) {
    doc.setFillColor(245, 240, 255)
    doc.setDrawColor(124, 58, 237)
    doc.roundedRect(margin, y - 4, pageW - margin * 2, fiche.execution_note ? 18 : 12, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(124, 58, 237)
    doc.text('EXÉCUTION COMPTABILITÉ', margin + 3, y + 1)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(30, 30, 30)
    doc.text(
      `Exécuté par ${getFullName(fiche.executed_by_detail) || '—'} le ${formatDate(fiche.executed_at)}`,
      margin + 3, y + 7
    )
    if (fiche.execution_note) {
      doc.setFontSize(7.5)
      doc.setTextColor(80, 80, 80)
      doc.text(`Réf : ${fiche.execution_note}`, margin + 3, y + 13)
      y += 24
    } else {
      y += 18
    }
  }

  if (fiche.received_at) {
    doc.setFillColor(240, 253, 250)
    doc.setDrawColor(13, 148, 136)
    doc.roundedRect(margin, y - 4, pageW - margin * 2, 12, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(13, 148, 136)
    doc.text('RÉCEPTION CONFIRMÉE', margin + 3, y + 1)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(30, 30, 30)
    doc.text(`Reçu le ${formatDate(fiche.received_at)}`, margin + 3, y + 7)
    y += 18
  }

  // ── Articles ─────────────────────────────────────────────────────────────────
  doc.setTextColor(...BRAND_DEEP)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Articles', margin, y)
  doc.setDrawColor(...BRAND_LIGHT)
  doc.setLineWidth(0.5)
  doc.line(margin, y + 2, pageW - margin, y + 2)
  y += 6

  const items = fiche.items || []

  const head = isExterne
    ? [['#', 'Désignation', 'Qté', 'Affectation', 'Date requise', 'Mnt. Prestataire', 'Mnt. Client']]
    : [['#', 'Désignation', 'Qté', 'Date requise', 'Montant']]

  const body = items.map((item, idx) => {
    const base = [
      String(idx + 1),
      item.designation || '—',
      String(item.quantity ?? item.quantite ?? '—'),
    ]
    if (isExterne) {
      return [
        ...base,
        item.affectation || '—',
        item.date_requise ? new Date(item.date_requise).toLocaleDateString('fr-FR') : '—',
        formatCFA(item.montant_prestataire),
        formatCFA(item.montant_client),
      ]
    }
    return [
      ...base,
      item.date_requise ? new Date(item.date_requise).toLocaleDateString('fr-FR') : '—',
      formatCFA(item.montant),
    ]
  })

  if (items.length > 0) {
    if (isExterne) {
      const totalPresta = items.reduce((s, i) => s + (parseFloat(i.montant_prestataire) || 0), 0)
      const totalClient = items.reduce((s, i) => s + (parseFloat(i.montant_client) || 0), 0)
      body.push(['', '', '', '', 'TOTAL', formatCFA(totalPresta), formatCFA(totalClient)])
    } else {
      const total = items.reduce((s, i) => s + (parseFloat(i.montant) || 0), 0)
      body.push(['', '', '', 'TOTAL', formatCFA(total)])
    }
  }

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: BRAND_DEEP,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: [245, 249, 255] },
    didParseCell(data) {
      const isLastRow = data.row.index === body.length - 1 && items.length > 0
      if (isLastRow) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [235, 245, 255]
        data.cell.styles.textColor = BRAND_DEEP
      }
    },
    columnStyles: isExterne
      ? { 0: { cellWidth: 8 }, 1: { cellWidth: 45 }, 5: { halign: 'right' }, 6: { halign: 'right' } }
      : { 0: { cellWidth: 8 }, 1: { cellWidth: 70 }, 4: { halign: 'right' } },
  })

  // ── Historique de validation ────────────────────────────────────────────────
  const validations = fiche.validations || []
  if (validations.length > 0) {
    const finalY = doc.lastAutoTable.finalY + 10
    doc.setTextColor(...BRAND_DEEP)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Historique de validation', margin, finalY)
    doc.setDrawColor(...BRAND_LIGHT)
    doc.line(margin, finalY + 2, pageW - margin, finalY + 2)

    autoTable(doc, {
      startY: finalY + 6,
      head: [['Date', 'Validateur', 'Rôle', 'Décision', 'Commentaire']],
      body: validations.map((v) => [
        formatDate(v.validated_at || v.created_at),
        getFullName(v.validated_by_detail || v.validated_by) || '—',
        ROLE_LABELS[v.validated_by_detail?.role] || '—',
        v.approved ? 'Approuvé' : 'Rejeté',
        v.comment || '—',
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      headStyles: { fillColor: BRAND_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
      didParseCell(data) {
        if (data.column.index === 3 && data.section === 'body') {
          data.cell.styles.textColor = data.cell.raw === 'Approuvé' ? [22, 101, 52] : [185, 28, 28]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
  }

  // ── Pied de page sur chaque page ────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const ph = doc.internal.pageSize.getHeight()

    // Décoration de fond sur chaque page supplémentaire
    if (i > 1 && headerDeco) {
      doc.saveGraphicsState()
      doc.setGState(new doc.GState({ opacity: 0.06 }))
      doc.addImage(headerDeco, 'PNG', 0, 0, pageW, ph)
      doc.restoreGraphicsState()
    }

    // En-tête réduit sur pages suivantes
    if (i > 1 && headerLogo) {
      doc.addImage(headerLogo, 'PNG', 0, 0, pageW, 18)
      doc.setFillColor(...BRAND_DEEP)
      doc.rect(0, 18, pageW, 5, 'F')
    }

    // Pied de page
    doc.setFillColor(...BRAND_DEEP)
    doc.rect(0, ph - 10, pageW, 10, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('JoFé Digital SARL — Document confidentiel', margin, ph - 4)
    doc.text(`Page ${i} / ${pageCount}`, pageW - margin, ph - 4, { align: 'right' })
  }

  const filename = `fiche-besoin-${isExterne ? 'externe' : 'interne'}-${fiche.numero || fiche.id}.pdf`
  doc.save(filename)
}

// ── Private helpers shared by all three export functions ───────────────────

function _drawPageBackground(doc, { pageW, pageH, headerLogo, headerDeco, margin }) {
  if (headerDeco) {
    doc.saveGraphicsState()
    doc.setGState(new doc.GState({ opacity: 0.06 }))
    doc.addImage(headerDeco, 'PNG', 0, 0, pageW, pageH)
    doc.restoreGraphicsState()
  }
  const headerH = 29
  if (headerLogo) {
    doc.addImage(headerLogo, 'PNG', 0, 0, pageW, headerH)
  } else {
    doc.setFillColor(...BRAND_DEEP)
    doc.rect(0, 0, pageW, headerH, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('JoFé Digital SARL', margin, 18)
  }
  return headerH
}

function _drawTitleBand(doc, { pageW, margin, title, numero, date, headerH }) {
  const bandY = headerH
  doc.setFillColor(...BRAND_DEEP)
  doc.rect(0, bandY, pageW, 9, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(title, pageW / 2, bandY + 6, { align: 'center' })
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...BRAND_LIGHT)
  doc.text(`N° ${numero}   |   ${date}`, pageW - margin, bandY + 6, { align: 'right' })
  return bandY
}

function _drawStatusBadge(doc, { margin, y, label }) {
  doc.setFillColor(240, 248, 255)
  doc.setDrawColor(...BRAND_LIGHT)
  doc.roundedRect(margin, y - 5, 80, 8, 2, 2, 'FD')
  doc.setTextColor(...BRAND_MID)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(`Statut : ${label}`, margin + 3, y)
}

function _drawSection(doc, { text, y, pageW, margin }) {
  doc.setTextColor(...BRAND_DEEP)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(text, margin, y)
  doc.setDrawColor(...BRAND_LIGHT)
  doc.setLineWidth(0.5)
  doc.line(margin, y + 2, pageW - margin, y + 2)
  return y + 8
}

function _drawFields(doc, { fields, startY, col1, col2 }) {
  fields.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? col1 : col2
    const rowY = startY + Math.floor(i / 2) * 10
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(label.toUpperCase(), x, rowY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    const lines = doc.splitTextToSize(String(value ?? '—'), col2 - x - 4)
    doc.text(lines[0], x, rowY + 5)
  })
  return startY + Math.ceil(fields.length / 2) * 10
}

function _drawSignatureRow(doc, { signers, y, pageW, margin }) {
  // signers: [{ role, name, mention, date }]
  const n = signers.length
  const colW = (pageW - margin * 2) / n
  const boxH = 34

  signers.forEach(({ role, name, mention, date }, i) => {
    const x = margin + i * colW
    const cx = x + colW / 2

    doc.setDrawColor(...BRAND_MID)
    doc.setLineWidth(0.3)
    doc.setFillColor(248, 251, 255)
    doc.roundedRect(x + 2, y, colW - 4, boxH, 1.5, 1.5, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...BRAND_DEEP)
    doc.text(role, cx, y + 6, { align: 'center' })

    if (name) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(50, 50, 50)
      const nm = doc.splitTextToSize(name, colW - 10)
      doc.text(nm[0], cx, y + 12, { align: 'center' })
    }

    if (mention) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(22, 101, 52)
      doc.text(mention, cx, y + (name ? 18 : 13), { align: 'center' })
    }

    if (date) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(120, 120, 120)
      doc.text(date, cx, y + (name ? 23 : 18), { align: 'center' })
    }

    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.25)
    doc.line(x + 6, y + boxH - 3, x + colW - 6, y + boxH - 3)
  })

  return y + boxH + 4
}

function _drawAllPageFooters(doc, { pageW, headerLogo, headerDeco, margin }) {
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const ph = doc.internal.pageSize.getHeight()
    if (i > 1 && headerDeco) {
      doc.saveGraphicsState()
      doc.setGState(new doc.GState({ opacity: 0.06 }))
      doc.addImage(headerDeco, 'PNG', 0, 0, pageW, ph)
      doc.restoreGraphicsState()
    }
    if (i > 1 && headerLogo) {
      doc.addImage(headerLogo, 'PNG', 0, 0, pageW, 18)
      doc.setFillColor(...BRAND_DEEP)
      doc.rect(0, 18, pageW, 5, 'F')
    }
    doc.setFillColor(...BRAND_DEEP)
    doc.rect(0, ph - 10, pageW, 10, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('JoFé Digital SARL — Document confidentiel', margin, ph - 4)
    doc.text(`Page ${i} / ${pageCount}`, pageW - margin, ph - 4, { align: 'right' })
  }
}

// ---------------------------------------------------------------------------
// Bon de Paiement PDF
// ---------------------------------------------------------------------------
export async function exportBonPaiementPDF(bon) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const col1 = margin
  const col2 = pageW / 2

  const [headerLogo, headerDeco] = await Promise.all([
    loadImageAsBase64(headerLogoUrl),
    loadImageAsBase64(headerDecoUrl),
  ])

  const headerH = _drawPageBackground(doc, { pageW, pageH, headerLogo, headerDeco, margin })
  const bandY = _drawTitleBand(doc, {
    pageW, margin, title: 'BON DE PAIEMENT',
    numero: bon.numero, date: formatDate(bon.date), headerH,
  })

  const BP_STATUS = { DRAFT: 'Brouillon', VALIDATED: 'Validé', CANCELLED: 'Annulé' }
  let y = bandY + 16
  _drawStatusBadge(doc, { margin, y, label: BP_STATUS[bon.status] || bon.status })

  // ── Informations générales ──────────────────────────────────────────────
  y = _drawSection(doc, { text: 'Informations générales', y: y + 10, pageW, margin })
  const MODE_LABELS = { ESPECE: 'Espèce', CHEQUE: 'Chèque' }
  const infoFields = [
    ['Date', formatDate(bon.date)],
    ['Mode de paiement', MODE_LABELS[bon.mode_paiement] ?? bon.mode_paiement ?? '—'],
    ['Bénéficiaire (Reçu par)', bon.beneficiaire || '—'],
    ['Montant', `${Number(bon.montant).toLocaleString('fr-FR')} FCFA`],
    ['Créé par', getFullName(bon.created_by_detail) || '—'],
    ['Statut', BP_STATUS[bon.status] || bon.status],
  ]
  y = _drawFields(doc, { fields: infoFields, startY: y, col1, col2 }) + 4

  // Motif (pleine largeur)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text('MOTIF', col1, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(30, 30, 30)
  const motifLines = doc.splitTextToSize(bon.motif || '—', pageW - margin * 2)
  doc.text(motifLines, col1, y + 5)
  y += motifLines.length * 5 + 8

  // Montant en lettres
  if (bon.montant_lettres) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text('MONTANT EN LETTRES', col1, y)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    const letLines = doc.splitTextToSize(bon.montant_lettres, pageW - margin * 2)
    doc.text(letLines, col1, y + 5)
    y += letLines.length * 5 + 8
  }

  // Notes
  if (bon.notes) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text('NOTES', col1, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    const noteLines = doc.splitTextToSize(bon.notes, pageW - margin * 2)
    doc.text(noteLines, col1, y + 5)
    y += noteLines.length * 5 + 8
  }

  // ── Articles ───────────────────────────────────────────────────────────
  const items = bon.items || []
  if (items.length > 0) {
    y = _drawSection(doc, { text: 'Articles', y, pageW, margin }) - 2
    const total = items.reduce((s, i) => s + (parseFloat(i.montant) || 0), 0)
    const body = items.map((item) => [item.designation || '—', formatCFA(item.montant)])
    body.push(['TOTAL', formatCFA(total)])
    autoTable(doc, {
      startY: y,
      head: [['Désignation / Détail', 'Montant (FCFA)']],
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: BRAND_DEEP, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [245, 249, 255] },
      columnStyles: { 1: { halign: 'right', cellWidth: 45 } },
      didParseCell(data) {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = [235, 245, 255]
          data.cell.styles.textColor = BRAND_DEEP
        }
      },
    })
    y = doc.lastAutoTable.finalY + 10
  }

  // ── Signatures et approbations ─────────────────────────────────────────
  y = _drawSection(doc, { text: 'Signatures et approbations', y, pageW, margin })
  const isValidated = bon.status === 'VALIDATED'
  _drawSignatureRow(doc, {
    y,
    pageW,
    margin,
    signers: [
      {
        role: 'Le Comptable',
        name: getFullName(bon.created_by_detail) || '—',
        mention: null,
        date: formatDate(bon.created_at),
      },
      {
        role: 'Le DAF',
        name: null,
        mention: isValidated ? 'Approuvé' : null,
        date: null,
      },
    ],
  })

  _drawAllPageFooters(doc, { pageW, headerLogo, headerDeco, margin })
  doc.save(`bon-paiement-${bon.numero || bon.id}.pdf`)
}

// ---------------------------------------------------------------------------
// Fiche de Mission PDF
// ---------------------------------------------------------------------------
export async function exportFicheMissionPDF(mission) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const col1 = margin
  const col2 = pageW / 2

  const [headerLogo, headerDeco] = await Promise.all([
    loadImageAsBase64(headerLogoUrl),
    loadImageAsBase64(headerDecoUrl),
  ])

  const FM_STATUS = {
    DRAFT: 'Brouillon', PENDING_MANAGER: 'En attente Manager', PENDING_DAF: 'En attente DAF',
    PENDING_DG: 'En attente DG', APPROVED: 'Approuvée', REJECTED: 'Rejetée',
    IN_PROGRESS: 'En cours', DONE: 'Terminée',
  }

  const headerH = _drawPageBackground(doc, { pageW, pageH, headerLogo, headerDeco, margin })
  const bandY = _drawTitleBand(doc, {
    pageW, margin, title: 'FICHE DE FRAIS DE MISSION',
    numero: mission.numero, date: formatDate(mission.date), headerH,
  })

  let y = bandY + 16
  _drawStatusBadge(doc, { margin, y, label: FM_STATUS[mission.status] || mission.status })

  // ── Informations générales ──────────────────────────────────────────────
  y = _drawSection(doc, { text: 'Informations générales', y: y + 10, pageW, margin })
  const infoFields = [
    ['Nom et Prénom', mission.nom_prenom || '—'],
    ['Matricule', mission.matricule_display || '—'],
    ['Fonction', mission.fonction || '—'],
    ['Date de la fiche', formatDate(mission.date)],
    ['Département', mission.department_detail?.name || '—'],
    ['Créé par', getFullName(mission.created_by_detail) || '—'],
  ]
  if (mission.prestataire_nom) infoFields.push(['Prestataire', mission.prestataire_nom], ['', ''])
  y = _drawFields(doc, { fields: infoFields, startY: y, col1, col2 }) + 6

  // ── Détails de la mission ───────────────────────────────────────────────
  y = _drawSection(doc, { text: 'Détails de la mission', y, pageW, margin })
  const missionFields = [
    ['Destination', mission.destination || '—'],
    ['Date de départ', formatDate(mission.date_debut)],
    ['Date de retour', formatDate(mission.date_fin)],
    ...(mission.agent_liaison_detail
      ? [['Agent de liaison', getFullName(mission.agent_liaison_detail) || '—']]
      : []),
  ]
  y = _drawFields(doc, { fields: missionFields, startY: y, col1, col2 }) + 4

  // Objet (pleine largeur)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text("OBJET DE LA MISSION", col1, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(30, 30, 30)
  const objetLines = doc.splitTextToSize(mission.objet_mission || '—', pageW - margin * 2)
  doc.text(objetLines, col1, y + 5)
  y += objetLines.length * 5 + 10

  // ── Détail des frais ────────────────────────────────────────────────────
  y = _drawSection(doc, { text: 'Détail des frais', y, pageW, margin }) - 2
  const fraisBody = [
    ['Hébergement',   formatCFA(mission.hebergement)],
    ['Restauration',  formatCFA(mission.restauration)],
    ['Transport A/R', formatCFA(mission.transport_aller_retour)],
    ['Autres frais',  formatCFA(mission.autres_frais)],
    ['TOTAL',         formatCFA(mission.total_frais)],
  ]
  autoTable(doc, {
    startY: y,
    body: fraisBody,
    margin: { left: margin, right: margin },
    tableWidth: 110,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: BRAND_DEEP, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [245, 249, 255] },
    columnStyles: { 0: { cellWidth: 65 }, 1: { halign: 'right', cellWidth: 45 } },
    didParseCell(data) {
      if (data.row.index === fraisBody.length - 1) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [235, 245, 255]
        data.cell.styles.textColor = BRAND_DEEP
      }
    },
  })
  y = doc.lastAutoTable.finalY + 8

  // Notes
  if (mission.notes) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text('NOTES', col1, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    const lines = doc.splitTextToSize(mission.notes, pageW - margin * 2)
    doc.text(lines, col1, y + 5)
    y += lines.length * 5 + 10
  }

  // ── Signatures et approbations ─────────────────────────────────────────
  y = _drawSection(doc, { text: 'Signatures et approbations', y, pageW, margin })
  const isApproved = ['APPROVED', 'IN_PROGRESS', 'DONE'].includes(mission.status)
  const managerDetail = mission.created_by_detail?.manager_detail
  _drawSignatureRow(doc, {
    y,
    pageW,
    margin,
    signers: [
      {
        role: "L'Intéressé(e)",
        name: mission.nom_prenom || '—',
        mention: null,
        date: formatDate(mission.date),
      },
      {
        role: 'Le Supérieur Hiérarchique',
        name: managerDetail ? getFullName(managerDetail) : null,
        mention: isApproved ? 'Approuvé' : null,
        date: null,
      },
      {
        role: 'Le DAF',
        name: null,
        mention: isApproved ? 'Approuvé' : null,
        date: null,
      },
      {
        role: 'Le DG',
        name: null,
        mention: isApproved ? 'Approuvé' : null,
        date: null,
      },
    ],
  })

  _drawAllPageFooters(doc, { pageW, headerLogo, headerDeco, margin })
  doc.save(`fiche-mission-${mission.numero || mission.id}.pdf`)
}

// ---------------------------------------------------------------------------
// Bon de Commande PDF
// ---------------------------------------------------------------------------
export async function exportBonCommandePDF(bon) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14

  const [headerLogo, headerDeco] = await Promise.all([
    loadImageAsBase64(headerLogoUrl),
    loadImageAsBase64(headerDecoUrl),
  ])

  if (headerDeco) {
    doc.saveGraphicsState()
    doc.setGState(new doc.GState({ opacity: 0.06 }))
    doc.addImage(headerDeco, 'PNG', 0, 0, pageW, pageH)
    doc.restoreGraphicsState()
  }

  const headerH = 29
  if (headerLogo) {
    doc.addImage(headerLogo, 'PNG', 0, 0, pageW, headerH)
  } else {
    doc.setFillColor(...BRAND_DEEP)
    doc.rect(0, 0, pageW, headerH, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('JoFé Digital SARL', margin, 18)
  }

  const bandY = headerH
  doc.setFillColor(...BRAND_DEEP)
  doc.rect(0, bandY, pageW, 9, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('BON DE COMMANDE', pageW / 2, bandY + 6, { align: 'center' })
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...BRAND_LIGHT)
  doc.text(`N° ${bon.numero}   |   ${formatDate(bon.date)}`, pageW - margin, bandY + 6, { align: 'right' })

  // Status
  let y = bandY + 16
  const statusLabels = {
    DRAFT: 'Brouillon', PENDING_PROFORMA: 'En attente proformas', PENDING_DAF: 'En attente DAF',
    PENDING_DG: 'En attente DG', APPROVED: 'Approuvé', REJECTED: 'Rejeté',
    IN_EXECUTION: 'En exécution', DONE: 'Clôturé',
  }
  doc.setFillColor(240, 248, 255)
  doc.setDrawColor(...BRAND_LIGHT)
  doc.roundedRect(margin, y - 5, 70, 8, 2, 2, 'FD')
  doc.setTextColor(...BRAND_MID)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(`Statut : ${statusLabels[bon.status] || bon.status}`, margin + 3, y)

  // Info
  y += 10
  doc.setTextColor(...BRAND_DEEP)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Informations', margin, y)
  doc.setDrawColor(...BRAND_LIGHT)
  doc.setLineWidth(0.5)
  doc.line(margin, y + 2, pageW - margin, y + 2)
  y += 6

  const infoRows = [
    ['Date', formatDate(bon.date)],
    ['Référence', bon.reference || '—'],
    ['Créé par', getFullName(bon.created_by_detail) || '—'],
    ['Objet', bon.objet || '—'],
  ]
  if (bon.notes) infoRows.push(['Notes', bon.notes])

  autoTable(doc, {
    startY: y,
    body: infoRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, fillColor: [245, 249, 255], textColor: BRAND_DEEP },
      1: { textColor: [30, 30, 30] },
    },
    theme: 'grid',
    tableLineColor: [210, 225, 245],
    tableLineWidth: 0.3,
  })

  // Selected supplier
  if (bon.fournisseur_selectionne_detail) {
    const p = bon.fournisseur_selectionne_detail
    const suppY = doc.lastAutoTable.finalY + 8
    doc.setTextColor(...BRAND_DEEP)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Fournisseur sélectionné', margin, suppY)
    doc.setDrawColor(...BRAND_LIGHT)
    doc.line(margin, suppY + 2, pageW - margin, suppY + 2)

    const suppRows = [
      ['Fournisseur', p.fournisseur_nom || '—'],
    ]
    if (p.reference) suppRows.push(['Référence', p.reference])
    if (p.montant)   suppRows.push(['Montant', formatCFA(p.montant)])
    if (p.notes)     suppRows.push(['Notes', p.notes])

    autoTable(doc, {
      startY: suppY + 6,
      body: suppRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 3.5 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 45, fillColor: [240, 253, 244], textColor: [22, 101, 52] },
        1: { textColor: [30, 30, 30] },
      },
      theme: 'grid',
      tableLineColor: [187, 247, 208],
      tableLineWidth: 0.3,
    })
  }

  // Approvals
  const hasApprovals = bon.daf_approuve_par || bon.dg_approuve_par
  if (hasApprovals) {
    const appY = doc.lastAutoTable.finalY + 8
    doc.setTextColor(...BRAND_DEEP)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Approbations', margin, appY)
    doc.setDrawColor(...BRAND_LIGHT)
    doc.line(margin, appY + 2, pageW - margin, appY + 2)

    const appRows = []
    if (bon.daf_approuve_par) {
      appRows.push([
        'DAF',
        getFullName(bon.daf_approuve_par_detail) || '—',
        formatDate(bon.daf_approuve_le),
        bon.daf_commentaire || '—',
      ])
    }
    if (bon.dg_approuve_par) {
      appRows.push([
        'DG',
        getFullName(bon.dg_approuve_par_detail) || '—',
        formatDate(bon.dg_approuve_le),
        bon.dg_commentaire || '—',
      ])
    }

    autoTable(doc, {
      startY: appY + 6,
      head: [['Rôle', 'Approuvé par', 'Date', 'Commentaire']],
      body: appRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: BRAND_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 249, 255] },
      columnStyles: { 0: { cellWidth: 18, fontStyle: 'bold' } },
    })
  }

  // Signature zones
  const sigY = doc.lastAutoTable.finalY + 16
  const sigW = (pageW - margin * 2) / 2
  ;['Le DAF', 'Le Directeur Général'].forEach((label, i) => {
    const x = margin + i * sigW
    doc.setDrawColor(...BRAND_MID)
    doc.setLineWidth(0.4)
    doc.line(x + 4, sigY + 22, x + sigW - 8, sigY + 22)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...BRAND_DEEP)
    doc.text(label, x + sigW / 2 - 4, sigY + 6, { align: 'center' })
  })

  // Footer
  doc.setFillColor(...BRAND_DEEP)
  doc.rect(0, pageH - 10, pageW, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('JoFé Digital SARL — Document confidentiel', margin, pageH - 4)
  doc.text('Page 1 / 1', pageW - margin, pageH - 4, { align: 'right' })

  doc.save(`bon-commande-${bon.numero || bon.id}.pdf`)
}
