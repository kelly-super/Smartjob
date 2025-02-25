const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', async (req, res) => {
    try {
        // Get processing jobs
        const processingJobs = await new Promise((resolve, reject) => {
            db.all(`
                SELECT j.*, c.client_lastname, c.client_surname
                FROM jobs j
                LEFT JOIN clients c ON j.client_id = c.client_id
                WHERE j.job_status = 'in_progress'
                ORDER BY j.job_startdate DESC
                LIMIT 5
            `, [], (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });

        // Get monthly order expenses
        const orderExpenses = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    strftime('%Y-%m', order_date) as month,
                    SUM(order_amount) as total
                FROM orders
                WHERE order_date >= date('now', '-11 months')
                GROUP BY month
                ORDER BY month
            `, [], (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });

        // Get monthly job income
        const jobIncome = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    strftime('%Y-%m', job_createdate) as month,
                    SUM(CAST(job_price AS FLOAT)) as total
                FROM jobs
                WHERE job_createdate >= date('now', '-11 months')
                GROUP BY month
                ORDER BY month
            `, [], (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });

        // Transform data for chart
        const months = Array.from({ length: 12 }, (_, i) => {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            return date.toISOString().slice(0, 7);
        }).reverse();

        const chartData = {
            labels: months,
            expenses: months.map(month => {
                const record = orderExpenses.find(r => r.month === month);
                return record ? record.total : 0;
            }),
            income: months.map(month => {
                const record = jobIncome.find(r => r.month === month);
                return record ? record.total : 0;
            })
        };

        res.render('partials/layout', {
            title: 'Dashboard',
            body: '../dashboard/index',
            processingJobs,
            orderExpenses,
            jobIncome
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).send('Error loading dashboard');
    }
});

module.exports = router;