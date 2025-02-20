const express = require('express');
const db = require('../database');
const router = express.Router();

// Display all quotes (with search functionality)
router.get('/', (req, res) => {
  const searchQuery = req.query.search || ''; // Get search query from URL
  const sql = `
    SELECT * FROM quotes
    WHERE client_name LIKE ? OR quote_property_address LIKE ?
  `;
  const searchTerm = `%${searchQuery}%`;

  db.all(sql, [searchTerm, searchTerm], (err, quotes) => {
    if (err) {
      console.error(err);
      req.flash('error_msg', 'Error fetching quotes');
      res.redirect('/');
    } else {
      res.render('partials/layout', {
        title: 'Quotes',
        body: '../quotes/index',
        quotes: quotes,
        searchQuery: searchQuery
      });
    }
  });
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
  const sql = `
    SELECT * FROM quotes
    LEFT JOIN quote_items ON quotes.quote_id = quote_items.quote_id
    WHERE quotes.quote_id = ?
  `;

  db.all(sql, [quoteId], (err, rows) => {
    if (err) {
      console.error(err);
      req.flash('error_msg', 'Error fetching quote');
      res.redirect('/quotes');
    } else if (rows.length > 0) {
      const quote = {
        ...rows[0],
        products: rows.map(row => ({
          product_id: row.product_id,
          description: row.description,
          remark: row.remark
        }))
      };
      res.render('partials/layout', {
        title: 'Quote Details',
        body: '../quotes/show',
        quote: quote
      });
    } else {
      req.flash('error_msg', 'Quote not found');
      res.redirect('/quotes');
    }
  });
});

// Display form to edit a quote
router.get('/:id/edit', (req, res) => {
  const quoteId = req.params.id;
  const sql = 'SELECT * FROM quotes WHERE quote_id = ?';

  db.get(sql, [quoteId], (err, quote) => {
    if (err) {
      console.error(err);
      req.flash('error_msg', 'Error fetching quote');
      res.redirect('/quotes');
    } else if (quote) {
      res.render('partials/layout', {
        title: 'Edit Quote',
        body: '../quotes/edit',
        quote: quote
      });
    } else {
      req.flash('error_msg', 'Quote not found');
      res.redirect('/quotes');
    }
  });
});

// Update a quote
router.post('/:id/edit', (req, res) => {
    const quoteId = req.params.id;
    const { client_id, client_name, quote_property_address, contact_number, contact_email, quote_price, selected_products } = req.body;
  
    // Update the quote
    const quoteSql = `
      UPDATE quotes
      SET client_id = ?, client_name = ?, quote_property_address = ?, contact_number = ?, contact_email = ?, quote_price = ?
      WHERE quote_id = ?
    `;
  
    db.run(quoteSql, [client_id, client_name, quote_property_address, contact_number, contact_email, quote_price, quoteId], (err) => {
      if (err) {
        console.error(err);
        req.flash('error_msg', 'Error updating quote');
        res.redirect(`/quotes/${quoteId}/edit`);
      } else {
        // Delete existing quote_products
        db.run('DELETE FROM quote_products WHERE quote_id = ?', [quoteId], (err) => {
          if (err) {
            console.error(err);
            req.flash('error_msg', 'Error updating products');
            res.redirect(`/quotes/${quoteId}/edit`);
          } else {
            // Insert new quote_products
            const productIds = selected_products.split(',').filter(Boolean);
            const productSql = `
              INSERT INTO quote_items (quote_id, product_id, create_date)
              VALUES (?, ?, CURRENT_TIMESTAMP)
            `;
  
            Promise.all(productIds.map(productId => {
              return new Promise((resolve, reject) => {
                db.run(productSql, [quoteId, productId], (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              });
            }))
              .then(() => {
                req.flash('success_msg', 'Quote updated successfully!');
                res.redirect(`/quotes/${quoteId}`);
              })
              .catch(err => {
                console.error(err);
                req.flash('error_msg', 'Error updating products');
                res.redirect(`/quotes/${quoteId}/edit`);
              });
          }
        });
      }
    });
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