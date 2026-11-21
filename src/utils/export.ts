import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import type {
  ExamIdentity,
  GeneratedExamResult,
  GeneratedSoalItem,
  GeneratedSoalOptions,
} from '../types';

export type ExportTabScope = 'naskah' | 'kunci' | 'kisi' | 'kartu';
export type ExportScope = ExportTabScope | 'all';

const OPTION_KEYS: Array<keyof GeneratedSoalOptions> = ['A', 'B', 'C', 'D', 'E'];

const TAB_FILE_LABELS: Record<ExportScope, string> = {
  naskah: 'Naskah_Soal',
  kunci: 'Kunci_Pembahasan',
  kisi: 'Kisi_Kisi',
  kartu: 'Kartu_Soal',
  all: 'Semua',
};

function sanitizeFilenamePart(raw: string, fallback: string): string {
  const cleaned = (raw || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (cleaned || fallback).slice(0, 50);
}

export function buildExportFilename(
  result: GeneratedExamResult,
  identity: ExamIdentity,
  scope: ExportScope,
  ext: 'docx' | 'pdf'
): string {
  const mapel = sanitizeFilenamePart(
    result.meta?.mapel || identity.mataPelajaran,
    'Mapel'
  );
  const materi = sanitizeFilenamePart(identity.topikUtama, 'Materi');
  const tabLabel = TAB_FILE_LABELS[scope];
  return `${mapel}_${materi}_${tabLabel}.${ext}`;
}

function getNonEmptyOptions(
  opsi?: GeneratedSoalOptions
): Array<{ key: string; value: string }> {
  if (!opsi) return [];
  return OPTION_KEYS.map((k) => ({
    key: k,
    value: typeof opsi[k] === 'string' ? opsi[k].trim() : '',
  })).filter((item) => item.value.length > 0);
}

function resolveMeta(result: GeneratedExamResult, identity: ExamIdentity) {
  return {
    judul: result.meta?.judul?.trim() || identity.judulUjian || 'Naskah Ujian',
    sekolah: result.meta?.sekolah?.trim() || identity.namaSekolah || '-',
    mapel: result.meta?.mapel?.trim() || identity.mataPelajaran || '-',
    kelas: result.meta?.kelas?.trim() || identity.kelas || '-',
    fase: identity.fase || '-',
    tahunAjaran: identity.tahunAjaran || '-',
    alokasiWaktu: identity.alokasiWaktu || '-',
    namaGuru: identity.namaGuru || '-',
    topik: identity.topikUtama || '-',
  };
}

// ============================================================================
// WORD (.docx) EXPORT
// ============================================================================

const TABLE_BORDER = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: 'CBD5E1',
} as const;

const FULL_TABLE_BORDERS = {
  top: TABLE_BORDER,
  bottom: TABLE_BORDER,
  left: TABLE_BORDER,
  right: TABLE_BORDER,
  insideHorizontal: TABLE_BORDER,
  insideVertical: TABLE_BORDER,
};

function makeCell(
  text: string,
  options?: {
    bold?: boolean;
    header?: boolean;
    widthPct?: number;
    columnSpan?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  }
): TableCell {
  const lines = (text || '-').split('\n');
  return new TableCell({
    columnSpan: options?.columnSpan,
    width:
      options?.widthPct !== undefined
        ? { size: options.widthPct, type: WidthType.PERCENTAGE }
        : undefined,
    shading: options?.header
      ? { type: ShadingType.CLEAR, fill: 'F1F5F9', color: 'auto' }
      : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: lines.map(
      (line) =>
        new Paragraph({
          alignment: options?.align ?? AlignmentType.LEFT,
          spacing: { before: 20, after: 20 },
          children: [
            new TextRun({
              text: line,
              bold: options?.bold || options?.header,
              size: 20,
              color: options?.header ? '0F172A' : '1E293B',
            }),
          ],
        })
    ),
  });
}

function buildDocxNaskahChildren(
  soalList: GeneratedSoalItem[],
  meta: ReturnType<typeof resolveMeta>
): Array<Paragraph | Table> {
  const children: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: meta.sekolah.toUpperCase(), bold: true, size: 22, color: '475569' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: meta.judul, bold: true, size: 28, color: '0F172A' }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: FULL_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            makeCell('Mata Pelajaran', { header: true, widthPct: 22 }),
            makeCell(meta.mapel, { widthPct: 28 }),
            makeCell('Tahun Ajaran', { header: true, widthPct: 22 }),
            makeCell(meta.tahunAjaran, { widthPct: 28 }),
          ],
        }),
        new TableRow({
          children: [
            makeCell('Kelas / Fase', { header: true }),
            makeCell(`${meta.kelas} (${meta.fase})`),
            makeCell('Alokasi Waktu', { header: true }),
            makeCell(meta.alokasiWaktu),
          ],
        }),
        new TableRow({
          children: [
            makeCell('Guru Pengampu', { header: true }),
            makeCell(meta.namaGuru, { columnSpan: 3 }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 220, after: 120 }, children: [] }),
  ];

  soalList.forEach((item, idx) => {
    const number = item.no ?? idx + 1;
    const hasStimulus =
      typeof item.stimulus === 'string' && item.stimulus.trim().length > 0;

    if (hasStimulus) {
      children.push(
        new Paragraph({
          indent: { left: 240 },
          spacing: { before: 120, after: 80 },
          children: [
            new TextRun({
              text: 'Stimulus: ',
              bold: true,
              italics: true,
              size: 20,
              color: '334155',
            }),
            new TextRun({
              text: item.stimulus.trim(),
              size: 20,
              color: '334155',
            }),
          ],
        })
      );
    }

    children.push(
      new Paragraph({
        spacing: { before: hasStimulus ? 40 : 140, after: 80 },
        children: [
          new TextRun({
            text: `${number}. `,
            bold: true,
            size: 22,
            color: '0F172A',
          }),
          new TextRun({
            text: item.pertanyaan,
            size: 22,
            color: '0F172A',
          }),
        ],
      })
    );

    const options = getNonEmptyOptions(item.opsi);
    options.forEach((opt) => {
      children.push(
        new Paragraph({
          indent: { left: 420 },
          spacing: { before: 20, after: 40 },
          children: [
            new TextRun({
              text: `${opt.key}. `,
              bold: true,
              size: 21,
              color: '1E293B',
            }),
            new TextRun({
              text: opt.value,
              size: 21,
              color: '1E293B',
            }),
          ],
        })
      );
    });
  });

  return children;
}

function buildDocxKunciChildren(
  soalList: GeneratedSoalItem[],
  meta: ReturnType<typeof resolveMeta>
): Array<Paragraph | Table> {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      makeCell('No', { header: true, widthPct: 10, align: AlignmentType.CENTER }),
      makeCell('Kunci Jawaban', { header: true, widthPct: 25 }),
      makeCell('Pembahasan', { header: true, widthPct: 65 }),
    ],
  });

  const rows = soalList.map((item, idx) => {
    const number = item.no ?? idx + 1;
    return new TableRow({
      children: [
        makeCell(String(number), { bold: true, align: AlignmentType.CENTER }),
        makeCell(item.kunci || '-', { bold: true }),
        makeCell(item.pembahasan || '-'),
      ],
    });
  });

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'KUNCI JAWABAN & PEMBAHASAN',
          bold: true,
          size: 26,
          color: '0F172A',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `${meta.judul} · ${meta.mapel} · Kelas ${meta.kelas}`,
          size: 20,
          color: '475569',
        }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: FULL_TABLE_BORDERS,
      rows: [headerRow, ...rows],
    }),
  ];
}

function buildDocxKisiChildren(
  soalList: GeneratedSoalItem[],
  meta: ReturnType<typeof resolveMeta>
): Array<Paragraph | Table> {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      makeCell('No', { header: true, widthPct: 7, align: AlignmentType.CENTER }),
      makeCell('Materi', { header: true, widthPct: 18 }),
      makeCell('Indikator Soal', { header: true, widthPct: 30 }),
      makeCell('Level', { header: true, widthPct: 10, align: AlignmentType.CENTER }),
      makeCell('Kesulitan', { header: true, widthPct: 12 }),
      makeCell('Bentuk', { header: true, widthPct: 13 }),
      makeCell('Kunci', { header: true, widthPct: 10 }),
    ],
  });

  const rows = soalList.map((item, idx) => {
    const number = item.no ?? idx + 1;
    return new TableRow({
      children: [
        makeCell(String(number), { bold: true, align: AlignmentType.CENTER }),
        makeCell(meta.topik),
        makeCell(item.indikator || '-'),
        makeCell(item.level_kognitif || '-', { align: AlignmentType.CENTER }),
        makeCell(item.kesulitan || '-'),
        makeCell(item.tipe || '-'),
        makeCell(item.kunci || '-', { bold: true }),
      ],
    });
  });

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'KISI-KISI PENULISAN SOAL',
          bold: true,
          size: 26,
          color: '0F172A',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `${meta.judul} · ${meta.mapel} · Kelas ${meta.kelas}`,
          size: 20,
          color: '475569',
        }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: FULL_TABLE_BORDERS,
      rows: [headerRow, ...rows],
    }),
  ];
}

function buildDocxKartuChildren(
  soalList: GeneratedSoalItem[],
  meta: ReturnType<typeof resolveMeta>
): Array<Paragraph | Table> {
  const children: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'KARTU SOAL',
          bold: true,
          size: 26,
          color: '0F172A',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `${meta.judul} · ${meta.sekolah}`,
          size: 20,
          color: '475569',
        }),
      ],
    }),
  ];

  soalList.forEach((item, idx) => {
    const number = item.no ?? idx + 1;
    const options = getNonEmptyOptions(item.opsi);
    const hasStimulus =
      typeof item.stimulus === 'string' && item.stimulus.trim().length > 0;

    const bodyParagraphs: Paragraph[] = [];
    if (hasStimulus) {
      bodyParagraphs.push(
        new Paragraph({
          spacing: { before: 40, after: 80 },
          children: [
            new TextRun({
              text: 'Stimulus: ',
              bold: true,
              italics: true,
              size: 20,
              color: '334155',
            }),
            new TextRun({
              text: item.stimulus.trim(),
              size: 20,
              color: '334155',
            }),
          ],
        })
      );
    }

    bodyParagraphs.push(
      new Paragraph({
        spacing: { before: 40, after: 80 },
        children: [
          new TextRun({
            text: `${number}. ${item.pertanyaan}`,
            size: 21,
            color: '0F172A',
          }),
        ],
      })
    );

    options.forEach((opt) => {
      bodyParagraphs.push(
        new Paragraph({
          indent: { left: 320 },
          spacing: { before: 20, after: 30 },
          children: [
            new TextRun({
              text: `${opt.key}. `,
              bold: true,
              size: 20,
              color: '1E293B',
            }),
            new TextRun({
              text: opt.value,
              size: 20,
              color: '1E293B',
            }),
          ],
        })
      );
    });

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: FULL_TABLE_BORDERS,
        rows: [
          new TableRow({
            children: [
              makeCell(`KARTU SOAL NOMOR ${number} (${item.tipe})`, {
                header: true,
                columnSpan: 4,
              }),
            ],
          }),
          new TableRow({
            children: [
              makeCell('Mata Pelajaran', { header: true, widthPct: 22 }),
              makeCell(meta.mapel, { widthPct: 28 }),
              makeCell('Kelas', { header: true, widthPct: 20 }),
              makeCell(meta.kelas, { widthPct: 30 }),
            ],
          }),
          new TableRow({
            children: [
              makeCell('Level Kognitif', { header: true }),
              makeCell(item.level_kognitif || '-'),
              makeCell('Kesulitan', { header: true }),
              makeCell(item.kesulitan || '-'),
            ],
          }),
          new TableRow({
            children: [
              makeCell('Indikator Soal', { header: true }),
              makeCell(item.indikator || '-', { columnSpan: 3 }),
            ],
          }),
          new TableRow({
            children: [
              makeCell('Kunci Jawaban', { header: true }),
              makeCell(item.kunci || '-', { bold: true, columnSpan: 3 }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 4,
                margins: { top: 120, bottom: 120, left: 140, right: 140 },
                children: bodyParagraphs,
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ spacing: { before: 140, after: 140 }, children: [] })
    );
  });

  return children;
}

export async function exportToWord(
  result: GeneratedExamResult,
  identity: ExamIdentity,
  scope: ExportScope
): Promise<string> {
  const meta = resolveMeta(result, identity);
  const soalList = Array.isArray(result.soal) ? result.soal : [];

  let children: Array<Paragraph | Table> = [];

  if (scope === 'naskah') {
    children = buildDocxNaskahChildren(soalList, meta);
  } else if (scope === 'kunci') {
    children = buildDocxKunciChildren(soalList, meta);
  } else if (scope === 'kisi') {
    children = buildDocxKisiChildren(soalList, meta);
  } else if (scope === 'kartu') {
    children = buildDocxKartuChildren(soalList, meta);
  } else {
    children = [
      ...buildDocxNaskahChildren(soalList, meta),
      new Paragraph({ children: [new PageBreak()] }),
      ...buildDocxKunciChildren(soalList, meta),
      new Paragraph({ children: [new PageBreak()] }),
      ...buildDocxKisiChildren(soalList, meta),
      new Paragraph({ children: [new PageBreak()] }),
      ...buildDocxKartuChildren(soalList, meta),
    ];
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1134,
              right: 1134,
              bottom: 1134,
              left: 1134,
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = buildExportFilename(result, identity, scope, 'docx');
  saveAs(blob, filename);
  return filename;
}

// ============================================================================
// PDF (.pdf) EXPORT
// ============================================================================

type JsPDFWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY?: number;
  };
};

const PDF_MARGIN = 16;

function ensurePdfSpace(doc: jsPDF, currentY: number, neededHeight: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + neededHeight > pageHeight - PDF_MARGIN) {
    doc.addPage();
    return PDF_MARGIN;
  }
  return currentY;
}

function drawPdfWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight = 5.5
): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  let y = startY;
  for (const line of lines) {
    y = ensurePdfSpace(doc, y, lineHeight);
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

function renderPdfNaskah(
  doc: jsPDF,
  soalList: GeneratedSoalItem[],
  meta: ReturnType<typeof resolveMeta>
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PDF_MARGIN * 2;
  let y = PDF_MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(meta.sekolah.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(meta.judul, contentWidth) as string[];
  for (const line of titleLines) {
    doc.text(line, pageWidth / 2, y, { align: 'center' });
    y += 6.5;
  }
  y += 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const leftColX = PDF_MARGIN;
  const rightColX = pageWidth / 2 + 4;

  doc.text(`Mata Pelajaran : ${meta.mapel}`, leftColX, y);
  doc.text(`Tahun Ajaran  : ${meta.tahunAjaran}`, rightColX, y);
  y += 5;
  doc.text(`Kelas / Fase   : ${meta.kelas} (${meta.fase})`, leftColX, y);
  doc.text(`Alokasi Waktu : ${meta.alokasiWaktu}`, rightColX, y);
  y += 5;
  doc.text(`Guru Pengampu  : ${meta.namaGuru}`, leftColX, y);
  y += 4;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(PDF_MARGIN, y, pageWidth - PDF_MARGIN, y);
  y += 7;

  doc.setTextColor(15, 23, 42);

  soalList.forEach((item, idx) => {
    const number = item.no ?? idx + 1;
    const hasStimulus =
      typeof item.stimulus === 'string' && item.stimulus.trim().length > 0;

    y = ensurePdfSpace(doc, y, 16);

    if (hasStimulus) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      y = drawPdfWrappedText(
        doc,
        `Stimulus: ${item.stimulus.trim()}`,
        PDF_MARGIN + 3,
        y,
        contentWidth - 6,
        5
      );
      y += 1.5;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    y = drawPdfWrappedText(
      doc,
      `${number}. ${item.pertanyaan}`,
      PDF_MARGIN,
      y,
      contentWidth,
      5.5
    );
    y += 1;

    const options = getNonEmptyOptions(item.opsi);
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    options.forEach((opt) => {
      y = drawPdfWrappedText(
        doc,
        `${opt.key}. ${opt.value}`,
        PDF_MARGIN + 6,
        y,
        contentWidth - 6,
        5.2
      );
    });

    y += 4;
  });
}

function renderPdfKunci(
  doc: jsPDF,
  soalList: GeneratedSoalItem[],
  meta: ReturnType<typeof resolveMeta>
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = PDF_MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('KUNCI JAWABAN & PEMBAHASAN', pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${meta.judul} · ${meta.mapel} · Kelas ${meta.kelas}`, pageWidth / 2, y, {
    align: 'center',
  });
  y += 6;

  autoTable(doc, {
    startY: y,
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9.5,
    },
    bodyStyles: {
      textColor: [30, 41, 59],
      fontSize: 9,
      valign: 'top',
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 38, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
    },
    head: [['No', 'Kunci', 'Pembahasan']],
    body: soalList.map((item, idx) => [
      String(item.no ?? idx + 1),
      item.kunci || '-',
      item.pembahasan || '-',
    ]),
  });
}

function renderPdfKisi(
  doc: jsPDF,
  soalList: GeneratedSoalItem[],
  meta: ReturnType<typeof resolveMeta>
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = PDF_MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('KISI-KISI PENULISAN SOAL', pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${meta.judul} · ${meta.mapel} · Kelas ${meta.kelas}`, pageWidth / 2, y, {
    align: 'center',
  });
  y += 6;

  autoTable(doc, {
    startY: y,
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: {
      textColor: [30, 41, 59],
      fontSize: 8.5,
      valign: 'top',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 28 },
      2: { cellWidth: 52 },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 20 },
      5: { cellWidth: 25 },
      6: { cellWidth: 'auto', fontStyle: 'bold' },
    },
    head: [['No', 'Materi', 'Indikator', 'Level', 'Kesulitan', 'Bentuk', 'Kunci']],
    body: soalList.map((item, idx) => [
      String(item.no ?? idx + 1),
      meta.topik,
      item.indikator || '-',
      item.level_kognitif || '-',
      item.kesulitan || '-',
      item.tipe || '-',
      item.kunci || '-',
    ]),
  });
}

function renderPdfKartu(
  doc: jsPDF,
  soalList: GeneratedSoalItem[],
  meta: ReturnType<typeof resolveMeta>
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PDF_MARGIN * 2;
  let y = PDF_MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('KARTU SOAL', pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${meta.judul} · ${meta.sekolah}`, pageWidth / 2, y, {
    align: 'center',
  });
  y += 8;

  soalList.forEach((item, idx) => {
    const number = item.no ?? idx + 1;
    const options = getNonEmptyOptions(item.opsi);
    const hasStimulus =
      typeof item.stimulus === 'string' && item.stimulus.trim().length > 0;

    // Pre-calculate line counts so the card box wraps cleanly
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const indikatorLines = doc.splitTextToSize(
      `Indikator : ${item.indikator || '-'}`,
      contentWidth - 8
    ) as string[];
    const kunciLines = doc.splitTextToSize(
      `Kunci     : ${item.kunci || '-'}`,
      contentWidth - 8
    ) as string[];
    const stimulusLines = hasStimulus
      ? (doc.splitTextToSize(
          `Stimulus: ${item.stimulus.trim()}`,
          contentWidth - 8
        ) as string[])
      : [];
    doc.setFontSize(10);
    const questionLines = doc.splitTextToSize(
      `${number}. ${item.pertanyaan}`,
      contentWidth - 8
    ) as string[];

    const optionLineBlocks = options.map(
      (opt) =>
        doc.splitTextToSize(`${opt.key}. ${opt.value}`, contentWidth - 14) as string[]
    );
    const totalOptionLines = optionLineBlocks.reduce((acc, b) => acc + b.length, 0);

    const headerHeight = 20 + indikatorLines.length * 4.5 + kunciLines.length * 4.5;
    const bodyHeight =
      10 +
      stimulusLines.length * 4.8 +
      (hasStimulus ? 2 : 0) +
      questionLines.length * 5.2 +
      totalOptionLines * 4.8;
    const totalBoxHeight = headerHeight + bodyHeight;

    y = ensurePdfSpace(doc, y, Math.min(totalBoxHeight, 120));

    const boxStartY = y;

    // Header band inside card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.rect(PDF_MARGIN, boxStartY, contentWidth, headerHeight, 'FD');

    let textY = boxStartY + 5.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`KARTU SOAL NOMOR ${number} (${item.tipe})`, PDF_MARGIN + 4, textY);
    textY += 5.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(`Mata Pelajaran : ${meta.mapel}`, PDF_MARGIN + 4, textY);
    doc.text(`Kelas : ${meta.kelas}`, PDF_MARGIN + contentWidth / 2, textY);
    textY += 4.8;

    doc.text(`Level Kognitif : ${item.level_kognitif || '-'}`, PDF_MARGIN + 4, textY);
    doc.text(`Kesulitan : ${item.kesulitan || '-'}`, PDF_MARGIN + contentWidth / 2, textY);
    textY += 4.8;

    for (const line of indikatorLines) {
      doc.text(line, PDF_MARGIN + 4, textY);
      textY += 4.5;
    }

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 118, 110);
    for (const line of kunciLines) {
      doc.text(line, PDF_MARGIN + 4, textY);
      textY += 4.5;
    }

    // Card body using doc.text() with margin and line breaks
    let bodyY = boxStartY + headerHeight + 6;

    if (hasStimulus) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      for (const line of stimulusLines) {
        bodyY = ensurePdfSpace(doc, bodyY, 5.5);
        doc.text(line, PDF_MARGIN + 4, bodyY);
        bodyY += 4.8;
      }
      bodyY += 2;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    for (const line of questionLines) {
      bodyY = ensurePdfSpace(doc, bodyY, 5.5);
      doc.text(line, PDF_MARGIN + 4, bodyY);
      bodyY += 5.2;
    }

    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    optionLineBlocks.forEach((lines) => {
      lines.forEach((line) => {
        bodyY = ensurePdfSpace(doc, bodyY, 5.2);
        doc.text(line, PDF_MARGIN + 10, bodyY);
        bodyY += 4.8;
      });
    });

    // Draw outer border if body stayed on same page
    if (bodyY > boxStartY + headerHeight) {
      doc.setDrawColor(203, 213, 225);
      doc.rect(
        PDF_MARGIN,
        boxStartY + headerHeight,
        contentWidth,
        bodyY - (boxStartY + headerHeight) + 2
      );
    }

    y = bodyY + 8;
  });

  // Unused helper reference guard for strict TS
  void (doc as JsPDFWithAutoTable).lastAutoTable;
}

export function exportToPdf(
  result: GeneratedExamResult,
  identity: ExamIdentity,
  scope: ExportScope
): string {
  const meta = resolveMeta(result, identity);
  const soalList = Array.isArray(result.soal) ? result.soal : [];
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  if (scope === 'naskah') {
    renderPdfNaskah(doc, soalList, meta);
  } else if (scope === 'kunci') {
    renderPdfKunci(doc, soalList, meta);
  } else if (scope === 'kisi') {
    renderPdfKisi(doc, soalList, meta);
  } else if (scope === 'kartu') {
    renderPdfKartu(doc, soalList, meta);
  } else {
    renderPdfNaskah(doc, soalList, meta);
    doc.addPage();
    renderPdfKunci(doc, soalList, meta);
    doc.addPage();
    renderPdfKisi(doc, soalList, meta);
    doc.addPage();
    renderPdfKartu(doc, soalList, meta);
  }

  const filename = buildExportFilename(result, identity, scope, 'pdf');
  const blob = doc.output('blob');
  saveAs(blob, filename);
  return filename;
}
