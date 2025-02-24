const express = require('express');
const db = require('../database');
const router = express.Router();
const PDFDocument = require('pdfkit');
const fs = require('fs');

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
                    SELECT q.*, c.client_lastname || ' ' || COALESCE(c.client_surname, '') as client_name
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
router.get('/:id', (req, res) => {
    const quoteId = req.params.id;

    db.serialize(() => {
        // Get quote details
        db.get(`
            SELECT q.*, c.client_lastname, c.client_surname
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
                SELECT quote_item_id, item_name, item_description, 
                       item_price, item_discount_price, item_remark
                FROM quote_items 
                WHERE quote_id = ?
                ORDER BY quote_item_id
            `, [quoteId], (err, items) => {
                if (err) {
                    console.error('Error fetching quote items:', err);
                    req.flash('error_msg', 'Error loading quote items');
                    return res.redirect('/quotes');
                }

                res.render('partials/layout', {
                    title: `Quote #${quote.quote_id}`,
                    body: '../quotes/show',
                    quote,
                    items: items || []
                });
            });
        });
    });
});

// Display form to edit a quote
router.get('/:id/edit', (req, res) => {
    const quoteId = req.params.id;

    db.serialize(() => {
        // Get quote details with client info
        db.get(`
            SELECT q.*, c.client_lastname, c.client_surname
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
        client_name, 
        quote_property_address, 
        contact_number, 
        contact_email, 
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
                    client_name = ?, 
                    quote_property_address = ?, 
                    contact_number = ?, 
                    contact_email = ?, 
                    quote_price = ?
                WHERE quote_id = ?`,
                [client_id, client_name, quote_property_address, 
                 contact_number, contact_email, quote_price, quoteId],
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
                                item_remark
                            ) VALUES (?, ?, ?, ?, ?, ?)`
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

// Create new quote
router.post('/create', async (req, res) => {
    const { 
        client_id, 
        client_name,
        quote_property_address,
        contact_number,
        contact_email,
        quote_price,
        items 
    } = req.body;

    if (!client_id || !items || !items.length) {
        return res.json({ 
            success: false, 
            message: 'Missing required fields' 
        });
    }

    try {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Insert quote
            db.run(`
                INSERT INTO quotes (
                    client_id,
                    client_name,
                    quote_property_address,
                    contact_number,
                    contact_email,
                    quote_price,
                    quote_date
                ) VALUES (?, ?,?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [client_id, client_name, quote_property_address, contact_number, contact_email, quote_price],
                function(err) {
                    if (err) {
                        console.error('Error creating quote:', err);
                        db.run('ROLLBACK');
                        return res.json({ 
                            success: false, 
                            message: 'Error creating quote' 
                        });
                    }

                    const quoteId = this.lastID;
                    const stmt = db.prepare(`
                        INSERT INTO quote_items (
                            quote_id,
                            item_name,
                            item_description,
                            item_price,
                            item_discount_price,
                            item_remark
                        ) VALUES (?, ?, ?, ?, ?, ?)`
                    );

                    // Insert quote items
                    items.forEach(item => {
                        stmt.run([
                            quoteId,
                            item.item_name,
                            item.item_description,
                            item.item_price,
                            item.item_discount,
                            item.item_remark
                        ]);
                    });

                    stmt.finalize();
                    db.run('COMMIT');

                    res.json({ 
                        success: true, 
                        quoteId: quoteId 
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
function generateQuotePDF(quoteId, callback) {
    db.get(`
        SELECT q.*, c.*, GROUP_CONCAT(qi.item_name || '|' || 
               qi.item_description || '|' || qi.item_price || '|' || 
               qi.item_discount_price || '|' || qi.item_remark, ';;') as items
        FROM quotes q
        LEFT JOIN clients c ON q.client_id = c.client_id
        LEFT JOIN quote_items qi ON q.quote_id = qi.quote_id
        WHERE q.quote_id = ?
        GROUP BY q.quote_id`,
    [quoteId], (err, quote) => {
        if (err) return callback(err);

        const doc = new PDFDocument();
        const pdfPath = `./uploads/quotes/quote_${quoteId}.pdf`;
        const writeStream = fs.createWriteStream(pdfPath);

        doc.pipe(writeStream);

        // Add company logo
        doc.image('./public/image/smartjob-logo.png', 50, 50, { width: 150 });

        // Add quote header
        doc.fontSize(20).text('Quote', 50, 150);
        doc.fontSize(12).text(`Quote #: ${quoteId}`, 50, 180);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 50, 200);

        // Add client information
        doc.fontSize(14).text('Client Information', 50, 240);
        doc.fontSize(12)
           .text(`Name: ${quote.client_name}`)
           .text(`Address: ${quote.quote_property_address}`)
           .text(`Phone: ${quote.contact_number}`)
           .text(`Email: ${quote.contact_email}`);

        // Add items table
        doc.moveDown(2);
        doc.fontSize(14).text('Items');
        
        let yPosition = doc.y + 20;
        const items = quote.items.split(';;').map(item => item.split('|'));
        
        // Table headers
        doc.fontSize(12);
        doc.text('Item', 50, yPosition);
        doc.text('Description', 150, yPosition);
        doc.text('Price', 350, yPosition);
        doc.text('Discount', 420, yPosition);
        
        yPosition += 20;
        
        // Table rows
        items.forEach(item => {
            doc.text(item[0], 50, yPosition);
            doc.text(item[1], 150, yPosition);
            doc.text(`$${parseFloat(item[2]).toFixed(2)}`, 350, yPosition);
            doc.text(`$${parseFloat(item[3]).toFixed(2)}`, 420, yPosition);
            yPosition += 20;
        });

        // Add totals
        doc.moveDown(2);
        doc.text(`Subtotal: $${quote.quote_price}`, { align: 'right' });
        doc.text(`GST (15%): $${(quote.quote_price * 0.15).toFixed(2)}`, { align: 'right' });
        doc.text(`Total: $${(quote.quote_price * 1.15).toFixed(2)}`, { align: 'right' });

        // Finalize PDF
        doc.end();

        writeStream.on('finish', () => callback(null, pdfPath));
        writeStream.on('error', callback);
    });
}

router.get('/generate-pdf', (req, res) => {
  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="quote.pdf"');

  doc.pipe(res);

  // Add a logo
  doc.image('logo.png', 50, 50, { width: 100 });

  // Add a title
  doc.fontSize(25).text('Quote Details', 50, 150);

  // Add client information
  doc.fontSize(14).text('Client Name: John Doe', 50, 200);
  doc.fontSize(14).text('Email: john.doe@example.com', 50, 220);
  doc.fontSize(14).text('Address: 123 Main St, City, Country', 50, 240);

  // Add a table for products
  const products = [
    { code: '001', description: 'Product 1', price: 50, discount: 5 },
    { code: '002', description: 'Product 2', price: 30, discount: 0 },
  ];

  let y = 280;
  doc.fontSize(12).text('Item Code', 50, y);
  doc.text('Description', 150, y);
  doc.text('Price', 300, y);
  doc.text('Discount', 400, y);
  doc.text('Total', 500, y);

  y += 20;
  products.forEach(product => {
    doc.text(product.code, 50, y);
    doc.text(product.description, 150, y);
    doc.text(`$${product.price.toFixed(2)}`, 300, y);
    doc.text(`$${product.discount.toFixed(2)}`, 400, y);
    doc.text(`$${(product.price - product.discount).toFixed(2)}`, 500, y);
    y += 20;
  });

  // Add totals
  doc.fontSize(14).text('Total Amount: $100.00', 50, y + 20);
  doc.text('GST (15%): $15.00', 50, y + 40);
  doc.text('Final Price: $115.00', 50, y + 60);

  doc.end();
});

module.exports = router;