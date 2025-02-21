// routes/clientRoutes.js
const express = require('express');
const db = require('../database');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse');
const fs = require('fs');

// Configure multer for file upload
const upload = multer({ dest: 'uploads/' });

// Create a new client (Form)
router.get('/new', (req, res) => {
  res.render('partials/layout', { title: 'New Client', body: '../clients/new' });
});

// Search for clients
router.get('/search', (req, res) => {
  const query = req.query.q || '';
  console.log('Search query:', query); // Debugging line
  const sql = `
    SELECT * FROM clients
    WHERE client_surname LIKE ? OR client_id LIKE ? OR client_lastname LIKE ?
  `;
  console.log('Search query:', sql); 
  const searchTerm = `%${query}%`;

  db.all(sql, [searchTerm, searchTerm, searchTerm], (err, clients) => {
    if (err) {
      console.error('Database error:', err); // Debugging line
      res.status(500).json({ error: 'Error fetching clients' });
    } else {
      console.log('Clients found:', clients); // Debugging line
      res.json(clients);
    }
  });
});

// Create a new client (Submit)
router.post('/', (req, res) => {
  console.log("hhhhhhhhhh"+req.body);
  const { client_lastname, client_surname, client_address, client_postcode, client_mobile, client_email,remark } = req.body;

  // Log received data for debugging
  console.log('Received client data:', {
    client_lastname,
    client_surname,
    client_mobile,
    client_email,
    client_address
  });
  db.run(
    'INSERT INTO clients (client_lastname, client_surname, client_address, client_postcode, client_mobile, client_email, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [client_lastname, client_surname, client_address, client_postcode, client_mobile, client_email, remark],
    (err) => {
      if (err) throw err;
      req.flash('success_msg', 'Client created successfully!');
      res.redirect('clients/');
    }
  );
});


router.post('/create', (req, res) => {
  console.log("9999999999999999"+req.body);
  const { client_lastname, client_surname, client_mobile, client_email, client_address } = req.body;

  // Log received data for debugging
  console.log('Received client data:', {
    client_lastname,
    client_surname,
    client_mobile,
    client_email,
    client_address
  });

  const sql = `
    INSERT INTO clients (client_lastname, client_surname, client_mobile, client_email, client_address)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.run(sql, [client_lastname, client_surname, client_mobile, client_email, client_address], function (err) {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Error adding client' });
    } else {
      res.json({ client_id: this.lastID });
    }
  });
});

// Read all clients
router.get('/clients', (req, res) => {
  // Fetch jobs from the database (example)
  db.all("SELECT * FROM clients", [], (err, clients) => {
      if (err) {
          res.status(500).send("Error fetching clients");
      } else {
          // Render the `index.ejs` file and pass the `body` variable
          res.render('partials/layout', { 
              title: 'Clients', 
              body: 'clients/index', // Pass the path to the content file
              clients: clients 
          });
      }
  });
});


// Import clients from CSV
router.post('/import', upload.single('clientsFile'), (req, res) => {
  console.log('Received file:'); // Debugging line
  if (!req.file) {
    req.flash('error_msg', 'No file uploaded');
    return res.redirect('/clients');
  }

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(parse({
      columns: true,
      skip_empty_lines: true
    }))
    .on('data', (data) => results.push(data))
    .on('end', () => {
      // Process each row
      const insertPromises = results.map(client => {
        return new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO clients (
              client_lastname, client_surname, client_mobile, 
              client_email, client_address, client_postcode, remark
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              client.client_lastname,
              client.client_surname,
              client.client_mobile,
              client.client_email,
              client.client_address,
              client.client_postcode,
              client.remark
            ],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      Promise.all(insertPromises)
        .then(() => {
          // Clean up the uploaded file
          fs.unlinkSync(req.file.path);
          req.flash('success_msg', `Successfully imported ${results.length} clients`);
          res.redirect('/clients');
        })
        .catch(err => {
          console.error('Import error:', err);
          req.flash('error_msg', 'Error importing clients');
          res.redirect('/clients');
        });
    });
});

// Download CSV template
router.get('/template', (req, res) => {
  const headers = [
    'client_lastname',
    'client_surname',
    'client_mobile',
    'client_email',
    'client_address',
    'client_postcode',
    'remark'
  ].join(',');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=clients-template.csv');
  res.send(headers);
});
// Get all clients
router.get('/', (req, res) => {
  db.all("SELECT * FROM clients", [], (err, clients) => {
    if (err) return res.status(500).send("Error fetching clients");
    res.render('partials/layout', {
      title: 'Clients',
      body: '../clients/index', // Path relative to views directory
      clients: clients
    });
  });
});
// Update a client (Form)
router.get('/:id/edit', (req, res) => {
  console.log('Fetching client with ID:', req.params.id);
  db.get('SELECT * FROM clients WHERE client_id = ?', [req.params.id], (err, client) => {
    if (err){
      res.status(500).send("Error fetching clients");
  } else {
    console.log("99999999999999");
    res.render('partials/layout', { title: 'Edit client', body: '../clients/edit', clientObj: client });
  }

});
});

// Get single client
router.get('/:id', (req, res) => {
  console.log('Fetching client with ID:', req.params.id);
  db.get('SELECT * FROM clients WHERE client_id = ?', [req.params.id], (err, client) => {
    if (err) {
      console.log(err);
      return res.status(500).send('Database error');
    } else {
      console.log("8888888888888888");
      const path = '../clients/show';
      console.log('Body path:', path); // Log the body path

      res.render('partials/layout', {
        title: 'Clients',
        body: path, // Ensure the path is correct
        clientObj: client
      });
    }
  });
});

// Update a client (Submit)
router.post('/:id', (req, res) => {
  const { client_lastname, client_surname, client_address, client_postcode, client_mobile, client_email, remark } = req.body;
  db.run(
    'UPDATE clients SET client_lastname = ?, client_surname = ?, client_address = ?, client_postcode = ?, client_mobile = ?, client_email = ?, remark = ? WHERE client_ID = ?',
    [client_lastname, client_surname, client_address, client_postcode, client_mobile, client_email, remark, req.params.id],
    (err) => {
      if (err) throw err;
      res.redirect(`/clients/${req.params.id}`);
    }
  );
});

// Delete a client
router.post('/:id/delete', (req, res) => {
  db.run('DELETE FROM clients WHERE client_id = ?', [req.params.id], (err) => {
    if (err) throw err;
    res.redirect('/clients');
  });
});

module.exports = router;