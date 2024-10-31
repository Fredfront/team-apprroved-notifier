// Import required modules
const express = require('express');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// Environment variables
require('dotenv').config();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ;
const username = process.env.EMAIL_USERNAME;
const password = process.env.EMAIL_PASSWORD;

if(!SUPABASE_URL || !SUPABASE_ANON_KEY || !username || !password) {
  console.error('Missing environment variables');
  process.exit(1);
}
// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Create Express app
const app = express();
const PORT = 8080;

app.use(express.json());

// Create Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: 'send.one.com',
  port: 465,
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false,
  },
  auth: {
    user: username,
    pass: password,
  },
});

// Function to send email notification
const sendEmail = async (recipientEmail, teamName) => {
  try {
    await transporter.sendMail({
      from: username,
      to: recipientEmail,
      subject: 'Laget ditt er registrert i Mythic Trials',
      html: `
        <p>Hei,</p>
        <p>Ditt lag "<strong>${teamName}</strong>" er blitt registrert. Du kan oppdatere infoformasjonen om laget ditt og medlemmene her: <a href="https://trials.nl-wow.no/min-side" target="_blank">https://trials.nl-wow.no/min-side</a> </p>
        <p>Hilsen,</p>
        <p>Mythic Trials teamet i Nerdelandslaget WoW</p>
      `,
    });
    console.log(`Email sent to ${recipientEmail} for team ${teamName}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};
let isListeningInitialized = false;

// Start listening to Supabase changes
const startListening = async () => {
  if (isListeningInitialized) return; // Prevent multiple listeners
  isListeningInitialized = true;

  await supabase
    .channel('pick_ban')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams' }, (payload) => {
      const { new: newRow } = payload;
      if (newRow.approved_in_sanity === true) {
        sendEmail(newRow.contact_person, newRow.name);
      }
    })
    .subscribe();
  console.log('Listening for team approval changes...');
};

// Automatically start listening when the server starts
startListening();

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
