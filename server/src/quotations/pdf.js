'use strict';

const PDFDocument = require('pdfkit');

const GST_RATE = 0.18;

// Sample/placeholder issuer details — swap for the real registered business before this
// document is used for anything beyond a demo.
const COMPANY = {
    name: 'CallIQ Technologies Pvt. Ltd.',
    address: '4th Floor, Orbit Business Park, Whitefield, Bengaluru, KA 560066, India',
    gstin: 'GSTIN: 29ABCDE1234F1Z5 (sample)',
    email: 'billing@calliq.example',
};

function money(n) {
    return `$${Number(n).toFixed(2)}`;
}

/**
 * Streams a one-line-item quotation PDF straight to `res`. Standard
 * business-quotation layout: issuer header, quotation #/date, bill-to,
 * line-item table, GST, total, terms, signature line.
 */
function renderQuotationPdf(quotation, res) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="quotation-${quotation.id}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text(COMPANY.name);
    doc.fontSize(9).font('Helvetica').fillColor('#555').text(COMPANY.address);
    doc.text(COMPANY.gstin);
    doc.text(COMPANY.email);
    doc.fillColor('#000');

    doc.moveUp(3);
    doc.fontSize(22).font('Helvetica-Bold').text('QUOTATION', 0, doc.y, { align: 'right' });
    doc.fontSize(9).font('Helvetica').text(`Quotation #: ${quotation.id}`, { align: 'right' });
    doc.text(`Date: ${new Date(quotation.created_at).toLocaleDateString()}`, { align: 'right' });
    doc.text(`Valid until: ${new Date(new Date(quotation.created_at).getTime() + 30 * 86400000).toLocaleDateString()}`, {
        align: 'right',
    });

    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke();
    doc.moveDown(1);

    // Bill To
    doc.fontSize(10).font('Helvetica-Bold').text('Bill To');
    doc.font('Helvetica').text(quotation.customer_name);
    doc.moveDown(1.5);

    // Line item table
    const tableTop = doc.y;
    const cols = { desc: 50, qty: 320, price: 380, amount: 470 };
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Description', cols.desc, tableTop);
    doc.text('Qty', cols.qty, tableTop);
    doc.text('Unit Price', cols.price, tableTop);
    doc.text('Amount', cols.amount, tableTop);
    doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).strokeColor('#ddd').stroke();

    const rowY = tableTop + 22;
    const price = Number(quotation.price);
    doc.font('Helvetica').fontSize(9);
    doc.text(quotation.product_name, cols.desc, rowY, { width: 260 });
    doc.text('1', cols.qty, rowY);
    doc.text(money(price), cols.price, rowY);
    doc.text(money(price), cols.amount, rowY);
    if (quotation.product_description) {
        doc.fontSize(8).fillColor('#777').text(quotation.product_description, cols.desc, rowY + 13, { width: 260 });
        doc.fillColor('#000');
    }

    const totalsTop = rowY + 55;
    doc.moveTo(320, totalsTop).lineTo(545, totalsTop).strokeColor('#ddd').stroke();
    const gst = price * GST_RATE;
    const total = price + gst;

    doc.fontSize(9).font('Helvetica');
    doc.text('Subtotal', cols.price, totalsTop + 8);
    doc.text(money(price), cols.amount, totalsTop + 8);
    doc.text(`GST (${(GST_RATE * 100).toFixed(0)}%)`, cols.price, totalsTop + 24);
    doc.text(money(gst), cols.amount, totalsTop + 24);
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('Total', cols.price, totalsTop + 44);
    doc.text(money(total), cols.amount, totalsTop + 44);

    // Terms
    doc.font('Helvetica-Bold').fontSize(9).text('Terms & Conditions', 50, totalsTop + 90);
    doc.font('Helvetica').fontSize(8).fillColor('#555').text(
        'This quotation is valid for 30 days from the date of issue. Prices are exclusive of applicable ' +
            'taxes unless stated otherwise above. Payment is due within 15 days of invoice. This is a ' +
            'system-generated quotation and does not require a physical signature.',
        50,
        totalsTop + 104,
        { width: 495 }
    );
    doc.fillColor('#000');

    doc.moveDown(4);
    doc.fontSize(9).text('_______________________', 50, doc.y);
    doc.text('Authorized Signatory', 50, doc.y + 2);

    doc.end();
}

module.exports = { renderQuotationPdf };
