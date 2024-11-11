// Import required modules
const express = require('express');
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

// Cache to prevent duplicate emails within a short time frame
const emailCache = new Set();
const CACHE_EXPIRY_MS = 60000; // 1 minute

// Function to send email notification
const sendEmail = async (recipientEmail, teamName) => {
  try {
    await transporter.sendMail({
      from: EMAIL_USERNAME,
      to: recipientEmail,
      subject: 'Laget ditt er registrert i Mythic Trials',
      html: `
        <p>Hei,</p>
        <p>Ditt lag "<strong>${teamName}</strong>" er blitt registrert. Du kan oppdatere informasjon om laget ditt og få discord invitasjon for laget her: <a href="https://trials.nl-wow.no/min-side" target="_blank">https://trials.nl-wow.no/min-side</a> </p>
        <p>Vi ønsker deg lykke til i turneringen!</p>
        <p>Hilsen,</p>
        <p>Mythic Trials teamet i Nerdelandslaget WoW</p>
      `,
    });
    console.log(`Email sent to ${recipientEmail} for team ${teamName}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

// Function to handle Supabase changes
const handleSupabaseChange = async (payload) => {
  const { new: newRow } = payload;
  
  // Check for `approved_in_sanity` change and avoid duplicate emails
  if (newRow.approved_in_sanity) {
    const cacheKey = `${newRow.contact_person}-${newRow.name}`;

    // Skip if email was sent recently
    if (emailCache.has(cacheKey)) {
      console.log(`Duplicate email prevented for ${newRow.name} (${newRow.contact_person})`);
      return;
    }

    // Send email and add to cache
    await sendEmail(newRow.contact_person, newRow.name);
    emailCache.add(cacheKey);

    // Remove cache entry after expiry time to allow future notifications if necessary
    setTimeout(() => {
      emailCache.delete(cacheKey);
    }, CACHE_EXPIRY_MS);
  }
};

// Start listening to Supabase changes
(async () => {
  await supabase
    .channel('pick_ban')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams' }, handleSupabaseChange)
    .subscribe();
  console.log('Listening for team approval changes...');
})();

// Create Express app to keep the server active
const app = express();
const PORT = process.env.PORT || 8080;

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});