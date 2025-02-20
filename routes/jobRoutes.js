// routes/jobRoutes.js
const express = require('express');
const db = require('../database');
const router = express.Router();
 
// Create a new job (Form)
router.get('/new', (req, res) => {
  db.all('SELECT * FROM clients', (err, clients) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Internal Server Error');
    }
  res.render('partials/layout', { title: 'New Job', body: '../jobs/new' ,clients: clients});
  });
});

// Create a new job (Submit)
router.post('/', (req, res) => {
  const { job_category, client_ID, user_ID,client_name, contact, details, price, status, create_date, complete_date } = req.body;
  db.run(
    'INSERT INTO jobs (job_category, client_ID, user_ID, client_name, contact, details, price, status, create_date, complete_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [job_category, client_ID,user_ID, client_name, contact, details, price, status, create_date, complete_date],
    (err) => {
      if (err) throw err;
      res.redirect('/jobs');
    }
  );
});

// Read all jobs
router.get('/', (req, res) => {
  db.all("SELECT * FROM jobs", [], (err, jobs) => {
    if (err) {
        res.status(500).send("Error fetching jobs");
    } else {
        // Render the `index.ejs` file and pass the `body` variable
        res.render('partials/layout', { 
            title: 'Jobs', 
            body: '../jobs/index', // Pass the path to the content file
            jobs: jobs 
        });
    }
});
});

// Read a single job
router.get('/:id', (req, res) => {
  db.get('SELECT * FROM jobs WHERE job_id = ?', [req.params.id], (err, job) => {
    if (err) throw err;
    res.render('partials/layout', { title: 'Job Details', body: '../jobs/show', job: job });
});
});

// Update a job (Form)
router.get('/:id/edit', (req, res) => {
  db.get('SELECT * FROM jobs WHERE job_id = ?', [req.params.id], (err, job) => {
    if (err) throw err;
    res.render('partials/layout', { title: 'Edit Job', body: '../jobs/edit', job: job });
});
});

// Update a job (Submit)
router.post('/:id', (req, res) => {
  const { jobCategory, jobDescription, jobPrice, jobStatus, jobStartDate, jobNotes } = req.body;
  db.run(
      'UPDATE jobs SET job_category = ?, job_description = ?, job_price = ?, job_status = ?, job_startdate = ?, job_notes = ? WHERE job_id = ?',
      [jobCategory, jobDescription, jobPrice, jobStatus, jobStartDate, jobNotes, req.params.id],
      (err) => {
          if (err) throw err;
          res.redirect(`/jobs/${req.params.id}`);
      }
  );
});

// Delete a job
router.post('/:id/delete', (req, res) => {
  db.run('DELETE FROM jobs WHERE job_ID = ?', [req.params.id], (err) => {
    if (err) throw err;
    res.redirect('/jobs');
  });
});

module.exports = router;