#!/usr/bin/env node

const DevSMTPServer = require('./smtp-server');

console.log('🚀 Starting OnDottedLine Development SMTP Server...');
console.log('');

const smtpServer = new DevSMTPServer();
smtpServer.start();

console.log('');
console.log('📧 SMTP Server Configuration:');
console.log('   Host: localhost');
console.log('   Port: 1025');
console.log('   Security: None (development only)');
console.log('');
console.log('🌐 Web Interface:');
console.log('   URL: http://localhost:8025');
console.log('   Features: View emails, clear mailbox, real-time updates');
console.log('');
console.log('🔧 Usage in your application:');
console.log('   Configure nodemailer with host: localhost, port: 1025');
console.log('');
console.log('Press Ctrl+C to stop the server');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down SMTP server...');
  smtpServer.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down SMTP server...');
  smtpServer.stop();
  process.exit(0);
});
