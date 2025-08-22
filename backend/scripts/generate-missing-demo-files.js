#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const PDFDocument = require('pdfkit');
const db = require('../models/database');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Demo documents that should exist but are missing files
const missingDemoFiles = [
  {
    filename: 'demo_contract_001.pdf',
    title: 'Demo Contract',
    content: `DEMONSTRATION CONTRACT

This is a sample contract document for demonstration purposes.

AGREEMENT DETAILS:
- Party A: Demo Company Inc.
- Party B: Client Corporation
- Effective Date: ${new Date().toLocaleDateString()}
- Duration: 12 months

TERMS AND CONDITIONS:
1. Service delivery will commence upon signature
2. Payment terms: Net 30 days
3. Both parties agree to maintain confidentiality

SIGNATURES REQUIRED:
__________________    __________________
Party A Signature     Party B Signature

Date: ____________    Date: ____________

This document contains ${Math.floor(Math.random() * 50) + 100} important clauses.`
  },
  {
    filename: 'demo_nda_002.pdf',
    title: 'Demo NDA',
    content: `NON-DISCLOSURE AGREEMENT

CONFIDENTIALITY AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into on ${new Date().toLocaleDateString()}.

PARTIES:
- Disclosing Party: Demo Company Inc.
- Receiving Party: [TO BE FILLED]

CONFIDENTIAL INFORMATION:
The Receiving Party agrees to maintain confidentiality of all proprietary information shared.

OBLIGATIONS:
1. Non-disclosure of confidential information
2. Non-use except for evaluation purposes
3. Return of materials upon request

TERM: This agreement remains in effect for 5 years.

SIGNATURES:
__________________    __________________
Disclosing Party      Receiving Party

Date: ____________    Date: ____________`
  },
  {
    filename: 'demo_agreement_003.pdf',
    title: 'Demo Agreement',
    content: `SERVICE AGREEMENT

PROFESSIONAL SERVICES AGREEMENT

Agreement Date: ${new Date().toLocaleDateString()}

SERVICE PROVIDER: Demo Services LLC
CLIENT: [TO BE FILLED]

SCOPE OF WORK:
- Consulting services as detailed in Exhibit A
- Project timeline: 6 months
- Deliverables as specified

COMPENSATION:
- Total project value: $50,000
- Payment schedule: Monthly invoicing
- Expenses reimbursed separately

TERMS:
1. Work begins upon execution
2. Client approval required for major changes
3. Intellectual property remains with provider

SIGNATURES:
__________________    __________________
Service Provider      Client

Date: ____________    Date: ____________`
  },
  {
    filename: 'demo_invoice_004.pdf',
    title: 'Demo Invoice',
    content: `INVOICE

INVOICE #: INV-2025-001
Date: ${new Date().toLocaleDateString()}
Due Date: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}

BILL TO:
Client Company
123 Business Street
City, State 12345

FROM:
Demo Services LLC
456 Service Avenue
Business City, BC 67890

DESCRIPTION                    QTY    RATE      AMOUNT
Consulting Services - Jan      40     $150      $6,000.00
Document Review               10     $100      $1,000.00
Travel Expenses               1      $500      $500.00

                              SUBTOTAL:        $7,500.00
                              TAX (8%):        $600.00
                              TOTAL:           $8,100.00

PAYMENT TERMS: Net 30 days
Please remit payment within 30 days of invoice date.

Thank you for your business!`
  },
  {
    filename: 'demo_completed_005.pdf',
    title: 'Demo Completed Document',
    content: `COMPLETED AGREEMENT

STATUS: FULLY EXECUTED ✓

This document has been completed and signed by all parties.

EXECUTION DETAILS:
- Document Type: Service Agreement
- Completion Date: ${new Date().toLocaleDateString()}
- Parties: Demo Company & Client Corp
- Witness: John Doe, Notary Public

SIGNATURES COMPLETED:
✓ Party A: John Smith (Signed: ${new Date().toLocaleDateString()})
✓ Party B: Jane Johnson (Signed: ${new Date().toLocaleDateString()})
✓ Witness: John Doe (Signed: ${new Date().toLocaleDateString()})

DOCUMENT HASH: 5f7c8d9e2a1b3c4d5e6f7a8b9c0d1e2f
VERIFICATION CODE: ABC-123-XYZ

This document is legally binding and has been digitally secured.

All parties have received executed copies.`
  },
  {
    filename: 'demo_signed_006.pdf',
    title: 'Demo Signed Contract',
    content: `EXECUTED CONTRACT

FINAL EXECUTED VERSION

Contract Number: DEMO-2025-001
Execution Date: ${new Date().toLocaleDateString()}

This contract has been fully executed by all required parties.

SIGNATORY INFORMATION:
1. Primary Signatory: Alice Brown
   - Title: CEO, Demo Company
   - Signature Date: ${new Date().toLocaleDateString()}
   - IP Address: 192.168.1.100
   - Device: Chrome Browser

2. Secondary Signatory: Bob Wilson
   - Title: Director, Client Corp
   - Signature Date: ${new Date().toLocaleDateString()}
   - IP Address: 10.0.0.25
   - Device: Safari Browser

AUDIT TRAIL:
- Document created: ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
- Sent for signature: ${new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toLocaleDateString()}
- First signature: ${new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString()}
- Final signature: ${new Date().toLocaleDateString()}

Document Status: COMPLETE ✓`
  }
];

async function generatePDF(filename, title, content) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      resolve(pdfBuffer);
    });
    doc.on('error', reject);

    // Add title
    doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(2);

    // Add content
    doc.fontSize(10).font('Helvetica').text(content, {
      align: 'left',
      lineGap: 2
    });

    // Add footer with filename and timestamp
    doc.moveDown(3);
    doc.fontSize(8).text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
    doc.text(`File: ${filename}`, { align: 'center' });

    doc.end();
  });
}

async function generateMissingDemoFiles() {
  try {
    console.log('📄 Generating missing demo PDF files...');

    // Ensure uploads directory exists
    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    let generatedCount = 0;

    for (const demoFile of missingDemoFiles) {
      const filePath = path.join(UPLOADS_DIR, demoFile.filename);
      
      try {
        // Check if file already exists
        await fs.access(filePath);
        console.log(`⏭️  Skipping ${demoFile.filename} (already exists)`);
        continue;
      } catch (error) {
        // File doesn't exist, generate it
      }

      const pdfBuffer = await generatePDF(demoFile.filename, demoFile.title, demoFile.content);
      await fs.writeFile(filePath, pdfBuffer);
      
      console.log(`✅ Generated ${demoFile.title} (${demoFile.filename})`);
      generatedCount++;
    }

    console.log(`✅ Generated ${generatedCount} missing demo PDF files successfully!`);

  } catch (error) {
    console.error('❌ Error generating demo files:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  generateMissingDemoFiles()
    .then(() => {
      console.log('Demo file generation completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Demo file generation failed:', error);
      process.exit(1);
    });
}

module.exports = { generateMissingDemoFiles };
