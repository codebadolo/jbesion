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
