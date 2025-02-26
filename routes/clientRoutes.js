const express = require('express');
const db = require('../database');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse');
const fs = require('fs');

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `clients-${Date.now()}.csv`);
    }
});

const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        console.log('Multer processing file:', file);
        if (file.mimetype === 'text/csv') {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    }
});

// Validation middleware
const validateClient = (req, res, next) => {
    const { client_lastname, client_mobile, client_email } = req.body;

    if (!client_lastname) {
        return res.status(400).json({ 
            success: false, 
            message: 'Last name is required' 
        });
    }

    if (client_email && !client_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid email format' 
        });
    }

    if (client_mobile && !client_mobile.match(/^[0-9+\s-]*$/)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid mobile number format' 
        });
    }

    next();
};

// Separate validation for CSV imports
const validateCsvClient = (client) => {
    const errors = [];
    
    if (!client.client_lastname) {
        errors.push(`Missing last name in row`);
    }
    
    // Optional validations
    if (client.client_email && !client.client_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        errors.push(`Invalid email format: ${client.client_email}`);
    }
    
    if (client.client_mobile && !client.client_mobile.match(/^[0-9+\s-]*$/)) {
        errors.push(`Invalid mobile format: ${client.client_mobile}`);
    }
    
    return errors;
};

// Move this route to the top, before other routes
router.get('/search', async (req, res) => {
    const searchTerm = req.query.term;
    console.log('Search term received:', searchTerm);

    if (!searchTerm || searchTerm.length < 2) {
        return res.json([]);
    }

    try {
        const clients = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    client_id,
                    client_lastname,
                    client_surname,
                    client_mobile,
                    client_address,
                    client_email
                FROM clients
                WHERE (
                    client_lastname LIKE ? OR 
                    client_surname LIKE ? OR 
                    client_mobile LIKE ?
                )
                AND status = 'Valid'
                LIMIT 10
            `, [
                `%${searchTerm}%`,
                `%${searchTerm}%`,
                `%${searchTerm}%`
            ], (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });

        console.log('Search results:', clients.length, 'clients found');
        return res.json(clients);
    } catch (err) {
        console.error('Search error:', err);
        return res.status(500).json({ error: 'Error searching clients' });
    }
});

// Get all clients with search
router.get('/', async (req, res) => {
    const { name, mobile, address, status } = req.query;
    let query = `
        SELECT * FROM clients 
        WHERE 1=1
    `;
    const params = [];

    if (name) {
        query += ` AND (client_lastname LIKE ? OR client_surname LIKE ?)`;
        params.push(`%${name}%`, `%${name}%`);
    }
    if (mobile) {
        query += ` AND client_mobile LIKE ?`;
        params.push(`%${mobile}%`);
    }
    if (address) {
        query += ` AND (client_address LIKE ? OR client_postcode LIKE ?)`;
        params.push(`%${address}%`, `%${address}%`);
    }
    if (status) {
        query += ` AND status = ?`;
        params.push(status);
    }

    query += ` ORDER BY client_lastname, client_surname`;

    try {
        const clients = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });

        res.render('partials/layout', {
            title: 'Clients',
            body: '../clients/index',
            clients,
            query: req.query
        });
    } catch (err) {
        console.error('Error fetching clients:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Show new client form
router.get('/new', (req, res) => {
    res.render('partials/layout', { 
        title: 'New Client', 
        body: '../clients/new' 
    });
});

// Create new client
router.post('/', validateClient, async (req, res) => {
    const { 
        client_lastname, 
        client_surname, 
        client_address, 
        client_postcode, 
        client_mobile, 
        client_email, 
        remark 
    } = req.body;

    try {
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO clients (
                    client_lastname, 
                    client_surname, 
                    client_address, 
                    client_postcode, 
                    client_mobile, 
                    client_email, 
                    remark,
                    create_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                client_lastname,
                client_surname,
                client_address,
                client_postcode,
                client_mobile,
                client_email,
                remark
            ], function(err) {
                if (err) reject(err);
                resolve(this.lastID);
            });
        });

        req.flash('success_msg', 'Client created successfully');
        res.redirect('/clients');
    } catch (err) {
        console.error('Error creating client:', err);
        req.flash('error_msg', 'Error creating client');
        res.redirect('/clients/new');
    }
});

// Get single client
router.get('/:id', async (req, res) => {
    try {
        const client = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM clients WHERE client_id = ?', [req.params.id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!client) {
            req.flash('error_msg', 'Client not found');
            return res.redirect('/clients');
        }

        res.render('partials/layout', {
            title: 'Client Details',
            body: '../clients/show',
            clientObj: client
        });
    } catch (err) {
        console.error('Error fetching client:', err);
        res.status(500).send('Database error');
    }
});

// Show edit form
router.get('/:id/edit', async (req, res) => {
    try {
        const client = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM clients WHERE client_id = ?', [req.params.id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!client) {
            req.flash('error_msg', 'Client not found');
            return res.redirect('/clients');
        }

        res.render('partials/layout', {
            title: 'Edit Client',
            body: '../clients/edit',
            clientObj: client
        });
    } catch (err) {
        console.error('Error fetching client:', err);
        res.status(500).send('Database error');
    }
});

// Update client
router.post('/:id', validateClient, async (req, res) => {
    const { 
        client_lastname, 
        client_surname, 
        client_address, 
        client_postcode, 
        client_mobile, 
        client_email, 
        remark 
    } = req.body;

    try {
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE clients 
                SET client_lastname = ?, 
                    client_surname = ?, 
                    client_address = ?, 
                    client_postcode = ?, 
                    client_mobile = ?, 
                    client_email = ?, 
                    remark = ?,
                    update_date = CURRENT_TIMESTAMP
                WHERE client_id = ?
            `, [
                client_lastname,
                client_surname,
                client_address,
                client_postcode,
                client_mobile,
                client_email,
                remark,
                req.params.id
            ], function(err) {
                if (err) reject(err);
                resolve(this.changes);
            });
        });

        req.flash('success_msg', 'Client updated successfully');
        res.redirect(`/clients/${req.params.id}`);
    } catch (err) {
        console.error('Error updating client:', err);
        req.flash('error_msg', 'Error updating client');
        res.redirect(`/clients/${req.params.id}/edit`);
    }
});

// Delete client
router.post('/:id/delete', async (req, res) => {
    try {
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM clients WHERE client_id = ?', [req.params.id], function(err) {
                if (err) reject(err);
                resolve(this.changes);
            });
        });

        res.json({ 
            success: true, 
            message: 'Client deleted successfully' 
        });
    } catch (err) {
        console.error('Error deleting client:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting client' 
        });
    }
});

// Update the import route to use validateCsvClient
router.post('/import', upload.single('clientsFile'), async (req, res) => {
    console.log('Importing clients:', req.file);
    if (!req.file) {
        req.flash('error_msg', 'Please select a file to import');
        return res.redirect('/clients');
    }

    try {
        const results = [];
        const errors = [];
        let successCount = 0;

        await new Promise((resolve, reject) => {
            fs.createReadStream(req.file.path)
                .pipe(parse({
                    columns: true,
                    skip_empty_lines: true,
                    trim: true
                }))
                .on('data', (data) => results.push(data))
                .on('end', resolve)
                .on('error', reject);
        });

        // Validate and import each row
        for (const [index, client] of results.entries()) {
            // Use validateCsvClient here
            const validationErrors = validateCsvClient(client);
            
            if (validationErrors.length > 0) {
                errors.push(`Row ${index + 2}: ${validationErrors.join(', ')}`);
                continue;
            }

            try {
                await new Promise((resolve, reject) => {
                    db.run(`
                        INSERT INTO clients (
                            client_lastname,
                            client_surname,
                            client_mobile,
                            client_email,
                            client_address,
                            client_postcode,
                            remark,
                            create_date,
                            status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'Valid')
                    `, [
                        client.client_lastname,
                        client.client_surname || null,
                        client.client_mobile || null,
                        client.client_email || null,
                        client.client_address || null,
                        client.client_postcode || null,
                        client.remark || null
                    ], (err) => {
                        if (err) reject(err);
                        resolve();
                    });
                });
                successCount++;
            } catch (err) {
                errors.push(`Row ${index + 2}: Database error`);
                console.error('Import row error:', err);
            }
        }

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        if (errors.length > 0) {
            req.flash('warning_msg', 
                `Imported ${successCount} clients. ${errors.length} errors occurred. Check the console for details.`);
            console.log('Import errors:', errors);
        } else {
            req.flash('success_msg', `Successfully imported ${successCount} clients`);
        }
        
        res.redirect('/clients');

    } catch (err) {
        console.error('Import error:', err);
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        req.flash('error_msg', 'Error importing clients');
        res.redirect('/clients');
    }
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
    ];

    const example = [
        'Smith',
        'John',
        '0412345678',
        'john.smith@example.com',
        '123 Main St',
        '2000',
        'Example client'
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=clients-template.csv');
    res.send(headers.join(',') + '\n' + example.join(','));
});

module.exports = router;