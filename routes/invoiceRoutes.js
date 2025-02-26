const express = require('express');
const router = express.Router();
const db = require('../database');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Generate unique invoice number
async function generateInvoiceNumber() {
    const date = new Date();
    const prefix = date.getFullYear().toString() +
                  String(date.getMonth() + 1).padStart(2, '0') +
                  String(date.getDate()).padStart(2, '0');
    
    try {
        const lastInvoice = await new Promise((resolve, reject) => {
            db.get(`
                SELECT invoice_number 
                FROM invoices 
                WHERE invoice_number LIKE ?
                ORDER BY invoice_number DESC 
                LIMIT 1
            `, [`${prefix}%`], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        let sequence = 1;
        if (lastInvoice) {
            sequence = parseInt(lastInvoice.invoice_number.slice(-4)) + 1;
        }

        return `${prefix}${String(sequence).padStart(4, '0')}`;
    } catch (err) {
        console.error('Error generating invoice number:', err);
        throw err;
    }
}

// Update the GET / route to handle search
router.get('/', async (req, res) => {
    try {
        const {
            client_name,
            invoice_number,
            date_from,
            date_to
        } = req.query;

        let query = `
            SELECT i.*, c.client_lastname, c.client_surname
            FROM invoices i
            LEFT JOIN clients c ON i.client_id = c.client_id
            WHERE 1=1
        `;
        const params = [];

        if (client_name) {
            query += ` AND (c.client_lastname LIKE ? OR c.client_surname LIKE ?)`;
            params.push(`%${client_name}%`, `%${client_name}%`);
        }

        if (invoice_number) {
            query += ` AND i.invoice_number LIKE ?`;
            params.push(`%${invoice_number}%`);
        }

        if (date_from) {
            query += ` AND i.issue_date >= ?`;
            params.push(date_from);
        }

        if (date_to) {
            query += ` AND i.issue_date <= ?`;
            params.push(date_to);
        }

        query += ` ORDER BY i.create_date DESC`;

        const invoices = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });

        res.render('partials/layout', {
            title: 'Invoices',
            body: '../invoices/index',
            invoices,
            query: req.query
        });
    } catch (err) {
        console.error('Error fetching invoices:', err);
        req.flash('error_msg', 'Error loading invoices');
        res.redirect('/');
    }
});

// Update the new invoice route
router.get('/new', async (req, res) => {
    try {
        const [clients, quotes, company] = await Promise.all([
            new Promise((resolve, reject) => {
                db.all('SELECT * FROM clients WHERE status = "Valid"', [], (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                });
            }),
            new Promise((resolve, reject) => {
                db.all('SELECT * FROM quotes', [], (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                });
            }),
            new Promise((resolve, reject) => {
                db.get('SELECT * FROM companies ORDER BY company_id LIMIT 1', [], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            })
        ]);

        const invoiceNumber = await generateInvoiceNumber();

        res.render('partials/layout', {
            title: 'New Invoice',
            body: '../invoices/new',
            clients,
            quotes,
            company,
            invoiceNumber
        });
    } catch (err) {
        console.error('Error loading new invoice form:', err);
        req.flash('error_msg', 'Error loading form');
        res.redirect('/invoices');
    }
});

// Create new invoice
router.post('/', async (req, res) => {
    const {
        invoice_number,
        quote_id,
        client_id,
        issue_date,
        due_date,
        total_amount,
        tax_amount,
        discount_amount,
        notes,
        items
    } = req.body;

    try {
        // Start transaction
        await new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        // Insert invoice
        const result = await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO invoices (
                    invoice_number,
                    quote_id,
                    client_id,
                    issue_date,
                    due_date,
                    total_amount,
                    tax_amount,
                    discount_amount,
                    notes,
                    create_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                invoice_number,
                quote_id || null,
                client_id,
                issue_date,
                due_date,
                total_amount,
                tax_amount,
                discount_amount,
                notes
            ], function(err) {
                if (err) reject(err);
                resolve(this.lastID);
            });
        });

        // Insert invoice items
        const invoice_id = result;
        const itemsArray = Array.isArray(items) ? items : [items];

        for (const item of itemsArray) {
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO invoice_items (
                        invoice_id,
                        item_name,
                        item_description,
                        item_price,
                        item_discount_price,
                        item_total_price,
                        item_quantity,
                        item_remark,
                        create_date
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `, [
                    invoice_id,
                    item.name,
                    item.description,
                    item.price,
                    item.discount,
                    item.total,
                    item.quantity,
                    item.remark
                ], (err) => {
                    if (err) reject(err);
                    resolve();
                });
            });
        }

        // Commit transaction
        await new Promise((resolve, reject) => {
            db.run('COMMIT', (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        req.flash('success_msg', 'Invoice created successfully');
        res.redirect('/invoices');

    } catch (err) {
        // Rollback on error
        await new Promise((resolve) => {
            db.run('ROLLBACK', resolve);
        });

        console.error('Error creating invoice:', err);
        req.flash('error_msg', 'Error creating invoice');
        res.redirect('/invoices/new');
    }
});


// Generate PDF
router.post('/:id/generate-pdf', async (req, res) => {
    const invoiceId = req.params.id;
    
    try {
        const [invoice, items, company, client] = await Promise.all([
            new Promise((resolve, reject) => {
                db.get(`
                    SELECT * FROM invoices WHERE invoice_id = ?
                `, [invoiceId], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            }),
            new Promise((resolve, reject) => {
                db.all(`
                    SELECT * FROM invoice_items WHERE invoice_id = ?
                `, [invoiceId], (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                });
            }),
            new Promise((resolve, reject) => {
                db.get('SELECT * FROM companies LIMIT 1', [], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            }),
            new Promise((resolve, reject) => {
                db.get(`
                    SELECT * FROM clients 
                    WHERE client_id = (
                        SELECT client_id FROM invoices WHERE invoice_id = ?
                    )
                `, [invoiceId], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            })
        ]);

        // Create PDF document
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const pdfDir = path.join(__dirname, '../public/invoicepdfs');
                if (!fs.existsSync(pdfDir)) {
                    fs.mkdirSync(pdfDir, { recursive: true });
                }
                const pdfPath = path.join(pdfDir, `invoice-${invoiceId}.pdf`);
                const writeStream = fs.createWriteStream(pdfPath);
                doc.pipe(writeStream);

        // Add company logo
        doc.image('./public/image/smartjob-logo.png', 50, 50, { width: 150 });

        // Add company information
        doc.fontSize(10)
           .text(company.company_name, 400, 50, { align: 'right' })
           .text(company.company_address, 400, 65, { align: 'right' })
           .text(`Phone: ${company.company_phone}`, 400, 80, { align: 'right' })
           .text(`Email: ${company.company_email}`, 400, 95, { align: 'right' })
           .text(`GST: ${company.company_gst}`, 400, 110, { align: 'right' });

        // Add invoice title and details
        doc.fontSize(20)
           .text('INVOICE', 50, 150)
           .fontSize(10)
           .text(`Invoice #: ${invoice.invoice_number}`, 50, 180)
           .text(`Date: ${new Date(invoice.issue_date).toLocaleDateString()}`, 50, 195)
           .text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 50, 210);

        // Add client details
        doc.fontSize(10)
           .text('Bill To:', 50, 240)
           .text(`${client.client_lastname} ${client.client_surname}`, 50, 255)
           .text(client.client_address || '', 50, 270)
           .text(`Phone: ${client.client_mobile || ''}`, 50, 285)
           .text(`Email: ${client.client_email || ''}`, 50, 300);

        // Add items table
        let y = 350;
        doc.fontSize(10)
           .text('Item', 50, y)
           .text('Description', 150, y)
           .text('Quantity', 300, y, { width: 50, align: 'right' })
           .text('Price', 370, y, { width: 60, align: 'right' })
           .text('Discount', 450, y, { width: 60, align: 'right' })
           .text('Total', 520, y, { width: 60, align: 'right' });

        doc.moveTo(50, y + 15).lineTo(570, y + 15).stroke();
        y += 30;

        // Add items
        items.forEach(item => {
            doc.text(item.item_name, 50, y)
               .text(item.item_description || '', 150, y)
               .text(item.item_quantity.toString(), 300, y, { width: 50, align: 'right' })
               .text(`$${item.item_price.toFixed(2)}`, 370, y, { width: 60, align: 'right' })
               .text(`$${(item.item_discount_price || 0).toFixed(2)}`, 450, y, { width: 60, align: 'right' })
               .text(`$${item.item_total_price.toFixed(2)}`, 520, y, { width: 60, align: 'right' });
            y += 20;
        });

        // Add totals
        y += 20;
        doc.moveTo(350, y).lineTo(570, y).stroke();
        y += 10;

        doc.text('Subtotal:', 350, y)
           .text(`$${(invoice.total_amount - invoice.tax_amount).toFixed(2)}`, 520, y, { width: 60, align: 'right' });
        y += 20;
        
        doc.text('GST (15%):', 350, y)
           .text(`$${invoice.tax_amount.toFixed(2)}`, 520, y, { width: 60, align: 'right' });
        y += 20;
        
        doc.fontSize(12)
           .text('Total:', 350, y)
           .text(`$${invoice.total_amount.toFixed(2)}`, 520, y, { width: 60, align: 'right' });

        // Add payment details
        y += 50;
        doc.fontSize(10)
           .text('Payment Details:', 50, y)
           .text(`Bank: ${company.bank_name}`, 50, y + 15)
           .text(`Account: ${company.bank_account}`, 50, y + 30);

        // Finalize PDF
        doc.end();

        // Update invoice with PDF path
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE invoices 
                SET invoice_pdf = ?, 
                    update_date = CURRENT_TIMESTAMP 
                WHERE invoice_id = ?
            `, [`/invoicepdfs/invoice-${invoiceId}.pdf`, invoiceId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        res.json({ success: true });

    } catch (err) {
        console.error('Error generating PDF:', err);
        res.status(500).json({ success: false, error: 'Failed to generate PDF' });
    }
});

// Download PDF
router.get('/:id/download-pdf', async (req, res) => {
    try {
        const invoice = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM invoices WHERE invoice_id = ?', [req.params.id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!invoice || !invoice.invoice_pdf) {
            return res.status(404).send('PDF not found');
        }

        const pdfPath = path.join(__dirname, '../public', invoice.invoice_pdf);
        res.download(pdfPath, `invoice-${invoice.invoice_number}.pdf`);
    } catch (err) {
        console.error('Error downloading PDF:', err);
        res.status(500).send('Error downloading PDF');
    }
});

// Show single invoice
router.get('/:id', async (req, res) => {
    try {
        const [invoice, items, client] = await Promise.all([
            new Promise((resolve, reject) => {
                db.get(`
                    SELECT i.*, c.company_name, c.company_address, c.company_phone,
                           c.company_email, c.company_gst, c.bank_name, c.bank_account
                    FROM invoices i
                    LEFT JOIN companies c ON c.company_id = i.company_id
                    WHERE i.invoice_id = ?
                `, [req.params.id], (err, row) => {
                    if (err) reject(err);
                    if (!row) reject(new Error('Invoice not found'));
                    resolve(row);
                });
            }),
            new Promise((resolve, reject) => {
                db.all(`
                    SELECT * FROM invoice_items 
                    WHERE invoice_id = ?
                    ORDER BY invoice_item_id
                `, [req.params.id], (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                });
            }),
            new Promise((resolve, reject) => {
                db.get(`
                    SELECT c.* 
                    FROM clients c
                    INNER JOIN invoices i ON i.client_id = c.client_id
                    WHERE i.invoice_id = ?
                `, [req.params.id], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            })
        ]);

        res.render('partials/layout', {
            title: `Invoice #${invoice.invoice_number}`,
            body: '../invoices/show',
            invoice,
            items,
            client
        });

    } catch (err) {
        console.error('Error fetching invoice:', err);
        req.flash('error_msg', 'Invoice not found');
        res.redirect('/invoices');
    }
});

module.exports = router;