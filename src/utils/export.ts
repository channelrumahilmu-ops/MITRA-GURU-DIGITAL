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
  GeneratedLkpdResult,
  GeneratedModulAjarResult,
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

// ============================================================================
// WORD (.docx) EXPORT — MODUL AJAR / RPM
// ============================================================================

function makeSectionHeading(title: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 100 },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 24,
        color: '0F172A',
      }),
    ],
  });
}

function makeSubHeading(title: string): Paragraph {
  return new Paragraph({
    spacing: { before: 140, after: 60 },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 21,
        color: '0F766E',
      }),
    ],
  });
}

function makeBodyParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 40, after: 80 },
    children: [
      new TextRun({
        text: text || '-',
        size: 20,
        color: '1E293B',
      }),
    ],
  });
}

function makeNumberedList(items: string[]): Paragraph[] {
  const safeItems = items.filter((item) => item && item.trim().length > 0);
  if (safeItems.length === 0) {
    return [makeBodyParagraph('-')];
  }
  return safeItems.map(
    (item, idx) =>
      new Paragraph({
        indent: { left: 360, hanging: 240 },
        spacing: { before: 30, after: 50 },
        children: [
          new TextRun({
            text: `${idx + 1}. `,
            bold: true,
            size: 20,
            color: '0F172A',
          }),
          new TextRun({
            text: item.trim(),
            size: 20,
            color: '1E293B',
          }),
        ],
      })
  );
}

function makeBulletList(items: string[]): Paragraph[] {
  const safeItems = items.filter((item) => item && item.trim().length > 0);
  if (safeItems.length === 0) {
    return [makeBodyParagraph('-')];
  }
  return safeItems.map(
    (item) =>
      new Paragraph({
        indent: { left: 360, hanging: 200 },
        spacing: { before: 30, after: 50 },
        children: [
          new TextRun({
            text: '•  ',
            bold: true,
            size: 20,
            color: '0F766E',
          }),
          new TextRun({
            text: item.trim(),
            size: 20,
            color: '1E293B',
          }),
        ],
      })
  );
}

export async function exportModulAjarToWord(
  modul: GeneratedModulAjarResult
): Promise<string> {
  const { identitas, analisis_pembelajaran, desain_pembelajaran, pengalaman_belajar, asesmen } =
    modul;

  const identitasTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: FULL_TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          makeCell('Satuan Pendidikan', { header: true, widthPct: 24 }),
          makeCell(identitas.satuan_pendidikan || '-', { widthPct: 26 }),
          makeCell('Fase', { header: true, widthPct: 20 }),
          makeCell(identitas.fase || '-', { widthPct: 30 }),
        ],
      }),
      new TableRow({
        children: [
          makeCell('Mata Pelajaran', { header: true }),
          makeCell(identitas.mata_pelajaran || '-'),
          makeCell('Alokasi Waktu', { header: true }),
          makeCell(identitas.alokasi_waktu || '-'),
        ],
      }),
      new TableRow({
        children: [
          makeCell('Kelas / Semester', { header: true }),
          makeCell(identitas.kelas_semester || '-'),
          makeCell('Jumlah Pertemuan', { header: true }),
          makeCell(identitas.jumlah_pertemuan || '-'),
        ],
      }),
      new TableRow({
        children: [
          makeCell('Penyusun', { header: true }),
          makeCell(identitas.penyusun || '-', { columnSpan: 3 }),
        ],
      }),
    ],
  });

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'MODUL AJAR / RENCANA PEMBELAJARAN MENDALAM',
          bold: true,
          size: 22,
          color: '475569',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: modul.judul_modul || 'Modul Ajar',
          bold: true,
          size: 28,
          color: '0F172A',
        }),
      ],
    }),

    makeSectionHeading('A. Identitas Modul'),
    identitasTable,

    makeSectionHeading('B. Analisis Pembelajaran'),
    makeSubHeading('1. Capaian Pembelajaran (CP)'),
    makeBodyParagraph(analisis_pembelajaran.capaian_pembelajaran),
    makeSubHeading('2. Topik / Materi Pembelajaran'),
    makeBodyParagraph(analisis_pembelajaran.topik_materi),
    makeSubHeading('3. Tujuan Pembelajaran (TP)'),
    ...makeNumberedList(analisis_pembelajaran.tujuan_pembelajaran || []),
    makeSubHeading('4. Karakteristik Murid'),
    makeBodyParagraph(analisis_pembelajaran.karakteristik_murid || '-'),

    makeSectionHeading('C. Desain Pembelajaran'),
    makeSubHeading('1. 8 Dimensi Profil Lulusan'),
    ...makeBulletList(desain_pembelajaran.dimensi_profil_lulusan || []),
    makeSubHeading('2. Model Pembelajaran'),
    makeBodyParagraph(desain_pembelajaran.model_pembelajaran),
    makeSubHeading('3. Metode Pembelajaran'),
    ...makeBulletList(desain_pembelajaran.metode_pembelajaran || []),

    makeSectionHeading('D. Pengalaman Belajar'),
    makeSubHeading('1. Kegiatan Pendahuluan'),
    ...makeNumberedList(pengalaman_belajar.pendahuluan || []),
    makeSubHeading('2. Kegiatan Inti'),
    ...makeNumberedList(pengalaman_belajar.kegiatan_inti || []),
    makeSubHeading('3. Kegiatan Penutup'),
    ...makeNumberedList(pengalaman_belajar.penutup || []),

    makeSectionHeading('E. Asesmen'),
    makeSubHeading('1. Jenis Asesmen'),
    makeBodyParagraph(asesmen.jenis),
    makeSubHeading('2. Bentuk Instrumen & Rubrik'),
    makeBodyParagraph(asesmen.bentuk_instrumen),
  ];

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
  const mapel = sanitizeFilenamePart(identitas.mata_pelajaran, 'Mapel');
  const topik = sanitizeFilenamePart(analisis_pembelajaran.topik_materi, 'Modul_Ajar');
  const filename = `Modul_Ajar_${mapel}_${topik}.docx`;
  saveAs(blob, filename);
  return filename;
}

// ============================================================================
// PDF (.pdf) EXPORT — MODUL AJAR / RPM
// ============================================================================

function drawModulPdfSectionHeading(
  doc: jsPDF,
  title: string,
  startY: number,
  contentWidth: number
): number {
  let y = ensurePdfSpace(doc, startY, 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(title, PDF_MARGIN, y);
  y += 2;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.line(PDF_MARGIN, y, PDF_MARGIN + contentWidth, y);
  return y + 5.5;
}

function drawModulPdfSubHeading(
  doc: jsPDF,
  title: string,
  startY: number
): number {
  const y = ensurePdfSpace(doc, startY, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 118, 110);
  doc.text(title, PDF_MARGIN, y);
  return y + 5;
}

function drawModulPdfBody(
  doc: jsPDF,
  text: string,
  startY: number,
  contentWidth: number,
  bold = false
): number {
  const cleanText = (text || '-').trim() || '-';
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  const paragraphs = cleanText.split('\n');
  let y = startY;
  for (const para of paragraphs) {
    if (para.trim().length === 0) {
      y = ensurePdfSpace(doc, y, 4);
      y += 3;
      continue;
    }
    y = drawPdfWrappedText(doc, para, PDF_MARGIN, y, contentWidth, 5.2);
  }
  return y + 2;
}

function drawModulPdfList(
  doc: jsPDF,
  items: string[],
  ordered: boolean,
  startY: number,
  contentWidth: number
): number {
  const safeItems = items.map((i) => (i || '').trim()).filter((i) => i.length > 0);
  if (safeItems.length === 0) {
    return drawModulPdfBody(doc, '-', startY, contentWidth);
  }

  let y = startY;
  const textX = PDF_MARGIN + 8;
  const textWidth = contentWidth - 8;
  const lineHeight = 5.1;

  safeItems.forEach((item, idx) => {
    const prefix = ordered ? `${idx + 1}.` : '•';
    const subLines = doc.splitTextToSize(item, textWidth) as string[];
    const firstLineHeight = subLines.length > 0 ? lineHeight : lineHeight;

    y = ensurePdfSpace(doc, y, firstLineHeight + 1);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(ordered ? 15 : 15, ordered ? 23 : 118, ordered ? 42 : 110);
    doc.text(prefix, PDF_MARGIN + 1.5, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);

    subLines.forEach((line, lineIdx) => {
      if (lineIdx > 0) {
        y = ensurePdfSpace(doc, y, lineHeight);
      }
      doc.text(line, textX, y);
      y += lineHeight;
    });

    y += 1.2;
  });

  return y + 2;
}

export function exportModulAjarToPdf(modul: GeneratedModulAjarResult): string {
  const {
    identitas,
    analisis_pembelajaran,
    desain_pembelajaran,
    pengalaman_belajar,
    asesmen,
  } = modul;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PDF_MARGIN * 2;
  let y = PDF_MARGIN;

  // Kop & Judul Modul
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text('MODUL AJAR / RENCANA PEMBELAJARAN MENDALAM', pageWidth / 2, y, {
    align: 'center',
  });
  y += 6.5;

  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(
    modul.judul_modul || 'Modul Ajar',
    contentWidth
  ) as string[];
  for (const line of titleLines) {
    doc.text(line, pageWidth / 2, y, { align: 'center' });
    y += 6.5;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${identitas.satuan_pendidikan || '-'} · ${identitas.mata_pelajaran || '-'} · ${identitas.kelas_semester || '-'}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 4;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(PDF_MARGIN, y, pageWidth - PDF_MARGIN, y);
  y += 8;

  // A. Identitas Modul (Tabel)
  y = drawModulPdfSectionHeading(doc, 'A. Identitas Modul', y, contentWidth);

  autoTable(doc, {
    startY: y,
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      cellPadding: 2.8,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.25,
    },
    columnStyles: {
      0: { cellWidth: 38, fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [15, 23, 42] },
      1: { cellWidth: (contentWidth - 76) / 2 },
      2: { cellWidth: 38, fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [15, 23, 42] },
      3: { cellWidth: (contentWidth - 76) / 2 },
    },
    body: [
      [
        'Satuan Pendidikan',
        identitas.satuan_pendidikan || '-',
        'Fase',
        identitas.fase || '-',
      ],
      [
        'Mata Pelajaran',
        identitas.mata_pelajaran || '-',
        'Alokasi Waktu',
        identitas.alokasi_waktu || '-',
      ],
      [
        'Kelas / Semester',
        identitas.kelas_semester || '-',
        'Jumlah Pertemuan',
        identitas.jumlah_pertemuan || '-',
      ],
      [
        'Penyusun',
        { content: identitas.penyusun || '-', colSpan: 3 },
      ],
    ],
  });

  const tableEndY = (doc as JsPDFWithAutoTable).lastAutoTable?.finalY;
  y = (tableEndY ?? y + 32) + 8;

  // B. Analisis Pembelajaran
  y = drawModulPdfSectionHeading(doc, 'B. Analisis Pembelajaran', y, contentWidth);
  y = drawModulPdfSubHeading(doc, '1. Capaian Pembelajaran (CP)', y);
  y = drawModulPdfBody(doc, analisis_pembelajaran.capaian_pembelajaran, y, contentWidth);

  y = drawModulPdfSubHeading(doc, '2. Topik / Materi Pembelajaran', y);
  y = drawModulPdfBody(doc, analisis_pembelajaran.topik_materi, y, contentWidth, true);

  y = drawModulPdfSubHeading(doc, '3. Tujuan Pembelajaran (TP)', y);
  y = drawModulPdfList(
    doc,
    analisis_pembelajaran.tujuan_pembelajaran || [],
    true,
    y,
    contentWidth
  );

  y = drawModulPdfSubHeading(doc, '4. Karakteristik Murid', y);
  y = drawModulPdfBody(
    doc,
    analisis_pembelajaran.karakteristik_murid?.trim() ||
      'Umum / heterogen (tidak ada catatan khusus)',
    y,
    contentWidth
  );
  y += 2;

  // C. Desain Pembelajaran
  y = drawModulPdfSectionHeading(doc, 'C. Desain Pembelajaran', y, contentWidth);
  y = drawModulPdfSubHeading(doc, '1. 8 Dimensi Profil Lulusan', y);
  y = drawModulPdfList(
    doc,
    desain_pembelajaran.dimensi_profil_lulusan || [],
    false,
    y,
    contentWidth
  );

  y = drawModulPdfSubHeading(doc, '2. Model Pembelajaran', y);
  y = drawModulPdfBody(doc, desain_pembelajaran.model_pembelajaran, y, contentWidth, true);

  y = drawModulPdfSubHeading(doc, '3. Metode Pembelajaran', y);
  y = drawModulPdfList(
    doc,
    desain_pembelajaran.metode_pembelajaran || [],
    false,
    y,
    contentWidth
  );
  y += 2;

  // D. Pengalaman Belajar
  y = drawModulPdfSectionHeading(doc, 'D. Pengalaman Belajar', y, contentWidth);
  y = drawModulPdfSubHeading(doc, '1. Kegiatan Pendahuluan', y);
  y = drawModulPdfList(
    doc,
    pengalaman_belajar.pendahuluan || [],
    true,
    y,
    contentWidth
  );

  y = drawModulPdfSubHeading(doc, '2. Kegiatan Inti', y);
  y = drawModulPdfList(
    doc,
    pengalaman_belajar.kegiatan_inti || [],
    true,
    y,
    contentWidth
  );

  y = drawModulPdfSubHeading(doc, '3. Kegiatan Penutup', y);
  y = drawModulPdfList(
    doc,
    pengalaman_belajar.penutup || [],
    true,
    y,
    contentWidth
  );
  y += 2;

  // E. Asesmen
  y = drawModulPdfSectionHeading(doc, 'E. Asesmen', y, contentWidth);
  y = drawModulPdfSubHeading(doc, '1. Jenis Asesmen', y);
  y = drawModulPdfBody(doc, asesmen.jenis, y, contentWidth, true);

  y = drawModulPdfSubHeading(doc, '2. Bentuk Instrumen & Teknik Penilaian', y);
  y = drawModulPdfBody(doc, asesmen.bentuk_instrumen, y, contentWidth);

  // Page footer numbers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Halaman ${p} dari ${totalPages}`,
      pageWidth - PDF_MARGIN,
      pageHeight - 8,
      { align: 'right' }
    );
  }

  const mapel = sanitizeFilenamePart(identitas.mata_pelajaran, 'Mapel');
  const topik = sanitizeFilenamePart(analisis_pembelajaran.topik_materi, 'Modul_Ajar');
  const filename = `Modul_Ajar_${mapel}_${topik}.pdf`;
  const blob = doc.output('blob');
  saveAs(blob, filename);
  return filename;
}

// ============================================================================
// HELPER TABEL DATA LKPD
// ============================================================================

export interface ParsedPipeTable {
  headers: string[];
  rows: string[][];
}

export function parsePipeTable(raw?: string): ParsedPipeTable | null {
  if (!raw || typeof raw !== 'string') return null;
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.includes('|'));

  if (lines.length < 2) return null;

  const splitRow = (line: string): string[] => {
    const trimmed = line.replace(/^\|/, '').replace(/\|$/, '');
    return trimmed.split('|').map((cell) => cell.trim());
  };

  const isSeparatorRow = (cells: string[]): boolean =>
    cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));

  const headerCells = splitRow(lines[0]);
  if (headerCells.length < 2) return null;

  const dataLines = lines.slice(1).filter((line) => !isSeparatorRow(splitRow(line)));
  const rows = dataLines.map((line) => {
    const cells = splitRow(line);
    while (cells.length < headerCells.length) {
      cells.push('');
    }
    return cells.slice(0, headerCells.length);
  });

  if (rows.length === 0) {
    rows.push(headerCells.map(() => ''));
    rows.push(headerCells.map(() => ''));
    rows.push(headerCells.map(() => ''));
  }

  return { headers: headerCells, rows };
}

// ============================================================================
// WORD (.docx) EXPORT — LKPD
// ============================================================================

function makeLkpdAnswerSpaceParagraphs(lineCount = 5): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      spacing: { before: 140, after: 40 },
      children: [
        new TextRun({
          text: 'Ruang Jawaban / Hasil Pengamatan:',
          bold: true,
          size: 19,
          color: '475569',
        }),
      ],
    }),
  ];

  for (let i = 0; i < lineCount; i++) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 160, after: 140 },
        border: {
          bottom: {
            style: BorderStyle.DOTTED,
            size: 6,
            color: '94A3B8',
          },
        },
        children: [new TextRun({ text: ' ', size: 20 })],
      })
    );
  }

  return paragraphs;
}

export async function exportLkpdToWord(
  lkpd: GeneratedLkpdResult,
  durasi?: string
): Promise<string> {
  const { identitas, petunjuk_umum, kegiatan, rubrik_penilaian } = lkpd;

  const identitasTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: FULL_TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          makeCell('Satuan Pendidikan', { header: true, widthPct: 22 }),
          makeCell(identitas.sekolah || '-', { widthPct: 28 }),
          makeCell('Mata Pelajaran', { header: true, widthPct: 22 }),
          makeCell(identitas.mata_pelajaran || '-', { widthPct: 28 }),
        ],
      }),
      new TableRow({
        children: [
          makeCell('Kelas / Semester', { header: true }),
          makeCell(identitas.kelas || '-'),
          makeCell('Durasi Pengerjaan', { header: true }),
          makeCell(durasi?.trim() || '-'),
        ],
      }),
      new TableRow({
        children: [
          makeCell('Topik / Materi', { header: true }),
          makeCell(identitas.topik || '-', { columnSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          makeCell('Nama Siswa / Kelompok', { header: true }),
          makeCell('....................................................'),
          makeCell('Tanggal', { header: true }),
          makeCell('....................................'),
        ],
      }),
    ],
  });

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'LEMBAR KERJA PESERTA DIDIK (LKPD)',
          bold: true,
          size: 22,
          color: '475569',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: lkpd.judul || 'Lembar Kerja Peserta Didik',
          bold: true,
          size: 28,
          color: '0F172A',
        }),
      ],
    }),

    makeSectionHeading('A. Identitas LKPD'),
    identitasTable,

    makeSectionHeading('B. Tujuan Pembelajaran'),
    makeBodyParagraph(identitas.tujuan || '-'),

    makeSectionHeading('C. Petunjuk Umum'),
    ...(petunjuk_umum || '-')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => makeBodyParagraph(line)),

    makeSectionHeading('D. Kegiatan Pembelajaran'),
  ];

  const safeKegiatan = Array.isArray(kegiatan) ? kegiatan : [];
  safeKegiatan.forEach((keg, index) => {
    children.push(
      makeSubHeading(`Kegiatan ${index + 1}: ${keg.judul_kegiatan || `Aktivitas ${index + 1}`}`)
    );
    children.push(
      new Paragraph({
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: 'Langkah Kerja:',
            bold: true,
            size: 20,
            color: '0F172A',
          }),
        ],
      })
    );
    children.push(...makeNumberedList(keg.langkah_kerja || []));

    const parsedTable = parsePipeTable(keg.tabel_data);
    if (parsedTable) {
      children.push(
        new Paragraph({
          spacing: { before: 100, after: 60 },
          children: [
            new TextRun({
              text: 'Tabel Data / Pengamatan:',
              bold: true,
              size: 20,
              color: '0F172A',
            }),
          ],
        })
      );

      const colWidth = Math.floor(100 / parsedTable.headers.length);
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: FULL_TABLE_BORDERS,
          rows: [
            new TableRow({
              tableHeader: true,
              children: parsedTable.headers.map((h) =>
                makeCell(h, { header: true, widthPct: colWidth })
              ),
            }),
            ...parsedTable.rows.map(
              (row) =>
                new TableRow({
                  children: row.map((cell) => makeCell(cell || ' ')),
                })
            ),
          ],
        })
      );
    } else if (keg.tabel_data && keg.tabel_data.trim().length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 100, after: 40 },
          children: [
            new TextRun({
              text: 'Data / Catatan Pengamatan:',
              bold: true,
              size: 20,
              color: '0F172A',
            }),
          ],
        })
      );
      children.push(makeBodyParagraph(keg.tabel_data.trim()));
    }

    children.push(...makeLkpdAnswerSpaceParagraphs(5));
  });

  children.push(makeSectionHeading('E. Rubrik Penilaian'));

  const safeRubrik = Array.isArray(rubrik_penilaian) ? rubrik_penilaian : [];
  const totalSkor = safeRubrik.reduce(
    (sum, item) => sum + (Number.isFinite(item.skor_maksimal) ? Number(item.skor_maksimal) : 0),
    0
  );

  const rubrikTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: FULL_TABLE_BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          makeCell('No', { header: true, widthPct: 8, align: AlignmentType.CENTER }),
          makeCell('Aspek Penilaian', { header: true, widthPct: 26 }),
          makeCell('Indikator Penilaian', { header: true, widthPct: 50 }),
          makeCell('Skor Maks', { header: true, widthPct: 16, align: AlignmentType.CENTER }),
        ],
      }),
      ...safeRubrik.map(
        (item, idx) =>
          new TableRow({
            children: [
              makeCell(String(idx + 1), { align: AlignmentType.CENTER }),
              makeCell(item.aspek || '-', { bold: true }),
              makeCell(item.indikator || '-'),
              makeCell(String(item.skor_maksimal ?? 0), { align: AlignmentType.CENTER }),
            ],
          })
      ),
      new TableRow({
        children: [
          makeCell('Total Skor Maksimal', {
            header: true,
            columnSpan: 3,
            align: AlignmentType.RIGHT,
          }),
          makeCell(String(totalSkor), {
            header: true,
            align: AlignmentType.CENTER,
          }),
        ],
      }),
    ],
  });

  children.push(rubrikTable);

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
  const mapel = sanitizeFilenamePart(identitas.mata_pelajaran, 'Mapel');
  const topik = sanitizeFilenamePart(identitas.topik, 'LKPD');
  const filename = `LKPD_${mapel}_${topik}.docx`;
  saveAs(blob, filename);
  return filename;
}

// ============================================================================
// PDF (.pdf) EXPORT — LKPD
// ============================================================================

function drawLkpdAnswerBoxPdf(
  doc: jsPDF,
  startY: number,
  contentWidth: number,
  lineCount = 5
): number {
  const lineGap = 8;
  const headerGap = 6;
  const boxPaddingBottom = 4;
  const totalNeeded = headerGap + lineCount * lineGap + boxPaddingBottom + 4;

  let y = ensurePdfSpace(doc, startY, totalNeeded);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Ruang Jawaban / Hasil Pengamatan Siswa:', PDF_MARGIN, y);
  y += 3;

  const boxHeight = lineCount * lineGap + boxPaddingBottom;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.setLineWidth(0.3);
  doc.roundedRect(PDF_MARGIN, y, contentWidth, boxHeight, 1.5, 1.5, 'FD');

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.22);
  for (let i = 1; i <= lineCount; i++) {
    const lineY = y + i * lineGap;
    doc.line(PDF_MARGIN + 4, lineY, PDF_MARGIN + contentWidth - 4, lineY);
  }

  return y + boxHeight + 6;
}

export function exportLkpdToPdf(
  lkpd: GeneratedLkpdResult,
  durasi?: string
): string {
  const { identitas, petunjuk_umum, kegiatan, rubrik_penilaian } = lkpd;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PDF_MARGIN * 2;
  let y = PDF_MARGIN;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text('LEMBAR KERJA PESERTA DIDIK (LKPD)', pageWidth / 2, y, {
    align: 'center',
  });
  y += 6.5;

  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(
    lkpd.judul || 'Lembar Kerja Peserta Didik',
    contentWidth
  ) as string[];
  for (const line of titleLines) {
    doc.text(line, pageWidth / 2, y, { align: 'center' });
    y += 6.5;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${identitas.sekolah || '-'} · ${identitas.mata_pelajaran || '-'} · ${identitas.kelas || '-'}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 4;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(PDF_MARGIN, y, pageWidth - PDF_MARGIN, y);
  y += 8;

  // A. Identitas LKPD
  y = drawModulPdfSectionHeading(doc, 'A. Identitas LKPD', y, contentWidth);

  autoTable(doc, {
    startY: y,
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      cellPadding: 2.8,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.25,
    },
    columnStyles: {
      0: { cellWidth: 38, fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [15, 23, 42] },
      1: { cellWidth: (contentWidth - 76) / 2 },
      2: { cellWidth: 38, fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [15, 23, 42] },
      3: { cellWidth: (contentWidth - 76) / 2 },
    },
    body: [
      [
        'Satuan Pendidikan',
        identitas.sekolah || '-',
        'Mata Pelajaran',
        identitas.mata_pelajaran || '-',
      ],
      [
        'Kelas / Semester',
        identitas.kelas || '-',
        'Durasi Pengerjaan',
        durasi?.trim() || '-',
      ],
      [
        'Topik / Materi',
        { content: identitas.topik || '-', colSpan: 3 },
      ],
      [
        'Nama / Kelompok',
        '........................................',
        'Tanggal',
        '............................',
      ],
    ],
  });

  y = ((doc as JsPDFWithAutoTable).lastAutoTable?.finalY ?? y + 32) + 8;

  // B. Tujuan Pembelajaran
  y = drawModulPdfSectionHeading(doc, 'B. Tujuan Pembelajaran', y, contentWidth);
  y = drawModulPdfBody(doc, identitas.tujuan || '-', y, contentWidth);
  y += 2;

  // C. Petunjuk Umum
  y = drawModulPdfSectionHeading(doc, 'C. Petunjuk Umum', y, contentWidth);
  y = drawModulPdfBody(doc, petunjuk_umum || '-', y, contentWidth);
  y += 2;

  // D. Kegiatan Pembelajaran
  y = drawModulPdfSectionHeading(doc, 'D. Kegiatan Pembelajaran', y, contentWidth);
  const safeKegiatan = Array.isArray(kegiatan) ? kegiatan : [];

  safeKegiatan.forEach((keg, idx) => {
    y = drawModulPdfSubHeading(
      doc,
      `Kegiatan ${idx + 1}: ${keg.judul_kegiatan || `Aktivitas ${idx + 1}`}`,
      y
    );

    y = ensurePdfSpace(doc, y, 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Langkah Kerja:', PDF_MARGIN, y);
    y += 5;

    y = drawModulPdfList(doc, keg.langkah_kerja || [], true, y, contentWidth);

    const parsedTable = parsePipeTable(keg.tabel_data);
    if (parsedTable) {
      y = ensurePdfSpace(doc, y, 16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text('Tabel Data / Pengamatan:', PDF_MARGIN, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        margin: { left: PDF_MARGIN, right: PDF_MARGIN },
        theme: 'grid',
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 9,
          lineColor: [203, 213, 225],
          lineWidth: 0.25,
        },
        bodyStyles: {
          textColor: [30, 41, 59],
          fontSize: 9,
          minCellHeight: 8,
          lineColor: [203, 213, 225],
          lineWidth: 0.25,
        },
        head: [parsedTable.headers],
        body: parsedTable.rows,
      });

      y = ((doc as JsPDFWithAutoTable).lastAutoTable?.finalY ?? y + 20) + 6;
    } else if (keg.tabel_data && keg.tabel_data.trim().length > 0) {
      y = ensurePdfSpace(doc, y, 10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text('Data / Catatan Pengamatan:', PDF_MARGIN, y);
      y += 5;
      y = drawModulPdfBody(doc, keg.tabel_data.trim(), y, contentWidth);
    }

    y = drawLkpdAnswerBoxPdf(doc, y, contentWidth, 5);
  });

  // E. Rubrik Penilaian
  y = drawModulPdfSectionHeading(doc, 'E. Rubrik Penilaian', y, contentWidth);
  const safeRubrik = Array.isArray(rubrik_penilaian) ? rubrik_penilaian : [];
  const totalSkor = safeRubrik.reduce(
    (sum, item) => sum + (Number.isFinite(item.skor_maksimal) ? Number(item.skor_maksimal) : 0),
    0
  );

  autoTable(doc, {
    startY: y,
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9.5,
      lineColor: [203, 213, 225],
      lineWidth: 0.25,
    },
    bodyStyles: {
      textColor: [30, 41, 59],
      fontSize: 9,
      valign: 'top',
      lineColor: [203, 213, 225],
      lineWidth: 0.25,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 42, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
    },
    head: [['No', 'Aspek Penilaian', 'Indikator Pencapaian', 'Skor Maks']],
    body: [
      ...safeRubrik.map((item, idx) => [
        String(idx + 1),
        item.aspek || '-',
        item.indikator || '-',
        String(item.skor_maksimal ?? 0),
      ]),
      [
        {
          content: 'Total Skor Maksimal',
          colSpan: 3,
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] },
        },
        {
          content: String(totalSkor),
          styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] },
        },
      ],
    ],
  });

  // Page footer numbers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Halaman ${p} dari ${totalPages}`,
      pageWidth - PDF_MARGIN,
      pageHeight - 8,
      { align: 'right' }
    );
  }

  const mapel = sanitizeFilenamePart(identitas.mata_pelajaran, 'Mapel');
  const topik = sanitizeFilenamePart(identitas.topik, 'LKPD');
  const filename = `LKPD_${mapel}_${topik}.pdf`;
  const blob = doc.output('blob');
  saveAs(blob, filename);
  return filename;
}



