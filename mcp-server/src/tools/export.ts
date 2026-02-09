import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import Papa from 'papaparse';
import { dataPath } from '../paths.js';

/**
 * Export MCP Tools - Session 249.6
 *
 * Capabilities:
 * - CSV generation from data
 * - XLSX generation from data
 * - PDF generation from content
 * - Google Sheets export to CSV/XLSX (via googleapis)
 *
 * Output directory: data/exports/
 */

const EXPORT_DIR = dataPath('exports');

/**
 * Sanitize filename to prevent path traversal (MC1 fix).
 * Strips path separators, .., and null bytes. Allows only safe chars.
 */
function sanitizeFilename(raw: string): string {
    // Remove null bytes, path separators, and parent directory references
    let safe = raw.replace(/[\x00\/\\]/g, '').replace(/\.\./g, '');
    // Strip leading dots (hidden files)
    safe = safe.replace(/^\.+/, '');
    // Allow only alphanumeric, dash, underscore, dot, space
    safe = safe.replace(/[^a-zA-Z0-9\-_. ]/g, '_');
    // Ensure non-empty
    if (!safe || safe.trim().length === 0) {
        safe = `export_${Date.now()}`;
    }
    // Limit length
    if (safe.length > 200) {
        safe = safe.substring(0, 200);
    }
    return safe;
}

// Ensure export directory exists
function ensureExportDir() {
    if (!fs.existsSync(EXPORT_DIR)) {
        fs.mkdirSync(EXPORT_DIR, { recursive: true });
    }
    return EXPORT_DIR;
}

/**
 * Validate that resolved path stays within EXPORT_DIR (defense-in-depth).
 * Throws if path traversal detected after sanitization.
 */
function validateExportPath(outputPath: string): void {
    const resolved = path.resolve(outputPath);
    const exportDir = path.resolve(EXPORT_DIR);
    if (!resolved.startsWith(exportDir + path.sep) && resolved !== exportDir) {
        throw new Error('Path traversal detected: output path escapes export directory');
    }
}

export const exportTools = {
    generate_csv: {
        name: 'export_generate_csv',
        description: 'Generate a CSV file from data array. Returns file path.',
        parameters: {
            data: z.array(z.record(z.string(), z.any())).describe('Array of objects to convert to CSV'),
            filename: z.string().describe('Output filename (without extension)'),
            headers: z.array(z.string()).optional().describe('Column headers (optional, auto-detected from data)'),
        },
        handler: async ({ data, filename, headers }: {
            data: Record<string, any>[],
            filename: string,
            headers?: string[]
        }) => {
            try {
                ensureExportDir();

                if (!data || data.length === 0) {
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "error",
                                message: "Data array is empty or undefined"
                            }, null, 2)
                        }]
                    };
                }

                // Auto-detect headers from first object if not provided
                const csvHeaders = headers || Object.keys(data[0]);

                // Convert to CSV using papaparse
                const csv = Papa.unparse(data, {
                    columns: csvHeaders,
                    header: true
                });

                const safeFilename = sanitizeFilename(filename);
                const outputPath = path.join(EXPORT_DIR, `${safeFilename}.csv`);
                validateExportPath(outputPath);
                fs.writeFileSync(outputPath, csv, 'utf-8');

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "CSV generated successfully",
                            file: {
                                path: `data/exports/${safeFilename}.csv`,
                                filename: `${safeFilename}.csv`,
                                rows: data.length,
                                columns: csvHeaders.length,
                                size_bytes: fs.statSync(outputPath).size
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    },

    generate_xlsx: {
        name: 'export_generate_xlsx',
        description: 'Generate an Excel XLSX file from data array. Returns file path.',
        parameters: {
            data: z.array(z.record(z.string(), z.any())).describe('Array of objects to convert to Excel'),
            filename: z.string().describe('Output filename (without extension)'),
            sheetName: z.string().optional().describe('Sheet name (default: "Data")'),
            headers: z.array(z.string()).optional().describe('Column headers (optional, auto-detected from data)'),
        },
        handler: async ({ data, filename, sheetName = 'Data', headers }: {
            data: Record<string, any>[],
            filename: string,
            sheetName?: string,
            headers?: string[]
        }) => {
            try {
                ensureExportDir();

                if (!data || data.length === 0) {
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "error",
                                message: "Data array is empty or undefined"
                            }, null, 2)
                        }]
                    };
                }

                // Auto-detect headers from first object if not provided
                const xlsxHeaders = headers || Object.keys(data[0]);

                const workbook = new ExcelJS.Workbook();
                workbook.creator = 'VocalIA MCP Server';
                workbook.created = new Date();

                const worksheet = workbook.addWorksheet(sheetName);

                // Add headers with styling
                worksheet.columns = xlsxHeaders.map(header => ({
                    header,
                    key: header,
                    width: Math.max(header.length + 2, 15)
                }));

                // Style header row
                worksheet.getRow(1).font = { bold: true };
                worksheet.getRow(1).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF5E6AD2' }
                };
                worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

                // Add data rows
                data.forEach(row => {
                    worksheet.addRow(row);
                });

                // Auto-filter (supports >26 columns: A..Z, AA..AZ, etc.)
                function colLetter(n: number): string {
                    let s = '';
                    while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
                    return s;
                }
                worksheet.autoFilter = {
                    from: 'A1',
                    to: `${colLetter(xlsxHeaders.length)}1`
                };

                const safeFilename = sanitizeFilename(filename);
                const outputPath = path.join(EXPORT_DIR, `${safeFilename}.xlsx`);
                validateExportPath(outputPath);
                await workbook.xlsx.writeFile(outputPath);

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Excel file generated successfully",
                            file: {
                                path: `data/exports/${safeFilename}.xlsx`,
                                filename: `${safeFilename}.xlsx`,
                                rows: data.length,
                                columns: xlsxHeaders.length,
                                sheet: sheetName,
                                size_bytes: fs.statSync(outputPath).size
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    },

    generate_pdf: {
        name: 'export_generate_pdf',
        description: 'Generate a PDF document from text content or structured data',
        parameters: {
            content: z.string().describe('Text content for the PDF'),
            filename: z.string().describe('Output filename (without extension)'),
            title: z.string().optional().describe('Document title'),
            includeDate: z.boolean().optional().describe('Include generation date (default: true)'),
        },
        handler: async ({ content, filename, title, includeDate = true }: {
            content: string,
            filename: string,
            title?: string,
            includeDate?: boolean
        }): Promise<{ content: { type: "text"; text: string }[] }> => {
            return new Promise<{ content: { type: "text"; text: string }[] }>((resolve) => {
                try {
                    ensureExportDir();
                    const safeFilename = sanitizeFilename(filename);

                    const outputPath = path.join(EXPORT_DIR, `${safeFilename}.pdf`);
                    validateExportPath(outputPath);
                    const doc = new PDFDocument({
                        size: 'A4',
                        margins: { top: 50, bottom: 50, left: 50, right: 50 }
                    });

                    const writeStream = fs.createWriteStream(outputPath);
                    doc.pipe(writeStream);

                    // Header with VocalIA branding
                    doc.fontSize(10)
                       .fillColor('#5E6AD2')
                       .text('VocalIA - Voice AI Platform', 50, 30, { align: 'right' });

                    // Title
                    if (title) {
                        doc.fontSize(24)
                           .fillColor('#1e1b4b')
                           .text(title, 50, 80);
                        doc.moveDown();
                    }

                    // Date
                    if (includeDate) {
                        doc.fontSize(10)
                           .fillColor('#64748b')
                           .text(`Generated: ${new Date().toLocaleDateString('fr-FR', {
                               year: 'numeric',
                               month: 'long',
                               day: 'numeric',
                               hour: '2-digit',
                               minute: '2-digit'
                           })}`, { align: 'left' });
                        doc.moveDown();
                    }

                    // Horizontal line
                    doc.strokeColor('#e2e8f0')
                       .lineWidth(1)
                       .moveTo(50, doc.y)
                       .lineTo(545, doc.y)
                       .stroke();
                    doc.moveDown();

                    // Content
                    doc.fontSize(11)
                       .fillColor('#1e293b')
                       .text(content, {
                           align: 'left',
                           lineGap: 4
                       });

                    // Footer
                    const pageCount = doc.bufferedPageRange().count;
                    for (let i = 0; i < pageCount; i++) {
                        doc.switchToPage(i);
                        doc.fontSize(8)
                           .fillColor('#94a3b8')
                           .text(
                               `Page ${i + 1} of ${pageCount} | Generated by VocalIA MCP Server`,
                               50,
                               doc.page.height - 30,
                               { align: 'center' }
                           );
                    }

                    doc.end();

                    writeStream.on('finish', () => {
                        resolve({
                            content: [{
                                type: "text" as const,
                                text: JSON.stringify({
                                    status: "success",
                                    message: "PDF generated successfully",
                                    file: {
                                        path: `data/exports/${safeFilename}.pdf`,
                                        filename: `${safeFilename}.pdf`,
                                        title: title || '(untitled)',
                                        pages: pageCount,
                                        size_bytes: fs.statSync(outputPath).size
                                    }
                                }, null, 2)
                            }]
                        });
                    });

                    writeStream.on('error', (err) => {
                        resolve({
                            content: [{
                                type: "text" as const,
                                text: JSON.stringify({
                                    status: "error",
                                    message: err.message
                                }, null, 2)
                            }]
                        });
                    });

                } catch (error: any) {
                    resolve({
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "error",
                                message: error.message
                            }, null, 2)
                        }]
                    });
                }
            });
        }
    },

    generate_pdf_table: {
        name: 'export_generate_pdf_table',
        description: 'Generate a PDF with a formatted data table',
        parameters: {
            data: z.array(z.record(z.string(), z.any())).describe('Array of objects for the table'),
            filename: z.string().describe('Output filename (without extension)'),
            title: z.string().describe('Document title'),
            headers: z.array(z.string()).optional().describe('Column headers (optional, auto-detected)'),
        },
        handler: async ({ data, filename, title, headers }: {
            data: Record<string, any>[],
            filename: string,
            title: string,
            headers?: string[]
        }): Promise<{ content: { type: "text"; text: string }[] }> => {
            return new Promise<{ content: { type: "text"; text: string }[] }>((resolve) => {
                try {
                    ensureExportDir();

                    if (!data || data.length === 0) {
                        resolve({
                            content: [{
                                type: "text" as const,
                                text: JSON.stringify({
                                    status: "error",
                                    message: "Data array is empty"
                                }, null, 2)
                            }]
                        });
                        return;
                    }

                    const tableHeaders = headers || Object.keys(data[0]);
                    const safeFilename = sanitizeFilename(filename);
                    const outputPath = path.join(EXPORT_DIR, `${safeFilename}.pdf`);
                    validateExportPath(outputPath);
                    const doc = new PDFDocument({
                        size: 'A4',
                        layout: tableHeaders.length > 4 ? 'landscape' : 'portrait',
                        margins: { top: 50, bottom: 50, left: 40, right: 40 }
                    });

                    const writeStream = fs.createWriteStream(outputPath);
                    doc.pipe(writeStream);

                    // Title
                    doc.fontSize(18)
                       .fillColor('#1e1b4b')
                       .text(title, { align: 'center' });
                    doc.moveDown(0.5);

                    // Date
                    doc.fontSize(9)
                       .fillColor('#64748b')
                       .text(`Generated: ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' });
                    doc.moveDown();

                    // Table setup
                    const pageWidth = doc.page.width - 80;
                    const colWidth = pageWidth / tableHeaders.length;
                    const rowHeight = 25;
                    let startX = 40;
                    let startY = doc.y;

                    // Header row
                    doc.fillColor('#5E6AD2');
                    doc.rect(startX, startY, pageWidth, rowHeight).fill();

                    doc.fillColor('#ffffff')
                       .fontSize(9)
                       .font('Helvetica-Bold');

                    tableHeaders.forEach((header, i) => {
                        doc.text(
                            String(header).substring(0, 15),
                            startX + i * colWidth + 5,
                            startY + 8,
                            { width: colWidth - 10, align: 'left' }
                        );
                    });

                    startY += rowHeight;

                    // Data rows
                    doc.font('Helvetica').fontSize(8);

                    data.forEach((row, rowIndex) => {
                        // Check for page break
                        if (startY > doc.page.height - 80) {
                            doc.addPage();
                            startY = 50;
                        }

                        // Alternate row colors
                        if (rowIndex % 2 === 0) {
                            doc.fillColor('#f8fafc');
                            doc.rect(startX, startY, pageWidth, rowHeight).fill();
                        }

                        doc.fillColor('#1e293b');
                        tableHeaders.forEach((header, i) => {
                            const value = row[header] !== undefined ? String(row[header]) : '';
                            doc.text(
                                value.substring(0, 20),
                                startX + i * colWidth + 5,
                                startY + 8,
                                { width: colWidth - 10, align: 'left' }
                            );
                        });

                        startY += rowHeight;
                    });

                    // Border around table
                    doc.strokeColor('#e2e8f0')
                       .lineWidth(0.5)
                       .rect(40, doc.y - (data.length + 1) * rowHeight - rowHeight, pageWidth, (data.length + 1) * rowHeight)
                       .stroke();

                    doc.end();

                    writeStream.on('finish', () => {
                        resolve({
                            content: [{
                                type: "text" as const,
                                text: JSON.stringify({
                                    status: "success",
                                    message: "PDF table generated successfully",
                                    file: {
                                        path: `data/exports/${safeFilename}.pdf`,
                                        filename: `${safeFilename}.pdf`,
                                        title,
                                        rows: data.length,
                                        columns: tableHeaders.length,
                                        size_bytes: fs.statSync(outputPath).size
                                    }
                                }, null, 2)
                            }]
                        });
                    });

                    writeStream.on('error', (err) => {
                        resolve({
                            content: [{
                                type: "text" as const,
                                text: JSON.stringify({
                                    status: "error",
                                    message: err.message
                                }, null, 2)
                            }]
                        });
                    });

                } catch (error: any) {
                    resolve({
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "error",
                                message: error.message
                            }, null, 2)
                        }]
                    });
                }
            });
        }
    },

    list_exports: {
        name: 'export_list_files',
        description: 'List all exported files in the exports directory',
        parameters: {},
        handler: async () => {
            try {
                ensureExportDir();

                const files = fs.readdirSync(EXPORT_DIR).map(fname => {
                    const filePath = path.join(EXPORT_DIR, fname);
                    const stats = fs.statSync(filePath);
                    return {
                        filename: fname,
                        path: `data/exports/${fname}`,
                        size_bytes: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime,
                        type: path.extname(fname).substring(1).toUpperCase()
                    };
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            export_directory: "data/exports/",
                            file_count: files.length,
                            files
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    }
};
