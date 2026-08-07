import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import {
  AccessType,
  DurationType,
  REQUEST_KIND_LABELS,
  RequestKind,
  RequestStatus,
} from '../common/enums';
import {
  DescribedFormData,
  FormDefinitionsService,
} from '../form-definitions/form-definitions.service';
import { AccessRequestDocument } from './schemas/access-request.schema';

const ACCESS_TYPE_LABELS: Record<AccessType, string> = {
  [AccessType.FULL]: 'Accès complet',
  [AccessType.STANDARD]: 'Accès standard (navigation professionnelle filtrée)',
  [AccessType.RESTRICTED]: 'Accès restreint (liste blanche de sites)',
};

const STATUS_LABELS: Record<RequestStatus, string> = {
  [RequestStatus.PENDING_MANAGER]: 'En attente de validation du chef de département',
  [RequestStatus.CHANGES_REQUESTED]: 'Modifications demandées par le chef',
  [RequestStatus.REJECTED]: 'Refusée par le chef de département',
  [RequestStatus.APPROVED_BY_MANAGER]: 'Acceptée — en attente de l’équipe réseau',
  [RequestStatus.PENDING_NETWORK]: 'En attente de l’équipe réseau',
  [RequestStatus.IN_PROGRESS_NETWORK]: 'En cours de vérification technique',
  [RequestStatus.ACTIVATED]: 'Exécutée / accès activé',
  [RequestStatus.REJECTED_TECHNICAL]: 'Refus technique (équipe réseau)',
  [RequestStatus.CLOSED]: 'Clôturée',
  [RequestStatus.EXPIRED]: 'Expirée',
};

const INK = '#1e293b';
const MUTED = '#64748b';
const LINE = '#cbd5e1';
const ACCENT = '#1d54a7';

function formatDate(value?: Date | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR');
}

function formatDateTime(value?: Date | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function personName(value: any): string {
  if (!value) return '—';
  if (value.firstName || value.lastName) {
    return `${value.firstName ?? ''} ${value.lastName ?? ''}`.trim();
  }
  return '—';
}

/**
 * Génère la version PDF officielle d'un formulaire rempli :
 * l'équivalent numérique de l'ancien formulaire papier, avec
 * les blocs de décision et les zones de signature.
 */
@Injectable()
export class RequestPdfService {
  constructor(private readonly formDefinitions: FormDefinitionsService) {}

  async generate(request: AccessRequestDocument): Promise<Buffer> {
    // Le formulaire est décrit d'après sa définition courante en base
    const form = await this.formDefinitions.describeFormData(
      request.requestType,
      request.formData as Record<string, unknown>,
    );

    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    this.drawHeader(doc, request, form.title);
    this.drawRequesterSection(doc, request);
    this.drawContentSection(doc, request, form);
    this.drawManagerSection(doc, request);
    this.drawNetworkSection(doc, request);
    this.drawAcknowledgement(doc, request);
    this.drawSignatures(doc, request);
    this.drawFooter(doc, request);

    doc.end();
    return done;
  }

  // ------------------------------------------------------------------

  private drawHeader(
    doc: PDFKit.PDFDocument,
    request: AccessRequestDocument,
    formTitle: string,
  ): void {
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor(INK)
      .text('GROUPE HOLDING POULINA', { continued: false });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text('Direction des Systèmes d’Information — Sécurité des accès');

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(INK)
      .text(`Réf. : ${request.reference}`, 380, 50, { width: 167, align: 'right' })
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(`Émis le : ${formatDate(request.createdAt)}`, 380, 64, {
        width: 167,
        align: 'right',
      });

    doc
      .moveTo(48, 92)
      .lineTo(547, 92)
      .lineWidth(1.2)
      .strokeColor(ACCENT)
      .stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(INK)
      .text(formTitle.toUpperCase(), 48, 106, {
        width: 499,
        align: 'center',
      });
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(MUTED)
      .text(`Statut actuel : ${STATUS_LABELS[request.status]}`, {
        width: 499,
        align: 'center',
      });
    doc.moveDown(1.2);
  }

  private sectionTitle(doc: PDFKit.PDFDocument, title: string): void {
    if (doc.y > 720) doc.addPage();
    doc.moveDown(0.6);
    const y = doc.y;
    doc.rect(48, y, 499, 18).fillColor('#eef2f7').fill();
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(ACCENT)
      .text(title.toUpperCase(), 56, y + 4.5);
    doc.moveDown(0.7);
  }

  /** Grille clé/valeur sur 2 colonnes */
  private keyValues(doc: PDFKit.PDFDocument, pairs: [string, string][]): void {
    const colWidth = 249;
    for (let index = 0; index < pairs.length; index += 2) {
      if (doc.y > 740) doc.addPage();
      const y = doc.y;
      for (const column of [0, 1]) {
        const pair = pairs[index + column];
        if (!pair) continue;
        const x = 48 + column * (colWidth + 4);
        doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(pair[0].toUpperCase(), x, y);
        doc
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor(INK)
          .text(pair[1] || '—', x, y + 10, { width: colWidth });
      }
      const leftHeight = doc.heightOfString(pairs[index]?.[1] || '—', { width: colWidth });
      const rightHeight = pairs[index + 1]
        ? doc.heightOfString(pairs[index + 1][1] || '—', { width: colWidth })
        : 0;
      doc.y = y + 10 + Math.max(leftHeight, rightHeight, 12) + 6;
      doc.x = 48;
    }
  }

  private paragraph(doc: PDFKit.PDFDocument, label: string, text: string): void {
    if (doc.y > 700) doc.addPage();
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(label.toUpperCase(), 48, doc.y);
    doc.moveDown(0.2);
    const y = doc.y;
    const height = doc.heightOfString(text || '—', { width: 483 }) + 12;
    doc.rect(48, y, 499, height).lineWidth(0.7).strokeColor(LINE).stroke();
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(INK)
      .text(text || '—', 56, y + 6, { width: 483 });
    doc.y = y + height + 6;
    doc.x = 48;
  }

  // ------------------------------------------------------------------

  private drawRequesterSection(doc: PDFKit.PDFDocument, request: AccessRequestDocument): void {
    this.sectionTitle(doc, '1. Informations du demandeur');
    const department: any = request.department;
    const service: any = request.service;
    this.keyValues(doc, [
      ['Nom et prénom', `${request.firstName} ${request.lastName}`],
      ['Matricule', request.matricule],
      ['Email professionnel', request.email],
      ['Poste', request.position || '—'],
      ['Département', department?.name ?? '—'],
      ['Service', service?.name ?? '—'],
    ]);
  }

  private drawContentSection(
    doc: PDFKit.PDFDocument,
    request: AccessRequestDocument,
    form: DescribedFormData,
  ): void {
    this.sectionTitle(doc, '2. Contenu de la demande');

    const pairs: [string, string][] = [
      [
        'Nature de la demande',
        REQUEST_KIND_LABELS[request.requestKind ?? RequestKind.NEW] ?? 'Nouvelle demande',
      ],
    ];
    if (request.accessType) {
      pairs.push(["Type d'accès Internet", ACCESS_TYPE_LABELS[request.accessType]]);
    }
    pairs.push([
      'Durée demandée',
      request.durationType === DurationType.PERMANENT
        ? 'Permanente'
        : `Temporaire — ${request.durationDays ?? '—'} jour(s)`,
    ]);
    for (const entry of form.entries) {
      pairs.push([entry.label, entry.value]);
    }
    this.keyValues(doc, pairs);

    // Engagements (cases cochées)
    for (const commitment of form.commitments) {
      if (doc.y > 720) doc.addPage();
      const y = doc.y;
      doc.rect(48, y, 10, 10).lineWidth(0.9).strokeColor(INK).stroke();
      if (commitment.accepted) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text('X', 50.5, y + 1);
      }
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(INK)
        .text(commitment.label, 64, y, { width: 483 });
      doc.moveDown(0.5);
      doc.x = 48;
    }

    this.paragraph(doc, 'Justification du besoin', request.justification);
  }

  private drawManagerSection(doc: PDFKit.PDFDocument, request: AccessRequestDocument): void {
    this.sectionTitle(doc, '3. Décision du chef de département / direction');
    let decision = 'En attente';
    if (request.status === RequestStatus.REJECTED) decision = 'REFUSÉE';
    else if (request.status === RequestStatus.CHANGES_REQUESTED)
      decision = 'MODIFICATIONS DEMANDÉES';
    else if (request.managerDecisionAt) decision = 'ACCEPTÉE';

    this.keyValues(doc, [
      ['Décision', decision],
      ['Date', formatDateTime(request.managerDecisionAt)],
      ['Validée par', personName(request.managerDecisionBy)],
      [
        request.status === RequestStatus.REJECTED ? 'Motif du refus' : 'Commentaire',
        request.status === RequestStatus.REJECTED
          ? request.rejectionReason || '—'
          : request.managerComment || '—',
      ],
    ]);
  }

  private drawNetworkSection(doc: PDFKit.PDFDocument, request: AccessRequestDocument): void {
    this.sectionTitle(doc, '4. Vérification et traitement — équipe réseau et sécurité');
    let result = 'En attente';
    if (request.status === RequestStatus.REJECTED_TECHNICAL) result = 'REFUS TECHNIQUE';
    else if (request.accessActivated === true) result = 'EXÉCUTÉE / ACCÈS ACTIVÉ';

    this.keyValues(doc, [
      ['Résultat', result],
      ['Traité par', personName(request.processedBy)],
      ['Date de traitement', formatDateTime(request.processedAt)],
      ['Commentaire technique', request.networkComment || '—'],
      ["Date d'activation", formatDate(request.activationDate)],
      [
        "Date d'expiration",
        request.expirationDate ? formatDate(request.expirationDate) : 'Permanente / N.A.',
      ],
    ]);
  }

  private drawAcknowledgement(
    doc: PDFKit.PDFDocument,
    request: AccessRequestDocument,
  ): void {
    if (doc.y > 675) doc.addPage();
    doc.moveDown(0.7);
    const y = doc.y;
    doc.rect(48, y, 10, 10).lineWidth(0.9).strokeColor(INK).stroke();
    if (request.acknowledgementAccepted) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text('X', 50.5, y + 1);
    }
    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor(INK)
      .text('Lu et approuvé', 64, y - 1, { width: 180 });
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(`Date : ${formatDateTime(request.acknowledgedAt)}`, 250, y - 1, {
        width: 297,
        align: 'right',
      });
    doc.y = y + 22;
    doc.x = 48;
  }

  private drawSignatures(
    doc: PDFKit.PDFDocument,
    request: AccessRequestDocument,
  ): void {
    if (doc.y > 640) doc.addPage();
    doc.moveDown(1);
    const y = doc.y;
    const labels = ['Le demandeur', 'Le chef de département', "L'équipe réseau / sécurité"];
    const signature = this.signatureImageBuffer(request.applicantSignature);
    labels.forEach((label, index) => {
      const x = 48 + index * 170;
      doc.rect(x, y, 158, 64).lineWidth(0.7).strokeColor(LINE).stroke();
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(label, x + 8, y + 6);
      if (index === 0 && signature) {
        try {
          doc.image(signature, x + 12, y + 20, {
            fit: [134, 24],
            align: 'center',
            valign: 'center',
          });
          doc
            .font('Helvetica')
            .fontSize(6.8)
            .fillColor(MUTED)
            .text('Signature numérique', x + 8, y + 48, { width: 142 });
          return;
        } catch {
          // Une signature invalide ne doit pas bloquer l'export PDF.
        }
      }
      doc.fontSize(7.5).text('Signature :', x + 8, y + 48);
    });
    doc.y = y + 76;
    doc.x = 48;
  }

  private signatureImageBuffer(value?: string | null): Buffer | null {
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(value ?? '');
    if (!match) return null;
    return Buffer.from(match[1], 'base64');
  }

  private drawFooter(doc: PDFKit.PDFDocument, request: AccessRequestDocument): void {
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index++) {
      doc.switchToPage(index);
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(MUTED)
        .text(
          `Document généré électroniquement le ${formatDateTime(new Date())} — ${request.reference} — page ${index + 1}/${range.count}`,
          48,
          800,
          { width: 499, align: 'center' },
        );
    }
  }
}
