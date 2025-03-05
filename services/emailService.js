const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const transporter = nodemailer.createTransport({
    host: process.env.MAILTRAP_HOST || 'sandbox.smtp.mailtrap.io',
    port: parseInt(process.env.MAILTRAP_PORT || '2525'),
    secure: false,
    auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASS
    },
    debug: true
});

// Verify configuration before attempting to send
transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP Configuration Error:', error);
    } else {
        console.log('SMTP Server is ready to send emails');
    }
});

async function sendQuoteEmail(quote, pdfPath, recipientEmail) {
    if (!process.env.MAILTRAP_USER || !process.env.MAILTRAP_PASS) {
        throw new Error('Email credentials not configured');
    }

    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || 'quotes@smartjob.com',
            to: recipientEmail,
            subject: `Quote #${quote.quote_number}`,
            html: `
                <h2>Quote Details</h2>
                <p>Dear ${quote.client_name},</p>
                <p>Please find attached your quote #${quote.quote_number}.</p>

                <p>If you have any questions, please don't hesitate to contact us.</p>
                <p>Thank you for choosing our services!</p>
            `,
            attachments: [{
                filename: `quote-${quote.quote_number}.pdf`,
                path: pdfPath
            }]
        });

        console.log('Email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email sending error:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { sendQuoteEmail };