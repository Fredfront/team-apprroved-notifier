// Import required modules
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const EMAIL_USERNAME = process.env.EMAIL_USERNAME;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !EMAIL_USERNAME || !EMAIL_PASSWORD) {
  console.error('Missing environment variables');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Create Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: 'send.one.com',
  port: 465,
  tls: { ciphers: 'SSLv3', rejectUnauthorized: false },
  auth: { user: EMAIL_USERNAME, pass: EMAIL_PASSWORD },
});

// Function to send email notification
const sendEmail = async (recipientEmail, teamName) => {
  try {
    await transporter.sendMail({
      from: EMAIL_USERNAME,
      to: recipientEmail,
      subject: 'Laget ditt er registrert i Mythic Trials',
      html: `
        <p>Hei,</p>
        <p>Ditt lag "<strong>${teamName}</strong>" er blitt registrert. Du kan oppdatere informasjon om laget ditt og medlemmene her: <a href="https://trials.nl-wow.no/min-side" target="_blank">https://trials.nl-wow.no/min-side</a> </p>
        <p>Hilsen,</p>
        <p>Mythic Trials teamet i Nerdelandslaget WoW</p>
      `,
    });
    console.log(`Email sent to ${recipientEmail} for team ${teamName}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

// Start listening to Supabase changes
(async () => {
  await supabase
    .channel('pick_ban')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams' }, (payload) => {
      const { new: newRow } = payload;
      if (newRow.approved_in_sanity) {
        sendEmail(newRow.contact_person, newRow.name);
      }
    })
    .subscribe();
  console.log('Listening for team approval changes...');
})();