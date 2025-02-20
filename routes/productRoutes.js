const express   = require('express');
const db        = require('../database');
const router    = express.Router();

// create a new product (form)
router.get('/new', (req, res) => {
    res.render('partials/layout', { title: 'New product', body: '../products/new' });
})
//create a new product(submit)
router.post('/', async (req, res) => {
    const { product_code, product_name, product_description, product_price,  note } = req.body;
    try {
        const result = await db.run(
            'INSERT INTO products (product_code, product_name, product_description, product_price,  note) VALUES (?, ?, ?, ?, ?)', 
            [product_code, product_name, product_description, product_price, note]
        );
        req.flash('success_msg', 'Product created successfully!');
    res.redirect('/products');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error creating product');
    res.redirect('/products/new');
    }               
});

//get all products
router.get('/products', (req, res) => {
    // Fetch jobs from the database (example)
    db.all("SELECT * FROM products", [], (err, products) => {
        if (err) {
            res.status(500).send("Error fetching products");
        } else {
            // Render the `index.ejs` file and pass the `body` variable
            res.render('partials/layout', { 
                title: 'Products', 
                body: '../products/index', // Pass the path to the content file
                products: products 
            });
        }
    });
}); 
//read a single product
router.get('/:id', async (req, res) => {
    db.get('SELECT * FROM products WHERE product_id = ?', [req.params.id], (err, product) => {
        if (err) {
            console.error(err);
            res.status(500).send('Database error');
        } else if (product) {
            res.render('partials/layout', { 
                title: 'Products', 
                body: '../products/show', // Pass the path to the content file
                product: product 
            });
        } else {
            req.flash('error_msg', 'cannot find product');
            res.redirect('/products');
        }
    });
});

//Update a product (form)
router.get('/:id/edit', (req, res) => {
    db.get('SELECT * FROM products WHERE product_id = ?', [req.params.id], (err, product) => {
        if (err) {
            console.error(err);
            req.flash('error_msg', 'Database error');
            res.redirect('/products');
        } else if (product) {
            res.render('partials/layout', { 
                title: 'Products', 
                body: '../products/edit', // Pass the path to the content file
                product: product 
            });
        } else {
            req.flash('error_msg', 'cannot find product');
            res.redirect('/products');
        }
    });
})
//update a product(sumbit)
router.post('/:id/edit', (req, res) => {
    const { product_name, product_code, product_description, product_price,  note,status } = req.body;
  
    console.log('Executing SQL:', 'UPDATE products SET product_code = ?, product_name = ?, product_description = ?, product_price = ?, note = ?, status = ? WHERE product_id = ?');
    console.log('Request Body:', req.body);
    db.run(
      'UPDATE products SET product_name = ?, product_code = ?, product_description = ?, product_price = ?,  note = ?, status = ? WHERE product_ID = ?',
      [product_name, product_code, product_description, product_price,  note, status, req.params.id],
      (err) => {
        if (err) {
            console.error(err);
            res.status(500).render('partials/layout', {
                title: 'Error',
                body: '../error',
                message: 'Error updating product'
            });
        } else {
            req.flash('success_msg', 'Product updated successfully!');
            res.redirect(`/products/${req.params.id}`);
        }
    }
    );
  });

//delete a product
router.delete('/:id/delete', (req, res) => {
    db.run('DELETE FROM products WHERE product_id = ?', [req.params.id], (err) => {
        if (err) {
            console.error(err);
            res.status(500).send('Database error');
        } else {
            res.json({ message: 'Product deleted successfully' });
        }
    });
});


// Search for products
router.get('/search', (req, res) => {
    const query = req.query.q || '';
    const sql = `
      SELECT * FROM products
      WHERE product_name LIKE ? OR product_code LIKE ?
    `;
    const searchTerm = `%${query}%`;
  console.log('Search query:', sql);
    db.all(sql, [searchTerm, searchTerm], (err, products) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching products' });
      } else {
        console.log('products found:', products);
        res.json(products);
      }
    });
  });

module.exports = router;
