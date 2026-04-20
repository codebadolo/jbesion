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

// ---------------------------------------------------------------------------
// Bon de Paiement PDF
// ---------------------------------------------------------------------------
export async function exportBonPaiementPDF(bon) {
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
  doc.text('BON DE PAIEMENT', pageW / 2, bandY + 6, { align: 'center' })
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...BRAND_LIGHT)
  doc.text(`N° ${bon.numero}   |   ${formatDate(bon.date)}`, pageW - margin, bandY + 6, { align: 'right' })

  // Status badge
  let y = bandY + 16
  const statusLabels = { DRAFT: 'Brouillon', VALIDATED: 'Validé', CANCELLED: 'Annulé' }
  doc.setFillColor(240, 248, 255)
  doc.setDrawColor(...BRAND_LIGHT)
  doc.roundedRect(margin, y - 5, 55, 8, 2, 2, 'FD')
  doc.setTextColor(...BRAND_MID)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(`Statut : ${statusLabels[bon.status] || bon.status}`, margin + 3, y)

  // Payment info table
  y += 10
  const MODE_LABELS = { ESPECE: 'Espèce', CHEQUE: 'Chèque' }
  const infoRows = [
    ['Mode de paiement', MODE_LABELS[bon.mode_paiement] ?? bon.mode_paiement ?? '—'],
    ['Bénéficiaire (Reçu par)', bon.beneficiaire || '—'],
    ['Montant en chiffres', `${Number(bon.montant).toLocaleString('fr-FR')} FCFA`],
    ['Montant en lettres', bon.montant_lettres || '—'],
    ['Motif', bon.motif || '—'],
  ]
  if (bon.notes) infoRows.push(['Notes', bon.notes])

  autoTable(doc, {
    startY: y,
    body: infoRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55, fillColor: [245, 249, 255], textColor: BRAND_DEEP },
      1: { textColor: [30, 30, 30] },
    },
    theme: 'grid',
    tableLineColor: [210, 225, 245],
    tableLineWidth: 0.3,
  })

  // Items table
  const items = bon.items || []
  if (items.length > 0) {
    const tableEndY = doc.lastAutoTable.finalY + 8
    doc.setTextColor(...BRAND_DEEP)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Tableau récapitulatif', margin, tableEndY)
    doc.setDrawColor(...BRAND_LIGHT)
    doc.setLineWidth(0.5)
    doc.line(margin, tableEndY + 2, pageW - margin, tableEndY + 2)

    const total = items.reduce((s, i) => s + (parseFloat(i.montant) || 0), 0)
    const body = items.map((item) => [item.designation || '—', formatCFA(item.montant)])
    body.push(['TOTAL', formatCFA(total)])

    autoTable(doc, {
      startY: tableEndY + 6,
      head: [['Désignation / Détail', 'Montant (FCFA)']],
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: BRAND_DEEP, textColor: [255, 255, 255], fontStyle: 'bold' },
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
  }

  // Signature zones
  const sigY = doc.lastAutoTable.finalY + 18
  const colW = (pageW - margin * 2) / 2
  ;[['La Caisse', ''], ['Le Receveur', bon.beneficiaire || '']].forEach(([title, sub], i) => {
    const x = margin + i * colW
    doc.setDrawColor(...BRAND_MID)
    doc.setLineWidth(0.4)
    doc.line(x + 4, sigY + 22, x + colW - 8, sigY + 22)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...BRAND_DEEP)
    doc.text(title, x + colW / 2 - 4, sigY + 6, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 100, 100)
    doc.text(sub, x + colW / 2 - 4, sigY + 27, { align: 'center' })
  })

  // Footer
  doc.setFillColor(...BRAND_DEEP)
  doc.rect(0, pageH - 10, pageW, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('JoFé Digital SARL — Document confidentiel', margin, pageH - 4)
  doc.text('Page 1 / 1', pageW - margin, pageH - 4, { align: 'right' })

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
  doc.text('FICHE DE FRAIS DE MISSION', pageW / 2, bandY + 6, { align: 'center' })
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...BRAND_LIGHT)
  doc.text(`N° ${mission.numero}   |   ${formatDate(mission.date)}`, pageW - margin, bandY + 6, { align: 'right' })

  // Status
  let y = bandY + 16
  const statusLabels = {
    DRAFT: 'Brouillon', PENDING_MANAGER: 'En attente Manager', PENDING_DAF: 'En attente DAF',
    PENDING_DG: 'En attente DG', APPROVED: 'Approuvée', REJECTED: 'Rejetée',
    IN_PROGRESS: 'En cours', DONE: 'Terminée',
  }
  doc.setFillColor(240, 248, 255)
  doc.setDrawColor(...BRAND_LIGHT)
  doc.roundedRect(margin, y - 5, 65, 8, 2, 2, 'FD')
  doc.setTextColor(...BRAND_MID)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(`Statut : ${statusLabels[mission.status] || mission.status}`, margin + 3, y)

  // Identification
  y += 10
  doc.setTextColor(...BRAND_DEEP)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Identification', margin, y)
  doc.setDrawColor(...BRAND_LIGHT)
  doc.setLineWidth(0.5)
  doc.line(margin, y + 2, pageW - margin, y + 2)

  y += 8
  const col1 = margin
  const col2 = pageW / 2
  const idFields = [
    ['Nom et Prénom', mission.nom_prenom || '—'],
    ['Matricule', mission.matricule_display || '—'],
    ['Fonction', mission.fonction || '—'],
    ['Date', formatDate(mission.date)],
  ]
  if (mission.prestataire_nom) idFields.push(['Prestataire', mission.prestataire_nom])

  idFields.forEach(([label, value], i) => {
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

  y += Math.ceil(idFields.length / 2) * 10 + 6

  // Mission details
  doc.setTextColor(...BRAND_DEEP)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Détails de la mission', margin, y)
  doc.setDrawColor(...BRAND_LIGHT)
  doc.line(margin, y + 2, pageW - margin, y + 2)
  y += 8

  const missionFields = [
    ['Destination', mission.destination || '—'],
    ['Date de départ', formatDate(mission.date_debut)],
    ['Objet de la mission', mission.objet_mission || '—'],
    ['Date de retour', formatDate(mission.date_fin)],
  ]
  if (mission.agent_liaison_detail) {
    const nom = `${mission.agent_liaison_detail.first_name || ''} ${mission.agent_liaison_detail.last_name || ''}`.trim()
    missionFields.push(['Agent de liaison', nom || '—'])
  }

  missionFields.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? col1 : col2
    const rowY = y + Math.floor(i / 2) * 10
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(label.toUpperCase(), x, rowY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    const lines = doc.splitTextToSize(value, col2 - x - 4)
    doc.text(lines[0] || value, x, rowY + 5)
  })

  y += Math.ceil(missionFields.length / 2) * 10 + 6

  // Frais table
  doc.setTextColor(...BRAND_DEEP)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Détail des frais', margin, y)
  doc.setDrawColor(...BRAND_LIGHT)
  doc.line(margin, y + 2, pageW - margin, y + 2)
  y += 4

  const fraisBody = [
    ['Hébergement',    formatCFA(mission.hebergement)],
    ['Restauration',   formatCFA(mission.restauration)],
    ['Transport A/R',  formatCFA(mission.transport_aller_retour)],
    ['Autres frais',   formatCFA(mission.autres_frais)],
    ['TOTAL',          formatCFA(mission.total_frais)],
  ]

  autoTable(doc, {
    startY: y,
    body: fraisBody,
    margin: { left: margin, right: margin },
    tableWidth: 100,
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'normal', cellWidth: 55 },
      1: { halign: 'right', cellWidth: 45 },
    },
    theme: 'grid',
    tableLineColor: [210, 225, 245],
    tableLineWidth: 0.3,
    didParseCell(data) {
      if (data.row.index === fraisBody.length - 1) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [235, 245, 255]
        data.cell.styles.textColor = BRAND_DEEP
      }
    },
  })

  if (mission.notes) {
    const notesY = doc.lastAutoTable.finalY + 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text('NOTES', margin, notesY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    const lines = doc.splitTextToSize(mission.notes, pageW - margin * 2)
    doc.text(lines, margin, notesY + 5)
  }

  // Signatures
  const sigY = doc.lastAutoTable.finalY + (mission.notes ? 20 : 16)
  const sigLabels = ["L'Intéressé(e)", 'Le Manager', 'Le DG / DAF']
  const sigW = (pageW - margin * 2) / 3
  sigLabels.forEach((label, i) => {
    const x = margin + i * sigW
    doc.setDrawColor(...BRAND_MID)
    doc.setLineWidth(0.4)
    doc.line(x + 4, sigY + 22, x + sigW - 4, sigY + 22)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...BRAND_DEEP)
    doc.text(label, x + sigW / 2, sigY + 6, { align: 'center' })
  })

  // Footer
  doc.setFillColor(...BRAND_DEEP)
  doc.rect(0, pageH - 10, pageW, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('JoFé Digital SARL — Document confidentiel', margin, pageH - 4)
  doc.text('Page 1 / 1', pageW - margin, pageH - 4, { align: 'right' })

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
