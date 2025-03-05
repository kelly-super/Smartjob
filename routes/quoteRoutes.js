const express = require('express');
const db = require('../database');
const router = express.Router();
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { sendQuoteEmail } = require('../services/emailService');

// Add these routes before other quote routes
router.get('/defaultsliding', async (req, res) => {
    try {
        const [clients, company] = await Promise.all([
            new Promise((resolve, reject) => {
                db.all('SELECT * FROM clients WHERE status = "Valid"', [], (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                });
            }),
            new Promise((resolve, reject) => {
                db.get('SELECT * FROM companies LIMIT 1', [], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            })
        ]);

        // Default items for sliding door quote
        const defaultItems = [
            {
                item_name: 'Door Removal',
                item_description: 'Remove existing sliding door',
                item_price: 180.00,
                item_quantity: 1,
                item_discount_price: 0,
                item_total_price: 180.00
            },
            {
                item_name: 'Supply & Install',
                item_description: 'Supply and install new aluminum sliding door',
                item_price: 1250.00,
                item_quantity: 1,
                item_discount_price: 0,
                item_total_price: 1250.00
            },
            {
                item_name: 'Supply & Install',
                item_description: 'Supply and install new aluminum sliding door',
                item_price: 1250.00,
                item_quantity: 1,
                item_discount_price: 0,
                item_total_price: 1250.00
            }
        ];

        res.render('partials/layout', {
            title: 'New Sliding Door Quote',
            body: '../quotes/new',
            clients,
            company,
            defaultItems: JSON.stringify(defaultItems) // Stringify the items
        });

    } catch (err) {
        console.error('Error loading default sliding quote:', err);
        req.flash('error_msg', 'Error loading form');
        res.redirect('/quotes');
    }
});

router.get('/defaultswing', async (req, res) => {
    try {
        const [clients, company] = await Promise.all([
            new Promise((resolve, reject) => {
                db.all('SELECT * FROM clients WHERE status = "Valid"', [], (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                });
            }),
            new Promise((resolve, reject) => {
                db.get('SELECT * FROM companies LIMIT 1', [], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            })
        ]);

        // Default items for swing door quote
        const defaultItems = [
            {
                name: 'Door Removal',
                description: 'Remove existing swing door',
                price: 150.00,
                quantity: 1
            },
            {
                name: 'Supply & Install',
                description: 'Supply and install new aluminum swing door',
                price: 980.00,
                quantity: 1
            },
            {
                name: 'Door Closer',
                description: 'Heavy duty door closer installation',
                price: 165.00,
                quantity: 1
            },
            {
                name: 'Lock Set',
                description: 'Premium quality lockset with keys',
                price: 95.00,
                quantity: 1
            },
            {
                name: 'Disposal',
                description: 'Removal and disposal of old door',
                price: 120.00,
                quantity: 1
            },
            {
                name: 'Clean Up',
                description: 'Site cleanup and rubbish removal',
                price: 75.00,
                quantity: 1
            }
        ];

        res.render('partials/layout', {
            title: 'New Swing Door Quote',
            body: '../quotes/new',
            clients,
            company,
            defaultItems
        });

    } catch (err) {
        console.error('Error loading default swing quote:', err);
        req.flash('error_msg', 'Error loading form');
        res.redirect('/quotes');
    }
});

// Display all quotes (with search functionality)
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // items per page
        const offset = (page - 1) * limit;
        
        // Build the WHERE clause based on filters
        let whereClause = [];
        let params = [];
        
        if (req.query.client_id) {
            whereClause.push('q.client_id = ?');
            params.push(req.query.client_id);
        }
        
        if (req.query.property_address) {
            whereClause.push('q.quote_property_address LIKE ?');
            params.push(`%${req.query.property_address}%`);
        }
        
        if (req.query.dateFrom) {
            whereClause.push('DATE(q.quote_date) >= DATE(?)');
            params.push(req.query.dateFrom);
        }
        
        if (req.query.dateTo) {
            whereClause.push('DATE(q.quote_date) <= DATE(?)');
            params.push(req.query.dateTo);
        }
        
        const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';
        
        // Get total count for pagination
        const [totalCount, clients, quotes] = await Promise.all([
            new Promise((resolve, reject) => {
                db.get(`SELECT COUNT(*) as total FROM quotes q ${whereSQL}`, 
                params, (err, result) => {
                    if (err) reject(err);
                    else resolve(result.total);
                });
            }),
            new Promise((resolve, reject) => {
                db.all('SELECT client_id, client_lastname, client_surname FROM clients', 
                [], (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            }),
            new Promise((resolve, reject) => {
                db.all(`
                    SELECT q.*, c.client_lastname || ' ' || COALESCE(c.client_surname, '') as client_name,c.client_mobile 
                    FROM quotes q
                    LEFT JOIN clients c ON q.client_id = c.client_id
                    ${whereSQL}
                    ORDER BY q.quote_date DESC
                    LIMIT ? OFFSET ?
                `, [...params, limit, offset], (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            })
        ]);

        // Calculate pagination values
        const totalPages = Math.ceil(totalCount / limit);
        
        // Build search params for pagination links
        const searchParams = new URLSearchParams();
        if (req.query.client_id) searchParams.append('client_id', req.query.client_id);
        if (req.query.property_address) searchParams.append('property_address', req.query.property_address);
        if (req.query.dateFrom) searchParams.append('dateFrom', req.query.dateFrom);
        if (req.query.dateTo) searchParams.append('dateTo', req.query.dateTo);
        
        res.render('partials/layout', {
            title: 'Quotes',
            body: '../quotes/index',
            quotes,
            clients,
            currentPage: page,
            totalPages,
            query: req.query,
            searchParams: searchParams.toString() ? '&' + searchParams.toString() : ''
        });
    } catch (err) {
        console.error('Error:', err);
        req.flash('error_msg', 'Error loading quotes');
        res.redirect('/');
    }
});

// Display form to create a new quote
router.get('/new', (req, res) => {
  res.render('partials/layout', {
    title: 'Create New Quote',
    body: '../quotes/new'
  });
});

router.post('/createQuote', (req, res) => {
  console.log("Request Body:", req.body); // Debug: Log the request body

  const { client_id, client_name, quote_property_address, contact_number, contact_email, quote_price, item_list } = req.body;

  // Insert into quotes table
  const quoteSql = `
    INSERT INTO quotes (client_id, client_name, quote_property_address, contact_number, contact_email, quote_price)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  console.log("Executing SQL:", quoteSql); // Debug: Log the SQL query

  db.run(quoteSql, [client_id, client_name, quote_property_address, contact_number, contact_email, quote_price], function (err) {
    if (err) {
      console.error("Error inserting into quotes table:", err); // Debug: Log the error
      req.flash('error_msg', 'Error creating quote');
      return res.redirect('/quotes/new');
    }

    const quoteId = this.lastID;
    console.log("Quote created with ID:", quoteId); // Debug: Log the quote ID

    // Insert into quote_items table
    const items = item_list.split(',').filter(Boolean);
    const itemSql = `
      INSERT INTO quote_items (quote_id, item_name, item_description, item_price, item_discount_price, remark, create_date)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    Promise.all(items.map(item => {
      const [item_name, item_description, item_price, item_discount_price, remark] = item.split('|');
      return new Promise((resolve, reject) => {
        db.run(itemSql, [quoteId, item_name, item_description, item_price, item_discount_price, remark], (err) => {
          if (err) {
            console.error("Error inserting into quote_items table:", err); // Debug: Log the error
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }))
      .then(() => {
        console.log("All items inserted successfully"); // Debug: Log success
        req.flash('success_msg', 'Quote created successfully!');
        res.redirect(`/quotes/${quoteId}`);
      })
      .catch(err => {
        console.error("Error inserting items:", err); // Debug: Log the error
        req.flash('error_msg', 'Error adding items to quote');
        res.redirect('/quotes/new');
      });
  });
});

// Display a single quote
// Show single quote
router.get('/:id', async (req, res) => {
    try {
        const [quote, items, company] = await Promise.all([
            // Get quote with client details
            new Promise((resolve, reject) => {
                db.get(`
                    SELECT q.*, 
                           c.client_lastname, 
                           c.client_surname,
                           c.client_mobile,
                           c.client_email,
                           c.client_address
                    FROM quotes q
                    LEFT JOIN clients c ON c.client_id = q.client_id
                    WHERE q.quote_id = ?
                `, [req.params.id], (err, row) => {
                    if (err) reject(err);
                    if (!row) reject(new Error('Quote not found'));
                    resolve(row);
                });
            }),
            // Get quote items
            new Promise((resolve, reject) => {
                db.all(`
                    SELECT 
                        quote_item_id,
                        item_name,
                        item_description,
                        item_price,
                        item_quantity,
                        item_discount_price,
                        COALESCE(item_total_price, (item_price * item_quantity) - COALESCE(item_discount_price, 0)) as item_total_price
                    FROM quote_items 
                    WHERE quote_id = ?
                    ORDER BY quote_item_id
                `, [req.params.id], (err, rows) => {
                    if (err) reject(err);
                    resolve(rows || []);
                });
            }),
            // Get company details
            new Promise((resolve, reject) => {
                db.get('SELECT * FROM companies LIMIT 1', [], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            })
        ]);

        res.render('partials/layout', {
            title: `Quote #${quote.quote_number}`,
            body: '../quotes/show',
            quote,
            items,
            company
        });

    } catch (err) {
        console.error('Error fetching quote:', err);
        req.flash('error_msg', 'Quote not found');
        res.redirect('/quotes');
    }
});



// Display form to edit a quote
router.get('/:id/edit', (req, res) => {
    const quoteId = req.params.id;

    db.serialize(() => {
        // Get quote details with client info
        db.get(`
            SELECT q.*, c.client_lastname, c.client_surname,c.client_mobile,c.client_email,c.client_address 
            FROM quotes q
            LEFT JOIN clients c ON q.client_id = c.client_id
            WHERE q.quote_id = ?
        `, [quoteId], (err, quote) => {
            if (err || !quote) {
                req.flash('error_msg', 'Quote not found');
                return res.redirect('/quotes');
            }

            // Get quote items
            db.all(`
                SELECT *
                FROM quote_items 
                WHERE quote_id = ?
                ORDER BY quote_item_id
            `, [quoteId], (err, items) => {
                if (err) {
                    console.error('Error fetching quote items:', err);
                    req.flash('error_msg', 'Error loading quote items');
                    return res.redirect('/quotes');
                }

                // Get all clients for the dropdown
                db.all(`
                    SELECT client_id, client_lastname, client_surname
                    FROM clients
                    ORDER BY client_lastname, client_surname
                `, [], (err, clients) => {
                    if (err) {
                        console.error('Error fetching clients:', err);
                        req.flash('error_msg', 'Error loading clients');
                        return res.redirect('/quotes');
                    }

                    res.render('partials/layout', {
                        title: 'Edit Quote',
                        body: '../quotes/edit',
                        quote,
                        items: items || [],
                        clients: clients || []
                    });
                });
            });
        });
    });
});

// Update a quote
router.post('/:id/edit', (req, res) => {
    const quoteId = req.params.id;
    const { 
        client_id, 
        quote_property_address, 
        contact_number, 
        contact_email, 
        total_amount,
        tax_amount,
        quote_price,
        items 
    } = req.body;

    try {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Update quote header
            db.run(`
                UPDATE quotes 
                SET client_id = ?, 
                   quote_property_address = ?, 
                    contact_number = ?, 
                    contact_email = ?, 
                    total_amount = ?,
                    tax_amount = ?,
                    quote_price = ?
                WHERE quote_id = ?`,
                [client_id, quote_property_address, 
                 contact_number, contact_email, total_amount, tax_amount, quote_price, quoteId],
                function(err) {
                    if (err) {
                        console.error('Error updating quote:', err);
                        db.run('ROLLBACK');
                        return res.json({ 
                            success: false, 
                            message: 'Error updating quote'
                        });
                    }

                    // Delete existing items
                    db.run('DELETE FROM quote_items WHERE quote_id = ?', [quoteId], (err) => {
                        if (err) {
                            console.error('Error deleting old items:', err);
                            db.run('ROLLBACK');
                            return res.json({
                                success: false,
                                message: 'Error updating quote items'
                            });
                        }

                        // Insert updated items
                        const stmt = db.prepare(`
                            INSERT INTO quote_items (
                                quote_id,
                                item_name,
                                item_description,
                                item_price,
                                item_discount_price,
                                item_total_price,
                                item_remark
                            ) VALUES (?, ?, ?, ?, ?, ?, ?)`
                        );

                        try {
                            // Items is already an array, no need to parse
                            items.forEach(item => {
                                stmt.run([
                                    quoteId,
                                    item.item_name,
                                    item.item_description,
                                    item.item_price,
                                    item.item_discount_price,
                                    item.item_total_price,
                                    item.item_remark
                                ]);
                            });

                            stmt.finalize();
                            db.run('COMMIT');

                            res.json({
                                success: true,
                                quoteId: quoteId,
                                message: 'Quote updated successfully'
                            });
                        } catch (err) {
                            console.error('Error saving items:', err);
                            db.run('ROLLBACK');
                            stmt.finalize();
                            res.json({
                                success: false,
                                message: 'Error saving quote items'
                            });
                        }
                    });
                }
            );
        });
    } catch (err) {
        console.error('Error:', err);
        res.json({
            success: false,
            message: 'Server error'
        });
    }
});

// Delete a quote
router.post('/:id/delete', (req, res) => {
  const quoteId = req.params.id;
  const sql = 'DELETE FROM quotes WHERE quote_id = ?';

  db.run(sql, [quoteId], (err) => {
    if (err) {
      console.error(err);
      req.flash('error_msg', 'Error deleting quote');
    } else {
      req.flash('success_msg', 'Quote deleted successfully!');
    }
    res.redirect('/quotes');
  });
});

async function generateQuoteNumber() {
    const date = new Date();
    const prefix = date.getFullYear().toString() +
                  String(date.getMonth() + 1).padStart(2, '0') +
                  String(date.getDate()).padStart(2, '0');
    
    try {
        const lastQuote = await new Promise((resolve, reject) => {
            db.get(`
                SELECT quote_number 
                FROM quotes 
                WHERE quote_number LIKE ?
                ORDER BY quote_number DESC 
                LIMIT 1
            `, [`${prefix}%`], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        let sequence = 1;
        if (lastQuote) {
            sequence = parseInt(lastQuote.quote_number.slice(-4)) + 1;
        }

        return `${prefix}${String(sequence).padStart(4, '0')}`;
    } catch (err) {
        console.error('Error generating quote number:', err);
        throw err;
    }
}
// Create new quote
router.post('/create', async (req, res) => {
    const {
        client_id,
        quote_property_address,
        contact_number,
        contact_email,
        total_amount,
        tax_amount,
        items
    } = req.body;
 console.log("quote req.body=========",req.body);
    try {
        // Start transaction
        await new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', err => {
                if (err) reject(err);
                resolve();
            });
        });

        // Generate quote number
        const quoteNumber = await generateQuoteNumber();

        // Insert quote
        const result = await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO quotes (
                    client_id,
                    quote_number,
                    quote_property_address,
                    contact_number,
                    contact_email,
                    total_amount,
                    tax_amount, 
                                    quote_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                client_id,
                quoteNumber,
                quote_property_address,
                contact_number,
                contact_email,
                total_amount,
                tax_amount
            ], function(err) {
                if (err) reject(err);
                resolve(this.lastID);
            });
        });
console.log("result=========",result);
        // Insert items
        for (const item of items) {
            console.log("item=========",item);
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO quote_items (
                        quote_id,
                        item_name,
                        item_description,
                        item_price,
                        item_quantity,
                        item_discount_price,
                        item_total_price,
                        create_date
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `, [
                    result,
                    item.item_name,
                    item.item_description,
                    item.item_price,
                    item.item_quantity,
                    item.item_discount_price,
                    item.item_total_price
                ], err => {
                    if (err) reject(err);
                    resolve();
                });
            });
        }

        // Commit transaction
        await new Promise((resolve, reject) => {
            db.run('COMMIT', err => {
                if (err) reject(err);
                resolve();
            });
        });

        res.json({
            success: true,
            quoteId: result,
            message: 'Quote created successfully'
        });

    } catch (err) {
        // Rollback on error
        await new Promise(resolve => {
            db.run('ROLLBACK', resolve);
        });

        console.error('Error creating quote:', err);
        res.status(500).json({
            success: false,
            message: err.message || 'Failed to create quote'
        });
    }
});

// View quote PDF
router.get('/:id/pdf', (req, res) => {
    const quoteId = req.params.id;
    
    db.get('SELECT quote_pdf FROM quotes WHERE quote_id = ?', [quoteId], (err, quote) => {
        if (err || !quote || !quote.quote_pdf) {
            return res.status(404).send('PDF not found');
        }
        
        const pdfPath = quote.quote_pdf;
        res.sendFile(pdfPath);
    });
});

// Helper function to generate PDF
async function generateQuotePDF(quoteId) {
    try {
        // Get quote, items and company profile data
        const [quote, items, profile] = await Promise.all([
            new Promise((resolve, reject) => {
                db.get(`
                    SELECT q.*, c.client_lastname, c.client_surname, 
                           c.client_address, c.client_mobile, c.client_email
                    FROM quotes q
                    LEFT JOIN clients c ON q.client_id = c.client_id
                    WHERE q.quote_id = ?
                `, [quoteId], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            }),
            new Promise((resolve, reject) => {
                db.all(`
                    SELECT *
                    FROM quote_items
                    WHERE quote_id = ?
                    ORDER BY quote_item_id
                `, [quoteId], (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                });
            }),
            new Promise((resolve, reject) => {
                db.get('SELECT * FROM companies LIMIT 1', [], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            })
        ]);

        const doc = new PDFDocument({
            size: 'A4',
            margin: 50
        });
console.log("profile.company_email=========",profile.company_email);
        // Set up the PDF file
        const pdfDir = path.join(__dirname, '../public/quotepdfs');
        if (!fs.existsSync(pdfDir)) {
            fs.mkdirSync(pdfDir, { recursive: true });
        }
        const pdfPath = path.join(pdfDir, `quote-${quoteId}.pdf`);
        const writeStream = fs.createWriteStream(pdfPath);
        doc.pipe(writeStream);

        // Add company logo and header
      //  doc.image('./public/image/smartjob-logo.png', 50, 50, { width: 80 });
      doc.image(profile.company_logo, 50, 50, { width: 80 });
        // Add company information (right-aligned)
        doc.fontSize(10)
           .text(profile.company_name, 400, 50, { align: 'right' })
           .text(profile.company_address, 400, 65, { align: 'right' })
           .text(`Phone: ${profile.company_phone}`, 400, 80, { align: 'right' })
           .text(`Email: ${profile.company_email}`, 400, 95, { align: 'right' })
           .text(`GST: ${profile.company_gst}`, 400, 110, { align: 'right' });

        // Add quote title
        doc.fontSize(20)
           .text('QUOTE', 50, 150, { align: 'center' })
           .moveDown();

        // Create two columns for Quote ID and Bill To
        doc.fontSize(12);

        // Left column - Quote details
        doc.text('Quote Details:', 50, 200)
           .fontSize(10)
           .text(`Quote #: ${quote.quote_number}`, 50, 220)
           .text(`Date: ${new Date().toLocaleDateString()}`, 50, 235)
           .text(`Property: ${quote.quote_property_address || ''}`, 50, 250);

        // Right column - Client information
        doc.fontSize(12)
           .text('Bill To:', 300, 200)
           .fontSize(10)
           .text(`${quote.client_lastname} ${quote.client_surname}`, 300, 220)
           .text(quote.client_address || '', 300, 235)
           .text(`Phone: ${quote.client_mobile || ''}`, 300, 250)
           .text(`Email: ${quote.client_email || ''}`, 300, 265);

        // Add items table with more space between columns
        let y = 320; // Moved down to accommodate the header sections

        // Add table headers with background
        doc.fillColor('#f0f0f0')
           .rect(50, y, 500, 20)
           .fill()
           .fillColor('#000000');

        // Table headers
        doc.fontSize(10)
           .text('Item', 60, y + 5)
           .text('Description', 160, y + 5)
           .text('Price', 350, y + 5, { width: 70, align: 'right' })
           .text('Discount', 420, y + 5, { width: 70, align: 'right' })
           .text('Amount', 490, y + 5, { width: 60, align: 'right' });

        // Add horizontal line
        doc.moveTo(50, y + 20).lineTo(550, y + 20).stroke();
        y += 30;

        // Table rows with aligned columns
        let subtotal = 0;
        items.forEach(item => {
            const amount = item.item_price - (item.item_discount_price || 0);
            subtotal += amount;

            doc.text(item.item_name, 60, y, { width: 90 })
               .text(item.item_description, 160, y, { width: 180 })
               .text(`$${item.item_price.toFixed(2)}`, 350, y, { width: 70, align: 'right' })
               .text(`$${(item.item_discount_price || 0).toFixed(2)}`, 420, y, { width: 70, align: 'right' })
               .text(`$${amount.toFixed(2)}`, 490, y, { width: 60, align: 'right' });
            
            y += 25; // Increased spacing between rows
        });

        // Add totals section with better formatting
        const gst = subtotal * 0.15;
        const total = subtotal + gst;

        y += 10;
        doc.moveTo(350, y).lineTo(550, y).stroke();
        y += 10;

        // Right-aligned totals
        doc.fontSize(10)
           .text('Subtotal:', 350, y, { width: 140, align: 'right' })
           .text(`$${subtotal.toFixed(2)}`, 490, y, { width: 60, align: 'right' });
        y += 20;
        doc.text('GST (15%):', 350, y, { width: 140, align: 'right' })
           .text(`$${gst.toFixed(2)}`, 490, y, { width: 60, align: 'right' });
        y += 20;
        doc.fontSize(12)
           .text('Total:', 350, y, { width: 140, align: 'right' })
           .text(`$${total.toFixed(2)}`, 490, y, { width: 60, align: 'right' });

        // Add quote notes
        if (profile.quote_notes) {
            y += 50;
            doc.fontSize(10)
               .text('Terms & Conditions:', 50, y)
               .text(profile.quote_notes, 50, y + 15);
        }

        // Add banking details
        y += 100;
        doc.fontSize(10)
           .text('Banking Details:', 50, y)
           .text(`Bank: ${profile.bank_name}`, 50, y + 15)
           .text(`Account: ${profile.bank_account}`, 50, y + 30);

        doc.end();
        console.log("pdfPath=========",pdfPath);
        // Update quote record with PDF path
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE quotes 
                SET quote_pdf = ?, 
                    quote_date = CURRENT_TIMESTAMP 
                WHERE quote_id = ?
            `, [`/quotepdfs/quote-${quoteId}.pdf`, quoteId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        return pdfPath;

    } catch (err) {
        console.error('Error generating PDF:', err);
        throw err;
    }
}

// Generate PDF
router.post('/:id/generate-pdf', async (req, res) => {
    const quoteId = req.params.id;
    
    try {
        generateQuotePDF(quoteId);

        res.json({ success: true });
    } catch (err) {
        console.error('PDF generation error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error generating PDF' 
        });
    }
});

// Download PDF
router.get('/:id/download-pdf', async (req, res) => {
    const quoteId = req.params.id;
    
    try {
        const quote = await new Promise((resolve, reject) => {
            db.get('SELECT quote_pdf FROM quotes WHERE quote_id = ?', [quoteId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!quote || !quote.quote_pdf) {
            return res.status(404).send('PDF not found');
        }

        const pdfPath = path.join(__dirname, '../public', quote.quote_pdf);
        res.download(pdfPath, `quote-${quoteId}.pdf`);
    } catch (err) {
        console.error('PDF download error:', err);
        res.status(500).send('Error downloading PDF');
    }
});

// Add this new route to get quote details
router.get('/:id/details', async (req, res) => {
    try {
        const quoteId = req.params.id;
        
        const [quote, items] = await Promise.all([
            new Promise((resolve, reject) => {
                db.get(`
                    SELECT * FROM quotes 
                    WHERE quote_id = ?
                `, [quoteId], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            }),
            new Promise((resolve, reject) => {
                db.all(`
                    SELECT * FROM quote_items 
                    WHERE quote_id = ?
                    ORDER BY quote_item_id
                `, [quoteId], (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                });
            })
        ]);

        if (!quote) {
            return res.status(404).json({ error: 'Quote not found' });
        }

        res.json({ quote, items });
        
    } catch (err) {
        console.error('Error fetching quote details:', err);
        res.status(500).json({ error: 'Error fetching quote details' });
    }
});

// Add this new route
router.post('/:id/send-email', async (req, res) => {
    try {
        const quoteId = req.params.id;
        
        // Get quote details with client email
        const quote = await new Promise((resolve, reject) => {
            db.get(`
                SELECT q.*, c.client_email, 
                       c.client_lastname || ' ' || c.client_surname as client_name
                FROM quotes q
                LEFT JOIN clients c ON c.client_id = q.client_id
                WHERE q.quote_id = ?
            `, [quoteId], (err, row) => {
                if (err) reject(err);
                if (!row) reject(new Error('Quote not found'));
                resolve(row);
            });
        });

        if (!quote.quote_pdf) {
            throw new Error('PDF not generated yet');
        }

        const pdfPath = path.join(__dirname, '../public', quote.quote_pdf);
        
        const result = await sendQuoteEmail(quote, pdfPath, quote.client_email);
        
        if (result.success) {
            res.json({ success: true, message: 'Email sent successfully' });
        } else {
            throw new Error(result.error);
        }

    } catch (err) {
        console.error('Error sending email:', err);
        res.status(500).json({ 
            success: false, 
            message: err.message || 'Failed to send email' 
        });
    }
});

module.exports = router;