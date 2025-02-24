const express = require('express');
const db = require('../database');
const router = express.Router();

// Get all jobs with search functionality
router.get('/', (req, res) => {
    const { client_id, job_address, dateFrom, dateTo } = req.query;
    let query = `
        SELECT j.*, c.client_lastname, c.client_surname
        FROM jobs j
        LEFT JOIN clients c ON j.client_id = c.client_id
        WHERE 1=1
    `;
    const params = [];

    if (client_id) {
        query += ' AND j.client_id = ?';
        params.push(client_id);
    }
    if (job_address) {
        query += ' AND j.job_address LIKE ?';
        params.push(`%${job_address}%`);
    }
    if (dateFrom) {
        query += ' AND j.job_createdate >= ?';
        params.push(dateFrom);
    }
    if (dateTo) {
        query += ' AND j.job_createdate <= ?';
        params.push(dateTo);
    }

    query += ' ORDER BY j.job_createdate DESC';

    // Get clients for the filter dropdown
    db.all('SELECT client_id, client_lastname, client_surname FROM clients', [], (err, clients) => {
        if (err) {
            console.error('Error fetching clients:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Get jobs with filters
        db.all(query, params, (err, jobs) => {
            if (err) {
                console.error('Error fetching jobs:', err);
                return res.status(500).send('Internal Server Error');
            }

            res.render('partials/layout', { 
                title: 'Jobs', 
                body: '../jobs/index',
                jobs,
                clients,
                query: req.query
            });
        });
    });
});

// Show new job form
router.get('/new', (req, res) => {
    db.all('SELECT client_id, client_lastname, client_surname FROM clients', [], (err, clients) => {
        if (err) {
            console.error('Error fetching clients:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.render('partials/layout', { 
            title: 'New Job', 
            body: '../jobs/new',
            clients 
        });
    });
});

// Create new job
router.post('/create', (req, res) => {
    const { 
        client_id, 
        quote_id,
        job_category,
        job_description,
        job_address,
        job_price,
        job_status,
        job_startdate,
        job_inspectiondate,
        job_completedate,
        job_notes
    } = req.body;

    db.run(`
        INSERT INTO jobs (
            client_id,
            quote_id,
            job_category,
            job_description,
            job_address,
            job_price,
            job_status,
            job_startdate,
            job_inspectiondate,
            job_completedate,
            job_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        client_id,
        quote_id || null,
        job_category,
        job_description,
        job_address,
        job_price,
        job_status || 'pending',
        job_startdate || null,
        job_inspectiondate || null,
        job_completedate || null,
        job_notes
    ], function(err) {
        if (err) {
            console.error('Error creating job:', err);
            return res.json({ success: false, message: 'Error creating job' });
        }
        res.json({ success: true, jobId: this.lastID });
    });
});

// Show job details
router.get('/:id', (req, res) => {
    db.get(`
        SELECT j.*, c.client_lastname, c.client_surname, c.client_mobile, c.client_email,
               q.quote_id, q.quote_price
        FROM jobs j
        LEFT JOIN clients c ON j.client_id = c.client_id
        LEFT JOIN quotes q ON j.quote_id = q.quote_id
        WHERE j.job_id = ?
    `, [req.params.id], (err, job) => {
        if (err || !job) {
            console.error('Error fetching job:', err);
            return res.redirect('/jobs');
        }
        res.render('partials/layout', { 
            title: `Job #${job.job_id}`, 
            body: '../jobs/show',
            job
        });
    });
});

// Show edit form
router.get('/:id/edit', (req, res) => {
    db.get(`
        SELECT j.*, c.client_lastname, c.client_surname, c.client_mobile, c.client_email
        FROM jobs j
        LEFT JOIN clients c ON j.client_id = c.client_id
        WHERE j.job_id = ?
    `, [req.params.id], (err, job) => {
        if (err || !job) {
            console.error('Error fetching job:', err);
            return res.redirect('/jobs');
        }
        res.render('partials/layout', { 
            title: 'Edit Job', 
            body: '../jobs/edit',
            job
        });
    });
});

// Update job
router.post('/:id/edit', (req, res) => {
    const jobId = req.params.id;
    const {
        job_category,
        job_description,
        job_address,
        job_price,
        job_status,
        job_startdate,
        job_inspectiondate,
        job_completedate,
        job_notes
    } = req.body;

    db.run(`
        UPDATE jobs 
        SET job_category = ?,
            job_description = ?,
            job_address = ?,
            job_price = ?,
            job_status = ?,
            job_startdate = ?,
            job_inspectiondate = ?,
            job_completedate = ?,
            job_notes = ?
        WHERE job_id = ?
    `, [
        job_category,
        job_description,
        job_address,
        job_price,
        job_status,
        job_startdate || null,
        job_inspectiondate || null,
        job_completedate || null,
        job_notes,
        jobId
    ], (err) => {
        if (err) {
            console.error('Error updating job:', err);
            return res.json({ success: false, message: 'Error updating job' });
        }
        res.json({ success: true, jobId });
    });
});

// Delete job
router.post('/:id/delete', (req, res) => {
    db.run('DELETE FROM jobs WHERE job_id = ?', [req.params.id], (err) => {
        if (err) {
            console.error('Error deleting job:', err);
            return res.json({ success: false, message: 'Error deleting job' });
        }
        res.json({ success: true });
    });
});

module.exports = router;